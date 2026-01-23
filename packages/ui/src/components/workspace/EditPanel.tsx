/**
 * EditPanel - Modal for editing StoryBeats and Scenes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { OutlineStoryBeat, OutlineScene } from '../../api/types';
import styles from './EditPanel.module.css';

type EditItemType = 'storybeat' | 'scene';

interface EditPanelProps {
  itemType: EditItemType;
  item: OutlineStoryBeat | OutlineScene;
  onClose: () => void;
  onSave?: () => void;
}

const INTENT_OPTIONS = [
  { value: 'plot', label: 'Plot' },
  { value: 'character', label: 'Character' },
  { value: 'theme', label: 'Theme' },
  { value: 'tone', label: 'Tone' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const URGENCY_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const STAKES_CHANGE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'steady', label: 'Steady' },
];

const STATUS_OPTIONS = [
  { value: 'proposed', label: 'Proposed' },
  { value: 'approved', label: 'Approved' },
  { value: 'deprecated', label: 'Deprecated' },
];

const INT_EXT_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'INT', label: 'INT' },
  { value: 'EXT', label: 'EXT' },
  { value: 'OTHER', label: 'OTHER' },
];

const TIME_OF_DAY_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'DAY', label: 'Day' },
  { value: 'NIGHT', label: 'Night' },
  { value: 'MORNING', label: 'Morning' },
  { value: 'AFTERNOON', label: 'Afternoon' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'DAWN', label: 'Dawn' },
  { value: 'DUSK', label: 'Dusk' },
];

export function EditPanel({ itemType, item, onClose, onSave }: EditPanelProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sbData, setSbData] = useState({
    title: '',
    intent: 'plot',
    summary: '',
    priority: '',
    urgency: '',
    stakesChange: '',
    status: 'proposed',
  });

  const [sceneData, setSceneData] = useState({
    heading: '',
    overview: '',
    intExt: '',
    timeOfDay: '',
    mood: '',
  });

  useEffect(() => {
    if (itemType === 'storybeat') {
      const sb = item as OutlineStoryBeat;
      setSbData({
        title: sb.title || '',
        intent: sb.intent || 'plot',
        summary: sb.summary || '',
        priority: sb.priority || '',
        urgency: sb.urgency || '',
        stakesChange: sb.stakesChange || '',
        status: sb.status || 'proposed',
      });
    } else {
      const scene = item as OutlineScene;
      setSceneData({
        heading: scene.heading || '',
        overview: scene.overview || '',
        intExt: scene.intExt || '',
        timeOfDay: scene.timeOfDay || '',
        mood: scene.mood || '',
      });
    }
    setError(null);
  }, [itemType, item]);

  const handleSave = useCallback(async () => {
    if (!currentStoryId) return;

    setSaving(true);
    setError(null);

    try {
      if (itemType === 'storybeat') {
        await api.updateStoryBeat(currentStoryId, item.id, {
          title: sbData.title.trim() || undefined,
          intent: sbData.intent || undefined,
          summary: sbData.summary.trim() || undefined,
          priority: sbData.priority || undefined,
          urgency: sbData.urgency || undefined,
          stakes_change: sbData.stakesChange || undefined,
          status: sbData.status || undefined,
        });
      } else {
        await api.updateScene(currentStoryId, item.id, {
          heading: sceneData.heading.trim() || undefined,
          scene_overview: sceneData.overview.trim() || undefined,
          int_ext: sceneData.intExt || undefined,
          time_of_day: sceneData.timeOfDay || undefined,
          mood: sceneData.mood.trim() || undefined,
        });
      }

      void refreshStatus();
      onSave?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [currentStoryId, itemType, item.id, sbData, sceneData, refreshStatus, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Enter' && e.metaKey && !saving) {
        void handleSave();
      }
    },
    [onClose, saving, handleSave]
  );

  const title = itemType === 'storybeat' ? 'Edit Story Beat' : 'Edit Scene';

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className={styles.content}>
          {error && <div className={styles.error}>{error}</div>}

          {itemType === 'storybeat' ? (
            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="sb-title">
                  Title
                </label>
                <input
                  id="sb-title"
                  type="text"
                  className={styles.input}
                  value={sbData.title}
                  onChange={(e) => setSbData({ ...sbData, title: e.target.value })}
                  placeholder="What happens at this story beat..."
                  disabled={saving}
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="sb-intent">
                  Intent
                </label>
                <select
                  id="sb-intent"
                  className={styles.select}
                  value={sbData.intent}
                  onChange={(e) => setSbData({ ...sbData, intent: e.target.value })}
                  disabled={saving}
                >
                  {INTENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className={styles.hint}>
                  What this story beat primarily serves in the story
                </span>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="sb-summary">
                  Summary
                </label>
                <textarea
                  id="sb-summary"
                  className={styles.textarea}
                  value={sbData.summary}
                  onChange={(e) => setSbData({ ...sbData, summary: e.target.value })}
                  placeholder="Describe what happens in this story beat..."
                  rows={3}
                  disabled={saving}
                />
                <span className={styles.hint}>
                  A brief description of the story beat
                </span>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="sb-priority">
                    Priority
                  </label>
                  <select
                    id="sb-priority"
                    className={styles.select}
                    value={sbData.priority}
                    onChange={(e) => setSbData({ ...sbData, priority: e.target.value })}
                    disabled={saving}
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="sb-urgency">
                    Urgency
                  </label>
                  <select
                    id="sb-urgency"
                    className={styles.select}
                    value={sbData.urgency}
                    onChange={(e) => setSbData({ ...sbData, urgency: e.target.value })}
                    disabled={saving}
                  >
                    {URGENCY_OPTIONS.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="sb-stakes">
                  Stakes Change
                </label>
                <select
                  id="sb-stakes"
                  className={styles.select}
                  value={sbData.stakesChange}
                  onChange={(e) => setSbData({ ...sbData, stakesChange: e.target.value })}
                  disabled={saving}
                >
                  {STAKES_CHANGE_OPTIONS.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className={styles.hint}>
                  How does this story beat affect the stakes?
                </span>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="sb-status">
                  Status
                </label>
                <select
                  id="sb-status"
                  className={styles.select}
                  value={sbData.status}
                  onChange={(e) => setSbData({ ...sbData, status: e.target.value })}
                  disabled={saving}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="scene-heading">
                  Heading
                </label>
                <input
                  id="scene-heading"
                  type="text"
                  className={styles.input}
                  value={sceneData.heading}
                  onChange={(e) => setSceneData({ ...sceneData, heading: e.target.value })}
                  placeholder="Scene heading (e.g., LOCATION - TIME)"
                  disabled={saving}
                  autoFocus
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="scene-intext">
                    INT/EXT
                  </label>
                  <select
                    id="scene-intext"
                    className={styles.select}
                    value={sceneData.intExt}
                    onChange={(e) => setSceneData({ ...sceneData, intExt: e.target.value })}
                    disabled={saving}
                  >
                    {INT_EXT_OPTIONS.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="scene-time">
                    Time of Day
                  </label>
                  <select
                    id="scene-time"
                    className={styles.select}
                    value={sceneData.timeOfDay}
                    onChange={(e) => setSceneData({ ...sceneData, timeOfDay: e.target.value })}
                    disabled={saving}
                  >
                    {TIME_OF_DAY_OPTIONS.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="scene-mood">
                  Mood
                </label>
                <input
                  id="scene-mood"
                  type="text"
                  className={styles.input}
                  value={sceneData.mood}
                  onChange={(e) => setSceneData({ ...sceneData, mood: e.target.value })}
                  placeholder="e.g., tense, romantic, comedic..."
                  disabled={saving}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="scene-overview">
                  Overview
                </label>
                <textarea
                  id="scene-overview"
                  className={styles.textarea}
                  value={sceneData.overview}
                  onChange={(e) => setSceneData({ ...sceneData, overview: e.target.value })}
                  placeholder="What happens in this scene..."
                  rows={5}
                  disabled={saving}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}>Cmd+Enter to save</span>
          <div className={styles.footerButtons}>
            <button
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={saving}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={() => void handleSave()}
              disabled={saving}
              type="button"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
