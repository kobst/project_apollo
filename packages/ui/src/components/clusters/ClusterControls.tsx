import { useStory } from '../../context/StoryContext';
import styles from './ClusterControls.module.css';

export function ClusterControls() {
  const {
    selectedOQ,
    cluster,
    clusterLoading,
    clusterCount,
    showSeed,
    generateCluster,
    setClusterCount,
    setShowSeed,
  } = useStory();

  const handleGenerate = () => {
    void generateCluster();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Cluster Generation</span>
      </div>

      {selectedOQ ? (
        <>
          <div className={styles.selected}>
            <span className={styles.label}>Selected Question:</span>
            <span className={styles.message}>{selectedOQ.message}</span>
          </div>

          <div className={styles.controls}>
            <div className={styles.countControl}>
              <label className={styles.label}>
                Count: {clusterCount}
              </label>
              <input
                type="range"
                min={1}
                max={12}
                value={clusterCount}
                onChange={(e) => setClusterCount(Number(e.target.value))}
                className={styles.slider}
              />
            </div>

            <div className={styles.seedControl}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={showSeed}
                  onChange={(e) => setShowSeed(e.target.checked)}
                />
                Show seed
              </label>
              {showSeed && cluster && (
                <span className={styles.seed}>Seed: {cluster.seed}</span>
              )}
            </div>

            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={clusterLoading}
              type="button"
            >
              {clusterLoading
                ? 'Generating...'
                : cluster
                  ? 'Regenerate'
                  : 'Generate Cluster'}
            </button>
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          Select an open question to generate moves
        </div>
      )}
    </div>
  );
}
