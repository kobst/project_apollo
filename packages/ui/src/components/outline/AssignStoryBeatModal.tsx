/**
 * AssignStoryBeatModal - Modal for assigning a story beat to a structural beat.
 */

import { useState } from 'react';
import styles from './AssignModal.module.css';

interface AssignStoryBeatModalProps {
  storyBeatTitle: string;
  beats: Array<{ id: string; beatType: string; act: number }>;
  onAssign: (beatId: string) => void;
  onCancel: () => void;
  saving?: boolean | undefined;
}

// Format beat type for display (e.g., "FunAndGames" -> "Fun & Games")
function formatBeatType(beatType: string): string {
  return beatType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^[\s]/, '')
    .replace('And', '&')
    .trim();
}

export function AssignStoryBeatModal({
  storyBeatTitle,
  beats,
  onAssign,
  onCancel,
  saving = false,
}: AssignStoryBeatModalProps) {
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);

  // Group beats by act
  const beatsByAct = beats.reduce<Record<number, typeof beats>>((acc, beat) => {
    if (!acc[beat.act]) {
      acc[beat.act] = [];
    }
    acc[beat.act]!.push(beat);
    return acc;
  }, {});

  const handleAssign = () => {
    if (selectedBeatId) {
      onAssign(selectedBeatId);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Assign Story Beat</h3>
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
          <p className={styles.description}>
            Assign &quot;{storyBeatTitle}&quot; to a structural beat:
          </p>

          <div className={styles.optionsList}>
            {Object.entries(beatsByAct)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([act, actBeats]) => (
                <div key={act} className={styles.actGroup}>
                  <h4 className={styles.actHeader}>Act {act}</h4>
                  {actBeats.map((beat) => (
                    <label
                      key={beat.id}
                      className={`${styles.option} ${selectedBeatId === beat.id ? styles.optionSelected : ''}`}
                    >
                      <input
                        type="radio"
                        name="beat"
                        value={beat.id}
                        checked={selectedBeatId === beat.id}
                        onChange={() => setSelectedBeatId(beat.id)}
                        className={styles.radio}
                      />
                      <span className={styles.optionLabel}>
                        {formatBeatType(beat.beatType)}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            type="button"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className={styles.assignBtn}
            onClick={handleAssign}
            type="button"
            disabled={!selectedBeatId || saving}
          >
            {saving ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
