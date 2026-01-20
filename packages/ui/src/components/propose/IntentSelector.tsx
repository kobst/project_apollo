/**
 * IntentSelector - Reusable intent selection component
 *
 * Provides Add/Edit/Expand/Link buttons for selecting the AI proposal intent.
 */

import type { ProposeIntent } from '../../api/types';
import styles from './IntentSelector.module.css';

// Intent options with icons and descriptions
const INTENT_OPTIONS: {
  value: ProposeIntent;
  label: string;
  icon: string;
  description: string;
}[] = [
  { value: 'add', label: 'Add', icon: '+', description: 'Create new elements' },
  { value: 'edit', label: 'Edit', icon: '/', description: 'Modify existing' },
  { value: 'expand', label: 'Expand', icon: '⤢', description: 'Build out from selection' },
  { value: 'link', label: 'Link', icon: '⟷', description: 'Connect elements' },
];

interface IntentSelectorProps {
  /** Currently selected intent */
  value: ProposeIntent;
  /** Called when intent changes */
  onChange: (intent: ProposeIntent) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Compact mode - hide descriptions */
  compact?: boolean;
  /** Limit which intents are available */
  availableIntents?: ProposeIntent[];
}

export function IntentSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
  availableIntents,
}: IntentSelectorProps) {
  const options = availableIntents
    ? INTENT_OPTIONS.filter((opt) => availableIntents.includes(opt.value))
    : INTENT_OPTIONS;

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.intentBtn} ${value === opt.value ? styles.selected : ''}`}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          type="button"
          title={opt.description}
        >
          <span className={styles.icon}>{opt.icon}</span>
          <span className={styles.label}>{opt.label}</span>
          {!compact && <span className={styles.hint}>{opt.description}</span>}
        </button>
      ))}
    </div>
  );
}

export default IntentSelector;
