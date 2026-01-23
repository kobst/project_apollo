/**
 * SwimlaneSceneCard - Compact horizontal scene display for swimlane layout.
 * Fixed width ~200px with scene heading and preview.
 */

import type { MergedOutlineScene } from '../../utils/outlineMergeUtils';
import styles from './SwimlaneSceneCard.module.css';

interface SwimlaneSceneCardProps {
  scene: MergedOutlineScene;
  onClick?: () => void;
}

export function SwimlaneSceneCard({ scene, onClick }: SwimlaneSceneCardProps) {
  const isProposed = scene._isProposed;
  const operation = scene._operation;

  // Build scene header display
  const headerParts: string[] = [];
  if (scene.intExt) headerParts.push(scene.intExt);
  if (scene.heading) headerParts.push(scene.heading);
  if (scene.timeOfDay) headerParts.push(scene.timeOfDay);
  const headerDisplay = headerParts.join(' - ') || 'Untitled Scene';

  // Truncate overview for preview
  const overviewPreview = scene.overview
    ? scene.overview.length > 80 ? scene.overview.slice(0, 80) + '...' : scene.overview
    : '';

  return (
    <div
      className={`${styles.card} ${isProposed ? styles.proposed : ''} ${operation === 'add' ? styles.opAdd : ''} ${operation === 'modify' ? styles.opModify : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Operation badge */}
      {isProposed && operation && (
        <div className={`${styles.badge} ${styles[`badge${operation.charAt(0).toUpperCase() + operation.slice(1)}`]}`}>
          {operation === 'add' ? 'NEW' : operation === 'modify' ? 'MOD' : 'DEL'}
        </div>
      )}

      <div className={styles.heading}>{headerDisplay}</div>

      {overviewPreview && (
        <div className={styles.overview}>{overviewPreview}</div>
      )}

      <div className={styles.metadata}>
        {scene.mood && <span className={styles.mood}>{scene.mood}</span>}
        {scene.status && (
          <span className={`${styles.status} ${styles[`status${scene.status}`]}`}>
            {scene.status}
          </span>
        )}
      </div>
    </div>
  );
}
