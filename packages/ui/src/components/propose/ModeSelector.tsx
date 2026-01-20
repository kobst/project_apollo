/**
 * ModeSelector - Mode selector buttons for proposal generation
 *
 * Provides a 3-option selector for proposal modes:
 * - Add: Create exactly what is described (1 node, low creativity)
 * - Expand: Build out from a starting point (4 nodes, medium creativity)
 * - Explore: Generate creative options (6 nodes, high creativity)
 */

import type { ProposalMode } from '../../api/types';
import styles from './ModeSelector.module.css';

interface ModeOption {
  value: ProposalMode;
  label: string;
  icon: string;
  description: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'add',
    label: 'Add',
    icon: '+',
    description: 'Just what you describe (1 node)',
  },
  {
    value: 'expand',
    label: 'Expand',
    icon: '◈',
    description: 'With related elements (up to 4 nodes)',
  },
  {
    value: 'explore',
    label: 'Explore',
    icon: '✦',
    description: 'Creative variations (up to 6 nodes)',
  },
];

interface ModeSelectorProps {
  value: ProposalMode;
  onChange: (mode: ProposalMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ value, onChange, disabled = false }: ModeSelectorProps) {
  const selectedOption = MODE_OPTIONS.find((opt) => opt.value === value);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.modeButton} ${value === option.value ? styles.selected : ''}`}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            aria-pressed={value === option.value}
          >
            <span className={styles.icon}>{option.icon}</span>
            <span className={styles.label}>{option.label}</span>
          </button>
        ))}
      </div>
      {selectedOption && (
        <p className={styles.description}>{selectedOption.description}</p>
      )}
    </div>
  );
}
