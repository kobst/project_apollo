import type { RelationEdgeData, NodeData, EdgeData, EdgeType } from '../../api/types';
import styles from './NodeRelations.module.css';

/**
 * Extended edge data that includes full edge info for interactive editing.
 * When edgeId is present, the edge can be edited/deleted.
 */
export interface InteractiveEdgeData extends RelationEdgeData {
  edgeId?: string | undefined;
  properties?: EdgeData['properties'] | undefined;
  status?: EdgeData['status'] | undefined;
}

interface NodeRelationsProps {
  outgoing: InteractiveEdgeData[];
  incoming: InteractiveEdgeData[];
  relatedNodes: NodeData[];
  currentNodeType?: string | undefined;
  onEdit?: ((edge: EdgeData) => void) | undefined;
  onDelete?: ((edgeId: string) => void) | undefined;
  onAdd?: ((direction: 'outgoing' | 'incoming') => void) | undefined;
  interactive?: boolean | undefined;
}

export function NodeRelations({
  outgoing,
  incoming,
  relatedNodes,
  onEdit,
  onDelete,
  onAdd,
  interactive = false,
}: NodeRelationsProps) {
  const hasRelations = outgoing.length > 0 || incoming.length > 0;

  // Build a map of node IDs to node data for quick lookup
  const nodeMap = new Map<string, NodeData>();
  relatedNodes.forEach((node) => nodeMap.set(node.id, node));

  // Convert InteractiveEdgeData to EdgeData for edit handler
  const toEdgeData = (edge: InteractiveEdgeData): EdgeData => {
    const data: EdgeData = {
      id: edge.edgeId || '',
      type: edge.type as EdgeType,
      from: edge.source,
      to: edge.target,
    };
    if (edge.properties !== undefined) {
      data.properties = edge.properties;
    }
    if (edge.status !== undefined) {
      data.status = edge.status;
    }
    return data;
  };

  const handleEdit = (edge: InteractiveEdgeData) => {
    if (edge.edgeId && onEdit) {
      onEdit(toEdgeData(edge));
    }
  };

  const handleDelete = (edgeId: string) => {
    if (onDelete) {
      onDelete(edgeId);
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h4 className={styles.sectionTitle}>Relations</h4>
        {interactive && onAdd && (
          <button
            className={styles.addBtn}
            onClick={() => onAdd('outgoing')}
            type="button"
            title="Add relation"
          >
            + Add
          </button>
        )}
      </div>

      {!hasRelations && (
        <div className={styles.empty}>No relations</div>
      )}

      {outgoing.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <div className={styles.groupLabel}>Outgoing ({outgoing.length})</div>
          </div>
          <div className={styles.edges}>
            {outgoing.map((edge, i) => {
              const targetNode = nodeMap.get(edge.target);
              const canEdit = interactive && edge.edgeId;
              return (
                <div key={edge.edgeId || i} className={`${styles.edge} ${canEdit ? styles.edgeInteractive : ''}`}>
                  <div className={styles.edgeContent}>
                    <span className={styles.edgeType}>{edge.type}</span>
                    <span className={styles.arrow}>&rarr;</span>
                    <span className={styles.edgeTarget}>
                      {targetNode?.label || edge.target.slice(0, 12)}
                    </span>
                    {targetNode && (
                      <span className={styles.targetType}>{targetNode.type}</span>
                    )}
                    {edge.status && edge.status !== 'approved' && (
                      <span className={`${styles.statusBadge} ${styles[`status${edge.status.charAt(0).toUpperCase() + edge.status.slice(1)}`]}`}>
                        {edge.status}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className={styles.edgeActions}>
                      <button
                        className={styles.editBtn}
                        onClick={() => handleEdit(edge)}
                        type="button"
                        title="Edit relation"
                      >
                        &#9998;
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(edge.edgeId!)}
                        type="button"
                        title="Delete relation"
                      >
                        &times;
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {incoming.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <div className={styles.groupLabel}>Incoming ({incoming.length})</div>
          </div>
          <div className={styles.edges}>
            {incoming.map((edge, i) => {
              const sourceNode = nodeMap.get(edge.source);
              const canEdit = interactive && edge.edgeId;
              return (
                <div key={edge.edgeId || i} className={`${styles.edge} ${canEdit ? styles.edgeInteractive : ''}`}>
                  <div className={styles.edgeContent}>
                    <span className={styles.edgeSource}>
                      {sourceNode?.label || edge.source.slice(0, 12)}
                    </span>
                    {sourceNode && (
                      <span className={styles.sourceType}>{sourceNode.type}</span>
                    )}
                    <span className={styles.arrow}>&rarr;</span>
                    <span className={styles.edgeType}>{edge.type}</span>
                    {edge.status && edge.status !== 'approved' && (
                      <span className={`${styles.statusBadge} ${styles[`status${edge.status.charAt(0).toUpperCase() + edge.status.slice(1)}`]}`}>
                        {edge.status}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className={styles.edgeActions}>
                      <button
                        className={styles.editBtn}
                        onClick={() => handleEdit(edge)}
                        type="button"
                        title="Edit relation"
                      >
                        &#9998;
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(edge.edgeId!)}
                        type="button"
                        title="Delete relation"
                      >
                        &times;
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add button when no relations exist */}
      {!hasRelations && interactive && onAdd && (
        <button
          className={styles.addFirstBtn}
          onClick={() => onAdd('outgoing')}
          type="button"
        >
          + Add First Relation
        </button>
      )}
    </div>
  );
}
