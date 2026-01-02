import type { NodeData } from '../../api/types';
import styles from './NodeCard.module.css';

interface NodeCardProps {
  node: NodeData;
  isSelected: boolean;
  onClick: () => void;
}

export function NodeCard({ node, isSelected, onClick }: NodeCardProps) {
  // Get a brief summary from node data
  const summary = getNodeSummary(node);

  return (
    <button
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className={styles.header}>
        <span className={styles.label}>{node.label}</span>
        <span className={styles.type}>{node.type}</span>
      </div>
      {summary && <div className={styles.summary}>{summary}</div>}
      <div className={styles.id}>{node.id.slice(0, 12)}...</div>
    </button>
  );
}

function getNodeSummary(node: NodeData): string | null {
  const data = node.data;

  // Try various common fields
  if (typeof data.description === 'string') {
    return truncate(data.description, 80);
  }
  if (typeof data.overview === 'string') {
    return truncate(data.overview, 80);
  }
  if (typeof data.logline === 'string') {
    return truncate(data.logline, 80);
  }
  if (typeof data.archetype === 'string') {
    return data.archetype;
  }
  if (typeof data.beatName === 'string') {
    return `Beat: ${data.beatName}`;
  }

  return null;
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
