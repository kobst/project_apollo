/**
 * Coverage computation logic.
 *
 * Computes story coverage across five tiers by running lint rules, deriving
 * structural gaps from graph analysis, and narrative gaps from schema rules.
 */

import type { GraphState } from '../core/graph.js';
import {
  getNodesByType,
  getNodeCountByType,
  getEdgesByType,
} from '../core/graph.js';
import { lint, registerHardRules, registerSoftRules } from '../rules/index.js';
import type { LintScope } from '../rules/types.js';
import type { Beat, StoryBeat, Scene } from '../types/nodes.js';
import { BEAT_POSITION_MAP } from '../types/nodes.js';
import type {
  TierSummary,
  CoverageResponse,
  Gap,
  GapTier,
  MissingBeatInfo,
} from './types.js';
import { TIER_ORDER } from './types.js';
import { violationsToGaps } from './adapter.js';
import { deriveNarrativeGaps } from './deriveNarrativeGaps.js';

// =============================================================================
// Constants
// =============================================================================

/** Expected number of STC beats */
const EXPECTED_BEATS = 15;

/** Foundation node types that we track */
const FOUNDATION_TYPES = [
  'Setting',
  'GenreTone',
  'Character',
  'Location',
  'Object',
] as const;

// =============================================================================
// Main Compute Function
// =============================================================================

/**
 * Compute coverage for a story graph.
 *
 * @param graph - The story graph to analyze
 * @returns Coverage response with tier summaries and gaps
 */
export function computeCoverage(graph: GraphState): CoverageResponse {
  // Ensure rules are registered
  registerHardRules();
  registerSoftRules();

  // Run lint to get violations
  const scope: LintScope = { mode: 'full' };
  const lintResult = lint(graph, scope);

  // Convert violations to gaps (structural)
  const gaps = violationsToGaps(lintResult.violations);

  // Add derived structural gaps (missing beats, foundations)
  gaps.push(...computeDerivedGaps(graph));

  // Add narrative gaps (from OQ derivation logic)
  gaps.push(...deriveNarrativeGaps(graph));

  // Compute tier summaries
  const summary = computeTierSummaries(graph, gaps);

  return { summary, gaps };
}

// =============================================================================
// Tier Summary Computation
// =============================================================================

/**
 * Compute summaries for all tiers.
 */
function computeTierSummaries(graph: GraphState, gaps: Gap[]): TierSummary[] {
  // Count open gaps per tier
  const gapCountByTier = new Map<GapTier, number>();
  for (const gap of gaps) {
    if (gap.status === 'open') {
      gapCountByTier.set(gap.tier, (gapCountByTier.get(gap.tier) ?? 0) + 1);
    }
  }

  return TIER_ORDER.map((tier) => {
    switch (tier) {
      case 'premise':
        return computePremiseTier(graph);
      case 'foundations':
        return computeFoundationsTier(graph);
      case 'structure':
        return computeStructureTier(graph);
      case 'storyBeats':
        return computeStoryBeatsTier(graph);
      case 'scenes':
        return computeScenesTier(graph);
    }
  });
}

/**
 * Compute Premise tier summary.
 * Coverage: 1 if Logline node exists, 0 otherwise.
 */
function computePremiseTier(graph: GraphState): TierSummary {
  const hasLogline = getNodeCountByType(graph, 'Logline') > 0;

  return {
    tier: 'premise',
    label: 'Logline',
    covered: hasLogline ? 1 : 0,
    total: 1,
    percent: hasLogline ? 100 : 0,
  };
}

/**
 * Compute Foundations tier summary.
 * Coverage: Count of present foundation node types out of 5.
 */
function computeFoundationsTier(graph: GraphState): TierSummary {
  let covered = 0;

  for (const type of FOUNDATION_TYPES) {
    if (getNodeCountByType(graph, type) > 0) {
      covered++;
    }
  }

  const total = FOUNDATION_TYPES.length;

  return {
    tier: 'foundations',
    label: 'Foundations',
    covered,
    total,
    percent: Math.round((covered / total) * 100),
  };
}

/**
 * Compute Structure tier summary.
 * Coverage: Count of distinct beat_types present out of 15 expected.
 */
function computeStructureTier(graph: GraphState): TierSummary {
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const coveredBeatTypes = new Set(beats.map((b) => b.beat_type));
  const covered = coveredBeatTypes.size;

  return {
    tier: 'structure',
    label: 'Structure',
    covered,
    total: EXPECTED_BEATS,
    percent: Math.round((covered / EXPECTED_BEATS) * 100),
  };
}

/**
 * Compute StoryBeats tier summary.
 * Coverage: StoryBeats with SATISFIED_BY edges / expected minimum.
 * Expected minimum = number of beats (at least one story beat per beat).
 * Active = proposed or approved (excludes deprecated).
 */
function computeStoryBeatsTier(graph: GraphState): TierSummary {
  const storyBeats = getNodesByType<StoryBeat>(graph, 'StoryBeat');
  // Active story beats = not deprecated (proposed or approved)
  const activeSBs = storyBeats.filter((sb) => sb.status !== 'deprecated');

  // Get the number of beats to determine minimum expected story beats
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const numBeats = beats.length;

  // Expected minimum: at least one story beat per beat, or EXPECTED_BEATS if no beats yet
  const expectedMin = numBeats > 0 ? numBeats : EXPECTED_BEATS;

  // Total is the greater of existing active SBs or expected minimum
  const total = Math.max(activeSBs.length, expectedMin);

  // If no active story beats, show 0/expectedMin
  if (activeSBs.length === 0) {
    return {
      tier: 'storyBeats',
      label: 'Story Beats',
      covered: 0,
      total,
      percent: 0,
    };
  }

  // Count story beats that have at least one SATISFIED_BY edge (linked to a scene)
  const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');
  const satisfiedSBIds = new Set(satisfiedByEdges.map((e) => e.to));

  const covered = activeSBs.filter((sb) => satisfiedSBIds.has(sb.id)).length;

  return {
    tier: 'storyBeats',
    label: 'Story Beats',
    covered,
    total,
    percent: Math.round((covered / total) * 100),
  };
}

/**
 * Compute Scenes tier summary.
 * Coverage: Scenes with both HAS_CHARACTER and LOCATED_AT edges / expected minimum.
 * Expected minimum = max(beats, plot points) - need enough scenes to cover both.
 */
function computeScenesTier(graph: GraphState): TierSummary {
  const scenes = getNodesByType<Scene>(graph, 'Scene');

  // Get the number of beats
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const numBeats = beats.length > 0 ? beats.length : EXPECTED_BEATS;

  // Get the number of active story beats
  const storyBeats = getNodesByType<StoryBeat>(graph, 'StoryBeat');
  const numActiveSBs = storyBeats.filter((sb) => sb.status !== 'deprecated').length;

  // Expected minimum: the greater of beats or story beats
  // (need at least one scene per beat, and at least one scene per story beat)
  const expectedMin = Math.max(numBeats, numActiveSBs);

  // Total is the greater of existing scenes or expected minimum
  const total = Math.max(scenes.length, expectedMin);

  // If no scenes, show 0/expectedMin
  if (scenes.length === 0) {
    return {
      tier: 'scenes',
      label: 'Scenes',
      covered: 0,
      total,
      percent: 0,
    };
  }

  // Get all HAS_CHARACTER and LOCATED_AT edges
  const hasCharacterEdges = getEdgesByType(graph, 'HAS_CHARACTER');
  const locatedAtEdges = getEdgesByType(graph, 'LOCATED_AT');

  const scenesWithCharacter = new Set(hasCharacterEdges.map((e) => e.from));
  const scenesWithLocation = new Set(locatedAtEdges.map((e) => e.from));

  // Scene is "complete" if it has both character and location
  let covered = 0;
  for (const scene of scenes) {
    if (scenesWithCharacter.has(scene.id) && scenesWithLocation.has(scene.id)) {
      covered++;
    }
  }

  return {
    tier: 'scenes',
    label: 'Scenes',
    covered,
    total,
    percent: Math.round((covered / total) * 100),
  };
}

// =============================================================================
// Derived Gaps
// =============================================================================

/**
 * Compute derived gaps that aren't covered by lint rules.
 */
function computeDerivedGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];

  // Check for missing STC beats
  gaps.push(...computeMissingBeatGaps(graph));

  // Check for missing foundation types
  gaps.push(...computeMissingFoundationGaps(graph));

  return gaps;
}

/**
 * Compute gaps for missing STC beat types.
 */
function computeMissingBeatGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const existingBeatTypes = new Set(beats.map((b) => b.beat_type));

  for (const beatType of Object.keys(BEAT_POSITION_MAP)) {
    if (!existingBeatTypes.has(beatType as Beat['beat_type'])) {
      gaps.push({
        id: `derived_missing_beat_${beatType}`,
        type: 'structural',
        tier: 'structure',
        title: `Missing Beat: ${formatBeatType(beatType)}`,
        description: `The "${formatBeatType(beatType)}" beat is not yet defined in the story structure.`,
        scopeRefs: {},
        source: 'derived',
        status: 'open',
      });
    }
  }

  return gaps;
}

/**
 * Compute gaps for missing foundation node types.
 */
function computeMissingFoundationGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];

  for (const type of FOUNDATION_TYPES) {
    if (getNodeCountByType(graph, type) === 0) {
      gaps.push({
        id: `derived_missing_${type.toLowerCase()}`,
        type: 'structural',
        tier: 'foundations',
        title: `Missing ${type}`,
        description: `No ${type} node has been created yet.`,
        scopeRefs: {},
        source: 'derived',
        status: 'open',
      });
    }
  }

  return gaps;
}

/**
 * Format a beat type for display.
 * E.g., 'BreakIntoTwo' -> 'Break Into Two'
 */
function formatBeatType(beatType: string): string {
  return beatType.replace(/([A-Z])/g, ' $1').trim();
}

// =============================================================================
// Unaligned Beats (for StoryBeat generation)
// =============================================================================

/**
 * Compute beats that have no ALIGNS_WITH edges from StoryBeats.
 * These represent structural gaps that need StoryBeat coverage.
 *
 * @param graph - The story graph to analyze
 * @returns Array of MissingBeatInfo for beats without StoryBeat alignment
 */
export function computeUnalignedBeats(graph: GraphState): MissingBeatInfo[] {
  const beats = getNodesByType<Beat>(graph, 'Beat');

  // Get all ALIGNS_WITH edges (StoryBeat → Beat)
  const alignsWithEdges = getEdgesByType(graph, 'ALIGNS_WITH');

  // Create set of beat IDs that have at least one StoryBeat aligned
  const alignedBeatIds = new Set<string>();
  for (const edge of alignsWithEdges) {
    // ALIGNS_WITH goes from StoryBeat to Beat, so edge.to is the Beat ID
    alignedBeatIds.add(edge.to);
  }

  // Find beats that are not in the aligned set
  const unalignedBeats: MissingBeatInfo[] = [];
  for (const beat of beats) {
    if (!alignedBeatIds.has(beat.id)) {
      unalignedBeats.push({
        beatId: beat.id,
        beatType: beat.beat_type,
        act: beat.act,
        position: beat.position_index,
      });
    }
  }

  // Sort by position for consistent ordering
  unalignedBeats.sort((a, b) => a.position - b.position);

  return unalignedBeats;
}
