/**
 * Rule Engine public exports.
 */

// Types
export type {
  RuleSeverity,
  RuleCategory,
  Rule,
  LintScope,
  RuleViolation,
  Fix,
  LintResult,
  ApplyFixResult,
} from './types.js';

export {
  SCOPE_EXPANSION_LIMIT,
  AUTO_LINT_DEBOUNCE_MS,
} from './types.js';

// Utilities
export {
  stableHash,
  generateViolationId,
  generateFixId,
  getActForBeat,
  getActForBeatId,
  getPositionForBeat,
  getScenesByBeat,
  getBeatForScene,
  getBeatsByAct,
  getScenesByAct,
  expandScope,
  isNodeInScope,
  getBeatsInScope,
  getScenesInScope,
  sortScenesForReindex,
  createViolation,
  // Edge ordering helpers
  PARENT_IS_TARGET_EDGE_TYPES,
  getEdgeParentId,
  getEdgeChildId,
  isParentSource,
  getEdgesGroupedByParent,
  getEdgesForParent,
  sortEdgesForReindex,
} from './utils.js';

// Engine
export {
  registerRule,
  getRuleById,
  getAllRules,
  clearRules,
  lint,
  generateFixes,
  applyFix,
  applyAllFixes,
  generateInversePatch,
  createPatch,
} from './engine.js';

// Hard Rules
export {
  SCENE_ORDER_UNIQUE,
  SCENE_ACT_BOUNDARY,
  STC_BEAT_ORDERING,
  EDGE_ORDER_UNIQUE,
  HARD_RULES,
  registerHardRules,
} from './hardRules.js';

// Soft Rules
export {
  SCENE_HAS_CHARACTER,
  SCENE_HAS_LOCATION,
  THEME_NOT_ORPHANED,
  MOTIF_NOT_ORPHANED,
  SOFT_RULES,
  registerSoftRules,
} from './softRules.js';
