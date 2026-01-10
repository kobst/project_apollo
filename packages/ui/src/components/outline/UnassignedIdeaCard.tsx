/**
 * UnassignedIdeaCard - Card displaying an unassigned idea.
 * Ideas are informal story concepts that can be promoted to formal nodes.
 */

import type { OutlineIdea } from '../../api/types';
import styles from './UnassignedIdeaCard.module.css';

interface UnassignedIdeaCardProps {
  idea: OutlineIdea;
  onClick?: () => void;
}

export function UnassignedIdeaCard({
  idea,
  onClick,
}: UnassignedIdeaCardProps) {
  return (
    <div
      className={styles.container}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className={styles.header}>
        <span className={styles.icon} title="Idea">
          &#x1F4A1;
        </span>
        <span className={styles.title}>{idea.title}</span>
      </div>

      <div className={styles.description}>
        {idea.description}
      </div>

      <div className={styles.meta}>
        <span className={`${styles.badge} ${styles[`source_${idea.source}`]}`}>
          {idea.source}
        </span>
        {idea.suggestedType && (
          <span className={`${styles.badge} ${styles.suggestedType}`}>
            → {idea.suggestedType}
          </span>
        )}
      </div>
    </div>
  );
}
