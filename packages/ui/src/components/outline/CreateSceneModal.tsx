/**
 * Modal for creating a Scene without attaching to a StoryBeat.
 * Creates an unassigned Scene that can later be dragged to a StoryBeat.
 */

import { useState, useCallback } from 'react';
import styles from './AddStoryBeatModal.module.css';

export interface CreateSceneRequest {
  heading: string;
  scene_overview?: string;
  int_ext?: 'INT' | 'EXT' | 'OTHER';
  time_of_day?: string;
  mood?: string;
}

interface CreateSceneModalProps {
  /** Called when user confirms creation */
  onAdd: (data: CreateSceneRequest) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Loading state */
  saving?: boolean;
}

const INT_EXT_OPTIONS: { value: 'INT' | 'EXT' | 'OTHER' | ''; label: string }[] = [
  { value: '', label: 'Not specified' },
  { value: 'INT', label: 'Interior' },
  { value: 'EXT', label: 'Exterior' },
  { value: 'OTHER', label: 'Other' },
];

const TIME_OF_DAY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Not specified' },
  { value: 'DAY', label: 'Day' },
  { value: 'NIGHT', label: 'Night' },
  { value: 'MORNING', label: 'Morning' },
  { value: 'AFTERNOON', label: 'Afternoon' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'DAWN', label: 'Dawn' },
  { value: 'DUSK', label: 'Dusk' },
];

export function CreateSceneModal({
  onAdd,
  onCancel,
  saving = false,
}: CreateSceneModalProps) {
  const [heading, setHeading] = useState('');
  const [overview, setOverview] = useState('');
  const [intExt, setIntExt] = useState<'INT' | 'EXT' | 'OTHER' | ''>('');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [mood, setMood] = useState('');

  const canSubmit = heading.trim().length > 0 && !saving;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    const data: CreateSceneRequest = {
      heading: heading.trim(),
    };

    if (overview.trim()) {
      data.scene_overview = overview.trim();
    }

    if (intExt) {
      data.int_ext = intExt;
    }

    if (timeOfDay) {
      data.time_of_day = timeOfDay;
    }

    if (mood.trim()) {
      data.mood = mood.trim();
    }

    onAdd(data);
  }, [canSubmit, heading, overview, intExt, timeOfDay, mood, onAdd]);

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
          <h3 className={styles.title}>Create Scene</h3>
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
              Will need story beat assignment
            </span>
          </div>

          {/* Heading (required) */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cs-heading">
              Scene Heading <span className={styles.required}>*</span>
            </label>
            <input
              id="cs-heading"
              type="text"
              className={styles.input}
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="e.g., THE COFFEE SHOP"
              disabled={saving}
              autoFocus
            />
          </div>

          {/* INT/EXT */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cs-intext">
              Interior/Exterior
            </label>
            <select
              id="cs-intext"
              className={styles.select}
              value={intExt}
              onChange={(e) => setIntExt(e.target.value as 'INT' | 'EXT' | 'OTHER' | '')}
              disabled={saving}
            >
              {INT_EXT_OPTIONS.map((opt) => (
                <option key={opt.value || 'none'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time of Day */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cs-timeofday">
              Time of Day
            </label>
            <select
              id="cs-timeofday"
              className={styles.select}
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              disabled={saving}
            >
              {TIME_OF_DAY_OPTIONS.map((opt) => (
                <option key={opt.value || 'none'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mood */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cs-mood">
              Mood
            </label>
            <input
              id="cs-mood"
              type="text"
              className={styles.input}
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="e.g., tense, romantic, comedic"
              disabled={saving}
            />
          </div>

          {/* Scene Overview */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cs-overview">
              Scene Overview
            </label>
            <textarea
              id="cs-overview"
              className={styles.textarea}
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="Brief description of what happens in this scene..."
              rows={3}
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
            {saving ? 'Creating...' : 'Create Scene'}
          </button>
        </div>
      </div>
    </div>
  );
}
