/**
 * Entity Mention Tracking System
 * 
 * Tracks references to Characters, Locations, and Objects in text content.
 * Enables:
 * - Name change propagation
 * - Temporal/continuity validation
 * - Impact analysis
 * 
 * See docs/MENTIONS_EDGE_SPEC.md for full specification.
 */

export { extractMentions, type MentionMatch, type EntityInfo } from './extraction.js';
export { 
  computeIntroductionPoints,
  validateTemporalConsistency,
  validateProposalMentions,
  type TemporalViolation,
  type IntroductionMap
} from './validation.js';
export {
  rebuildMentionsForNode,
  rebuildAllMentions,
  removeMentionsFromNode,
  type MentionRebuildResult
} from './rebuild.js';
export {
  renameEntity,
  type RenameResult
} from './rename.js';
export {
  EXTRACTABLE_FIELDS,
  getBeatOrder,
  type BeatOrder
} from './utils.js';
