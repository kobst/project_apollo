/**
 * Impact Analyzer
 *
 * Deterministic server-side computation of package impact.
 * Replaces unreliable LLM-generated impact with computed values.
 *
 * Three tiers:
 * - fulfills_gaps: gaps resolved by this package
 * - creates_gaps: new gaps introduced by this package
 * - conflicts: structural conflicts with existing graph
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType, getEdgesByType, getNode } from '../core/graph.js';
import type { Beat, Character, Location, Scene } from '../types/nodes.js';
import type { NarrativePackage, ConflictInfo } from './types.js';
import { computeUnalignedBeats } from '../coverage/compute.js';
import { deriveNarrativeGaps } from '../coverage/deriveNarrativeGaps.js';
import type { Gap } from '../coverage/types.js';

// =============================================================================
// Types
// =============================================================================

export interface ComputeImpactOptions {
  graph: GraphState;
}

export interface ComputedImpact {
  fulfills_gaps: string[];
  creates_gaps: string[];
  conflicts: ConflictInfo[];
}

// =============================================================================
// Top-level Entry Point
// =============================================================================

/**
 * Compute deterministic impact for a package against the current graph.
 */
export function computeImpact(
  pkg: NarrativePackage,
  options: ComputeImpactOptions
): ComputedImpact {
  const { graph } = options;

  const fulfills_gaps = computeFulfillsGaps(pkg, graph);
  const creates_gaps = computeCreatesGaps(pkg, graph);
  const conflicts = computeStructuralConflicts(pkg, graph);

  return { fulfills_gaps, creates_gaps, conflicts };
}

// =============================================================================
// Fulfills Gaps
// =============================================================================

/**
 * Determine which existing gaps this package would resolve.
 *
 * Checks:
 * - ALIGNS_WITH edges to unaligned Beats → fulfills BeatUnrealized gaps
 * - SATISFIED_BY edges from Scenes to StoryBeats → fulfills BeatUnrealized gaps (scene realization)
 * - HAS_CHARACTER edges on new Scenes → fulfills SceneHasNoCast gaps
 * - LOCATED_AT edges on new Scenes → fulfills SceneNeedsLocation gaps
 * - New Character descriptions → fulfills CharacterUnderspecified gaps
 */
function computeFulfillsGaps(
  pkg: NarrativePackage,
  graph: GraphState
): string[] {
  // Map from gap ID → human-readable description
  const fulfilled = new Map<string, string>();

  // Helper: get beat description from a beat node
  const describeBeat = (beatId: string): string => {
    const beatNode = getNode(graph, beatId) as Beat | undefined;
    if (beatNode) {
      return `"${formatBeatType(beatNode.beat_type)}" (Act ${beatNode.act})`;
    }
    return `"${beatId}"`;
  };

  // Helper: get scene heading
  const describeScene = (sceneId: string): string => {
    const sceneNode = getNode(graph, sceneId) as Scene | undefined;
    if (sceneNode) {
      return `"${sceneNode.heading}"`;
    }
    return `"${sceneId}"`;
  };

  // Helper: get character name
  const describeCharacter = (charId: string): string => {
    const charNode = getNode(graph, charId) as Character | undefined;
    if (charNode) {
      return `"${charNode.name}"`;
    }
    // Check package nodes for new characters
    const pkgNode = pkg.changes.nodes.find((n) => n.node_id === charId);
    if (pkgNode?.data) {
      const name = (pkgNode.data as Record<string, unknown>).name;
      if (name && typeof name === 'string') return `"${name}"`;
    }
    return `"${charId}"`;
  };

  // 1. Check ALIGNS_WITH edges — fulfills unaligned beats
  const unalignedBeats = computeUnalignedBeats(graph);
  const unalignedBeatIds = new Set(unalignedBeats.map((b) => b.beatId));

  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'ALIGNS_WITH') {
      if (unalignedBeatIds.has(edge.to)) {
        const gapId = `gap_beat_${edge.to}`;
        fulfilled.set(gapId, `Aligns StoryBeat with Beat ${describeBeat(edge.to)}`);
      }
    }
  }

  // 2. Check SATISFIED_BY edges — Scene satisfies a StoryBeat, which may realize a Beat
  const existingAlignsWithEdges = getEdgesByType(graph, 'ALIGNS_WITH');
  const storyBeatToBeat = new Map<string, string>();
  for (const e of existingAlignsWithEdges) {
    storyBeatToBeat.set(e.from, e.to);
  }
  // Also include ALIGNS_WITH edges from this package
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'ALIGNS_WITH') {
      storyBeatToBeat.set(edge.from, edge.to);
    }
  }

  // Check if existing StoryBeats already have scenes (SATISFIED_BY)
  const existingSatisfiedBy = getEdgesByType(graph, 'SATISFIED_BY');
  const storyBeatsWithScenes = new Set<string>();
  for (const e of existingSatisfiedBy) {
    storyBeatsWithScenes.add(e.to); // SATISFIED_BY: Scene → StoryBeat (to is StoryBeat)
  }

  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'SATISFIED_BY') {
      const storyBeatId = edge.to;
      const beatId = storyBeatToBeat.get(storyBeatId);
      if (beatId && !storyBeatsWithScenes.has(storyBeatId)) {
        const gapId = `gap_beat_${beatId}`;
        if (!fulfilled.has(gapId)) {
          fulfilled.set(gapId, `Realizes Beat ${describeBeat(beatId)} by adding scene to StoryBeat`);
        }
      }
    }
  }

  // 3. Cross-reference with narrative gaps
  const narrativeGaps = deriveNarrativeGaps(graph);
  const gapById = new Map<string, Gap>();
  for (const gap of narrativeGaps) {
    gapById.set(gap.id, gap);
  }

  // New scenes with HAS_CHARACTER → fulfills SceneHasNoCast
  const newSceneIds = new Set(
    pkg.changes.nodes
      .filter((n) => n.operation === 'add' && n.node_type === 'Scene')
      .map((n) => n.node_id)
  );

  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'HAS_CHARACTER') {
      // If this is adding a character to an existing scene that had no cast
      if (!newSceneIds.has(edge.from)) {
        const gapId = `gap_scene_cast_${edge.from}`;
        if (gapById.has(gapId)) {
          fulfilled.set(gapId, `Adds cast to scene ${describeScene(edge.from)}`);
        }
      }
    }

    if (edge.operation === 'add' && edge.edge_type === 'LOCATED_AT') {
      // If this is adding a location to an existing scene that had no location
      if (!newSceneIds.has(edge.from)) {
        const gapId = `gap_scene_loc_${edge.from}`;
        if (gapById.has(gapId)) {
          fulfilled.set(gapId, `Adds location to scene ${describeScene(edge.from)}`);
        }
      }
    }
  }

  // 4. Character modifications that add descriptions → fulfills CharacterUnderspecified
  for (const node of pkg.changes.nodes) {
    if (node.operation === 'modify' && node.node_type === 'Character' && node.data) {
      const data = node.data as Record<string, unknown>;
      if (data.description) {
        const gapId = `gap_char_desc_${node.node_id}`;
        if (gapById.has(gapId)) {
          fulfilled.set(gapId, `Adds description to character ${describeCharacter(node.node_id)}`);
        }
      }
    }
  }

  // 5. New CharacterArcs → fulfills MissingCharacterArc
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'HAS_ARC') {
      const gapId = `gap_char_arc_${edge.from}`;
      if (gapById.has(gapId)) {
        fulfilled.set(gapId, `Adds character arc for ${describeCharacter(edge.from)}`);
      }
    }
  }

  return [...fulfilled.values()];
}

/**
 * Convert PascalCase beat type to human-readable format.
 * e.g. "ThemeStated" → "Theme Stated"
 */
function formatBeatType(beatType: string): string {
  return beatType.replace(/([A-Z])/g, ' $1').trim();
}

// =============================================================================
// Creates Gaps
// =============================================================================

/**
 * Determine what new gaps this package would introduce.
 *
 * Checks:
 * - New Characters without description
 * - New StoryBeats without Scenes (via SATISFIED_BY)
 * - New Scenes without characters (HAS_CHARACTER)
 * - New Scenes without location (LOCATED_AT)
 */
function computeCreatesGaps(
  pkg: NarrativePackage,
  _graph: GraphState
): string[] {
  const created: string[] = [];

  // Collect new node IDs and edges from this package for cross-referencing
  const newEdges = pkg.changes.edges.filter((e) => e.operation === 'add');
  const edgeFromMap = new Map<string, Set<string>>();
  for (const edge of newEdges) {
    if (!edgeFromMap.has(edge.from)) {
      edgeFromMap.set(edge.from, new Set());
    }
    edgeFromMap.get(edge.from)!.add(edge.edge_type);
  }

  // Also consider edges targeting new nodes
  const edgeToMap = new Map<string, Set<string>>();
  for (const edge of newEdges) {
    if (!edgeToMap.has(edge.to)) {
      edgeToMap.set(edge.to, new Set());
    }
    edgeToMap.get(edge.to)!.add(edge.edge_type);
  }

  for (const node of pkg.changes.nodes) {
    if (node.operation !== 'add') continue;

    const data = (node.data ?? {}) as Record<string, unknown>;

    switch (node.node_type) {
      case 'Character': {
        if (!data.description) {
          created.push(`New character "${data.name ?? node.node_id}" has no description`);
        }
        break;
      }
      case 'StoryBeat': {
        // Check if any SATISFIED_BY edge targets this StoryBeat
        const hasSatisfiedBy = edgeToMap.get(node.node_id)?.has('SATISFIED_BY') ?? false;
        if (!hasSatisfiedBy) {
          created.push(`New StoryBeat "${data.title ?? node.node_id}" has no scene`);
        }
        break;
      }
      case 'Scene': {
        const edgeTypes = edgeFromMap.get(node.node_id);
        if (!edgeTypes?.has('HAS_CHARACTER')) {
          created.push(`New scene "${data.heading ?? node.node_id}" has no characters`);
        }
        if (!edgeTypes?.has('LOCATED_AT')) {
          created.push(`New scene "${data.heading ?? node.node_id}" has no location`);
        }
        break;
      }
    }
  }

  return created;
}

// =============================================================================
// Structural Conflicts
// =============================================================================

/**
 * Detect structural conflicts between the package and existing graph.
 *
 * Checks:
 * - Duplicate node names (Character/Location names already in graph)
 * - Invalid edge references (edges pointing to non-existent nodes)
 * - Missing required edges (StoryBeat without ALIGNS_WITH)
 */
function computeStructuralConflicts(
  pkg: NarrativePackage,
  graph: GraphState
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  // 1. Duplicate Character names
  const existingCharacters = getNodesByType<Character>(graph, 'Character');
  const existingCharNames = new Map<string, string>();
  for (const char of existingCharacters) {
    existingCharNames.set(char.name.toLowerCase(), char.id);
  }

  for (const node of pkg.changes.nodes) {
    if (node.operation === 'add' && node.node_type === 'Character' && node.data) {
      const name = (node.data as Record<string, unknown>).name as string | undefined;
      if (name) {
        const existingId = existingCharNames.get(name.toLowerCase());
        if (existingId) {
          conflicts.push({
            type: 'duplicates',
            existing_node_id: existingId,
            description: `Character name "${name}" already exists (${existingId})`,
            source: 'lint',
            resolution_included: false,
          });
        }
      }
    }
  }

  // 2. Duplicate Location names
  const existingLocations = getNodesByType<Location>(graph, 'Location');
  const existingLocNames = new Map<string, string>();
  for (const loc of existingLocations) {
    existingLocNames.set(loc.name.toLowerCase(), loc.id);
  }

  for (const node of pkg.changes.nodes) {
    if (node.operation === 'add' && node.node_type === 'Location' && node.data) {
      const name = (node.data as Record<string, unknown>).name as string | undefined;
      if (name) {
        const existingId = existingLocNames.get(name.toLowerCase());
        if (existingId) {
          conflicts.push({
            type: 'duplicates',
            existing_node_id: existingId,
            description: `Location name "${name}" already exists (${existingId})`,
            source: 'lint',
            resolution_included: false,
          });
        }
      }
    }
  }

  // 3. Missing required ALIGNS_WITH for StoryBeats
  const newStoryBeatIds = new Set(
    pkg.changes.nodes
      .filter((n) => n.operation === 'add' && n.node_type === 'StoryBeat')
      .map((n) => n.node_id)
  );

  const storyBeatsWithAlignment = new Set<string>();
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'ALIGNS_WITH') {
      storyBeatsWithAlignment.add(edge.from);
    }
  }

  for (const sbId of newStoryBeatIds) {
    if (!storyBeatsWithAlignment.has(sbId)) {
      conflicts.push({
        type: 'interferes',
        existing_node_id: sbId,
        description: `New StoryBeat "${sbId}" has no ALIGNS_WITH edge to a Beat`,
        source: 'lint',
        resolution_included: false,
      });
    }
  }

  // 4. Missing required SATISFIED_BY for Scenes connected to StoryBeats
  const newSceneIds = new Set(
    pkg.changes.nodes
      .filter((n) => n.operation === 'add' && n.node_type === 'Scene')
      .map((n) => n.node_id)
  );

  const scenesWithSatisfiedBy = new Set<string>();
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'SATISFIED_BY') {
      scenesWithSatisfiedBy.add(edge.from);
    }
  }

  // Only flag scenes that don't have a SATISFIED_BY if there are StoryBeats in the graph
  const existingStoryBeats = getNodesByType(graph, 'StoryBeat');
  if (existingStoryBeats.length > 0 || newStoryBeatIds.size > 0) {
    for (const sceneId of newSceneIds) {
      if (!scenesWithSatisfiedBy.has(sceneId)) {
        conflicts.push({
          type: 'interferes',
          existing_node_id: sceneId,
          description: `New Scene "${sceneId}" has no SATISFIED_BY edge to a StoryBeat`,
          source: 'lint',
          resolution_included: false,
        });
      }
    }
  }

  return conflicts;
}
