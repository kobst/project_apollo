/**
 * useLint - React hook for linting with debounced auto-lint
 *
 * Provides:
 * - Debounced auto-lint (600ms) on touched scope
 * - Manual full lint
 * - Fix application (single and batch)
 * - Pre-commit check
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../api/client';
import type {
  LintData,
  LintViolationData,
  LintFixData,
  RuleCategory,
  ApplyFixData,
  PreCommitLintData,
} from '../api/types';

// =============================================================================
// Constants
// =============================================================================

const AUTO_LINT_DEBOUNCE_MS = 600;

// =============================================================================
// Types
// =============================================================================

export interface TouchedScope {
  nodeIds: string[];
  edgeIds: string[];
}

export interface UseLintOptions {
  storyId: string;
  autoLintEnabled?: boolean;
}

export interface UseLintResult {
  // State
  violations: LintViolationData[];
  fixes: LintFixData[];
  errorCount: number;
  warningCount: number;
  hasBlockingErrors: boolean;
  isLinting: boolean;
  lastCheckedAt: string | null;
  scopeTruncated: boolean;

  // Actions
  runFullLint: () => Promise<LintData | null>;
  runTouchedLint: (scope: TouchedScope) => void;
  applyFix: (fixId: string) => Promise<ApplyFixData | null>;
  applyAllFixes: (categories?: RuleCategory[]) => Promise<ApplyFixData | null>;
  checkPreCommit: () => Promise<PreCommitLintData | null>;
  clearTouchedScope: () => void;
  markNodeTouched: (nodeId: string) => void;
  markEdgeTouched: (edgeId: string) => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useLint({
  storyId,
  autoLintEnabled = true,
}: UseLintOptions): UseLintResult {
  // State
  const [violations, setViolations] = useState<LintViolationData[]>([]);
  const [fixes, setFixes] = useState<LintFixData[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [hasBlockingErrors, setHasBlockingErrors] = useState(false);
  const [isLinting, setIsLinting] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [scopeTruncated, setScopeTruncated] = useState(false);

  // Touched scope tracking
  const touchedNodeIds = useRef<Set<string>>(new Set());
  const touchedEdgeIds = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mark a node as touched (will trigger debounced lint)
  const markNodeTouched = useCallback(
    (nodeId: string) => {
      touchedNodeIds.current.add(nodeId);
      if (autoLintEnabled) {
        scheduleDebouncedLint();
      }
    },
    [autoLintEnabled]
  );

  // Mark an edge as touched (will trigger debounced lint)
  const markEdgeTouched = useCallback(
    (edgeId: string) => {
      touchedEdgeIds.current.add(edgeId);
      if (autoLintEnabled) {
        scheduleDebouncedLint();
      }
    },
    [autoLintEnabled]
  );

  // Clear touched scope
  const clearTouchedScope = useCallback(() => {
    touchedNodeIds.current.clear();
    touchedEdgeIds.current.clear();
  }, []);

  // Schedule a debounced lint
  const scheduleDebouncedLint = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      const nodeIds = Array.from(touchedNodeIds.current);
      const edgeIds = Array.from(touchedEdgeIds.current);
      if (nodeIds.length > 0 || edgeIds.length > 0) {
        runTouchedLintInternal({ nodeIds, edgeIds });
      }
    }, AUTO_LINT_DEBOUNCE_MS);
  }, []);

  // Internal function to run touched lint
  const runTouchedLintInternal = useCallback(
    async (scope: TouchedScope) => {
      if (!storyId || isLinting) return;

      setIsLinting(true);
      try {
        const result = await api.lint(storyId, {
          scope: 'touched',
          touchedNodeIds: scope.nodeIds,
          touchedEdgeIds: scope.edgeIds,
        });
        updateStateFromLintResult(result);
        // Clear the touched scope after successful lint
        touchedNodeIds.current.clear();
        touchedEdgeIds.current.clear();
      } catch (error) {
        console.error('Touched lint failed:', error);
      } finally {
        setIsLinting(false);
      }
    },
    [storyId, isLinting]
  );

  // Run lint on touched scope (called externally)
  const runTouchedLint = useCallback(
    (scope: TouchedScope) => {
      // Merge with existing touched scope
      for (const nodeId of scope.nodeIds) {
        touchedNodeIds.current.add(nodeId);
      }
      for (const edgeId of scope.edgeIds) {
        touchedEdgeIds.current.add(edgeId);
      }
      if (autoLintEnabled) {
        scheduleDebouncedLint();
      }
    },
    [autoLintEnabled, scheduleDebouncedLint]
  );

  // Update state from lint result
  const updateStateFromLintResult = useCallback((result: LintData) => {
    setViolations(result.violations);
    setFixes(result.fixes);
    setErrorCount(result.summary.errorCount);
    setWarningCount(result.summary.warningCount);
    setHasBlockingErrors(result.summary.hasBlockingErrors);
    setLastCheckedAt(result.lastCheckedAt);
    setScopeTruncated(result.summary.scopeTruncated ?? false);
  }, []);

  // Run full lint
  const runFullLint = useCallback(async (): Promise<LintData | null> => {
    if (!storyId) return null;

    setIsLinting(true);
    try {
      const result = await api.lint(storyId, { scope: 'full' });
      updateStateFromLintResult(result);
      // Clear touched scope since we did a full lint
      clearTouchedScope();
      return result;
    } catch (error) {
      console.error('Full lint failed:', error);
      return null;
    } finally {
      setIsLinting(false);
    }
  }, [storyId, updateStateFromLintResult, clearTouchedScope]);

  // Apply a single fix
  const applyFix = useCallback(
    async (fixId: string): Promise<ApplyFixData | null> => {
      if (!storyId) return null;

      setIsLinting(true);
      try {
        const result = await api.applyFix(storyId, { fixIds: [fixId] });
        // Update from revalidation
        setErrorCount(result.revalidation.errorCount);
        setWarningCount(result.revalidation.warningCount);
        setHasBlockingErrors(result.revalidation.hasBlockingErrors);
        // Trigger a full lint to get updated violations/fixes
        await runFullLint();
        return result;
      } catch (error) {
        console.error('Apply fix failed:', error);
        return null;
      } finally {
        setIsLinting(false);
      }
    },
    [storyId, runFullLint]
  );

  // Apply all fixes (optionally filtered by categories)
  const applyAllFixes = useCallback(
    async (categories?: RuleCategory[]): Promise<ApplyFixData | null> => {
      if (!storyId) return null;

      setIsLinting(true);
      try {
        const request: { applyAll: true; categories?: RuleCategory[] } = {
          applyAll: true,
        };
        if (categories && categories.length > 0) {
          request.categories = categories;
        }
        const result = await api.applyFix(storyId, request);
        // Update from revalidation
        setErrorCount(result.revalidation.errorCount);
        setWarningCount(result.revalidation.warningCount);
        setHasBlockingErrors(result.revalidation.hasBlockingErrors);
        // Trigger a full lint to get updated violations/fixes
        await runFullLint();
        return result;
      } catch (error) {
        console.error('Apply all fixes failed:', error);
        return null;
      } finally {
        setIsLinting(false);
      }
    },
    [storyId, runFullLint]
  );

  // Check pre-commit (full lint + blocking check)
  const checkPreCommit = useCallback(async (): Promise<PreCommitLintData | null> => {
    if (!storyId) return null;

    setIsLinting(true);
    try {
      const result = await api.preCommitLint(storyId);
      setViolations(result.violations);
      setFixes(result.fixes);
      setErrorCount(result.errorCount);
      setWarningCount(result.warningCount);
      setHasBlockingErrors(!result.canCommit);
      setLastCheckedAt(new Date().toISOString());
      return result;
    } catch (error) {
      console.error('Pre-commit check failed:', error);
      return null;
    } finally {
      setIsLinting(false);
    }
  }, [storyId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    // State
    violations,
    fixes,
    errorCount,
    warningCount,
    hasBlockingErrors,
    isLinting,
    lastCheckedAt,
    scopeTruncated,

    // Actions
    runFullLint,
    runTouchedLint,
    applyFix,
    applyAllFixes,
    checkPreCommit,
    clearTouchedScope,
    markNodeTouched,
    markEdgeTouched,
  };
}
