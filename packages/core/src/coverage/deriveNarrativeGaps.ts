/**
 * Narrative gap derivation from graph state.
 *
 * Derives narrative gaps based on schema rules.
 * This replaces the OpenQuestion derivation with unified Gap output.
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType } from '../core/graph.js';
import type {
  Beat,
  Scene,
  Character,
  CharacterArc,
} from '../types/nodes.js';
import type { Gap } from './types.js';
import { NARRATIVE_GAP_CONFIG } from './types.js';

// =============================================================================
// Main Derivation Function
// =============================================================================

/**
 * Derive all narrative gaps from the current graph state.
 *
 * @param graph - The current graph state
 * @returns Array of derived Gaps (type: 'narrative')
 */
export function deriveNarrativeGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];

  // STRUCTURE domain
  gaps.push(...deriveBeatUnrealizedGaps(graph));
  gaps.push(...deriveActImbalanceGaps(graph));

  // SCENE domain
  gaps.push(...deriveSceneQualityGaps(graph));

  // CHARACTER domain
  gaps.push(...deriveCharacterGaps(graph));

  return gaps;
}

// =============================================================================
// STRUCTURE Domain
// =============================================================================

/**
 * Derive BeatUnrealized gaps.
 * Triggered when a Beat has no Scenes reachable through PlotPoints.
 *
 * Hierarchy: Beat ← ALIGNS_WITH ← PlotPoint ← SATISFIED_BY ← Scene
 * A Beat is "realized" when it has at least one Scene attached through this chain.
 */
function deriveBeatUnrealizedGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const config = NARRATIVE_GAP_CONFIG.BeatUnrealized;

  // Get all ALIGNS_WITH edges (PlotPoint → Beat)
  const alignsWithEdges = graph.edges.filter((e) => e.type === 'ALIGNS_WITH');
  // Get all SATISFIED_BY edges (PlotPoint → Scene)
  const satisfiedByEdges = graph.edges.filter((e) => e.type === 'SATISFIED_BY');

  for (const beat of beats) {
    // Find PlotPoints aligned to this Beat
    const plotPointIds = alignsWithEdges
      .filter((e) => e.to === beat.id)
      .map((e) => e.from);

    // Find Scenes attached to those PlotPoints
    const sceneCount = satisfiedByEdges.filter((e) =>
      plotPointIds.includes(e.from)
    ).length;

    if (sceneCount === 0) {
      // Check if there are PlotPoints but no Scenes (different message)
      const hasPlotPoints = plotPointIds.length > 0;
      const description = hasPlotPoints
        ? `Beat "${beat.beat_type}" has PlotPoints but no Scenes attached`
        : `Beat "${beat.beat_type}" has no PlotPoints or Scenes`;

      gaps.push({
        id: `gap_beat_${beat.id}`,
        type: config.type,
        tier: config.tier,
        title: `Beat Unrealized: ${beat.beat_type}`,
        description,
        scopeRefs: { nodeIds: [beat.id] },
        source: 'derived',
        status: 'open',
        domain: config.domain,
        groupKey: `STRUCTURE:BEAT:${beat.beat_type}`,
      });
    }
  }

  return gaps;
}

/**
 * Derive ActImbalance gaps.
 * Triggered when an act has no scenes while neighboring acts have content.
 *
 * Uses hierarchy: Beat ← ALIGNS_WITH ← PlotPoint ← SATISFIED_BY ← Scene
 */
function deriveActImbalanceGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const config = NARRATIVE_GAP_CONFIG.ActImbalance;

  // Get all ALIGNS_WITH edges (PlotPoint → Beat)
  const alignsWithEdges = graph.edges.filter((e) => e.type === 'ALIGNS_WITH');
  // Get all SATISFIED_BY edges (PlotPoint → Scene)
  const satisfiedByEdges = graph.edges.filter((e) => e.type === 'SATISFIED_BY');

  // Count scenes per act by traversing Beat → PlotPoint → Scene
  const scenesPerAct: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const beat of beats) {
    // Find PlotPoints aligned to this Beat
    const plotPointIds = alignsWithEdges
      .filter((e) => e.to === beat.id)
      .map((e) => e.from);

    // Count Scenes attached to those PlotPoints
    const sceneCount = satisfiedByEdges.filter((e) =>
      plotPointIds.includes(e.from)
    ).length;

    scenesPerAct[beat.act] = (scenesPerAct[beat.act] ?? 0) + sceneCount;
  }

  // Check for imbalance
  for (let act = 1; act <= 5; act++) {
    const prevAct = act > 1 ? (scenesPerAct[act - 1] ?? 0) : 0;
    const currentAct = scenesPerAct[act] ?? 0;
    const nextAct = act < 5 ? (scenesPerAct[act + 1] ?? 0) : 0;

    if (currentAct === 0 && (prevAct >= 2 || nextAct >= 2)) {
      gaps.push({
        id: `gap_act_${act}`,
        type: config.type,
        tier: config.tier,
        title: `Act Imbalance: Act ${act}`,
        description: `Act ${act} has no scenes while neighboring acts have content`,
        scopeRefs: {},
        source: 'derived',
        status: 'open',
        domain: config.domain,
        groupKey: `STRUCTURE:ACT:${act}`,
      });
    }
  }

  return gaps;
}

// =============================================================================
// SCENE Domain
// =============================================================================

/**
 * Derive scene quality gaps (SceneHasNoCast, SceneNeedsLocation).
 */
function deriveSceneQualityGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];
  const scenes = getNodesByType<Scene>(graph, 'Scene');

  for (const scene of scenes) {
    // Check for missing characters
    const characterEdges = graph.edges.filter(
      (e) => e.type === 'HAS_CHARACTER' && e.from === scene.id
    );
    if (characterEdges.length === 0) {
      const config = NARRATIVE_GAP_CONFIG.SceneHasNoCast;
      gaps.push({
        id: `gap_scene_cast_${scene.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Scene Has No Cast',
        description: `Scene "${scene.heading}" has no characters assigned`,
        scopeRefs: { nodeIds: [scene.id] },
        source: 'derived',
        status: 'open',
        domain: config.domain,
        groupKey: `SCENE:QUALITY:${scene.id}`,
      });
    }

    // Check for missing location
    const locationEdges = graph.edges.filter(
      (e) => e.type === 'LOCATED_AT' && e.from === scene.id
    );
    if (locationEdges.length === 0) {
      const config = NARRATIVE_GAP_CONFIG.SceneNeedsLocation;
      gaps.push({
        id: `gap_scene_loc_${scene.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Scene Needs Location',
        description: `Scene "${scene.heading}" has no location assigned`,
        scopeRefs: { nodeIds: [scene.id] },
        source: 'derived',
        status: 'open',
        domain: config.domain,
        groupKey: `SCENE:QUALITY:${scene.id}`,
      });
    }
  }

  return gaps;
}

// =============================================================================
// CHARACTER Domain
// =============================================================================

/**
 * Derive character-related gaps.
 */
function deriveCharacterGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];
  const characters = getNodesByType<Character>(graph, 'Character');

  for (const char of characters) {
    // Count scene appearances
    const appearances = graph.edges.filter(
      (e) => e.type === 'HAS_CHARACTER' && e.to === char.id
    ).length;

    // CharacterUnderspecified
    if (!char.description && appearances >= 2) {
      const config = NARRATIVE_GAP_CONFIG.CharacterUnderspecified;
      gaps.push({
        id: `gap_char_desc_${char.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Character Underspecified',
        description: `Character "${char.name}" appears in ${appearances} scenes but has no description`,
        scopeRefs: { nodeIds: [char.id] },
        source: 'derived',
        status: 'open',
        domain: config.domain,
        groupKey: `CHARACTER:DETAIL:${char.id}`,
      });
    }

    // MissingCharacterArc
    const hasArc = graph.edges.some(
      (e) => e.type === 'HAS_ARC' && e.from === char.id
    );
    if (!hasArc && appearances >= 3) {
      const config = NARRATIVE_GAP_CONFIG.MissingCharacterArc;
      gaps.push({
        id: `gap_char_arc_${char.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Missing Character Arc',
        description: `Character "${char.name}" appears in ${appearances} scenes but has no arc defined`,
        scopeRefs: { nodeIds: [char.id] },
        source: 'derived',
        status: 'open',
        domain: config.domain,
        groupKey: `CHARACTER:ARC:${char.id}`,
      });
    }
  }

  // ArcUngrounded
  const arcs = getNodesByType<CharacterArc>(graph, 'CharacterArc');
  for (const arc of arcs) {
    if (!arc.turn_refs || arc.turn_refs.length === 0) {
      const char = characters.find((c) => c.id === arc.character_id);
      const charName = char?.name ?? arc.character_id;
      const config = NARRATIVE_GAP_CONFIG.ArcUngrounded;
      gaps.push({
        id: `gap_arc_ungrounded_${arc.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Arc Ungrounded',
        description: `CharacterArc for "${charName}" has no turn references`,
        scopeRefs: { nodeIds: [arc.id] },
        source: 'derived',
        status: 'open',
        domain: config.domain,
        groupKey: `CHARACTER:ARC:${arc.character_id}`,
      });
    }
  }

  return gaps;
}


// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Filter gaps by domain.
 */
export function filterGapsByDomain(gaps: Gap[], domain: Gap['domain']): Gap[] {
  return gaps.filter((g) => g.domain === domain);
}

/**
 * Filter gaps by type.
 */
export function filterGapsByType(gaps: Gap[], type: Gap['type']): Gap[] {
  return gaps.filter((g) => g.type === type);
}

/**
 * Group gaps by groupKey.
 */
export function groupGapsByKey(gaps: Gap[]): Map<string, Gap[]> {
  const groups = new Map<string, Gap[]>();
  for (const gap of gaps) {
    if (gap.groupKey) {
      const existing = groups.get(gap.groupKey);
      if (existing) {
        existing.push(gap);
      } else {
        groups.set(gap.groupKey, [gap]);
      }
    }
  }
  return groups;
}

