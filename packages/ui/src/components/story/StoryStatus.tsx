import { useStory } from '../../context/StoryContext';
import styles from './StoryStatus.module.css';

export function StoryStatus() {
  const { status, loading, error } = useStory();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className={styles.container}>
      {status.name && <div className={styles.name}>{status.name}</div>}

      <div className={styles.meta}>
        <div className={styles.item}>
          <span className={styles.label}>Branch</span>
          <span className={styles.value}>{status.currentBranch ?? 'detached'}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>Version</span>
          <span className={styles.value} title={status.currentVersionId}>
            {status.currentVersionId.slice(0, 12)}...
          </span>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{status.stats.scenes}</span>
          <span className={styles.statLabel}>Scenes</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{status.stats.beats}</span>
          <span className={styles.statLabel}>Beats</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{status.stats.characters}</span>
          <span className={styles.statLabel}>Chars</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{status.stats.locations}</span>
          <span className={styles.statLabel}>Locs</span>
        </div>
      </div>
    </div>
  );
}
