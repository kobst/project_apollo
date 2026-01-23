/**
 * SceneFulfillmentSection - Shows which StoryBeats a Scene fulfills
 *
 * Displays SATISFIED_BY edges where StoryBeat → Scene, with order and status.
 * Provides a "Manage" button to open the bulk attach modal.
 */

import { useMemo } from 'react';
import type { NodeData, EdgeData, EdgeType } from '../../api/types';
import type { InteractiveEdgeData, BulkAttachConfig } from './NodeRelations';
import styles from './SceneFulfillmentSection.module.css';

interface SceneFulfillmentSectionProps {
  /** Current scene node ID */
  sceneId: string;
  /** Incoming edges to the scene (we filter for SATISFIED_BY) */
  incomingEdges: InteractiveEdgeData[];
  /** Related nodes (to look up StoryBeat labels) */
  relatedNodes: NodeData[];
  /** Called when user wants to manage fulfillments */
  onManage?: ((config: BulkAttachConfig) => void) | undefined;
  /** Whether editing is enabled */
  interactive?: boolean | undefined;
}

export function SceneFulfillmentSection({
  sceneId,
  incomingEdges,
  relatedNodes,
  onManage,
  interactive = false,
}: SceneFulfillmentSectionProps) {
  // Filter for SATISFIED_BY edges where this scene is the target
  const fulfillmentEdges = useMemo(() => {
    return incomingEdges
      .filter((e) => e.type === 'SATISFIED_BY' && e.target === sceneId)
      .sort((a, b) => {
        // Sort by order if present
        const orderA = a.properties?.order ?? 999;
        const orderB = b.properties?.order ?? 999;
        return orderA - orderB;
      });
  }, [incomingEdges, sceneId]);

  // Build a map of node IDs to node data for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    relatedNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [relatedNodes]);

  // Convert to EdgeData for bulk attach
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

  const handleManage = () => {
    if (!onManage) return;

    const existingEdges = fulfillmentEdges
      .filter((e) => e.edgeId)
      .map(toEdgeData);

    onManage({
      edgeType: 'SATISFIED_BY',
      direction: 'incoming',
      existingEdges,
    });
  };

  const getStatusClass = (status?: string) => {
    if (!status) return '';
    switch (status) {
      case 'proposed':
        return styles.statusProposed;
      case 'approved':
        return styles.statusApproved;
      case 'deprecated':
        return styles.statusDeprecated;
      default:
        return '';
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h4 className={styles.title}>Fulfills Plot Points</h4>
        <span className={styles.count}>({fulfillmentEdges.length})</span>
        {interactive && onManage && (
          <button
            className={styles.manageBtn}
            onClick={handleManage}
            type="button"
            title="Manage which story beats this scene fulfills"
          >
            Manage
          </button>
        )}
      </div>

      {fulfillmentEdges.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyText}>No story beats fulfilled</span>
          {interactive && onManage && (
            <button
              className={styles.addBtn}
              onClick={handleManage}
              type="button"
            >
              + Attach Plot Points
            </button>
          )}
        </div>
      ) : (
        <div className={styles.list}>
          {fulfillmentEdges.map((edge, index) => {
            const storyBeat = nodeMap.get(edge.source);
            const ppData = storyBeat?.data as Record<string, unknown> | undefined;
            const ppStatus = ppData?.status as string | undefined;
            const ppIntent = ppData?.intent as string | undefined;

            return (
              <div key={edge.edgeId || index} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.order}>
                    {edge.properties?.order ?? index + 1}
                  </span>
                  <span className={styles.storyBeatLabel}>
                    {storyBeat?.label || edge.source.slice(0, 12)}
                  </span>
                </div>
                <div className={styles.itemMeta}>
                  {ppIntent && (
                    <span className={styles.intentBadge}>{ppIntent}</span>
                  )}
                  {ppStatus && (
                    <span className={`${styles.statusBadge} ${getStatusClass(ppStatus)}`}>
                      {ppStatus}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
