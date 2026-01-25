/**
 * UnassignedSceneCard - Card displaying an unassigned scene.
 * Has an Assign button to assign to a story beat.
 */

import type { OutlineScene } from '../../api/types';
import type { MergedOutlineScene } from '../../utils/outlineMergeUtils';
import styles from './UnassignedSceneCard.module.css';

interface UnassignedSceneCardProps {
  scene: OutlineScene | MergedOutlineScene;
  onClick?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onAssign?: (() => void) | undefined;
}

export function UnassignedSceneCard({
  scene,
  onClick,
  onDelete,
  onAssign,
}: UnassignedSceneCardProps) {
  const isProposed = '_isProposed' in scene && scene._isProposed;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleAssignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAssign?.();
  };

  return (
    <div
      className={styles.container}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className={styles.header}>
        {scene.intExt && <span className={styles.intExt}>{scene.intExt}</span>}
        <span className={styles.heading}>{scene.heading}</span>
        <div className={styles.actions}>
          {!isProposed && onAssign && (
            <button
              className={styles.assignBtn}
              onClick={handleAssignClick}
              type="button"
              title="Assign to a story beat"
              aria-label="Assign to a story beat"
            >
              Assign
            </button>
          )}
          {!isProposed && onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={handleDeleteClick}
              type="button"
              title="Delete scene"
              aria-label="Delete scene"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {scene.overview && (
        <div className={styles.overview}>{scene.overview}</div>
      )}

      <div className={styles.meta}>
        {scene.timeOfDay && (
          <span className={styles.metaItem}>{scene.timeOfDay}</span>
        )}
        {scene.mood && (
          <span className={styles.metaItem}>{scene.mood}</span>
        )}
        {scene.status && (
          <span className={styles.metaItem}>{scene.status}</span>
        )}
      </div>
    </div>
  );
}
