/**
 * ModeSelector - Four-mode generation selector for the new generation system.
 * Modes: Plot Points, Characters, Scenes, Expand
 */

import styles from './ModeSelector.module.css';

export type GenerationMode = 'plot-points' | 'characters' | 'scenes' | 'expand';

interface ModeConfig {
  icon: string;
  label: string;
  description: string;
}

const MODE_CONFIGS: Record<GenerationMode, ModeConfig> = {
  'plot-points': {
    icon: '\uD83D\uDCCB', // 📋
    label: 'Plot Points',
    description: 'Generate narrative beats aligned to structure',
  },
  'characters': {
    icon: '\uD83D\uDC64', // 👤
    label: 'Characters',
    description: 'Create or develop characters and arcs',
  },
  'scenes': {
    icon: '\uD83C\uDFAC', // 🎬
    label: 'Scenes',
    description: 'Generate scenes from committed story beats',
  },
  'expand': {
    icon: '\uD83D\uDD0D', // 🔍
    label: 'Expand',
    description: 'Elaborate on existing story elements',
  },
};

const MODE_ORDER: GenerationMode[] = ['plot-points', 'characters', 'scenes', 'expand'];

interface ModeSelectorProps {
  /** Currently selected mode */
  value: GenerationMode;
  /** Callback when mode changes */
  onChange: (mode: GenerationMode) => void;
  /** Whether selection is disabled */
  disabled?: boolean;
}

export function ModeSelector({
  value,
  onChange,
  disabled = false,
}: ModeSelectorProps) {
  return (
    <div className={styles.container}>
      {MODE_ORDER.map((mode) => {
        const config = MODE_CONFIGS[mode];
        const isSelected = value === mode;

        return (
          <button
            key={mode}
            className={`${styles.modeCard} ${isSelected ? styles.selected : ''}`}
            onClick={() => onChange(mode)}
            disabled={disabled}
            type="button"
            aria-pressed={isSelected}
          >
            <span className={styles.icon}>{config.icon}</span>
            <span className={styles.label}>{config.label}</span>
            <span className={styles.description}>{config.description}</span>
          </button>
        );
      })}
    </div>
  );
}
