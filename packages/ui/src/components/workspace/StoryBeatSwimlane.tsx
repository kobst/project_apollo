/**
 * StoryBeatSwimlane - Horizontal row for a story beat with scene cards.
 * Collapsible header with full title, horizontal scroll for scenes.
 */

import { useState, useCallback } from 'react';
import type { MergedOutlinePlotPoint, MergedOutlineScene } from '../../utils/outlineMergeUtils';
import { useStashContext } from '../../context/StashContext';
import { SwimlaneSceneCard } from './SwimlaneSceneCard';
import styles from './StoryBeatSwimlane.module.css';

interface StoryBeatSwimlaneProps {
  plotPoint: MergedOutlinePlotPoint;
  onEditPlotPoint?: (() => void) | undefined;
  onEditScene?: ((scene: MergedOutlineScene) => void) | undefined;
  onDeleteScene?: ((scene: MergedOutlineScene) => void) | undefined;
  onAddScene?: (() => void) | undefined;
  onEditProposed?: ((nodeId: string, updates: Partial<Record<string, unknown>>) => void) | undefined;
  onRemoveProposed?: ((nodeId: string) => void) | undefined;
  onDelete?: (() => void) | undefined;
  isRemoved?: boolean | undefined;
}

// Intent badge colors
const INTENT_COLORS: Record<string, string> = {
  plot: '#60a5fa',      // blue
  character: '#f472b6', // pink
  theme: '#c084fc',     // purple
  setup: '#fbbf24',     // amber
  payoff: '#4ade80',    // green
};

export function StoryBeatSwimlane({
  plotPoint,
  onEditPlotPoint,
  onEditScene,
  onDeleteScene,
  onAddScene,
  onRemoveProposed,
  onDelete,
  isRemoved,
}: StoryBeatSwimlaneProps) {
  const { createPlotPoint } = useStashContext();
  const [isExpanded, setIsExpanded] = useState(false);

  const isProposed = plotPoint._isProposed;
  const operation = plotPoint._operation;
  const hasScenes = plotPoint.scenes.length > 0;

  const handleRemove = useCallback(() => {
    if (onRemoveProposed) {
      onRemoveProposed(plotPoint.id);
    }
  }, [plotPoint.id, onRemoveProposed]);

  const intentColor = INTENT_COLORS[plotPoint.intent] || '#888';

  // Check if any scene is proposed
  const hasProposedScenes = plotPoint.scenes.some(s => s._isProposed);

  return (
    <div
      className={`${styles.swimlane} ${isProposed ? styles.proposed : ''} ${isRemoved ? styles.removed : ''}`}
    >
      {/* Header row */}
      <div className={styles.header}>
        <button
          type="button"
          className={styles.expandToggle}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}>
            {'\u25BC'}
          </span>
        </button>

        <div className={styles.titleArea} onClick={onEditPlotPoint}>
          {/* Operation badge for proposed */}
          {isProposed && operation && (
            <span className={`${styles.badge} ${styles[`badge${operation}`]}`}>
              {operation === 'add' ? 'NEW' : operation === 'modify' ? 'MODIFIED' : 'REMOVING'}
            </span>
          )}

          <span className={styles.title}>{plotPoint.title}</span>

          <span
            className={styles.intent}
            style={{ backgroundColor: `${intentColor}20`, color: intentColor }}
          >
            {plotPoint.intent}
          </span>

          {plotPoint.status && (
            <span className={`${styles.status} ${styles[`status${plotPoint.status}`]}`}>
              {plotPoint.status}
            </span>
          )}

          {/* Scene count indicator */}
          <span className={`${styles.sceneCount} ${hasProposedScenes ? styles.hasProposed : ''}`}>
            {plotPoint.scenes.length} scene{plotPoint.scenes.length !== 1 ? 's' : ''}
            {hasProposedScenes && ' +proposed'}
          </span>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {onEditPlotPoint && (
            <button type="button" className={styles.actionBtn} onClick={onEditPlotPoint}>
              Edit
            </button>
          )}
          {!isProposed && onDelete && (
            <button type="button" className={styles.deleteBtn} onClick={onDelete}>
              Delete
            </button>
          )}
          {isProposed && operation === 'add' && !isRemoved && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={async () => {
                const summary = (plotPoint as unknown as { summary?: string }).summary;
                await createPlotPoint({
                  title: plotPoint.title,
                  intent: plotPoint.intent as 'plot' | 'character' | 'tone',
                  ...(summary ? { summary } : {}),
                });
              }}
            >
              Send to Stash
            </button>
          )}
          {isProposed && operation === 'add' && onRemoveProposed && !isRemoved && (
            <button type="button" className={styles.removeBtn} onClick={handleRemove}>
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Removed overlay */}
      {isRemoved && (
        <div className={styles.removedOverlay}>
          <span>Will not be added</span>
        </div>
      )}

      {/* Expanded content - summary and details */}
      {isExpanded && !isRemoved && (
        <div className={styles.expandedContent}>
          {/* Summary */}
          {plotPoint.summary && (
            <p className={styles.summary}>{plotPoint.summary}</p>
          )}

          {/* Details row */}
          <div className={styles.detailsRow}>
            {plotPoint.priority && (
              <span className={`${styles.detailBadge} ${styles[`priority${plotPoint.priority}`]}`}>
                {plotPoint.priority} priority
              </span>
            )}
            {plotPoint.stakesChange && (
              <span className={`${styles.detailBadge} ${styles[`stakes${plotPoint.stakesChange}`]}`}>
                stakes {plotPoint.stakesChange}
              </span>
            )}
            {plotPoint.urgency && (
              <span className={styles.detailBadge}>
                {plotPoint.urgency} urgency
              </span>
            )}
          </div>

          {/* Previous data for modified nodes */}
          {plotPoint._previousData && (
            <div className={styles.previousData}>
              <span className={styles.previousLabel}>Previous:</span>
              <span className={styles.previousValue}>
                {(plotPoint._previousData.title as string) || 'No title'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Scene cards row */}
      {!isRemoved && (
        <div className={styles.scenesRow}>
          <div className={styles.scenesScroll}>
            {plotPoint.scenes.map((scene) => (
              <SwimlaneSceneCard
                key={scene.id}
                scene={scene}
                onClick={() => onEditScene?.(scene)}
                onDelete={!scene._isProposed && onDeleteScene ? () => onDeleteScene(scene) : undefined}
              />
            ))}

            {/* Add scene button */}
            {onAddScene && (
              <button
                type="button"
                className={styles.addSceneBtn}
                onClick={onAddScene}
              >
                + Add Scene
              </button>
            )}

            {/* Empty state */}
            {!hasScenes && !onAddScene && (
              <div className={styles.emptyScenes}>No scenes</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
