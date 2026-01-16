/**
 * EditPanel - Modal for editing PlotPoints and Scenes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useStory } from '../../context/StoryContext';
import { api } from '../../api/client';
import type { OutlinePlotPoint, OutlineScene } from '../../api/types';
import styles from './EditPanel.module.css';

type EditItemType = 'plotpoint' | 'scene';

interface EditPanelProps {
  itemType: EditItemType;
  item: OutlinePlotPoint | OutlineScene;
  onClose: () => void;
  onSave?: () => void;
}

const INTENT_OPTIONS = [
  { value: 'plot', label: 'Plot' },
  { value: 'character', label: 'Character' },
  { value: 'theme', label: 'Theme' },
  { value: 'tone', label: 'Tone' },
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

  const [ppData, setPpData] = useState({
    title: '',
    intent: 'plot',
  });

  const [sceneData, setSceneData] = useState({
    heading: '',
    overview: '',
    intExt: '',
    timeOfDay: '',
    mood: '',
  });

  useEffect(() => {
    if (itemType === 'plotpoint') {
      const pp = item as OutlinePlotPoint;
      setPpData({
        title: pp.title || '',
        intent: pp.intent || 'plot',
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
      if (itemType === 'plotpoint') {
        await api.updatePlotPoint(currentStoryId, item.id, {
          title: ppData.title.trim() || undefined,
          intent: ppData.intent || undefined,
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
  }, [currentStoryId, itemType, item.id, ppData, sceneData, refreshStatus, onSave, onClose]);

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

  const title = itemType === 'plotpoint' ? 'Edit Plot Point' : 'Edit Scene';

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

          {itemType === 'plotpoint' ? (
            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="pp-title">
                  Title
                </label>
                <input
                  id="pp-title"
                  type="text"
                  className={styles.input}
                  value={ppData.title}
                  onChange={(e) => setPpData({ ...ppData, title: e.target.value })}
                  placeholder="What happens at this plot point..."
                  disabled={saving}
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="pp-intent">
                  Intent
                </label>
                <select
                  id="pp-intent"
                  className={styles.select}
                  value={ppData.intent}
                  onChange={(e) => setPpData({ ...ppData, intent: e.target.value })}
                  disabled={saving}
                >
                  {INTENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className={styles.hint}>
                  What this plot point primarily serves in the story
                </span>
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
