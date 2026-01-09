/**
 * Modal for creating a PlotPoint without aligning to a Beat.
 * Creates an unassigned PlotPoint that can later be dragged to a Beat.
 */

import { useState, useCallback } from 'react';
import type { CreatePlotPointRequest, PlotPointIntent, PlotPointPriority } from '../../api/types';
import styles from './AddPlotPointModal.module.css';

interface CreatePlotPointModalProps {
  /** Called when user confirms creation */
  onAdd: (data: CreatePlotPointRequest) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Loading state */
  saving?: boolean;
}

const INTENT_OPTIONS: { value: PlotPointIntent; label: string }[] = [
  { value: 'plot', label: 'Plot' },
  { value: 'character', label: 'Character' },
  { value: 'theme', label: 'Theme' },
  { value: 'tone', label: 'Tone' },
];

const PRIORITY_OPTIONS: { value: PlotPointPriority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const ACT_OPTIONS: { value: 1 | 2 | 3 | 4 | 5 | undefined; label: string }[] = [
  { value: undefined, label: 'Not specified' },
  { value: 1, label: 'Act 1' },
  { value: 2, label: 'Act 2' },
  { value: 3, label: 'Act 3' },
  { value: 4, label: 'Act 4' },
  { value: 5, label: 'Act 5' },
];

export function CreatePlotPointModal({
  onAdd,
  onCancel,
  saving = false,
}: CreatePlotPointModalProps) {
  const [title, setTitle] = useState('');
  const [intent, setIntent] = useState<PlotPointIntent>('plot');
  const [summary, setSummary] = useState('');
  const [priority, setPriority] = useState<PlotPointPriority>('medium');
  const [act, setAct] = useState<1 | 2 | 3 | 4 | 5 | undefined>(undefined);

  const canSubmit = title.trim().length > 0 && !saving;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    const data: CreatePlotPointRequest = {
      title: title.trim(),
      intent,
      priority,
      // No alignToBeatId - this creates an unassigned plot point
    };

    if (summary.trim()) {
      data.summary = summary.trim();
    }

    if (act !== undefined) {
      data.act = act;
    }

    onAdd(data);
  }, [canSubmit, title, intent, priority, summary, act, onAdd]);

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
          <h3 className={styles.title}>Create Plot Point</h3>
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
          {/* Info about unassigned state */}
          <div className={styles.alignmentInfo}>
            <span className={styles.alignLabel}>Status:</span>
            <span className={styles.beatName}>Unassigned</span>
            <span className={styles.actBadge} style={{ background: 'rgba(255, 152, 0, 0.15)', color: '#ffb74d' }}>
              Will need beat alignment
            </span>
          </div>

          {/* Title (required) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cpp-title">
              Title <span className={styles.required}>*</span>
            </label>
            <input
              id="cpp-title"
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
            <label className={styles.label} htmlFor="cpp-intent">
              Intent
            </label>
            <select
              id="cpp-intent"
              className={styles.select}
              value={intent}
              onChange={(e) => setIntent(e.target.value as PlotPointIntent)}
              disabled={saving}
            >
              {INTENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Act (optional for unassigned) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cpp-act">
              Target Act
            </label>
            <select
              id="cpp-act"
              className={styles.select}
              value={act ?? ''}
              onChange={(e) => setAct(e.target.value ? parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | 5 : undefined)}
              disabled={saving}
            >
              {ACT_OPTIONS.map((opt) => (
                <option key={opt.value ?? 'none'} value={opt.value ?? ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cpp-priority">
              Priority
            </label>
            <select
              id="cpp-priority"
              className={styles.select}
              value={priority}
              onChange={(e) => setPriority(e.target.value as PlotPointPriority)}
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
            <label className={styles.label} htmlFor="cpp-summary">
              Summary
            </label>
            <textarea
              id="cpp-summary"
              className={styles.textarea}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of what must happen..."
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
            {saving ? 'Creating...' : 'Create Plot Point'}
          </button>
        </div>
      </div>
    </div>
  );
}
