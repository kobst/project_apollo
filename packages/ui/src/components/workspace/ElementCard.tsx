/**
 * ElementCard - Individual element card displayed in the Elements Board grid.
 * Shows type badge, name, truncated description, and scene count.
 */

import type { NodeData } from '../../api/types';
import type { ElementType } from './types';
import styles from './ElementCard.module.css';

interface ElementCardProps {
  element: NodeData;
  elementType: ElementType;
  sceneCount?: number;
  onClick: () => void;
}

const TYPE_CONFIG = {
  Character: { icon: '👤', label: 'CHARACTER', colorClass: 'character' },
  Location: { icon: '📍', label: 'LOCATION', colorClass: 'location' },
  Object: { icon: '📦', label: 'OBJECT', colorClass: 'object' },
} as const;

export function ElementCard({ element, elementType, sceneCount, onClick }: ElementCardProps) {
  const config = TYPE_CONFIG[elementType];
  const data = element.data as Record<string, unknown>;

  // Get name from various possible fields
  const name = (data.name as string) || (data.label as string) || element.label || element.id;

  // Get description from various possible fields
  const description = (data.description as string) || (data.bio as string) || (data.summary as string) || '';

  return (
    <button
      className={`${styles.card} ${styles[config.colorClass]}`}
      onClick={onClick}
      type="button"
    >
      <div className={styles.typeBadge}>
        <span className={styles.typeIcon}>{config.icon}</span>
        <span className={styles.typeLabel}>{config.label}</span>
      </div>

      <h4 className={styles.name}>{name}</h4>

      {description && (
        <p className={styles.description}>{description}</p>
      )}

      {sceneCount !== undefined && sceneCount > 0 && (
        <div className={styles.metadata}>
          <span className={styles.sceneCount}>🎬 {sceneCount} scene{sceneCount !== 1 ? 's' : ''}</span>
        </div>
      )}
    </button>
  );
}
