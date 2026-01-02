import type { EdgeData, NodeData } from '../../api/types';
import styles from './NodeRelations.module.css';

interface NodeRelationsProps {
  outgoing: EdgeData[];
  incoming: EdgeData[];
  relatedNodes: NodeData[];
}

export function NodeRelations({ outgoing, incoming, relatedNodes }: NodeRelationsProps) {
  const hasRelations = outgoing.length > 0 || incoming.length > 0;

  if (!hasRelations) {
    return (
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Relations</h4>
        <div className={styles.empty}>No relations</div>
      </div>
    );
  }

  // Build a map of node IDs to node data for quick lookup
  const nodeMap = new Map<string, NodeData>();
  relatedNodes.forEach((node) => nodeMap.set(node.id, node));

  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>Relations</h4>

      {outgoing.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupLabel}>Outgoing ({outgoing.length})</div>
          <div className={styles.edges}>
            {outgoing.map((edge, i) => {
              const targetNode = nodeMap.get(edge.target);
              return (
                <div key={i} className={styles.edge}>
                  <span className={styles.edgeType}>{edge.type}</span>
                  <span className={styles.arrow}>&rarr;</span>
                  <span className={styles.edgeTarget}>
                    {targetNode?.label || edge.target.slice(0, 12)}
                  </span>
                  {targetNode && (
                    <span className={styles.targetType}>{targetNode.type}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {incoming.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupLabel}>Incoming ({incoming.length})</div>
          <div className={styles.edges}>
            {incoming.map((edge, i) => {
              const sourceNode = nodeMap.get(edge.source);
              return (
                <div key={i} className={styles.edge}>
                  <span className={styles.edgeSource}>
                    {sourceNode?.label || edge.source.slice(0, 12)}
                  </span>
                  {sourceNode && (
                    <span className={styles.sourceType}>{sourceNode.type}</span>
                  )}
                  <span className={styles.arrow}>&rarr;</span>
                  <span className={styles.edgeType}>{edge.type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
