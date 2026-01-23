/**
 * Modal for quickly adding a StoryBeat aligned to a Beat.
 * Pre-fills act from the beat and creates ALIGNS_WITH edge on save.
 */

import { useState, useCallback } from 'react';
import type { CreateStoryBeatRequest, StoryBeatIntent, StoryBeatPriority } from '../../api/types';
import styles from './AddStoryBeatModal.module.css';

interface AddStoryBeatModalProps {
  /** Beat ID to align the story beat to */
  beatId: string;
  /** Beat type for display */
  beatType: string;
  /** Act number from the beat */
  act: 1 | 2 | 3 | 4 | 5;
  /** Called when user confirms creation */
  onAdd: (data: CreateStoryBeatRequest) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Loading state */
  saving?: boolean;
}

const INTENT_OPTIONS: { value: StoryBeatIntent; label: string }[] = [
  { value: 'plot', label: 'Plot' },
  { value: 'character', label: 'Character' },
  { value: 'tone', label: 'Tone' },
];

const PRIORITY_OPTIONS: { value: StoryBeatPriority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function AddStoryBeatModal({
  beatId,
  beatType,
  act,
  onAdd,
  onCancel,
  saving = false,
}: AddStoryBeatModalProps) {
  const [title, setTitle] = useState('');
  const [intent, setIntent] = useState<StoryBeatIntent>('plot');
  const [summary, setSummary] = useState('');
  const [criteria, setCriteria] = useState('');
  const [priority, setPriority] = useState<StoryBeatPriority>('medium');

  const canSubmit = title.trim().length > 0 && !saving;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    const data: CreateStoryBeatRequest = {
      title: title.trim(),
      intent,
      act,
      alignToBeatId: beatId,
      priority,
    };

    if (summary.trim()) {
      data.summary = summary.trim();
    }

    if (criteria.trim()) {
      data.criteria_of_satisfaction = criteria.trim();
    }

    onAdd(data);
  }, [canSubmit, title, intent, act, beatId, priority, summary, criteria, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.metaKey && canSubmit) {
        handleSubmit();
      }
    },
    [canSubmit, handleSubmit]
  );

  // Format beat type for display
  const formattedBeatType = beatType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^[\s]/, '')
    .replace('And', '&')
    .trim();

  return (
    <div className={styles.overlay} onClick={onCancel} onKeyDown={handleKeyDown}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Add Story Beat</h3>
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
          {/* Beat alignment info */}
          <div className={styles.alignmentInfo}>
            <span className={styles.alignLabel}>Aligned to:</span>
            <span className={styles.beatName}>{formattedBeatType}</span>
            <span className={styles.actBadge}>Act {act}</span>
          </div>

          {/* Title (required) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pp-title">
              Title <span className={styles.required}>*</span>
            </label>
            <input
              id="pp-title"
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Hero discovers the truth"
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Intent */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pp-intent">
              Intent
            </label>
            <select
              id="pp-intent"
              className={styles.select}
              value={intent}
              onChange={(e) => setIntent(e.target.value as StoryBeatIntent)}
              disabled={saving}
            >
              {INTENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pp-priority">
              Priority
            </label>
            <select
              id="pp-priority"
              className={styles.select}
              value={priority}
              onChange={(e) => setPriority(e.target.value as StoryBeatPriority)}
              disabled={saving}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Summary (optional) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pp-summary">
              Summary
            </label>
            <textarea
              id="pp-summary"
              className={styles.textarea}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of what must happen..."
              rows={2}
              disabled={saving}
            />
          </div>

          {/* Criteria of satisfaction (optional) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pp-criteria">
              Criteria of Satisfaction
            </label>
            <textarea
              id="pp-criteria"
              className={styles.textarea}
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              placeholder="How do we know this is fulfilled?"
              rows={2}
              disabled={saving}
            />
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
            {saving ? 'Adding...' : 'Add Story Beat'}
          </button>
        </div>
      </div>
    </div>
  );
}
