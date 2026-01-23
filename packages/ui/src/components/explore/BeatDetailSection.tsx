/**
 * BeatDetailSection - Specialized view for Beat nodes
 *
 * Shows StoryBeats aligned to this Beat via ALIGNS_WITH edges.
 * Future: Could show derived scenes (StoryBeat → SATISFIED_BY → Scene)
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

  // Get StoryBeats aligned to this beat (incoming ALIGNS_WITH)
  const alignedStoryBeats = useMemo(() => {
    return incomingEdges
      .filter((e) => e.type === 'ALIGNS_WITH')
      .map((e) => ({
        edge: e,
        storyBeat: nodeMap.get(e.source),
      }))
      .filter((item) => item.storyBeat !== undefined);
  }, [incomingEdges, nodeMap]);

  // Count scenes fulfilled by aligned story beats
  const totalFulfilledScenes = useMemo(() => {
    let count = 0;
    for (const { storyBeat } of alignedStoryBeats) {
      // fulfillmentCount is populated by the relations API
      const fulfillmentCount = storyBeat?.data?.fulfillmentCount;
      if (typeof fulfillmentCount === 'number') {
        count += fulfillmentCount;
      }
    }
    return count;
  }, [alignedStoryBeats]);

  if (alignedStoryBeats.length === 0) {
    return null; // Don't show section if no story beats aligned
  }

  return (
    <div className={styles.container}>
      {/* Aligned Plot Points Section */}
      <div className={styles.section}>
        <div className={styles.header}>
          <h4 className={styles.title}>Aligned Plot Points</h4>
          <span className={styles.count}>({alignedStoryBeats.length})</span>
        </div>
        <div className={styles.list}>
          {alignedStoryBeats.map(({ edge, storyBeat }) => {
            const fulfillmentCount = storyBeat?.data?.fulfillmentCount;
            return (
              <div key={edge.edgeId || storyBeat?.id} className={styles.item}>
                <span className={styles.itemLabel}>
                  {storyBeat?.label || edge.source.slice(0, 12)}
                </span>
                {storyBeat?.data.intent !== undefined && (
                  <span className={styles.intentBadge}>
                    {String(storyBeat.data.intent)}
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
            {totalFulfilledScenes} scene{totalFulfilledScenes !== 1 ? 's' : ''} fulfill this beat via story beats
          </div>
        )}
      </div>
    </div>
  );
}
