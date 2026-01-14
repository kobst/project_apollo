import { useGeneration } from '../../context/GenerationContext';
import { useStory } from '../../context/StoryContext';
import styles from './ViewTabs.module.css';

export type ViewMode = 'stories' | 'workspace' | 'generation';

interface ViewTabsProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewTabs({ activeView, onViewChange }: ViewTabsProps) {
  const { currentStoryId } = useStory();
  const { session } = useGeneration();

  // Show badge if there's an active session with packages
  const hasActiveSession = session && session.packages.length > 0;

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
        disabled={!currentStoryId}
      >
        Workspace
      </button>
      <button
        className={`${styles.tab} ${activeView === 'generation' ? styles.active : ''}`}
        onClick={() => onViewChange('generation')}
        type="button"
        disabled={!currentStoryId}
      >
        Generation
        {hasActiveSession && <span className={styles.badge} />}
      </button>
    </div>
  );
}
