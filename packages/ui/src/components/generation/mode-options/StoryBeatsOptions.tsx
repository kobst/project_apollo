/**
 * StoryBeatsOptions - Options for Story Beats generation mode.
 * Allows focusing on all beats, specific act, or priority beats.
 */

import { useMemo } from 'react';
import styles from './ModeOptions.module.css';

export type StoryBeatsFocusType = 'all' | 'act' | 'beats';

export interface StoryBeatsOptionsState {
  focusType: StoryBeatsFocusType;
  targetAct?: 1 | 2 | 3 | 4 | 5 | undefined;
  priorityBeats: string[];
}

interface BeatInfo {
  id: string;
  beatType: string;
  act: number;
  positionIndex: number;
  hasMissingStoryBeats: boolean;
}

interface StoryBeatsOptionsProps {
  /** Current options state */
  value: StoryBeatsOptionsState;
  /** Callback when options change */
  onChange: (options: StoryBeatsOptionsState) => void;
  /** Available beats from outline */
  beats?: BeatInfo[];
  /** Whether controls are disabled */
  disabled?: boolean;
}

const ACT_OPTIONS = [
  { value: 1, label: 'Act 1 - Setup' },
  { value: 2, label: 'Act 2A - Confrontation' },
  { value: 3, label: 'Act 2B - Midpoint' },
  { value: 4, label: 'Act 3A - Crisis' },
  { value: 5, label: 'Act 3B - Resolution' },
] as const;

export function StoryBeatsOptions({
  value,
  onChange,
  beats = [],
  disabled = false,
}: StoryBeatsOptionsProps) {
  // Group beats by act
  const beatsByAct = useMemo(() => {
    const grouped = new Map<number, BeatInfo[]>();
    for (const beat of beats) {
      if (!grouped.has(beat.act)) {
        grouped.set(beat.act, []);
      }
      grouped.get(beat.act)!.push(beat);
    }
    // Sort beats within each act by position
    for (const [, actBeats] of grouped) {
      actBeats.sort((a, b) => a.positionIndex - b.positionIndex);
    }
    return grouped;
  }, [beats]);

  const handleFocusChange = (focusType: StoryBeatsFocusType) => {
    onChange({
      ...value,
      focusType,
      // Reset related fields when changing focus
      targetAct: focusType === 'act' ? value.targetAct ?? 1 : undefined,
      priorityBeats: focusType === 'beats' ? value.priorityBeats : [],
    });
  };

  const handleActChange = (act: 1 | 2 | 3 | 4 | 5) => {
    onChange({ ...value, targetAct: act });
  };

  const handleBeatToggle = (beatId: string) => {
    const newBeats = value.priorityBeats.includes(beatId)
      ? value.priorityBeats.filter((id) => id !== beatId)
      : [...value.priorityBeats, beatId];
    onChange({ ...value, priorityBeats: newBeats });
  };

  return (
    <div className={styles.container}>
      {/* Focus Type Radio Group */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>Focus</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="storyBeatsFocus"
              value="all"
              checked={value.focusType === 'all'}
              onChange={() => handleFocusChange('all')}
              disabled={disabled}
            />
            <span className={styles.radioLabel}>All Beats</span>
            <span className={styles.radioHint}>Generate for any unfilled beat</span>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="storyBeatsFocus"
              value="act"
              checked={value.focusType === 'act'}
              onChange={() => handleFocusChange('act')}
              disabled={disabled}
            />
            <span className={styles.radioLabel}>Specific Act</span>
            <span className={styles.radioHint}>Focus on one act at a time</span>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="storyBeatsFocus"
              value="beats"
              checked={value.focusType === 'beats'}
              onChange={() => handleFocusChange('beats')}
              disabled={disabled}
            />
            <span className={styles.radioLabel}>Priority Beats</span>
            <span className={styles.radioHint}>Select specific beats to fill</span>
          </label>
        </div>
      </div>

      {/* Act Selector (shown when focus is 'act') */}
      {value.focusType === 'act' && (
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Target Act</label>
          <select
            className={styles.select}
            value={value.targetAct ?? 1}
            onChange={(e) => handleActChange(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
            disabled={disabled}
          >
            {ACT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Beat Checklist (shown when focus is 'beats') */}
      {value.focusType === 'beats' && (
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Select Beats</label>
          {beats.length === 0 ? (
            <p className={styles.emptyState}>No beats available. Add structure first.</p>
          ) : (
            <div className={styles.beatChecklist}>
              {ACT_OPTIONS.map((actOpt) => {
                const actBeats = beatsByAct.get(actOpt.value) ?? [];
                if (actBeats.length === 0) return null;

                return (
                  <div key={actOpt.value} className={styles.actGroup}>
                    <div className={styles.actHeader}>{actOpt.label}</div>
                    <div className={styles.beatList}>
                      {actBeats.map((beat) => (
                        <label
                          key={beat.id}
                          className={`${styles.beatOption} ${beat.hasMissingStoryBeats ? styles.missing : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={value.priorityBeats.includes(beat.id)}
                            onChange={() => handleBeatToggle(beat.id)}
                            disabled={disabled}
                          />
                          <span className={styles.beatLabel}>
                            {beat.beatType}
                            {beat.hasMissingStoryBeats && (
                              <span className={styles.missingIndicator} title="Missing story beats">
                                {'\u25CF'}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
