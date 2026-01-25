/**
 * UnassignedIdeaCard - Card displaying an unassigned idea.
 * Ideas are informal story concepts that can be promoted to formal nodes.
 */

import type { OutlineIdea } from '../../api/types';
import type { MergedOutlineIdea } from '../../utils/outlineMergeUtils';
import styles from './UnassignedIdeaCard.module.css';

interface UnassignedIdeaCardProps {
  idea: OutlineIdea | MergedOutlineIdea;
  onClick?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}

export function UnassignedIdeaCard({
  idea,
  onClick,
  onDelete,
}: UnassignedIdeaCardProps) {
  const isProposed = '_isProposed' in idea && idea._isProposed;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
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
        <span className={styles.icon} title="Idea">
          &#x1F4A1;
        </span>
        <span className={styles.title}>{idea.title}</span>
        {!isProposed && onDelete && (
          <button
            className={styles.deleteBtn}
            onClick={handleDeleteClick}
            type="button"
            title="Delete idea"
            aria-label="Delete idea"
          >
            &times;
          </button>
        )}
      </div>

      <div className={styles.description}>
        {idea.description}
      </div>

      <div className={styles.meta}>
        {'source' in idea && idea.source && (
          <span className={`${styles.badge} ${styles[`source_${idea.source}`]}`}>
            {idea.source}
          </span>
        )}
        {'category' in idea && idea.category && (
          <span className={styles.badge}>
            {idea.category}
          </span>
        )}
        {'suggestedType' in idea && idea.suggestedType && (
          <span className={`${styles.badge} ${styles.suggestedType}`}>
            → {idea.suggestedType}
          </span>
        )}
      </div>
    </div>
  );
}
