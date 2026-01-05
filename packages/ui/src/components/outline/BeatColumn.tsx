import { useState, useCallback } from 'react';
import type { OutlineBeat, CreatePlotPointRequest } from '../../api/types';
import { useStory } from '../../context/StoryContext';
import { usePlotPoints } from '../../hooks/usePlotPoints';
import { SceneCard } from './SceneCard';
import { EmptyBeatSlot } from './EmptyBeatSlot';
import { AddPlotPointModal } from './AddPlotPointModal';
import styles from './BeatColumn.module.css';

interface BeatColumnProps {
  beat: OutlineBeat;
}

// Format beat type for display (e.g., "FunAndGames" -> "Fun & Games")
function formatBeatType(beatType: string): string {
  return beatType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^[\s]/, '')
    .replace('And', '&')
    .trim();
}

export function BeatColumn({ beat }: BeatColumnProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const { createPlotPoint, isLoading } = usePlotPoints({
    storyId: currentStoryId ?? '',
  });

  const [showAddPPModal, setShowAddPPModal] = useState(false);

  const hasScenes = beat.scenes.length > 0;
  const statusClass = beat.status === 'REALIZED'
    ? styles.realized
    : beat.status === 'PLANNED'
    ? styles.planned
    : styles.empty;

  const handleAddPlotPoint = useCallback(
    async (data: CreatePlotPointRequest) => {
      const result = await createPlotPoint(data);
      if (result) {
        setShowAddPPModal(false);
        // Refresh status to update counts
        refreshStatus?.();
      }
    },
    [createPlotPoint, refreshStatus]
  );

  return (
    <div className={`${styles.container} ${statusClass}`}>
      <div className={styles.header}>
        <span className={styles.beatType}>{formatBeatType(beat.beatType)}</span>
        {beat.guidance && (
          <span className={styles.guidance} title={beat.guidance}>
            ?
          </span>
        )}
      </div>

      <div className={styles.scenes}>
        {hasScenes ? (
          beat.scenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} beatId={beat.id} />
          ))
        ) : (
          <EmptyBeatSlot beatId={beat.id} beatType={beat.beatType} />
        )}
      </div>

      {/* Add Plot Point button */}
      <button
        className={styles.addPlotPointBtn}
        onClick={() => setShowAddPPModal(true)}
        type="button"
        title="Add a plot point aligned to this beat"
      >
        + Plot Point
      </button>

      {beat.notes && (
        <div className={styles.notes} title={beat.notes}>
          Note
        </div>
      )}

      {/* Add Plot Point Modal */}
      {showAddPPModal && (
        <AddPlotPointModal
          beatId={beat.id}
          beatType={beat.beatType}
          act={beat.act as 1 | 2 | 3 | 4 | 5}
          onAdd={handleAddPlotPoint}
          onCancel={() => setShowAddPPModal(false)}
          saving={isLoading}
        />
      )}
    </div>
  );
}
