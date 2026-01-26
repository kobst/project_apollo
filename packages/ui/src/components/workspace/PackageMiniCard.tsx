/**
 * PackageMiniCard - Compact card for displaying a package in the carousel.
 */

import type { NarrativePackage } from '../../api/types';
import styles from './PackageMiniCard.module.css';

interface PackageMiniCardProps {
  package: NarrativePackage;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

export function PackageMiniCard({
  package: pkg,
  index,
  isActive,
  onClick,
}: PackageMiniCardProps) {
  const confidence = Math.round(pkg.confidence * 100);
  const nodeCount = pkg.changes.nodes.length;
  const edgeCount = pkg.changes.edges.length;
  const contextCount = pkg.changes.storyContext?.length ?? 0;

  return (
    <button
      className={`${styles.card} ${isActive ? styles.active : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className={styles.header}>
        <span className={styles.index}>{index + 1}</span>
        <span className={styles.confidence}>{confidence}%</span>
      </div>
      <div className={styles.title}>
        {pkg.title.length > 30 ? `${pkg.title.slice(0, 30)}...` : pkg.title}
      </div>
      <div className={styles.meta}>
        {contextCount > 0 && <span className={styles.count}>{contextCount} context</span>}
        {nodeCount > 0 && <span className={styles.count}>{nodeCount} nodes</span>}
        {edgeCount > 0 && <span className={styles.count}>{edgeCount} edges</span>}
      </div>
      {isActive && <div className={styles.activeIndicator} />}
    </button>
  );
}
