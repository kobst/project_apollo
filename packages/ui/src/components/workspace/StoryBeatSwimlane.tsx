/**
 * StoryBeatSwimlane - Horizontal row for a story beat with scene cards.
 * Collapsible header with full title, horizontal scroll for scenes.
 */

import { useState, useCallback } from 'react';
import type { MergedOutlineStoryBeat, MergedOutlineScene } from '../../utils/outlineMergeUtils';
import { SwimlaneSceneCard } from './SwimlaneSceneCard';
import styles from './StoryBeatSwimlane.module.css';

interface StoryBeatSwimlaneProps {
  storyBeat: MergedOutlineStoryBeat;
  onEditStoryBeat?: (() => void) | undefined;
  onEditScene?: ((scene: MergedOutlineScene) => void) | undefined;
  onAddScene?: (() => void) | undefined;
  onEditProposed?: ((nodeId: string, updates: Partial<Record<string, unknown>>) => void) | undefined;
  onRemoveProposed?: ((nodeId: string) => void) | undefined;
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
  storyBeat,
  onEditStoryBeat,
  onEditScene,
  onAddScene,
  onRemoveProposed,
  isRemoved,
}: StoryBeatSwimlaneProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isProposed = storyBeat._isProposed;
  const operation = storyBeat._operation;
  const hasScenes = storyBeat.scenes.length > 0;

  const handleRemove = useCallback(() => {
    if (onRemoveProposed) {
      onRemoveProposed(storyBeat.id);
    }
  }, [storyBeat.id, onRemoveProposed]);

  const intentColor = INTENT_COLORS[storyBeat.intent] || '#888';

  // Check if any scene is proposed
  const hasProposedScenes = storyBeat.scenes.some(s => s._isProposed);

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

        <div className={styles.titleArea} onClick={onEditStoryBeat}>
          {/* Operation badge for proposed */}
          {isProposed && operation && (
            <span className={`${styles.badge} ${styles[`badge${operation}`]}`}>
              {operation === 'add' ? 'NEW' : operation === 'modify' ? 'MODIFIED' : 'REMOVING'}
            </span>
          )}

          <span className={styles.title}>{storyBeat.title}</span>

          <span
            className={styles.intent}
            style={{ backgroundColor: `${intentColor}20`, color: intentColor }}
          >
            {storyBeat.intent}
          </span>

          {storyBeat.status && (
            <span className={`${styles.status} ${styles[`status${storyBeat.status}`]}`}>
              {storyBeat.status}
            </span>
          )}

          {/* Scene count indicator */}
          <span className={`${styles.sceneCount} ${hasProposedScenes ? styles.hasProposed : ''}`}>
            {storyBeat.scenes.length} scene{storyBeat.scenes.length !== 1 ? 's' : ''}
            {hasProposedScenes && ' +proposed'}
          </span>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {onEditStoryBeat && (
            <button type="button" className={styles.actionBtn} onClick={onEditStoryBeat}>
              Edit
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

      {/* Expanded content - summary and scene grid */}
      {isExpanded && !isRemoved && (
        <div className={styles.expandedContent}>
          {storyBeat._previousData && (
            <div className={styles.previousData}>
              <span className={styles.previousLabel}>Previous:</span>
              <span className={styles.previousValue}>
                {(storyBeat._previousData.title as string) || 'No title'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Scene cards row */}
      {!isRemoved && (
        <div className={styles.scenesRow}>
          <div className={styles.scenesScroll}>
            {storyBeat.scenes.map((scene) => (
              <SwimlaneSceneCard
                key={scene.id}
                scene={scene}
                onClick={() => onEditScene?.(scene)}
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
