/**
 * UnassignedStoryBeatCard - Card displaying an unassigned story beat.
 * Has an Assign button to assign to a structural beat.
 */

import type { OutlineStoryBeat } from '../../api/types';
import type { MergedOutlineStoryBeat } from '../../utils/outlineMergeUtils';
import styles from './UnassignedStoryBeatCard.module.css';

interface UnassignedStoryBeatCardProps {
  storyBeat: OutlineStoryBeat | MergedOutlineStoryBeat;
  onClick?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onAssign?: (() => void) | undefined;
}

export function UnassignedStoryBeatCard({
  storyBeat,
  onClick,
  onDelete,
  onAssign,
}: UnassignedStoryBeatCardProps) {
  const sceneCount = storyBeat.scenes?.length ?? 0;
  const isProposed = '_isProposed' in storyBeat && storyBeat._isProposed;

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
        <span className={styles.title}>{storyBeat.title}</span>
        <div className={styles.actions}>
          {!isProposed && onAssign && (
            <button
              className={styles.assignBtn}
              onClick={handleAssignClick}
              type="button"
              title="Assign to a beat"
              aria-label="Assign to a beat"
            >
              Assign
            </button>
          )}
          {!isProposed && onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={handleDeleteClick}
              type="button"
              title="Delete story beat"
              aria-label="Delete story beat"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div className={styles.meta}>
        {storyBeat.intent && (
          <span className={`${styles.badge} ${styles[`intent_${storyBeat.intent}`]}`}>
            {storyBeat.intent}
          </span>
        )}
        {storyBeat.status && (
          <span className={styles.badge}>{storyBeat.status}</span>
        )}
      </div>

      {sceneCount > 0 && (
        <div className={styles.scenesInfo}>
          {sceneCount} scene{sceneCount !== 1 ? 's' : ''} attached
        </div>
      )}
    </div>
  );
}
