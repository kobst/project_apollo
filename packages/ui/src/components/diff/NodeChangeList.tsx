import type { NodeChange, ModifiedNodeChange } from '../../api/types';
import styles from './ChangeList.module.css';

interface Props {
  added: NodeChange[];
  removed: NodeChange[];
  modified: ModifiedNodeChange[];
}

export function NodeChangeList({ added, removed, modified }: Props) {
  if (added.length === 0 && removed.length === 0 && modified.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Nodes</div>

      {added.map((node) => (
        <div key={node.id} className={`${styles.item} ${styles.added}`}>
          <span className={styles.badge}>+</span>
          <span className={styles.type}>{node.type}</span>
          <span className={styles.label}>{node.label ?? node.id}</span>
        </div>
      ))}

      {removed.map((node) => (
        <div key={node.id} className={`${styles.item} ${styles.removed}`}>
          <span className={styles.badge}>-</span>
          <span className={styles.type}>{node.type}</span>
          <span className={styles.label}>{node.label ?? node.id}</span>
        </div>
      ))}

      {modified.map((node) => (
        <div key={node.id} className={`${styles.item} ${styles.modified}`}>
          <span className={styles.badge}>~</span>
          <span className={styles.type}>{node.nodeType}</span>
          <span className={styles.label}>{node.id}</span>
          <div className={styles.changes}>
            {node.changes.map((change, i) => (
              <div key={i} className={styles.change}>
                <span className={styles.field}>{change.field}:</span>
                <span className={styles.oldValue}>
                  {String(change.oldValue)}
                </span>
                <span className={styles.arrow}>→</span>
                <span className={styles.newValue}>
                  {String(change.newValue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
