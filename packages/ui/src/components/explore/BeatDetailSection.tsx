/**
 * BeatDetailSection - Specialized view for Beat nodes
 *
 * Shows PlotPoints aligned to this Beat via ALIGNS_WITH edges.
 * Future: Could show derived scenes (PlotPoint → SATISFIED_BY → Scene)
 */

import { useMemo } from 'react';
import type { NodeData } from '../../api/types';
import type { InteractiveEdgeData } from './NodeRelations';
import styles from './BeatDetailSection.module.css';

interface BeatDetailSectionProps {
  /** Current beat node ID (reserved for future use) */
  beatId?: string;
  /** Incoming edges to this beat */
  incomingEdges: InteractiveEdgeData[];
  /** Related nodes (to look up labels) */
  relatedNodes: NodeData[];
}

export function BeatDetailSection({
  incomingEdges,
  relatedNodes,
}: BeatDetailSectionProps) {
  // Build a map of node IDs to node data for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    relatedNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [relatedNodes]);

  // Get PlotPoints aligned to this beat (incoming ALIGNS_WITH)
  const alignedPlotPoints = useMemo(() => {
    return incomingEdges
      .filter((e) => e.type === 'ALIGNS_WITH')
      .map((e) => ({
        edge: e,
        plotPoint: nodeMap.get(e.source),
      }))
      .filter((item) => item.plotPoint !== undefined);
  }, [incomingEdges, nodeMap]);

  // Count scenes fulfilled by aligned plot points
  const totalFulfilledScenes = useMemo(() => {
    let count = 0;
    for (const { plotPoint } of alignedPlotPoints) {
      // fulfillmentCount is populated by the relations API
      const fulfillmentCount = plotPoint?.data?.fulfillmentCount;
      if (typeof fulfillmentCount === 'number') {
        count += fulfillmentCount;
      }
    }
    return count;
  }, [alignedPlotPoints]);

  if (alignedPlotPoints.length === 0) {
    return null; // Don't show section if no plot points aligned
  }

  return (
    <div className={styles.container}>
      {/* Aligned Plot Points Section */}
      <div className={styles.section}>
        <div className={styles.header}>
          <h4 className={styles.title}>Aligned Plot Points</h4>
          <span className={styles.count}>({alignedPlotPoints.length})</span>
        </div>
        <div className={styles.list}>
          {alignedPlotPoints.map(({ edge, plotPoint }) => {
            const fulfillmentCount = plotPoint?.data?.fulfillmentCount;
            return (
              <div key={edge.edgeId || plotPoint?.id} className={styles.item}>
                <span className={styles.itemLabel}>
                  {plotPoint?.label || edge.source.slice(0, 12)}
                </span>
                {plotPoint?.data.intent !== undefined && (
                  <span className={styles.intentBadge}>
                    {String(plotPoint.data.intent)}
                  </span>
                )}
                {typeof fulfillmentCount === 'number' && fulfillmentCount > 0 && (
                  <span className={styles.fulfillmentBadge}>
                    {fulfillmentCount} scene{fulfillmentCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {totalFulfilledScenes > 0 && (
          <div className={styles.summary}>
            {totalFulfilledScenes} scene{totalFulfilledScenes !== 1 ? 's' : ''} fulfill this beat via plot points
          </div>
        )}
      </div>
    </div>
  );
}
