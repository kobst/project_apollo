/**
 * ViolationItem - Displays a single lint violation with optional fix button
 */

import { useCallback, useState } from 'react';
import styles from './ViolationItem.module.css';
import type { LintViolationData, LintFixData } from '../../api/types';

interface ViolationItemProps {
  violation: LintViolationData;
  fix?: LintFixData | undefined;
  onApplyFix?: (fixId: string) => Promise<unknown>;
  applying?: boolean;
}

export function ViolationItem({ violation, fix, onApplyFix, applying }: ViolationItemProps) {
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyFix = useCallback(async () => {
    if (!fix || !onApplyFix) return;
    setIsApplying(true);
    try {
      await onApplyFix(fix.id);
    } finally {
      setIsApplying(false);
    }
  }, [fix, onApplyFix]);

  const isHard = violation.severity === 'hard';
  const severityClass = isHard ? styles.error : styles.warning;
  const icon = isHard ? '!' : '^';

  return (
    <div className={`${styles.item} ${severityClass}`}>
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.icon}>{icon}</span>
          <span className={styles.ruleId}>{violation.ruleId}</span>
          <span className={styles.severity}>{isHard ? 'Error' : 'Warning'}</span>
        </div>
        <p className={styles.message}>{violation.message}</p>
        {violation.nodeId && (
          <span className={styles.nodeInfo}>
            {violation.nodeType && `${violation.nodeType}: `}
            <code>{violation.nodeId}</code>
          </span>
        )}
      </div>

      {fix && onApplyFix && (
        <div className={styles.fixSection}>
          <button
            className={styles.fixBtn}
            onClick={handleApplyFix}
            disabled={isApplying || applying}
            title={fix.description}
            type="button"
          >
            {isApplying ? 'Applying...' : fix.label}
          </button>
        </div>
      )}
    </div>
  );
}
