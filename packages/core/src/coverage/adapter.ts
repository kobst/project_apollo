/**
 * Adapter to convert RuleViolation to Gap.
 *
 * This adapter bridges the rule engine domain with the coverage domain,
 * mapping violations to the appropriate tier and extracting display information.
 */

import type { RuleViolation } from '../rules/types.js';
import type { Gap, GapTier, GapType } from './types.js';

// =============================================================================
// Rule to Tier Mapping
// =============================================================================

/**
 * Map rule IDs to their corresponding tier.
 */
const RULE_TO_TIER: Record<string, GapTier> = {
  // Foundations tier
  THEME_NOT_ORPHANED: 'foundations',
  MOTIF_NOT_ORPHANED: 'foundations',

  // Structure tier
  STC_BEAT_ORDERING: 'structure',
  SCENE_ACT_BOUNDARY: 'structure',

  // StoryBeats tier
  SB_EVENT_REALIZATION: 'storyBeats',
  SB_DAG_NO_CYCLES: 'storyBeats',
  SB_ACT_ALIGNMENT: 'storyBeats',

  // Scenes tier
  SCENE_HAS_CHARACTER: 'scenes',
  SCENE_HAS_LOCATION: 'scenes',
  SCENE_HAS_STORYBEAT: 'scenes',
  EDGE_ORDER_UNIQUE: 'scenes',
};

/**
 * Map node types to their corresponding tier.
 * Used as fallback when rule mapping doesn't exist.
 */
const NODE_TYPE_TO_TIER: Record<string, GapTier> = {
  Conflict: 'foundations',
  Theme: 'foundations',
  Motif: 'foundations',
  Character: 'foundations',
  CharacterArc: 'foundations',
  Beat: 'structure',
  StoryBeat: 'storyBeats',
  Scene: 'scenes',
  Location: 'scenes',
  Object: 'scenes',
};

/**
 * Human-readable labels for rule IDs.
 */
const RULE_LABELS: Record<string, string> = {
  // Foundations
  THEME_NOT_ORPHANED: 'Orphaned Theme',
  MOTIF_NOT_ORPHANED: 'Orphaned Motif',

  // Structure
  STC_BEAT_ORDERING: 'Beat Order Issue',
  SCENE_ACT_BOUNDARY: 'Scene Act Mismatch',

  // StoryBeats
  SB_EVENT_REALIZATION: 'Unrealized StoryBeat',
  SB_DAG_NO_CYCLES: 'StoryBeat Cycle Detected',
  SB_ACT_ALIGNMENT: 'StoryBeat Act Mismatch',

  // Scenes
  SCENE_HAS_CHARACTER: 'Scene Without Character',
  SCENE_HAS_LOCATION: 'Scene Without Location',
  SCENE_HAS_STORYBEAT: 'Unlinked Scene',
  EDGE_ORDER_UNIQUE: 'Duplicate Edge Order',
};

// =============================================================================
// Adapter Functions
// =============================================================================

/**
 * Convert a single RuleViolation to a Gap.
 *
 * All rule violations are converted to 'structural' gaps since they represent
 * issues that can be fixed with patches rather than creative decisions.
 */
export function violationToGap(violation: RuleViolation): Gap {
  // Determine tier from rule ID, falling back to node type
  let tier: GapTier = RULE_TO_TIER[violation.ruleId] ?? 'scenes';
  if (violation.nodeType) {
    const nodeTypeTier = NODE_TYPE_TO_TIER[violation.nodeType];
    if (nodeTypeTier) {
      tier = nodeTypeTier;
    }
  }

  // All rule violations are structural (fixable with patches)
  const type: GapType = 'structural';

  // Build title from rule label or formatted rule ID
  const title = RULE_LABELS[violation.ruleId] ?? formatRuleId(violation.ruleId);

  // Build scope refs
  const nodeIds: string[] = [];
  if (violation.nodeId) {
    nodeIds.push(violation.nodeId);
  }
  if (violation.relatedNodeIds) {
    nodeIds.push(...violation.relatedNodeIds);
  }

  // Build scopeRefs using spread to avoid setting undefined with exactOptionalPropertyTypes
  const scopeRefs: { nodeIds?: string[]; edgeIds?: string[] } = {};
  if (nodeIds.length > 0) {
    scopeRefs.nodeIds = nodeIds;
  }

  return {
    id: `gap_${violation.id}`,
    type,
    tier,
    title,
    description: violation.message,
    scopeRefs,
    source: 'rule-engine',
    status: 'open',
  };
}

/**
 * Convert multiple RuleViolations to Gaps.
 */
export function violationsToGaps(violations: RuleViolation[]): Gap[] {
  return violations.map(violationToGap);
}

/**
 * Format a rule ID into a human-readable label.
 * E.g., 'SCENE_ORDER_UNIQUE' -> 'Scene Order Unique'
 */
function formatRuleId(ruleId: string): string {
  return ruleId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
