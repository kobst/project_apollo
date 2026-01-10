import { useState, useCallback, useMemo } from 'react';
import styles from './CommitPanel.module.css';

interface ValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

interface CommitPanelProps {
  nodeType: string;
  changes: Record<string, unknown>;
  onCommit: () => Promise<void>;
  onCancel: () => void;
  committing: boolean;
}

// Validation rules per field
const REQUIRED_FIELDS: Record<string, string[]> = {
  Character: ['name'],
  Scene: ['heading'],
  Location: ['name'],
  Beat: [],
  CharacterArc: ['arc_type'],
  Object: ['name'],
};

const MIN_LENGTHS: Record<string, number> = {
  description: 10,
  scene_overview: 20,
  guidance: 10,
};

export function CommitPanel({ nodeType, changes, onCommit, onCancel, committing }: CommitPanelProps) {
  const [commitError, setCommitError] = useState<string | null>(null);

  // Validate changes
  const issues = useMemo(() => {
    const result: ValidationIssue[] = [];
    const requiredFields = REQUIRED_FIELDS[nodeType] || [];

    // Check required fields that are being set to empty
    for (const field of requiredFields) {
      if (field in changes && !changes[field]) {
        result.push({
          type: 'error',
          field,
          message: `${formatFieldName(field)} is required`,
        });
      }
    }

    // Check minimum lengths
    for (const [field, minLen] of Object.entries(MIN_LENGTHS)) {
      if (field in changes) {
        const value = changes[field];
        if (typeof value === 'string' && value.length > 0 && value.length < minLen) {
          result.push({
            type: 'warning',
            field,
            message: `${formatFieldName(field)} should be at least ${minLen} characters`,
          });
        }
      }
    }

    return result;
  }, [nodeType, changes]);

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');
  const hasErrors = errors.length > 0;
  const isValid = !hasErrors;

  const handleCommit = useCallback(async () => {
    setCommitError(null);
    try {
      await onCommit();
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Commit failed');
    }
  }, [onCommit]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Validation</h4>
        {isValid ? (
          <span className={styles.statusValid}>Ready to commit</span>
        ) : (
          <span className={styles.statusInvalid}>{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {issues.length > 0 && (
        <div className={styles.issues}>
          {errors.map((issue, idx) => (
            <div key={`error-${idx}`} className={styles.error}>
              <span className={styles.issueIcon}>!</span>
              <span className={styles.issueText}>{issue.message}</span>
            </div>
          ))}
          {warnings.map((issue, idx) => (
            <div key={`warning-${idx}`} className={styles.warning}>
              <span className={styles.issueIcon}>⚠</span>
              <span className={styles.issueText}>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {issues.length === 0 && (
        <div className={styles.allGood}>
          All validations passed
        </div>
      )}

      {commitError && (
        <div className={styles.commitError}>
          {commitError}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.cancelBtn}
          onClick={onCancel}
          disabled={committing}
          type="button"
        >
          Cancel
        </button>
        <button
          className={styles.commitBtn}
          onClick={handleCommit}
          disabled={!isValid || committing}
          type="button"
        >
          {committing ? 'Committing...' : 'Commit Changes'}
        </button>
      </div>
    </div>
  );
}

function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
