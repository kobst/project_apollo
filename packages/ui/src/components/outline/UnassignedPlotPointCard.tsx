/**
 * UnassignedPlotPointCard - Card displaying an unassigned plot point.
 * Can be dragged to a Beat to create an ALIGNS_WITH edge.
 */

import type { OutlinePlotPoint } from '../../api/types';
import styles from './UnassignedPlotPointCard.module.css';

interface UnassignedPlotPointCardProps {
  plotPoint: OutlinePlotPoint;
  onClick?: () => void;
}

export function UnassignedPlotPointCard({
  plotPoint,
  onClick,
}: UnassignedPlotPointCardProps) {
  const sceneCount = plotPoint.scenes?.length ?? 0;

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
        <span className={styles.title}>{plotPoint.title}</span>
      </div>

      <div className={styles.meta}>
        {plotPoint.intent && (
          <span className={`${styles.badge} ${styles[`intent_${plotPoint.intent}`]}`}>
            {plotPoint.intent}
          </span>
        )}
        {plotPoint.status && (
          <span className={styles.badge}>{plotPoint.status}</span>
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
