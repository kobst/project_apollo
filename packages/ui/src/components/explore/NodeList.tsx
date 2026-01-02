import type { NodeData } from '../../api/types';
import { NodeCard } from './NodeCard';
import styles from './NodeList.module.css';

interface NodeListProps {
  nodes: NodeData[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export function NodeList({ nodes, selectedNodeId, onSelectNode }: NodeListProps) {
  if (nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No nodes found</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          node={node}
          isSelected={node.id === selectedNodeId}
          onClick={() => onSelectNode(node.id === selectedNodeId ? null : node.id)}
        />
      ))}
    </div>
  );
}
