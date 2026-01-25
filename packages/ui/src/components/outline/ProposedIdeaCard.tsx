/**
 * ProposedIdeaCard - Displays a proposed Idea from stashed ideas.
 * Shows idea content with include/exclude toggle.
 */

import { useCallback } from 'react';
import type { MergedOutlineIdea } from '../../utils/outlineMergeUtils';
import styles from './ProposedIdeaCard.module.css';

interface ProposedIdeaCardProps {
  idea: MergedOutlineIdea;
  isIncluded: boolean;
  onToggleInclude?: ((id: string) => void) | undefined;
}

const CATEGORY_LABELS: Record<string, string> = {
  character: 'Character',
  plot: 'Plot',
  scene: 'Scene',
  worldbuilding: 'World',
  general: 'General',
};

const CATEGORY_COLORS: Record<string, string> = {
  character: '#f472b6', // pink
  plot: '#4ade80', // green
  scene: '#60a5fa', // blue
  worldbuilding: '#fbbf24', // yellow
  general: '#a78bfa', // purple
};

export function ProposedIdeaCard({
  idea,
  isIncluded,
  onToggleInclude,
}: ProposedIdeaCardProps) {
  const handleToggle = useCallback(() => {
    onToggleInclude?.(idea.id);
  }, [idea.id, onToggleInclude]);

  const categoryLabel = CATEGORY_LABELS[idea.category] ?? 'General';
  const categoryColor = CATEGORY_COLORS[idea.category] ?? '#a78bfa';

  return (
    <div
      className={`${styles.container} ${isIncluded ? styles.included : styles.excluded}`}
      data-proposed
    >
      <div className={styles.header}>
        <span
          className={styles.categoryBadge}
          style={{ '--category-color': categoryColor } as React.CSSProperties}
        >
          {categoryLabel}
        </span>
        <span className={styles.proposedBadge}>Proposed</span>
      </div>

      <p className={styles.title}>{idea.title}</p>

      <p className={styles.description}>
        {idea.description.length > 150
          ? `${idea.description.slice(0, 150)}...`
          : idea.description}
      </p>

      {onToggleInclude && (
        <div className={styles.actions}>
          <button
            className={isIncluded ? styles.excludeButton : styles.includeButton}
            onClick={handleToggle}
            type="button"
          >
            {isIncluded ? 'Exclude' : 'Include'}
          </button>
        </div>
      )}

      {!isIncluded && (
        <div className={styles.excludedOverlay}>
          <span className={styles.excludedLabel}>Will not be added</span>
        </div>
      )}
    </div>
  );
}
