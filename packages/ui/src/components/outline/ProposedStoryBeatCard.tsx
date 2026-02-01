/**
 * ProposedStoryBeatCard - Displays a proposed StoryBeat within a beat column.
 * Features inline editing with expand/collapse and nested proposed scenes.
 */

import { useState, useCallback } from 'react';
import type { MergedOutlineStoryBeat } from '../../utils/outlineMergeUtils';
import { ProposedSceneCard } from './ProposedSceneCard';
import styles from './ProposedStoryBeatCard.module.css';
import { useStory } from '../../context/StoryContext';
import { useStashContext } from '../../context/StashContext';

interface ProposedStoryBeatCardProps {
  storyBeat: MergedOutlineStoryBeat;
  beatId: string;
  onEdit: (nodeId: string, updates: Partial<Record<string, unknown>>) => void;
  onRemove?: ((nodeId: string) => void) | undefined;
  isRemoved?: boolean | undefined;
  onUndoRemove?: ((nodeId: string) => void) | undefined;
}

const INTENT_OPTIONS = [
  { value: 'plot', label: 'Plot' },
  { value: 'character', label: 'Character' },
  { value: 'tone', label: 'Tone' },
];

export function ProposedStoryBeatCard({
  storyBeat,
  beatId: _beatId,
  onEdit,
  onRemove,
  isRemoved = false,
  onUndoRemove,
}: ProposedStoryBeatCardProps) {
  const { currentStoryId } = useStory();
  const { createStoryBeat } = useStashContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState({
    title: storyBeat.title,
    intent: storyBeat.intent,
    summary: (storyBeat as unknown as { summary?: string }).summary ?? '',
  });

  const operationClass =
    storyBeat._operation === 'add'
      ? styles.opAdd
      : storyBeat._operation === 'modify'
      ? styles.opModify
      : styles.opDelete;

  const operationLabel =
    storyBeat._operation === 'add'
      ? 'PROPOSED'
      : storyBeat._operation === 'modify'
      ? 'MODIFIED'
      : 'REMOVING';

  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      setLocalData((prev) => ({ ...prev, [key]: value }));
      onEdit(storyBeat.id, { [key]: value });
    },
    [storyBeat.id, onEdit]
  );

  const handleRemove = useCallback(() => {
    onRemove?.(storyBeat.id);
  }, [storyBeat.id, onRemove]);

  const handleUndoRemove = useCallback(() => {
    onUndoRemove?.(storyBeat.id);
  }, [storyBeat.id, onUndoRemove]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Count scenes (both existing converted and proposed)
  const sceneCount = storyBeat.scenes.length;
  const proposedSceneCount = storyBeat.scenes.filter((s) => s._isProposed).length;

  // Removed state
  if (isRemoved) {
    return (
      <div className={`${styles.container} ${styles.removed}`}>
        <div className={styles.removedContent}>
          <span className={styles.removedIcon}>{'\u2715'}</span>
          <span className={styles.removedLabel}>
            StoryBeat: {storyBeat.title} - will not be added
          </span>
          {onUndoRemove && (
            <button
              className={styles.undoButton}
              onClick={handleUndoRemove}
              type="button"
            >
              Undo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${operationClass}`}>
      {/* Badge */}
      <span className={`${styles.badge} ${operationClass}`}>{operationLabel}</span>

      {/* Header - clickable to expand */}
      <button
        className={styles.header}
        onClick={toggleExpand}
        type="button"
      >
        <span className={styles.title}>{localData.title}</span>
        <span className={`${styles.intentBadge} ${styles[localData.intent]}`}>
          {localData.intent.toUpperCase()}
        </span>
        <span className={styles.expandIcon}>
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
      </button>

      {/* Collapsed: show scenes preview */}
      {!isExpanded && sceneCount > 0 && (
        <div className={styles.scenesPreview}>
          {storyBeat.scenes.slice(0, 2).map((scene) => (
            <div
              key={scene.id}
              className={`${styles.scenePreviewItem} ${scene._isProposed ? styles.proposed : ''}`}
            >
              <span className={styles.sceneHeading}>{scene.heading}</span>
              {scene._isProposed && (
                <span className={styles.sceneNewBadge}>NEW</span>
              )}
            </div>
          ))}
          {sceneCount > 2 && (
            <div className={styles.moreScenes}>
              +{sceneCount - 2} more scene{sceneCount - 2 > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Expanded: inline editor */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {/* Show previous data for modifications */}
          {storyBeat._operation === 'modify' && storyBeat._previousData && (
            <div className={styles.previousData}>
              <span className={styles.previousLabel}>Previous:</span>
              <span className={styles.previousValue}>
                {(storyBeat._previousData.title as string) ?? 'Untitled'}
              </span>
            </div>
          )}

          {/* Fields */}
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Title</label>
              <input
                type="text"
                className={styles.input}
                value={localData.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Summary</label>
              <textarea
                className={styles.textarea}
                value={localData.summary}
                onChange={(e) => handleFieldChange('summary', e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Intent</label>
              <select
                className={styles.select}
                value={localData.intent}
                onChange={(e) => handleFieldChange('intent', e.target.value)}
              >
                {INTENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scenes section */}
          {sceneCount > 0 && (
            <div className={styles.scenesSection}>
              <h4 className={styles.scenesTitle}>
                Scenes ({sceneCount})
                {proposedSceneCount > 0 && (
                  <span className={styles.proposedCount}>
                    {proposedSceneCount} proposed
                  </span>
                )}
              </h4>
              <div className={styles.scenesList}>
                {storyBeat.scenes.map((scene) => (
                  <ProposedSceneCard
                    key={scene.id}
                    scene={scene}
                    parentStoryBeatId={storyBeat.id}
                    onEdit={onEdit}
                    onRemove={scene._isProposed && scene._operation === 'add' ? onRemove : undefined}
                    isRemoved={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <button
              className={styles.doneButton}
              onClick={toggleExpand}
              type="button"
            >
              Done
            </button>
            <button
              className={styles.doneButton}
              onClick={async () => {
                if (!currentStoryId) return;
                await createStoryBeat({
                  title: localData.title,
                  intent: localData.intent as 'plot' | 'character' | 'tone',
                  ...(localData.summary ? { summary: localData.summary } : {}),
                });
              }}
              type="button"
            >
              Send to Stash
            </button>
            {onRemove && storyBeat._operation === 'add' && (
              <button
                className={styles.removeButton}
                onClick={handleRemove}
                type="button"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
