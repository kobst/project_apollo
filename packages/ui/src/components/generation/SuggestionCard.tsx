/**
 * SuggestionCard - Displays context additions and stashed ideas
 * with Include/Dismiss actions.
 */

import styles from './SuggestionCard.module.css';

export type SuggestionType = 'context-addition' | 'stashed-idea';

interface RelatedNode {
  id: string;
  type: string;
  name: string;
}

interface SuggestionCardProps {
  /** Type of suggestion */
  type: SuggestionType;
  /** Title of the suggestion */
  title: string;
  /** Description or content */
  description: string;
  /** Category for stashed ideas */
  category?: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
  /** Related nodes for stashed ideas */
  relatedNodes?: RelatedNode[];
  /** Callback when Include is clicked */
  onInclude: () => void;
  /** Callback when Dismiss is clicked */
  onDismiss: () => void;
  /** Whether in loading state */
  loading?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  character: '\uD83D\uDC64', // 👤
  plot: '\uD83D\uDCCB', // 📋
  scene: '\uD83C\uDFAC', // 🎬
  worldbuilding: '\uD83C\uDF0D', // 🌍
  general: '\uD83D\uDCA1', // 💡
};

export function SuggestionCard({
  type,
  title,
  description,
  category,
  relatedNodes = [],
  onInclude,
  onDismiss,
  loading = false,
}: SuggestionCardProps) {
  const isIdea = type === 'stashed-idea';
  const icon = isIdea ? CATEGORY_ICONS[category ?? 'general'] : '\u2795'; // ➕

  return (
    <div className={`${styles.card} ${isIdea ? styles.idea : styles.context}`}>
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.title}>{title}</span>
        {category && (
          <span className={styles.categoryBadge}>{category}</span>
        )}
      </div>

      <p className={styles.description}>{description}</p>

      {/* Related nodes for stashed ideas */}
      {isIdea && relatedNodes.length > 0 && (
        <div className={styles.relatedNodes}>
          <span className={styles.relatedLabel}>Related to:</span>
          <div className={styles.relatedList}>
            {relatedNodes.map((node) => (
              <span key={node.id} className={styles.relatedNode}>
                <span className={styles.nodeType}>{node.type}</span>
                <span className={styles.nodeName}>{node.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={onDismiss}
          disabled={loading}
        >
          Dismiss
        </button>
        <button
          type="button"
          className={styles.includeBtn}
          onClick={onInclude}
          disabled={loading}
        >
          Include
        </button>
      </div>
    </div>
  );
}
