/**
 * ExpansionScopeToggle - Segmented control for expansion scope.
 * Controls whether AI generation is constrained (primary only) or flexible
 * (can include supporting elements like Characters, Locations, Ideas).
 */

import styles from './ExpansionScopeToggle.module.css';

export type ExpansionScope = 'constrained' | 'flexible';

interface ExpansionScopeToggleProps {
  /** Currently selected scope */
  value: ExpansionScope;
  /** Callback when scope changes */
  onChange: (scope: ExpansionScope) => void;
  /** Whether selection is disabled */
  disabled?: boolean;
}

export function ExpansionScopeToggle({
  value,
  onChange,
  disabled = false,
}: ExpansionScopeToggleProps) {
  return (
    <div className={styles.container}>
      <div className={styles.toggle}>
        <button
          type="button"
          className={`${styles.option} ${value === 'constrained' ? styles.selected : ''}`}
          onClick={() => onChange('constrained')}
          disabled={disabled}
          aria-pressed={value === 'constrained'}
        >
          <span className={styles.optionLabel}>Constrained</span>
          <span className={styles.optionHint}>Primary only</span>
        </button>
        <button
          type="button"
          className={`${styles.option} ${value === 'flexible' ? styles.selected : ''}`}
          onClick={() => onChange('flexible')}
          disabled={disabled}
          aria-pressed={value === 'flexible'}
        >
          <span className={styles.optionLabel}>Flexible</span>
          <span className={styles.optionHint}>+ Characters, Locations, Ideas</span>
        </button>
      </div>
    </div>
  );
}
