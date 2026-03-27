/**
 * AssignSceneModal - Modal for assigning a scene to a plot point.
 */

import { useState } from 'react';
import type { OutlinePlotPoint } from '../../api/types';
import styles from './AssignModal.module.css';

interface AssignSceneModalProps {
  sceneHeading: string;
  plotPoints: OutlinePlotPoint[];
  onAssign: (plotPointId: string) => void;
  onCancel: () => void;
  saving?: boolean | undefined;
}

export function AssignSceneModal({
  sceneHeading,
  plotPoints,
  onAssign,
  onCancel,
  saving = false,
}: AssignSceneModalProps) {
  const [selectedPlotPointId, setSelectedPlotPointId] = useState<string | null>(null);

  const handleAssign = () => {
    if (selectedPlotPointId) {
      onAssign(selectedPlotPointId);
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
            Assign &quot;{sceneHeading}&quot; to a plot point:
          </p>

          <div className={styles.optionsList}>
            {plotPoints.length > 0 ? (
              plotPoints.map((plotPoint) => (
                <label
                  key={plotPoint.id}
                  className={`${styles.option} ${selectedPlotPointId === plotPoint.id ? styles.optionSelected : ''}`}
                >
                  <input
                    type="radio"
                    name="plotPoint"
                    value={plotPoint.id}
                    checked={selectedPlotPointId === plotPoint.id}
                    onChange={() => setSelectedPlotPointId(plotPoint.id)}
                    className={styles.radio}
                  />
                  <span className={styles.optionLabel}>{plotPoint.title}</span>
                  <span className={`${styles.optionIntent} ${styles[`intent_${plotPoint.intent}`]}`}>
                    {plotPoint.intent}
                  </span>
                </label>
              ))
            ) : (
              <div className={styles.emptyMessage}>
                No plot points available. Create a plot point first.
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
            disabled={!selectedPlotPointId || saving}
          >
            {saving ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
