/**
 * Rule Engine - Main entry point for linting and fix application.
 */

import type { GraphState } from '../core/graph.js';
import { applyPatch } from '../core/applyPatch.js';
import type { Patch, PatchOp, UpdateNodeOp } from '../types/patch.js';
import type {
  Rule,
  RuleViolation,
  Fix,
  LintScope,
  LintResult,
} from './types.js';
import { expandScope, stableHash } from './utils.js';

// =============================================================================
// Rule Registry
// =============================================================================

/**
 * Global registry of all rules.
 */
const RULE_REGISTRY: Rule[] = [];

/**
 * Register a rule with the engine.
 */
export function registerRule(rule: Rule): void {
  // Check for duplicate ID
  if (RULE_REGISTRY.some((r) => r.id === rule.id)) {
    throw new Error(`Rule with ID "${rule.id}" is already registered`);
  }
  RULE_REGISTRY.push(rule);
}

/**
 * Get a rule by ID.
 */
export function getRuleById(id: string): Rule | undefined {
  return RULE_REGISTRY.find((r) => r.id === id);
}

/**
 * Get all registered rules.
 */
export function getAllRules(): Rule[] {
  return [...RULE_REGISTRY];
}

/**
 * Clear all registered rules (for testing).
 */
export function clearRules(): void {
  RULE_REGISTRY.length = 0;
}

// =============================================================================
// Lint Function
// =============================================================================

/**
 * Run all rules against the graph and return violations.
 *
 * @param graph - The graph to lint
 * @param scope - What portion of the graph to check
 * @param rules - Optional subset of rules to run (defaults to all registered)
 * @returns LintResult with violations, fixes, and summary
 */
export function lint(
  graph: GraphState,
  scope: LintScope,
  rules?: Rule[]
): LintResult {
  const rulesToRun = rules ?? RULE_REGISTRY;

  // Expand scope if in 'touched' mode
  const expandedScope = expandScope(graph, scope);

  // Collect all violations
  const violations: RuleViolation[] = [];

  for (const rule of rulesToRun) {
    try {
      const ruleViolations = rule.evaluate(graph, expandedScope);
      violations.push(...ruleViolations);
    } catch (error) {
      // Log but don't fail the entire lint
      console.error(`Rule "${rule.id}" threw an error:`, error);
    }
  }

  // Generate fixes for violations that have fix generators
  const fixes = generateFixes(graph, violations, rulesToRun);

  // Calculate summary
  const errorCount = violations.filter((v) => v.severity === 'hard').length;
  const warningCount = violations.filter((v) => v.severity === 'soft').length;

  const result: LintResult = {
    violations,
    fixes,
    errorCount,
    warningCount,
    hasBlockingErrors: errorCount > 0,
    lastCheckedAt: new Date().toISOString(),
  };

  // Only add scopeTruncated if it's true
  if (expandedScope.truncated) {
    result.scopeTruncated = true;
  }

  return result;
}

// =============================================================================
// Fix Generation
// =============================================================================

/**
 * Generate fixes for violations that have fix generators.
 */
export function generateFixes(
  graph: GraphState,
  violations: RuleViolation[],
  rules?: Rule[]
): Fix[] {
  const rulesToUse = rules ?? RULE_REGISTRY;
  const fixes: Fix[] = [];

  for (const violation of violations) {
    const rule = rulesToUse.find((r) => r.id === violation.ruleId);
    if (!rule || !rule.suggestFix) continue;

    try {
      const fix = rule.suggestFix(graph, violation);
      if (fix) {
        fixes.push(fix);
      }
    } catch (error) {
      // Log but don't fail fix generation
      console.error(`Fix generation for "${violation.ruleId}" threw an error:`, error);
    }
  }

  return fixes;
}

// =============================================================================
// Fix Application
// =============================================================================

/**
 * Apply a single fix to the graph.
 * Implements dry-run precondition: re-evaluates violation before applying.
 *
 * @param graph - Current graph state
 * @param fix - Fix to apply
 * @param rules - Rules to use for re-validation
 * @returns New graph state and whether fix was applied
 */
export function applyFix(
  graph: GraphState,
  fix: Fix,
  rules?: Rule[]
): { applied: boolean; newGraph: GraphState; skipReason?: string } {
  const rulesToUse = rules ?? RULE_REGISTRY;

  // Dry-run precondition: re-evaluate to check if violation still exists
  const rule = rulesToUse.find((r) => r.id === fix.violationRuleId);
  if (!rule) {
    return { applied: false, newGraph: graph, skipReason: 'Rule not found' };
  }

  // Check if the violation still exists
  const currentViolations = rule.evaluate(graph, { mode: 'full' });
  const violationExists = currentViolations.some((v) => v.id === fix.violationId);

  if (!violationExists) {
    return { applied: false, newGraph: graph, skipReason: 'Violation no longer exists (stale)' };
  }

  // Apply the fix patch
  try {
    const newGraph = applyPatch(graph, fix.patch);
    return { applied: true, newGraph };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { applied: false, newGraph: graph, skipReason: `Patch failed: ${message}` };
  }
}

/**
 * Apply multiple fixes in order with conflict detection.
 *
 * @param graph - Current graph state
 * @param fixes - Fixes to apply
 * @param rules - Rules to use for re-validation
 * @returns Result with applied/skipped fixes and new graph
 */
export function applyAllFixes(
  graph: GraphState,
  fixes: Fix[],
  rules?: Rule[]
): {
  applied: string[];
  skipped: string[];
  skipReasons: Record<string, string>;
  newGraph: GraphState;
} {
  // Topologically sort fixes by dependsOn (if specified)
  const sortedFixes = topologicalSortFixes(fixes);

  let currentGraph = graph;
  const applied: string[] = [];
  const skipped: string[] = [];
  const skipReasons: Record<string, string> = {};

  for (const fix of sortedFixes) {
    // Check if a dependency was skipped
    if (fix.dependsOn?.some((depId) => skipped.includes(depId))) {
      skipped.push(fix.id);
      skipReasons[fix.id] = 'Dependency was skipped';
      continue;
    }

    const result = applyFix(currentGraph, fix, rules);
    if (result.applied) {
      applied.push(fix.id);
      currentGraph = result.newGraph;
    } else {
      skipped.push(fix.id);
      if (result.skipReason) {
        skipReasons[fix.id] = result.skipReason;
      }
    }
  }

  return { applied, skipped, skipReasons, newGraph: currentGraph };
}

/**
 * Topologically sort fixes by dependsOn.
 * Fixes with no dependencies come first.
 */
function topologicalSortFixes(fixes: Fix[]): Fix[] {
  const fixMap = new Map(fixes.map((f) => [f.id, f]));
  const visited = new Set<string>();
  const result: Fix[] = [];

  function visit(fix: Fix): void {
    if (visited.has(fix.id)) return;
    visited.add(fix.id);

    // Visit dependencies first
    for (const depId of fix.dependsOn ?? []) {
      const dep = fixMap.get(depId);
      if (dep) {
        visit(dep);
      }
    }

    result.push(fix);
  }

  for (const fix of fixes) {
    visit(fix);
  }

  return result;
}

// =============================================================================
// Inverse Patch Generation
// =============================================================================

/**
 * Generate an inverse patch for undo functionality.
 * For UPDATE_NODE, swaps old and new values.
 * For ADD_NODE, generates DELETE_NODE.
 * For DELETE_NODE, would need stored node (not implemented here).
 */
export function generateInversePatch(
  graph: GraphState,
  patch: Patch
): Patch {
  const inverseOps: PatchOp[] = [];

  for (const op of patch.ops) {
    switch (op.op) {
      case 'UPDATE_NODE': {
        // Get current values to restore
        const node = graph.nodes.get(op.id);
        if (node) {
          const inverseSet: Record<string, unknown> = {};
          const nodeRecord = node as unknown as Record<string, unknown>;
          for (const key of Object.keys(op.set)) {
            inverseSet[key] = nodeRecord[key];
          }
          inverseOps.push({
            op: 'UPDATE_NODE',
            id: op.id,
            set: inverseSet,
          } as UpdateNodeOp);
        }
        break;
      }
      case 'ADD_NODE': {
        inverseOps.push({
          op: 'DELETE_NODE',
          id: op.node.id,
        });
        break;
      }
      case 'DELETE_NODE': {
        // For delete, we'd need to store the deleted node
        // This is a limitation - we can't fully invert deletes without stored data
        // For now, we skip (the fix should avoid DELETE_NODE if undo is needed)
        break;
      }
      case 'ADD_EDGE': {
        inverseOps.push({
          op: 'DELETE_EDGE',
          edge: { id: op.edge.id },
        });
        break;
      }
      case 'DELETE_EDGE': {
        // Similar to DELETE_NODE - would need stored edge data
        break;
      }
      case 'UPDATE_EDGE': {
        // Would need to store current edge properties
        break;
      }
      // UPSERT_EDGE and BATCH_EDGE are more complex
    }
  }

  return {
    type: 'Patch',
    id: `inverse_${patch.id}`,
    base_story_version_id: patch.base_story_version_id,
    created_at: new Date().toISOString(),
    ops: inverseOps,
    metadata: {
      source: 'inverse',
      originalPatchId: patch.id,
    },
  };
}

// =============================================================================
// Create Patch Helper
// =============================================================================

/**
 * Create a new Patch with a unique ID.
 */
export function createPatch(
  baseVersionId: string,
  ops: PatchOp[],
  metadata?: Record<string, unknown>
): Patch {
  const patchId = `patch_fix_${stableHash(JSON.stringify(ops))}`;
  const patch: Patch = {
    type: 'Patch',
    id: patchId,
    base_story_version_id: baseVersionId,
    created_at: new Date().toISOString(),
    ops,
  };

  if (metadata !== undefined) {
    patch.metadata = metadata;
  }

  return patch;
}
