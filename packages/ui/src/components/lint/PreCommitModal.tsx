/**
 * PreCommitModal - Blocking modal shown when there are hard rule violations
 */

import { useCallback, useMemo } from 'react';
import styles from './PreCommitModal.module.css';
import { ViolationItem } from './ViolationItem';
import type { LintViolationData, LintFixData, RuleCategory } from '../../api/types';

interface PreCommitModalProps {
  isOpen: boolean;
  violations: LintViolationData[];
  fixes: LintFixData[];
  errorCount: number;
  applying: boolean;
  onApplyFix: (fixId: string) => Promise<unknown>;
  onApplyAll: (categories?: RuleCategory[]) => Promise<unknown>;
  onClose: () => void;
  onProceed?: (() => void) | undefined;
}

export function PreCommitModal({
  isOpen,
  violations,
  fixes,
  errorCount,
  applying,
  onApplyFix,
  onApplyAll,
  onClose,
  onProceed,
}: PreCommitModalProps) {
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

  const hasBlockingErrors = errorCount > 0;

  const handleApplyAll = useCallback(async () => {
    await onApplyAll();
  }, [onApplyAll]);

  const handleProceed = useCallback(() => {
    if (onProceed) onProceed();
    onClose();
  }, [onProceed, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            {hasBlockingErrors ? 'Commit Blocked' : 'Review Before Commit'}
          </h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className={styles.content}>
          {hasBlockingErrors && (
            <div className={styles.blockingMessage}>
              There {errorCount === 1 ? 'is' : 'are'}{' '}
              <strong>{errorCount} error{errorCount !== 1 ? 's' : ''}</strong>{' '}
              that must be fixed before committing.
            </div>
          )}

          {errors.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                Errors ({errors.length})
              </h4>
              <div className={styles.list}>
                {errors.map((v) => (
                  <ViolationItem
                    key={v.id}
                    violation={v}
                    fix={fixByViolation.get(v.id)}
                    onApplyFix={onApplyFix}
                    applying={applying}
                  />
                ))}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                Warnings ({warnings.length})
              </h4>
              <div className={styles.list}>
                {warnings.map((v) => (
                  <ViolationItem
                    key={v.id}
                    violation={v}
                    fix={fixByViolation.get(v.id)}
                    onApplyFix={onApplyFix}
                    applying={applying}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={applying}
            type="button"
          >
            Cancel
          </button>

          {fixes.length > 0 && (
            <button
              className={styles.applyAllBtn}
              onClick={handleApplyAll}
              disabled={applying}
              type="button"
            >
              {applying ? 'Applying...' : `Apply All Fixes (${fixes.length})`}
            </button>
          )}

          {!hasBlockingErrors && onProceed && (
            <button
              className={styles.proceedBtn}
              onClick={handleProceed}
              disabled={applying}
              type="button"
            >
              Proceed with Warnings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
