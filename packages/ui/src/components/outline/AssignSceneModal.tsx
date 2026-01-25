/**
 * AssignSceneModal - Modal for assigning a scene to a story beat.
 */

import { useState } from 'react';
import type { OutlineStoryBeat } from '../../api/types';
import styles from './AssignModal.module.css';

interface AssignSceneModalProps {
  sceneHeading: string;
  storyBeats: OutlineStoryBeat[];
  onAssign: (storyBeatId: string) => void;
  onCancel: () => void;
  saving?: boolean | undefined;
}

export function AssignSceneModal({
  sceneHeading,
  storyBeats,
  onAssign,
  onCancel,
  saving = false,
}: AssignSceneModalProps) {
  const [selectedStoryBeatId, setSelectedStoryBeatId] = useState<string | null>(null);

  const handleAssign = () => {
    if (selectedStoryBeatId) {
      onAssign(selectedStoryBeatId);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Assign Scene</h3>
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
            Assign &quot;{sceneHeading}&quot; to a story beat:
          </p>

          <div className={styles.optionsList}>
            {storyBeats.length > 0 ? (
              storyBeats.map((storyBeat) => (
                <label
                  key={storyBeat.id}
                  className={`${styles.option} ${selectedStoryBeatId === storyBeat.id ? styles.optionSelected : ''}`}
                >
                  <input
                    type="radio"
                    name="storyBeat"
                    value={storyBeat.id}
                    checked={selectedStoryBeatId === storyBeat.id}
                    onChange={() => setSelectedStoryBeatId(storyBeat.id)}
                    className={styles.radio}
                  />
                  <span className={styles.optionLabel}>{storyBeat.title}</span>
                  <span className={`${styles.optionIntent} ${styles[`intent_${storyBeat.intent}`]}`}>
                    {storyBeat.intent}
                  </span>
                </label>
              ))
            ) : (
              <div className={styles.emptyMessage}>
                No story beats available. Create a story beat first.
              </div>
            )}
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
            disabled={!selectedStoryBeatId || saving}
          >
            {saving ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
