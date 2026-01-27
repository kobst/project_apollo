import type { StoryStats } from '../../api/types';
import styles from './NodeTypeFilter.module.css';

export type NodeTypeOption =
  | 'Beat'
  | 'Scene'
  | 'Character'
  | 'Location'
  | 'Object'
  | 'StoryBeat';

interface NodeTypeFilterProps {
  selectedType: NodeTypeOption;
  onTypeChange: (type: NodeTypeOption) => void;
  stats: StoryStats | undefined;
}

const NODE_TYPES: { type: NodeTypeOption; label: string; statKey?: keyof StoryStats }[] = [
  // Structure & content
  { type: 'Beat', label: 'Beats', statKey: 'beats' },
  { type: 'StoryBeat', label: 'Story Beats', statKey: 'storyBeats' },
  { type: 'Scene', label: 'Scenes', statKey: 'scenes' },
  { type: 'Character', label: 'Characters', statKey: 'characters' },
  { type: 'Location', label: 'Locations', statKey: 'locations' },
  { type: 'Object', label: 'Props', statKey: 'objects' },
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
