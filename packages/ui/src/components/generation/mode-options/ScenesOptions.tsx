/**
 * ScenesOptions - Options for Scenes generation mode.
 * Select committed story beats to generate scenes from.
 */

import styles from './ModeOptions.module.css';

export interface ScenesOptionsState {
  storyBeatIds: string[];
  scenesPerBeat: number;
}

interface StoryBeatInfo {
  id: string;
  title: string;
  intent: string;
  act?: number | undefined;
  sceneCount: number;
  status: 'proposed' | 'approved' | 'deprecated';
}

interface ScenesOptionsProps {
  /** Current options state */
  value: ScenesOptionsState;
  /** Callback when options change */
  onChange: (options: ScenesOptionsState) => void;
  /** Available story beats (only approved ones) */
  storyBeats?: StoryBeatInfo[];
  /** Whether controls are disabled */
  disabled?: boolean;
}

const SCENES_PER_BEAT_OPTIONS = [
  { value: 1, label: '1 scene' },
  { value: 2, label: '2 scenes' },
  { value: 3, label: '3 scenes' },
  { value: 4, label: '4 scenes' },
  { value: 5, label: '5 scenes' },
];

export function ScenesOptions({
  value,
  onChange,
  storyBeats = [],
  disabled = false,
}: ScenesOptionsProps) {
  // Only show approved story beats
  const approvedBeats = storyBeats.filter((sb) => sb.status === 'approved');

  const handleBeatToggle = (beatId: string) => {
    const newIds = value.storyBeatIds.includes(beatId)
      ? value.storyBeatIds.filter((id) => id !== beatId)
      : [...value.storyBeatIds, beatId];
    onChange({ ...value, storyBeatIds: newIds });
  };

  const handleSelectAll = () => {
    onChange({ ...value, storyBeatIds: approvedBeats.map((sb) => sb.id) });
  };

  const handleClearAll = () => {
    onChange({ ...value, storyBeatIds: [] });
  };

  const handleScenesPerBeatChange = (count: number) => {
    onChange({ ...value, scenesPerBeat: count });
  };

  // Group by act
  const beatsByAct = new Map<number, StoryBeatInfo[]>();
  const unassignedBeats: StoryBeatInfo[] = [];

  for (const beat of approvedBeats) {
    if (beat.act !== undefined) {
      if (!beatsByAct.has(beat.act)) {
        beatsByAct.set(beat.act, []);
      }
      beatsByAct.get(beat.act)!.push(beat);
    } else {
      unassignedBeats.push(beat);
    }
  }

  return (
    <div className={styles.container}>
      {/* Story Beat Checklist */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <label className={styles.sectionLabel}>Story Beats</label>
          {approvedBeats.length > 0 && (
            <div className={styles.bulkActions}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={handleSelectAll}
                disabled={disabled}
              >
                Select All
              </button>
              <button
                type="button"
                className={styles.linkButton}
                onClick={handleClearAll}
                disabled={disabled}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {approvedBeats.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No committed story beats available.</p>
            <p className={styles.emptyHint}>
              Generate and approve story beats first, then return here to create scenes.
            </p>
          </div>
        ) : (
          <div className={styles.beatChecklist}>
            {Array.from(beatsByAct.entries())
              .sort(([a], [b]) => a - b)
              .map(([act, beats]) => (
                <div key={act} className={styles.actGroup}>
                  <div className={styles.actHeader}>Act {act}</div>
                  <div className={styles.beatList}>
                    {beats.map((beat) => (
                      <label key={beat.id} className={styles.beatOption}>
                        <input
                          type="checkbox"
                          checked={value.storyBeatIds.includes(beat.id)}
                          onChange={() => handleBeatToggle(beat.id)}
                          disabled={disabled}
                        />
                        <span className={styles.beatLabel}>
                          {beat.title}
                          <span className={styles.sceneCount}>
                            ({beat.sceneCount} scene{beat.sceneCount !== 1 ? 's' : ''})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            {unassignedBeats.length > 0 && (
              <div className={styles.actGroup}>
                <div className={styles.actHeader}>Unassigned</div>
                <div className={styles.beatList}>
                  {unassignedBeats.map((beat) => (
                    <label key={beat.id} className={styles.beatOption}>
                      <input
                        type="checkbox"
                        checked={value.storyBeatIds.includes(beat.id)}
                        onChange={() => handleBeatToggle(beat.id)}
                        disabled={disabled}
                      />
                      <span className={styles.beatLabel}>
                        {beat.title}
                        <span className={styles.sceneCount}>
                          ({beat.sceneCount} scene{beat.sceneCount !== 1 ? 's' : ''})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scenes Per Beat */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>Scenes per Beat</label>
        <select
          className={styles.select}
          value={value.scenesPerBeat}
          onChange={(e) => handleScenesPerBeatChange(Number(e.target.value))}
          disabled={disabled || approvedBeats.length === 0}
        >
          {SCENES_PER_BEAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary */}
      {value.storyBeatIds.length > 0 && (
        <div className={styles.summary}>
          Will generate {value.storyBeatIds.length * value.scenesPerBeat} scene
          {value.storyBeatIds.length * value.scenesPerBeat !== 1 ? 's' : ''} from{' '}
          {value.storyBeatIds.length} story beat{value.storyBeatIds.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
