/**
 * ProposedSceneCard - Displays a proposed Scene within a story beat.
 * Features inline editing with expand/collapse.
 */

import { useState, useCallback } from 'react';
import type { MergedOutlineScene } from '../../utils/outlineMergeUtils';
import styles from './ProposedSceneCard.module.css';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';

interface ProposedSceneCardProps {
  scene: MergedOutlineScene;
  parentStoryBeatId: string;
  onEdit: (nodeId: string, updates: Partial<Record<string, unknown>>) => void;
  onRemove?: ((nodeId: string) => void) | undefined;
  isRemoved?: boolean | undefined;
  onUndoRemove?: ((nodeId: string) => void) | undefined;
}

const INT_EXT_OPTIONS = [
  { value: 'INT', label: 'Interior' },
  { value: 'EXT', label: 'Exterior' },
  { value: 'OTHER', label: 'Other' },
];

export function ProposedSceneCard({
  scene,
  parentStoryBeatId: _parentStoryBeatId,
  onEdit,
  onRemove,
  isRemoved = false,
  onUndoRemove,
}: ProposedSceneCardProps) {
  const { currentStoryId } = useStory();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localData, setLocalData] = useState({
    heading: scene.heading,
    overview: scene.overview ?? '',
    mood: scene.mood ?? '',
    int_ext: scene.intExt ?? 'INT',
  });

  // Non-proposed scenes render as regular scene cards
  if (!scene._isProposed) {
    return (
      <div className={styles.existingScene}>
        <span className={styles.existingHeading}>{scene.heading}</span>
      </div>
    );
  }

  const operationClass =
    scene._operation === 'add'
      ? styles.opAdd
      : scene._operation === 'modify'
      ? styles.opModify
      : styles.opDelete;

  const operationLabel =
    scene._operation === 'add'
      ? 'NEW'
      : scene._operation === 'modify'
      ? 'MODIFIED'
      : 'REMOVING';

  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      setLocalData((prev) => ({ ...prev, [key]: value }));
      onEdit(scene.id, { [key]: value });
    },
    [scene.id, onEdit]
  );

  const handleRemove = useCallback(() => {
    onRemove?.(scene.id);
  }, [scene.id, onRemove]);

  const handleUndoRemove = useCallback(() => {
    onUndoRemove?.(scene.id);
  }, [scene.id, onUndoRemove]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Removed state
  if (isRemoved) {
    return (
      <div className={`${styles.container} ${styles.removed}`}>
        <div className={styles.removedContent}>
          <span className={styles.removedIcon}>{'\u2715'}</span>
          <span className={styles.removedLabel}>
            Scene: {scene.heading} - will not be added
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
      {/* Header - clickable to expand */}
      <button
        className={styles.header}
        onClick={toggleExpand}
        type="button"
      >
        <span className={`${styles.badge} ${operationClass}`}>{operationLabel}</span>
        <span className={styles.heading}>{localData.heading}</span>
        <span className={styles.expandIcon}>
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
      </button>

      {/* Collapsed: show brief overview if available */}
      {!isExpanded && localData.overview && (
        <p className={styles.preview}>
          {localData.overview.length > 80
            ? `${localData.overview.slice(0, 80)}...`
            : localData.overview}
        </p>
      )}

      {/* Expanded: inline editor */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          {/* Show previous data for modifications */}
          {scene._operation === 'modify' && scene._previousData && (
            <div className={styles.previousData}>
              <span className={styles.previousLabel}>Previous:</span>
              <span className={styles.previousValue}>
                {(scene._previousData.heading as string) ?? 'Untitled'}
              </span>
            </div>
          )}

          {/* Fields */}
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Heading</label>
              <input
                type="text"
                className={styles.input}
                value={localData.heading}
                onChange={(e) => handleFieldChange('heading', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Overview</label>
              <textarea
                className={styles.textarea}
                value={localData.overview}
                onChange={(e) => handleFieldChange('scene_overview', e.target.value)}
                rows={2}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Int/Ext</label>
                <select
                  className={styles.select}
                  value={localData.int_ext}
                  onChange={(e) => handleFieldChange('int_ext', e.target.value)}
                >
                  {INT_EXT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Mood</label>
                <input
                  type="text"
                  className={styles.input}
                  value={localData.mood}
                  onChange={(e) => handleFieldChange('mood', e.target.value)}
                />
              </div>
            </div>
          </div>

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
                const title = `Scene: ${localData.heading}`;
                const description = String(localData.overview ?? '');
                await api.createIdea(currentStoryId, { title, description, source: 'ai', suggestedType: 'Scene' });
              }}
              type="button"
            >
              Send to Ideas
            </button>
            {onRemove && scene._operation === 'add' && (
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
