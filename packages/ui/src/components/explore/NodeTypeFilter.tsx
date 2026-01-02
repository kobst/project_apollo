import type { StoryStats } from '../../api/types';
import styles from './NodeTypeFilter.module.css';

export type NodeTypeOption =
  | 'Beat'
  | 'Scene'
  | 'Character'
  | 'Conflict'
  | 'Location'
  | 'Theme'
  | 'Motif';

interface NodeTypeFilterProps {
  selectedType: NodeTypeOption;
  onTypeChange: (type: NodeTypeOption) => void;
  stats: StoryStats | undefined;
}

const NODE_TYPES: { type: NodeTypeOption; label: string; statKey?: keyof StoryStats }[] = [
  { type: 'Beat', label: 'Beats', statKey: 'beats' },
  { type: 'Scene', label: 'Scenes', statKey: 'scenes' },
  { type: 'Character', label: 'Characters', statKey: 'characters' },
  { type: 'Conflict', label: 'Conflicts', statKey: 'conflicts' },
  { type: 'Location', label: 'Locations', statKey: 'locations' },
  { type: 'Theme', label: 'Themes' },
  { type: 'Motif', label: 'Motifs' },
];

export function NodeTypeFilter({ selectedType, onTypeChange, stats }: NodeTypeFilterProps) {
  return (
    <div className={styles.container}>
      {NODE_TYPES.map(({ type, label, statKey }) => {
        const count = statKey && stats ? stats[statKey] : undefined;
        const isActive = selectedType === type;

        return (
          <button
            key={type}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onTypeChange(type)}
            type="button"
          >
            {label}
            {count !== undefined && (
              <span className={styles.count}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
