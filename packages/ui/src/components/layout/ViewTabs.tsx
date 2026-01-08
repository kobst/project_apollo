import styles from './ViewTabs.module.css';

export type ViewMode = 'stories' | 'workspace';

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
        className={`${styles.tab} ${activeView === 'workspace' ? styles.active : ''}`}
        onClick={() => onViewChange('workspace')}
        type="button"
      >
        Workspace
      </button>
    </div>
  );
}
