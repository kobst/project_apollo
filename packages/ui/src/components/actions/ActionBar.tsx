import { useStory } from '../../context/StoryContext';
import styles from './ActionBar.module.css';

export function ActionBar() {
  const {
    selectedMoveId,
    preview,
    cluster,
    loading,
    clusterLoading,
    acceptMove,
    rejectAll,
    generateCluster,
    selectedOQ,
  } = useStory();

  const canAccept = selectedMoveId && preview?.validation.valid;
  const canReject = cluster !== null;
  const canRegenerate = selectedOQ !== null;

  const handleAccept = () => {
    void acceptMove();
  };

  const handleRegenerate = () => {
    void generateCluster();
  };

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        {selectedMoveId && preview && (
          <span className={styles.selected}>
            Selected: <strong>{preview.move.title}</strong>
          </span>
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${styles.rejectBtn}`}
          onClick={rejectAll}
          disabled={!canReject || loading}
          type="button"
        >
          Reject All
        </button>

        <button
          className={`${styles.btn} ${styles.regenerateBtn}`}
          onClick={handleRegenerate}
          disabled={!canRegenerate || clusterLoading}
          type="button"
        >
          {clusterLoading ? 'Generating...' : 'Regenerate'}
        </button>

        <button
          className={`${styles.btn} ${styles.acceptBtn}`}
          onClick={handleAccept}
          disabled={!canAccept || loading}
          type="button"
        >
          {loading ? 'Accepting...' : 'Accept Move'}
        </button>
      </div>
    </div>
  );
}
