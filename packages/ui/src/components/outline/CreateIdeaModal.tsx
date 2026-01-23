/**
 * Modal for creating an Idea.
 * Ideas are informal story concepts that can later be promoted to formal nodes.
 */

import { useState, useCallback } from 'react';
import type { CreateIdeaRequest, IdeaSuggestedType } from '../../api/types';
import styles from './AddStoryBeatModal.module.css';

interface CreateIdeaModalProps {
  /** Called when user confirms creation */
  onAdd: (data: CreateIdeaRequest) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Loading state */
  saving?: boolean;
}

const SUGGESTED_TYPE_OPTIONS: { value: IdeaSuggestedType | undefined; label: string }[] = [
  { value: undefined, label: 'Not sure yet' },
  { value: 'StoryBeat', label: 'Story Beat' },
  { value: 'Scene', label: 'Scene' },
  { value: 'Character', label: 'Character' },
  { value: 'Location', label: 'Location' },
  { value: 'Object', label: 'Object' },
];

export function CreateIdeaModal({
  onAdd,
  onCancel,
  saving = false,
}: CreateIdeaModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [suggestedType, setSuggestedType] = useState<IdeaSuggestedType | undefined>(undefined);

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !saving;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    const data: CreateIdeaRequest = {
      title: title.trim(),
      description: description.trim(),
      source: 'user',
    };

    if (suggestedType !== undefined) {
      data.suggestedType = suggestedType;
    }

    onAdd(data);
  }, [canSubmit, title, description, suggestedType, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.metaKey && canSubmit) {
        handleSubmit();
      }
    },
    [canSubmit, handleSubmit]
  );

  return (
    <div className={styles.overlay} onClick={onCancel} onKeyDown={handleKeyDown}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Add Idea</h3>
          <button
            className={styles.closeBtn}
            onClick={onCancel}
            type="button"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className={styles.content}>
          {/* Info about ideas */}
          <div className={styles.alignmentInfo}>
            <span className={styles.alignLabel}>Type:</span>
            <span className={styles.beatName}>Idea</span>
            <span className={styles.actBadge} style={{ background: 'rgba(255, 215, 0, 0.15)', color: '#ffd54f' }}>
              Can be promoted later
            </span>
          </div>

          {/* Title (required) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ci-title">
              Title <span className={styles.required}>*</span>
            </label>
            <input
              id="ci-title"
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Max's betrayal reveal"
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Description (required) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ci-description">
              Description <span className={styles.required}>*</span>
            </label>
            <textarea
              id="ci-description"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="1-3 sentences explaining the idea..."
              rows={3}
              disabled={saving}
            />
          </div>

          {/* Suggested Type (optional) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ci-suggested-type">
              Might become...
            </label>
            <select
              id="ci-suggested-type"
              className={styles.select}
              value={suggestedType ?? ''}
              onChange={(e) => setSuggestedType(e.target.value ? e.target.value as IdeaSuggestedType : undefined)}
              disabled={saving}
            >
              {SUGGESTED_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value ?? 'none'} value={opt.value ?? ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={saving}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.addBtn}
            onClick={handleSubmit}
            disabled={!canSubmit}
            type="button"
          >
            {saving ? 'Adding...' : 'Add Idea'}
          </button>
        </div>
      </div>
    </div>
  );
}
