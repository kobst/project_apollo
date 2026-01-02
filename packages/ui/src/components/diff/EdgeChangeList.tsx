import type { EdgeChange } from '../../api/types';
import styles from './ChangeList.module.css';

interface Props {
  added: EdgeChange[];
  removed: EdgeChange[];
}

export function EdgeChangeList({ added, removed }: Props) {
  if (added.length === 0 && removed.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Edges</div>

      {added.map((edge, i) => (
        <div key={`add-${i}`} className={`${styles.item} ${styles.added}`}>
          <span className={styles.badge}>+</span>
          <span className={styles.type}>{edge.type}</span>
          <span className={styles.edge}>
            {edge.source} → {edge.target}
          </span>
        </div>
      ))}

      {removed.map((edge, i) => (
        <div key={`rem-${i}`} className={`${styles.item} ${styles.removed}`}>
          <span className={styles.badge}>-</span>
          <span className={styles.type}>{edge.type}</span>
          <span className={styles.edge}>
            {edge.source} → {edge.target}
          </span>
        </div>
      ))}
    </div>
  );
}
