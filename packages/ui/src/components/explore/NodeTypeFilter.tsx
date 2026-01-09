import type { StoryStats } from '../../api/types';
import styles from './NodeTypeFilter.module.css';

export type NodeTypeOption =
  | 'Logline'
  | 'Setting'
  | 'GenreTone'
  | 'Beat'
  | 'Scene'
  | 'Character'
  | 'Conflict'
  | 'Location'
  | 'Theme'
  | 'Motif'
  | 'Object'
  | 'PlotPoint';

interface NodeTypeFilterProps {
  selectedType: NodeTypeOption;
  onTypeChange: (type: NodeTypeOption) => void;
  stats: StoryStats | undefined;
}

const NODE_TYPES: { type: NodeTypeOption; label: string; statKey?: keyof StoryStats }[] = [
  // Context Layer (top of pyramid)
  { type: 'Logline', label: 'Logline', statKey: 'loglines' },
  { type: 'Setting', label: 'Settings', statKey: 'settings' },
  { type: 'GenreTone', label: 'Genre/Tone', statKey: 'genreTones' },
  // Abstract meaning
  { type: 'Theme', label: 'Themes', statKey: 'themes' },
  { type: 'Motif', label: 'Motifs', statKey: 'motifs' },
  { type: 'Conflict', label: 'Conflicts', statKey: 'conflicts' },
  // Structure & content
  { type: 'Beat', label: 'Beats', statKey: 'beats' },
  { type: 'PlotPoint', label: 'Plot Points', statKey: 'plotPoints' },
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
