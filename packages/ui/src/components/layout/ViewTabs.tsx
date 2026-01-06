import styles from './ViewTabs.module.css';

export type ViewMode = 'contract' | 'coverage' | 'explore' | 'outline';

interface ViewTabsProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewTabs({ activeView, onViewChange }: ViewTabsProps) {
  return (
    <div className={styles.container}>
      <button
        className={`${styles.tab} ${activeView === 'contract' ? styles.active : ''}`}
        onClick={() => onViewChange('contract')}
        type="button"
      >
        Contract
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
