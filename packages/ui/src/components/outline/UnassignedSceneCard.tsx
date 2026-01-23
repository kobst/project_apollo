/**
 * UnassignedSceneCard - Card displaying an unassigned scene.
 * Can be dragged to a StoryBeat to create a SATISFIED_BY edge.
 */

import type { OutlineScene } from '../../api/types';
import styles from './UnassignedSceneCard.module.css';

interface UnassignedSceneCardProps {
  scene: OutlineScene;
  onClick?: () => void;
}

export function UnassignedSceneCard({
  scene,
  onClick,
}: UnassignedSceneCardProps) {
  return (
    <div
      className={styles.container}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className={styles.header}>
        <span className={styles.dragHandle} title="Drag to assign to a story beat">
          &#x2630;
        </span>
        {scene.intExt && <span className={styles.intExt}>{scene.intExt}</span>}
        <span className={styles.heading}>{scene.heading}</span>
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
