import { useStory } from '../../context/StoryContext';
import { NodeChangeList } from './NodeChangeList';
import { EdgeChangeList } from './EdgeChangeList';
import styles from './DiffVisualization.module.css';

export function DiffVisualization() {
  const { diff } = useStory();

  if (!diff) {
    return null;
  }

  const { summary } = diff;
  const hasChanges =
    summary.nodesAdded > 0 ||
    summary.nodesRemoved > 0 ||
    summary.nodesModified > 0 ||
    summary.edgesAdded > 0 ||
    summary.edgesRemoved > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Last Change</span>
      </div>

      <div className={styles.versions}>
        <span className={styles.from}>{diff.fromVersion.slice(0, 12)}...</span>
        <span className={styles.arrow}>→</span>
        <span className={styles.to}>{diff.toVersion.slice(0, 12)}...</span>
      </div>

      {hasChanges ? (
        <>
          <div className={styles.summary}>
            {summary.nodesAdded > 0 && (
              <span className={styles.added}>+{summary.nodesAdded} nodes</span>
            )}
            {summary.nodesRemoved > 0 && (
              <span className={styles.removed}>-{summary.nodesRemoved} nodes</span>
            )}
            {summary.nodesModified > 0 && (
              <span className={styles.modified}>~{summary.nodesModified} nodes</span>
            )}
            {summary.edgesAdded > 0 && (
              <span className={styles.added}>+{summary.edgesAdded} edges</span>
            )}
            {summary.edgesRemoved > 0 && (
              <span className={styles.removed}>-{summary.edgesRemoved} edges</span>
            )}
          </div>

          <NodeChangeList
            added={diff.nodes.added}
            removed={diff.nodes.removed}
            modified={diff.nodes.modified}
          />

          <EdgeChangeList
            added={diff.edges.added}
            removed={diff.edges.removed}
          />
        </>
      ) : (
        <div className={styles.noChanges}>No changes</div>
      )}
    </div>
  );
}
