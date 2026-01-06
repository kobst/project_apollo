/**
 * Coverage module public exports.
 *
 * Provides unified Gap model combining structural (rule violations) and
 * narrative (open questions) gaps for story completeness tracking.
 */

// Types
export type {
  GapType,
  GapTier,
  GapSeverity,
  GapSource,
  GapStatus,
  GapDomain,
  GapPhase,
  Gap,
  TierSummary,
  CoverageResponse,
  TierConfig,
  NarrativeGapConfig,
  NarrativeGapType,
} from './types.js';

export {
  TIER_CONFIG,
  TIER_ORDER,
  NARRATIVE_GAP_CONFIG,
  NARRATIVE_GAP_TYPES,
  GAP_DOMAINS,
  GAP_PHASES,
} from './types.js';

// Adapter
export { violationToGap, violationsToGaps } from './adapter.js';

// Compute
export { computeCoverage } from './compute.js';

// Narrative gap derivation
export {
  deriveNarrativeGaps,
  filterGapsByDomain,
  filterGapsBySeverity,
  filterGapsByPhase,
  filterGapsByType,
  groupGapsByKey,
  getBlockingGaps,
  hasBlockingGaps,
} from './deriveNarrativeGaps.js';
