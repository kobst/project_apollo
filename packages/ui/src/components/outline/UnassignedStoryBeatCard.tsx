/**
 * UnassignedStoryBeatCard - Card displaying an unassigned story beat.
 * Can be dragged to a Beat to create an ALIGNS_WITH edge.
 */

import type { OutlineStoryBeat } from '../../api/types';
import styles from './UnassignedStoryBeatCard.module.css';

interface UnassignedStoryBeatCardProps {
  storyBeat: OutlineStoryBeat;
  onClick?: () => void;
}

export function UnassignedStoryBeatCard({
  storyBeat,
  onClick,
}: UnassignedStoryBeatCardProps) {
  const sceneCount = storyBeat.scenes?.length ?? 0;

  return (
    <div
      className={styles.container}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className={styles.header}>
        <span className={styles.dragHandle} title="Drag to assign to a beat">
          &#x2630;
        </span>
        <span className={styles.title}>{storyBeat.title}</span>
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
