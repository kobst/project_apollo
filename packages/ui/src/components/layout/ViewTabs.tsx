import styles from './ViewTabs.module.css';

export type ViewMode = 'stories' | 'coverage' | 'explore' | 'outline';

interface ViewTabsProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewTabs({ activeView, onViewChange }: ViewTabsProps) {
  return (
    <div className={styles.container}>
      <button
        className={`${styles.tab} ${activeView === 'stories' ? styles.active : ''}`}
        onClick={() => onViewChange('stories')}
        type="button"
      >
        Stories
      </button>
      <button
        className={`${styles.tab} ${activeView === 'coverage' ? styles.active : ''}`}
        onClick={() => onViewChange('coverage')}
        type="button"
      >
        Coverage
      </button>
      <button
        className={`${styles.tab} ${activeView === 'explore' ? styles.active : ''}`}
        onClick={() => onViewChange('explore')}
        type="button"
      >
        Explore
      </button>
      <button
        className={`${styles.tab} ${activeView === 'outline' ? styles.active : ''}`}
        onClick={() => onViewChange('outline')}
        type="button"
      >
        Outline
      </button>
    </div>
  );
}
