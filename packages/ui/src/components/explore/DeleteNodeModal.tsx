/**
 * DeleteNodeModal - Confirmation modal for deleting a node
 *
 * Shows connected nodes and identifies which will become orphaned.
 * Allows user to confirm or cancel the deletion.
 */

import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import type { NodeData, ConnectedNodeInfo } from '../../api/types';
import styles from './DeleteNodeModal.module.css';

interface DeleteNodeModalProps {
  /** Story ID */
  storyId: string;
  /** Node to delete */
  node: NodeData;
  /** Called when deletion is confirmed and completed */
  onDeleted: () => void;
  /** Called when modal is closed without deletion */
  onCancel: () => void;
}

export function DeleteNodeModal({
  storyId,
  node,
  onDeleted,
  onCancel,
}: DeleteNodeModalProps) {
  const [connectedNodes, setConnectedNodes] = useState<ConnectedNodeInfo[]>([]);
  const [edgeCount, setEdgeCount] = useState(0);
  const [orphanCount, setOrphanCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Separate orphaned from non-orphaned nodes
  const { orphanedNodes, otherNodes } = useMemo(() => {
    const orphaned = connectedNodes.filter((n) => n.willBeOrphaned);
    const others = connectedNodes.filter((n) => !n.willBeOrphaned);
    return { orphanedNodes: orphaned, otherNodes: others };
  }, [connectedNodes]);

  // Fetch connected nodes on mount
  useEffect(() => {
    const fetchConnected = async () => {
      setLoading(true);
      try {
        const data = await api.getConnectedNodes(storyId, node.id);
        setConnectedNodes(data.connectedNodes);
        setEdgeCount(data.edgeCount);
        setOrphanCount(data.orphanCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load connected nodes');
      } finally {
        setLoading(false);
      }
    };

    void fetchConnected();
  }, [storyId, node.id]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await api.deleteNode(storyId, node.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete node');
      setDeleting(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Delete {node.type}?</h3>
          <button
            className={styles.closeBtn}
            onClick={onCancel}
            type="button"
            aria-label="Close"
            disabled={deleting}
          >
            &times;
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.nodeInfo}>
            <span className={styles.nodeType}>{node.type}</span>
            <span className={styles.nodeLabel}>{node.label}</span>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading connections...</div>
          ) : (
            <>
              {/* Info about edges being removed */}
              {edgeCount > 0 && (
                <div className={styles.info}>
                  <span className={styles.infoText}>
                    This will remove {edgeCount} connection{edgeCount !== 1 ? 's' : ''}.
                  </span>
                </div>
              )}

              {/* Warning only if nodes will be orphaned */}
              {orphanCount > 0 && (
                <div className={styles.warning}>
                  <span className={styles.warningIcon}>!</span>
                  <span className={styles.warningText}>
                    {orphanCount} node{orphanCount !== 1 ? 's' : ''} will become orphaned
                    (no remaining connections).
                  </span>
                </div>
              )}

              {/* Orphaned nodes section */}
              {orphanedNodes.length > 0 && (
                <div className={styles.orphanedSection}>
                  <h4 className={styles.sectionTitle}>
                    <span className={styles.orphanBadge}>Will be orphaned</span>
                    ({orphanedNodes.length})
                  </h4>
                  <div className={styles.nodeList}>
                    {orphanedNodes.map((item) => (
                      <div key={item.node.id} className={`${styles.nodeItem} ${styles.orphanedItem}`}>
                        <span className={styles.itemType}>{item.node.type}</span>
                        <span className={styles.itemLabel}>{item.node.label}</span>
                        <span className={styles.edgeInfo}>
                          {item.direction === 'outgoing' ? '→' : '←'} {item.edgeType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other connected nodes (will remain connected to other things) */}
              {otherNodes.length > 0 && (
                <div className={styles.connectedSection}>
                  <h4 className={styles.sectionTitle}>
                    Connections to remove
                    <span className={styles.sectionCount}>({otherNodes.length})</span>
                  </h4>
                  <div className={styles.nodeList}>
                    {otherNodes.map((item) => (
                      <div key={item.node.id} className={styles.nodeItem}>
                        <span className={styles.itemType}>{item.node.type}</span>
                        <span className={styles.itemLabel}>{item.node.label}</span>
                        <span className={styles.edgeInfo}>
                          {item.direction === 'outgoing' ? '→' : '←'} {item.edgeType}
                        </span>
                        <span className={styles.connectionCount}>
                          {item.totalConnections - 1} other
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No connections */}
              {connectedNodes.length === 0 && (
                <div className={styles.noConnections}>
                  This node has no connections.
                </div>
              )}
            </>
          )}

          {error && (
            <div className={styles.error}>{error}</div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={deleting}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.deleteBtn}
            onClick={handleDelete}
            disabled={loading || deleting}
            type="button"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
