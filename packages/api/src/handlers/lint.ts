/**
 * Lint handlers - Run linting and apply fixes
 */

import type { Request, Response, NextFunction } from 'express';
import {
  lint,
  applyAllFixes,
  getRuleById,
  getAllRules,
  registerHardRules,
  registerSoftRules,
  type LintScope,
  type Fix,
  type RuleCategory,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  deserializeGraph,
  updateGraphById,
} from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

// =============================================================================
// Types
// =============================================================================

interface LintRequest {
  scope?: 'full' | 'touched';
  touchedNodeIds?: string[];
  touchedEdgeIds?: string[];
}

interface LintViolationData {
  id: string;
  ruleId: string;
  severity: 'hard' | 'soft';
  category: string;
  message: string;
  nodeId?: string;
  nodeType?: string;
  relatedNodeIds?: string[];
}

interface LintFixData {
  id: string;
  violationId: string;
  ruleId: string;
  label: string;
  description: string;
  affectedNodeIds: string[];
  operationCount: number;
}

interface LintResponseData {
  violations: LintViolationData[];
  fixes: LintFixData[];
  summary: {
    errorCount: number;
    warningCount: number;
    hasBlockingErrors: boolean;
    scopeTruncated?: boolean;
  };
  lastCheckedAt: string;
}

interface ApplyFixRequest {
  fixIds?: string[];
  applyAll?: boolean;
  categories?: RuleCategory[];
}

interface ApplyFixResponseData {
  applied: string[];
  skipped: string[];
  skipReasons: Record<string, string>;
  newVersionId: string;
  revalidation: {
    errorCount: number;
    warningCount: number;
    hasBlockingErrors: boolean;
  };
}

// =============================================================================
// Rule Initialization
// =============================================================================

let rulesInitialized = false;

function ensureRulesRegistered(): void {
  if (rulesInitialized) return;
  registerHardRules();
  registerSoftRules();
  rulesInitialized = true;
}

// =============================================================================
// Lint Handler
// =============================================================================

/**
 * POST /stories/:id/lint - Run linting on the story graph
 */
export function createLintHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, LintRequest>,
    res: Response<APIResponse<LintResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      ensureRulesRegistered();

      const { id } = req.params;
      const { scope = 'full', touchedNodeIds, touchedEdgeIds } = req.body;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Build lint scope
      const lintScope: LintScope = {
        mode: scope,
      };

      if (scope === 'touched') {
        if (touchedNodeIds) {
          lintScope.touchedNodeIds = touchedNodeIds;
        }
        if (touchedEdgeIds) {
          lintScope.touchedEdgeIds = touchedEdgeIds;
        }
      }

      // Run lint
      const result = lint(graph, lintScope);

      // Transform violations for response
      const violations: LintViolationData[] = result.violations.map((v) => {
        const data: LintViolationData = {
          id: v.id,
          ruleId: v.ruleId,
          severity: v.severity,
          category: v.category,
          message: v.message,
        };
        if (v.nodeId !== undefined) data.nodeId = v.nodeId;
        if (v.nodeType !== undefined) data.nodeType = v.nodeType;
        if (v.relatedNodeIds !== undefined) data.relatedNodeIds = v.relatedNodeIds;
        return data;
      });

      // Transform fixes for response (without full patch data)
      const fixes: LintFixData[] = result.fixes.map((f) => ({
        id: f.id,
        violationId: f.violationId,
        ruleId: f.violationRuleId,
        label: f.label,
        description: f.description,
        affectedNodeIds: f.affectedNodeIds,
        operationCount: f.operationCount,
      }));

      const responseData: LintResponseData = {
        violations,
        fixes,
        summary: {
          errorCount: result.errorCount,
          warningCount: result.warningCount,
          hasBlockingErrors: result.hasBlockingErrors,
        },
        lastCheckedAt: result.lastCheckedAt ?? new Date().toISOString(),
      };

      if (result.scopeTruncated) {
        responseData.summary.scopeTruncated = true;
      }

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Apply Fix Handler
// =============================================================================

// Store fixes in memory keyed by story ID + violation ID
// This is ephemeral - fixes are regenerated on each lint
const fixCache = new Map<string, Map<string, Fix>>();

/**
 * Cache fixes for a story after linting
 */
function cacheFixes(storyId: string, fixes: Fix[]): void {
  const storyFixes = new Map<string, Fix>();
  for (const fix of fixes) {
    storyFixes.set(fix.id, fix);
  }
  fixCache.set(storyId, storyFixes);
}

/**
 * Get a cached fix
 */
function getCachedFix(storyId: string, fixId: string): Fix | undefined {
  return fixCache.get(storyId)?.get(fixId);
}

/**
 * POST /stories/:id/lint/apply - Apply one or more fixes
 */
export function createApplyFixHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ApplyFixRequest>,
    res: Response<APIResponse<ApplyFixResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      ensureRulesRegistered();

      const { id } = req.params;
      const { fixIds, applyAll, categories } = req.body;

      if (!fixIds && !applyAll) {
        throw new BadRequestError(
          'Either fixIds or applyAll is required',
          'Provide fixIds array or set applyAll to true'
        );
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      let graph = deserializeGraph(currentVersion.graph);

      // Re-lint to get fresh fixes (in case graph changed since last lint)
      const lintResult = lint(graph, { mode: 'full' });
      cacheFixes(id, lintResult.fixes);

      // Determine which fixes to apply
      let fixesToApply: Fix[] = [];

      if (applyAll) {
        fixesToApply = lintResult.fixes;
        // Filter by categories if specified
        if (categories && categories.length > 0) {
          const categorySet = new Set(categories);
          fixesToApply = fixesToApply.filter((f) => {
            const rule = getRuleById(f.violationRuleId);
            return rule && categorySet.has(rule.category);
          });
        }
      } else if (fixIds) {
        for (const fixId of fixIds) {
          const fix = getCachedFix(id, fixId);
          if (fix) {
            fixesToApply.push(fix);
          }
        }
      }

      if (fixesToApply.length === 0) {
        res.json({
          success: true,
          data: {
            applied: [],
            skipped: fixIds ?? [],
            skipReasons: Object.fromEntries(
              (fixIds ?? []).map((fid) => [fid, 'Fix not found or stale'])
            ),
            newVersionId: state.history.currentVersionId,
            revalidation: {
              errorCount: lintResult.errorCount,
              warningCount: lintResult.warningCount,
              hasBlockingErrors: lintResult.hasBlockingErrors,
            },
          },
        });
        return;
      }

      // Apply fixes
      const applyResult = applyAllFixes(graph, fixesToApply, getAllRules());

      // If any fixes were applied, save the new graph
      let newVersionId = state.history.currentVersionId;
      if (applyResult.applied.length > 0) {
        const label = applyResult.applied.length === 1
          ? 'Apply lint fix'
          : `Apply ${applyResult.applied.length} lint fixes`;

        newVersionId = await updateGraphById(
          id,
          applyResult.newGraph,
          label,
          undefined,
          ctx
        );
      }

      // Re-lint to get updated violation counts
      const revalidation = lint(applyResult.newGraph, { mode: 'full' });

      res.json({
        success: true,
        data: {
          applied: applyResult.applied,
          skipped: applyResult.skipped,
          skipReasons: applyResult.skipReasons,
          newVersionId,
          revalidation: {
            errorCount: revalidation.errorCount,
            warningCount: revalidation.warningCount,
            hasBlockingErrors: revalidation.hasBlockingErrors,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Pre-Commit Lint Handler
// =============================================================================

interface PreCommitLintResponseData {
  canCommit: boolean;
  violations: LintViolationData[];
  fixes: LintFixData[];
  errorCount: number;
  warningCount: number;
}

/**
 * GET /stories/:id/lint/precommit - Check if commit is allowed
 */
export function createPreCommitLintHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<PreCommitLintResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      ensureRulesRegistered();

      const { id } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Run full lint
      const result = lint(graph, { mode: 'full' });

      // Cache fixes for potential apply
      cacheFixes(id, result.fixes);

      // Transform violations
      const violations: LintViolationData[] = result.violations.map((v) => {
        const data: LintViolationData = {
          id: v.id,
          ruleId: v.ruleId,
          severity: v.severity,
          category: v.category,
          message: v.message,
        };
        if (v.nodeId !== undefined) data.nodeId = v.nodeId;
        if (v.nodeType !== undefined) data.nodeType = v.nodeType;
        if (v.relatedNodeIds !== undefined) data.relatedNodeIds = v.relatedNodeIds;
        return data;
      });

      // Transform fixes
      const fixes: LintFixData[] = result.fixes.map((f) => ({
        id: f.id,
        violationId: f.violationId,
        ruleId: f.violationRuleId,
        label: f.label,
        description: f.description,
        affectedNodeIds: f.affectedNodeIds,
        operationCount: f.operationCount,
      }));

      res.json({
        success: true,
        data: {
          canCommit: !result.hasBlockingErrors,
          violations,
          fixes,
          errorCount: result.errorCount,
          warningCount: result.warningCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
