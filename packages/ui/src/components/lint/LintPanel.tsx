/**
 * LintPanel - Displays lint violations grouped by severity
 */

import { useCallback, useMemo } from 'react';
import styles from './LintPanel.module.css';
import { ViolationItem } from './ViolationItem';
import type { LintViolationData, LintFixData, RuleCategory } from '../../api/types';

interface LintPanelProps {
  violations: LintViolationData[];
  fixes: LintFixData[];
  errorCount: number;
  warningCount: number;
  isLinting: boolean;
  lastCheckedAt: string | null;
  scopeTruncated: boolean;
  onApplyFix: (fixId: string) => Promise<unknown>;
  onApplyAll: (categories?: RuleCategory[]) => Promise<unknown>;
  onRunFullLint: () => void;
}

export function LintPanel({
  violations,
  fixes,
  errorCount,
  warningCount,
  isLinting,
  lastCheckedAt,
  scopeTruncated,
  onApplyFix,
  onApplyAll,
  onRunFullLint,
}: LintPanelProps) {
  // Map fixes to violations
  const fixByViolation = useMemo(() => {
    const map = new Map<string, LintFixData>();
    for (const fix of fixes) {
      map.set(fix.violationId, fix);
    }
    return map;
  }, [fixes]);

  // Split violations by severity
  const errors = useMemo(
    () => violations.filter((v) => v.severity === 'hard'),
    [violations]
  );
  const warnings = useMemo(
    () => violations.filter((v) => v.severity === 'soft'),
    [violations]
  );

  // Format time since last check
  const timeSinceCheck = useMemo(() => {
    if (!lastCheckedAt) return null;
    const diff = Date.now() - new Date(lastCheckedAt).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }, [lastCheckedAt]);

  const handleApplyAll = useCallback(async () => {
    await onApplyAll();
  }, [onApplyAll]);

  const hasViolations = violations.length > 0;
  const hasFixes = fixes.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h4 className={styles.title}>Lint</h4>
          {isLinting && <span className={styles.spinner}>...</span>}
          {timeSinceCheck && !isLinting && (
            <span className={styles.lastCheck}>checked {timeSinceCheck}</span>
          )}
        </div>
        <div className={styles.summary}>
          {errorCount > 0 && (
            <span className={styles.errorBadge}>
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className={styles.warningBadge}>
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {!hasViolations && !isLinting && (
            <span className={styles.allClear}>All clear</span>
          )}
        </div>
      </div>

      {scopeTruncated && (
        <div className={styles.truncatedBanner}>
          Scope truncated -
          <button
            className={styles.inlineBtn}
            onClick={onRunFullLint}
            disabled={isLinting}
            type="button"
          >
            run full lint
          </button>
          for complete results
        </div>
      )}

      {hasViolations && (
        <div className={styles.violations}>
          {errors.length > 0 && (
            <div className={styles.section}>
              <h5 className={styles.sectionTitle}>Errors (blocking)</h5>
              <div className={styles.list}>
                {errors.map((v) => (
                  <ViolationItem
                    key={v.id}
                    violation={v}
                    fix={fixByViolation.get(v.id)}
                    onApplyFix={onApplyFix}
                    applying={isLinting}
                  />
                ))}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className={styles.section}>
              <h5 className={styles.sectionTitle}>Warnings</h5>
              <div className={styles.list}>
                {warnings.map((v) => (
                  <ViolationItem
                    key={v.id}
                    violation={v}
                    fix={fixByViolation.get(v.id)}
                    onApplyFix={onApplyFix}
                    applying={isLinting}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.lintBtn}
          onClick={onRunFullLint}
          disabled={isLinting}
          type="button"
        >
          {isLinting ? 'Linting...' : 'Run Full Lint'}
        </button>
        {hasFixes && (
          <button
            className={styles.applyAllBtn}
            onClick={handleApplyAll}
            disabled={isLinting}
            type="button"
          >
            Apply All Fixes ({fixes.length})
          </button>
        )}
      </div>
    </div>
  );
}
