/**
 * StoryBeatDetailSection - Specialized view for StoryBeat nodes
 *
 * Shows:
 * - Alignment: ALIGNS_WITH → Beat
 * - Fulfillment: SATISFIED_BY → Scene (outgoing edges with order)
 * - Causality: PRECEDES → StoryBeat (both incoming and outgoing)
 */

import { useMemo } from 'react';
import type { NodeData, EdgeData, EdgeType } from '../../api/types';
import type { InteractiveEdgeData, BulkAttachConfig } from './NodeRelations';
import styles from './StoryBeatDetailSection.module.css';

interface StoryBeatDetailSectionProps {
  /** Current story beat node ID (reserved for future use) */
  storyBeatId?: string;
  /** Outgoing edges from this story beat */
  outgoingEdges: InteractiveEdgeData[];
  /** Incoming edges to this story beat */
  incomingEdges: InteractiveEdgeData[];
  /** Related nodes (to look up labels) */
  relatedNodes: NodeData[];
  /** Called when user wants to manage edges of a type */
  onManage?: ((config: BulkAttachConfig) => void) | undefined;
  /** Whether editing is enabled */
  interactive?: boolean | undefined;
}

export function StoryBeatDetailSection({
  outgoingEdges,
  incomingEdges,
  relatedNodes,
  onManage,
  interactive = false,
}: StoryBeatDetailSectionProps) {
  // Build a map of node IDs to node data for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    relatedNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [relatedNodes]);

  // Filter edges by type
  const alignedBeat = useMemo(() => {
    const edge = outgoingEdges.find((e) => e.type === 'ALIGNS_WITH');
    if (!edge) return null;
    return {
      edge,
      beat: nodeMap.get(edge.target),
    };
  }, [outgoingEdges, nodeMap]);

  const satisfiedByScenes = useMemo(() => {
    return outgoingEdges
      .filter((e) => e.type === 'SATISFIED_BY')
      .sort((a, b) => {
        const orderA = a.properties?.order ?? 999;
        const orderB = b.properties?.order ?? 999;
        return orderA - orderB;
      });
  }, [outgoingEdges]);

  const precedesOutgoing = useMemo(() => {
    return outgoingEdges.filter((e) => e.type === 'PRECEDES');
  }, [outgoingEdges]);

  const precedesIncoming = useMemo(() => {
    return incomingEdges.filter((e) => e.type === 'PRECEDES');
  }, [incomingEdges]);

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

  const handleManageAlignment = () => {
    if (!onManage) return;
    const existingEdges = alignedBeat?.edge
      ? [toEdgeData(alignedBeat.edge)]
      : [];
    onManage({
      edgeType: 'ALIGNS_WITH',
      direction: 'outgoing',
      existingEdges,
    });
  };

  const handleManageFulfillment = () => {
    if (!onManage) return;
    const existingEdges = satisfiedByScenes
      .filter((e) => e.edgeId)
      .map(toEdgeData);
    onManage({
      edgeType: 'SATISFIED_BY',
      direction: 'outgoing',
      existingEdges,
    });
  };

  const handleManagePrecedes = () => {
    if (!onManage) return;
    const existingEdges = precedesOutgoing
      .filter((e) => e.edgeId)
      .map(toEdgeData);
    onManage({
      edgeType: 'PRECEDES',
      direction: 'outgoing',
      existingEdges,
    });
  };

  // Format beat type for display
  const formatBeatType = (beatType: string): string => {
    return beatType
      .replace(/([A-Z])/g, ' $1')
      .replace(/^[\s]/, '')
      .replace('And', '&')
      .trim();
  };

  return (
    <div className={styles.container}>
      {/* Alignment Section */}
      <div className={styles.section}>
        <div className={styles.header}>
          <h4 className={styles.title}>Aligned to Beat</h4>
          {interactive && onManage && (
            <button
              className={styles.manageBtn}
              onClick={handleManageAlignment}
              type="button"
              title="Align to a story beat"
            >
              {alignedBeat ? 'Change' : 'Align'}
            </button>
          )}
        </div>
        {alignedBeat ? (
          <div className={styles.alignedBeat}>
            <span className={styles.beatName}>
              {alignedBeat.beat
                ? formatBeatType(alignedBeat.beat.data.beatType as string || '')
                : 'Unknown Beat'}
            </span>
            {alignedBeat.beat?.data.act !== undefined && (
              <span className={styles.actBadge}>
                Act {String(alignedBeat.beat.data.act)}
              </span>
            )}
          </div>
        ) : (
          <div className={styles.emptyBox}>
            <span className={styles.emptyText}>Not aligned to any beat</span>
            {interactive && onManage && (
              <button
                className={styles.addBtn}
                onClick={handleManageAlignment}
                type="button"
              >
                + Align to Beat
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fulfillment Section */}
      <div className={styles.section}>
        <div className={styles.header}>
          <h4 className={styles.title}>Fulfilled by Scenes</h4>
          <span className={styles.count}>({satisfiedByScenes.length})</span>
          {interactive && onManage && (
            <button
              className={styles.manageBtn}
              onClick={handleManageFulfillment}
              type="button"
              title="Manage scenes that fulfill this story beat"
            >
              Manage
            </button>
          )}
        </div>
        {satisfiedByScenes.length === 0 ? (
          <div className={styles.emptyBox}>
            <span className={styles.emptyText}>No scenes fulfill this story beat</span>
            {interactive && onManage && (
              <button
                className={styles.addBtn}
                onClick={handleManageFulfillment}
                type="button"
              >
                + Attach Scenes
              </button>
            )}
          </div>
        ) : (
          <div className={styles.list}>
            {satisfiedByScenes.map((edge, index) => {
              const scene = nodeMap.get(edge.target);
              return (
                <div key={edge.edgeId || index} className={styles.item}>
                  <span className={styles.order}>
                    {edge.properties?.order ?? index + 1}
                  </span>
                  <span className={styles.itemLabel}>
                    {scene?.label || edge.target.slice(0, 12)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Causality Section */}
      <div className={styles.section}>
        <div className={styles.header}>
          <h4 className={styles.title}>Causal Chain</h4>
          {interactive && onManage && (
            <button
              className={styles.manageBtn}
              onClick={handleManagePrecedes}
              type="button"
              title="Manage story beat dependencies"
            >
              Manage
            </button>
          )}
        </div>

        {/* Predecessors (incoming PRECEDES) */}
        {precedesIncoming.length > 0 && (
          <div className={styles.causalGroup}>
            <div className={styles.causalLabel}>Preceded by:</div>
            <div className={styles.causalList}>
              {precedesIncoming.map((edge, index) => {
                const pp = nodeMap.get(edge.source);
                return (
                  <div key={edge.edgeId || index} className={styles.causalItem}>
                    <span className={styles.arrowIn}>&larr;</span>
                    <span className={styles.causalName}>
                      {pp?.label || edge.source.slice(0, 12)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Successors (outgoing PRECEDES) */}
        {precedesOutgoing.length > 0 && (
          <div className={styles.causalGroup}>
            <div className={styles.causalLabel}>Precedes:</div>
            <div className={styles.causalList}>
              {precedesOutgoing.map((edge, index) => {
                const pp = nodeMap.get(edge.target);
                return (
                  <div key={edge.edgeId || index} className={styles.causalItem}>
                    <span className={styles.arrowOut}>&rarr;</span>
                    <span className={styles.causalName}>
                      {pp?.label || edge.target.slice(0, 12)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {precedesIncoming.length === 0 && precedesOutgoing.length === 0 && (
          <div className={styles.empty}>No causal dependencies</div>
        )}
      </div>
    </div>
  );
}
