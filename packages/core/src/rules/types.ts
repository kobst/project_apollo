/**
 * Rule Engine type definitions.
 * Defines rules, violations, fixes, and lint results for screenplay graph validation.
 */

import type { GraphState } from '../core/graph.js';
import type { Patch } from '../types/patch.js';

// =============================================================================
// Rule Severity and Categories
// =============================================================================

/**
 * Rule severity determines commit blocking behavior.
 * - 'hard': Blocks commit until fixed
 * - 'soft': Warning only, allows commit
 */
export type RuleSeverity = 'hard' | 'soft';

/**
 * Rule categories for grouping and filtering.
 */
export type RuleCategory =
  | 'structure'      // Beat/Scene ordering within containers
  | 'act_boundary'   // Cross-act validation
  | 'stc_ordering'   // Save The Cat beat sequence
  | 'completeness'   // Character/Location presence
  | 'orphan';        // Disconnected nodes (Theme/Motif not grounded)

// =============================================================================
// Rule Definition
// =============================================================================

/**
 * A single rule definition.
 */
export interface Rule {
  /** Unique rule identifier (e.g., 'SCENE_ORDER_UNIQUE') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Severity: 'hard' blocks commit, 'soft' is warning only */
  severity: RuleSeverity;
  /** Category for grouping */
  category: RuleCategory;
  /** Description of what this rule checks */
  description: string;

  /**
   * Evaluate the rule against the graph within the given scope.
   * Returns array of violations found.
   */
  evaluate: (graph: GraphState, scope: LintScope) => RuleViolation[];

  /**
   * Optional: Generate a fix patch for a given violation.
   * Returns null if no automatic fix is available.
   */
  suggestFix?: (graph: GraphState, violation: RuleViolation) => Fix | null;
}

// =============================================================================
// Lint Scope
// =============================================================================

/**
 * Defines what portion of the graph to lint.
 */
export interface LintScope {
  /** 'full' = entire graph, 'touched' = only touched nodes and their context */
  mode: 'full' | 'touched';
  /** For 'touched' mode: IDs of nodes that were directly edited */
  touchedNodeIds?: string[];
  /** For 'touched' mode: IDs of edges that were directly edited */
  touchedEdgeIds?: string[];
  /** Computed by expandScope(): includes incident edges and enclosing beat/act */
  expandedNodeIds?: string[];
  /** True if scope expansion was capped (guardrail hit) */
  truncated?: boolean;
}

// =============================================================================
// Rule Violation
// =============================================================================

/**
 * A single violation found by a rule.
 */
export interface RuleViolation {
  /** Stable ID: hash(ruleId + nodeId + JSON.stringify(context)) */
  id: string;
  /** Rule that found this violation */
  ruleId: string;
  /** Severity inherited from rule */
  severity: RuleSeverity;
  /** Category inherited from rule */
  category: RuleCategory;
  /** Human-readable message describing the violation */
  message: string;
  /** Primary node involved (if applicable) */
  nodeId?: string;
  /** Node type of the primary node */
  nodeType?: string;
  /** Specific field involved (if applicable) */
  field?: string;
  /** Related node IDs (e.g., duplicate scenes) */
  relatedNodeIds?: string[];
  /** Additional context data (rule-specific) */
  context?: Record<string, unknown>;
}

// =============================================================================
// Fix Definition
// =============================================================================

/**
 * A suggested fix with patch operations.
 */
export interface Fix {
  /** Deterministic ID: hash(violationId + fixType) */
  id: string;
  /** ID of the violation this fix addresses */
  violationId: string;
  /** Rule ID that generated the violation */
  violationRuleId: string;
  /** Short label for UI button (e.g., "Re-index scenes in this beat") */
  label: string;
  /** Longer description of what the fix does */
  description: string;
  /** Patch operations to apply */
  patch: Patch;
  /** Inverse patch for one-click undo */
  inversePatch: Patch;
  /** Node IDs that will be affected by this fix */
  affectedNodeIds: string[];
  /** Number of operations in the patch */
  operationCount: number;
  /** Fix IDs this depends on (for topological sorting) */
  dependsOn?: string[];
}

// =============================================================================
// Lint Result
// =============================================================================

/**
 * Result of running all rules.
 */
export interface LintResult {
  /** All violations found */
  violations: RuleViolation[];
  /** Available fixes for violations */
  fixes: Fix[];
  /** Count of hard rule violations */
  errorCount: number;
  /** Count of soft rule violations */
  warningCount: number;
  /** True if any hard rule violations exist (blocks commit) */
  hasBlockingErrors: boolean;
  /** True if scope was truncated due to guardrail */
  scopeTruncated?: boolean;
  /** ISO timestamp of when lint was performed */
  lastCheckedAt?: string;
}

// =============================================================================
// Apply Fix Result
// =============================================================================

/**
 * Result of applying fixes.
 */
export interface ApplyFixResult {
  /** Fix IDs that were successfully applied */
  applied: string[];
  /** Fix IDs that were skipped (stale, conflict, or filtered) */
  skipped: string[];
  /** Reasons for skipped fixes */
  skipReasons?: Record<string, string>;
  /** ID of the inverse patch for undo */
  inversePatchId: string;
  /** New story version ID after applying fixes */
  newVersionId: string;
  /** Re-lint result after applying fixes */
  revalidation: LintResult;
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum nodes/edges to include in scope expansion (guardrail) */
export const SCOPE_EXPANSION_LIMIT = 500;

/** Default debounce time for auto-lint in ms */
export const AUTO_LINT_DEBOUNCE_MS = 600;
