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
  /** Whether this card represents a refinement (child) package */
  isRefinement?: boolean;
  /** Number of child variations (shown on root cards) */
  childCount?: number;
}

export function PackageMiniCard({
  package: pkg,
  index,
  isActive,
  onClick,
  isRefinement = false,
  childCount,
}: PackageMiniCardProps) {
  const confidence = Math.round(pkg.confidence * 100);
  const first = pkg.changes.nodes[0];
  const human = first?.data && (String((first as any).data.name ?? (first as any).data.title ?? (first as any).data.heading ?? ''));
  const title = human && human.length > 0 ? `${first?.node_type ?? 'Item'}: ${human}` : (pkg.title || 'Package');
  const nodesAdded = pkg.changes.nodes.filter(n => n.operation === 'add').length;
  const nodesModified = pkg.changes.nodes.filter(n => n.operation === 'modify').length;
  const nodesDeleted = pkg.changes.nodes.filter(n => n.operation === 'delete').length;
  const edgesAdded = pkg.changes.edges.filter(e => e.operation === 'add').length;
  const edgesDeleted = pkg.changes.edges.filter(e => e.operation === 'delete').length;

  return (
    <button
      className={`${styles.card} ${isActive ? styles.active : ''} ${isRefinement ? styles.refinement : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className={styles.header}>
        <span className={styles.index}>{isRefinement ? `${index + 1}v` : index + 1}</span>
        <span className={styles.confidence}>{confidence}%</span>
      </div>
      <div className={styles.title}>
        {title.length > 30 ? `${title.slice(0, 30)}...` : title}
      </div>
      <div className={styles.meta}>
        <span className={styles.count}>Nodes +{nodesAdded} ~{nodesModified} -{nodesDeleted}</span>
        <span className={styles.count}>Edges +{edgesAdded} -{edgesDeleted}</span>
      </div>
      {childCount != null && childCount > 0 && (
        <span className={styles.refinementBadge}>{childCount} var{childCount !== 1 ? 's' : ''}</span>
      )}
      {isActive && <div className={styles.activeIndicator} />}
    </button>
  );
}
