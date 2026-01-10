import type { NodeData } from '../../api/types';
import styles from './NodeCardGrid.module.css';

interface NodeCardGridProps {
  nodes: NodeData[];
  onSelectNode: (node: NodeData) => void;
  categoryLabel: string;
}

export function NodeCardGrid({ nodes, onSelectNode, categoryLabel }: NodeCardGridProps) {
  if (nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No {categoryLabel.toLowerCase()} found</p>
        <p className={styles.hint}>Use the extraction panel to add new elements</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {nodes.map(node => (
          <button
            key={node.id}
            className={styles.card}
            onClick={() => onSelectNode(node)}
            type="button"
          >
            <div className={styles.cardHeader}>
              <span className={styles.cardLabel}>{node.label}</span>
              <span className={styles.cardType}>{node.type}</span>
            </div>

            <div className={styles.cardBody}>
              {getNodePreview(node)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function getNodePreview(node: NodeData): string {
  const data = node.data;

  // For Scene: show heading or overview
  if (node.type === 'Scene') {
    if (typeof data.scene_overview === 'string') {
      return truncate(data.scene_overview, 120);
    }
    if (typeof data.heading === 'string' && data.heading !== node.label) {
      return data.heading;
    }
  }

  // Try various common fields
  if (typeof data.description === 'string') {
    return truncate(data.description, 120);
  }
  if (typeof data.overview === 'string') {
    return truncate(data.overview, 120);
  }
  if (typeof data.text === 'string') {
    return truncate(data.text, 120);
  }
  if (typeof data.logline === 'string') {
    return truncate(data.logline, 120);
  }
  if (typeof data.archetype === 'string') {
    return `Archetype: ${data.archetype}`;
  }
  if (typeof data.beatName === 'string') {
    return `Beat: ${data.beatName}`;
  }
  if (typeof data.genre === 'string') {
    return `Genre: ${data.genre}`;
  }
  if (typeof data.tone === 'string') {
    return `Tone: ${data.tone}`;
  }

  return 'Click to view details';
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
