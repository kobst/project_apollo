import { useMemo } from 'react';
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

export interface BulkAttachConfig {
  edgeType: EdgeType;
  direction: 'outgoing' | 'incoming';
  existingEdges: EdgeData[];
}

interface NodeRelationsProps {
  outgoing: InteractiveEdgeData[];
  incoming: InteractiveEdgeData[];
  relatedNodes: NodeData[];
  currentNodeType?: string | undefined;
  currentNodeId?: string | undefined;
  onEdit?: ((edge: EdgeData) => void) | undefined;
  onDelete?: ((edgeId: string) => void) | undefined;
  onAdd?: ((direction: 'outgoing' | 'incoming') => void) | undefined;
  onBulkAttach?: ((config: BulkAttachConfig) => void) | undefined;
  interactive?: boolean | undefined;
}

export function NodeRelations({
  outgoing,
  incoming,
  relatedNodes,
  currentNodeId,
  onEdit,
  onDelete,
  onAdd,
  onBulkAttach,
  interactive = false,
}: NodeRelationsProps) {
  const hasRelations = outgoing.length > 0 || incoming.length > 0;

  // Build a map of node IDs to node data for quick lookup
  const nodeMap = new Map<string, NodeData>();
  relatedNodes.forEach((node) => nodeMap.set(node.id, node));

  // Group edges by type for bulk manage functionality
  const outgoingByType = useMemo(() => {
    const groups = new Map<EdgeType, InteractiveEdgeData[]>();
    for (const edge of outgoing) {
      const type = edge.type as EdgeType;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(edge);
    }
    return groups;
  }, [outgoing]);

  const incomingByType = useMemo(() => {
    const groups = new Map<EdgeType, InteractiveEdgeData[]>();
    for (const edge of incoming) {
      const type = edge.type as EdgeType;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(edge);
    }
    return groups;
  }, [incoming]);

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

  const handleBulkAttach = (edgeType: EdgeType, direction: 'outgoing' | 'incoming') => {
    if (!onBulkAttach || !currentNodeId) return;

    const edges = direction === 'outgoing' ? outgoingByType.get(edgeType) : incomingByType.get(edgeType);
    const existingEdges: EdgeData[] = (edges ?? [])
      .filter((e) => e.edgeId)
      .map(toEdgeData);

    onBulkAttach({
      edgeType,
      direction,
      existingEdges,
    });
  };

  // Render a type group with Manage button
  const renderTypeGroup = (
    edgeType: EdgeType,
    edges: InteractiveEdgeData[],
    direction: 'outgoing' | 'incoming'
  ) => {
    const isOutgoing = direction === 'outgoing';
    return (
      <div key={edgeType} className={styles.typeGroup}>
        <div className={styles.typeGroupHeader}>
          <span className={styles.typeGroupLabel}>
            <span className={styles.edgeTypeSmall}>{edgeType}</span>
            <span className={styles.typeGroupCount}>({edges.length})</span>
          </span>
          {interactive && onBulkAttach && currentNodeId && (
            <button
              className={styles.manageBtn}
              onClick={() => handleBulkAttach(edgeType, direction)}
              type="button"
              title={`Manage ${edgeType} relations`}
            >
              Manage
            </button>
          )}
        </div>
        <div className={styles.typeGroupEdges}>
          {edges.map((edge, i) => {
            const relatedNode = isOutgoing ? nodeMap.get(edge.target) : nodeMap.get(edge.source);
            const canEdit = interactive && edge.edgeId;
            return (
              <div key={edge.edgeId || i} className={`${styles.edge} ${canEdit ? styles.edgeInteractive : ''}`}>
                <div className={styles.edgeContent}>
                  {!isOutgoing && (
                    <>
                      <span className={styles.edgeSource}>
                        {relatedNode?.label || edge.source.slice(0, 12)}
                      </span>
                      {relatedNode && (
                        <span className={styles.sourceType}>{relatedNode.type}</span>
                      )}
                      <span className={styles.arrow}>&rarr;</span>
                    </>
                  )}
                  {isOutgoing && (
                    <>
                      <span className={styles.arrow}>&rarr;</span>
                      <span className={styles.edgeTarget}>
                        {relatedNode?.label || edge.target.slice(0, 12)}
                      </span>
                      {relatedNode && (
                        <span className={styles.targetType}>{relatedNode.type}</span>
                      )}
                    </>
                  )}
                  {edge.properties?.order !== undefined && (
                    <span className={styles.orderBadge}>#{edge.properties.order}</span>
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
    );
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
          <div className={styles.typeGroups}>
            {Array.from(outgoingByType.entries()).map(([edgeType, edges]) =>
              renderTypeGroup(edgeType, edges, 'outgoing')
            )}
          </div>
        </div>
      )}

      {incoming.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <div className={styles.groupLabel}>Incoming ({incoming.length})</div>
          </div>
          <div className={styles.typeGroups}>
            {Array.from(incomingByType.entries()).map(([edgeType, edges]) =>
              renderTypeGroup(edgeType, edges, 'incoming')
            )}
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
