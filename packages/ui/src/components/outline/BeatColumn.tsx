import { useState, useCallback } from 'react';
import type { OutlineStoryBeat, CreateStoryBeatRequest } from '../../api/types';
import type { MergedOutlineBeat, MergedOutlineStoryBeat } from '../../utils/outlineMergeUtils';
import { useStory } from '../../context/StoryContext';
import { useStoryBeats } from '../../hooks/useStoryBeats';
import { useEdit } from '../workspace/StructureBoard';
import { SceneCard } from './SceneCard';
import { ProposedStoryBeatCard } from './ProposedStoryBeatCard';
import { EmptyBeatSlot } from './EmptyBeatSlot';
import { AddStoryBeatModal } from './AddStoryBeatModal';
import styles from './BeatColumn.module.css';

interface BeatColumnProps {
  beat: MergedOutlineBeat;
  onEditProposed?: ((nodeId: string, updates: Partial<Record<string, unknown>>) => void) | undefined;
  onRemoveProposed?: ((nodeId: string) => void) | undefined;
  removedNodeIds?: Set<string> | undefined;
}

// Format beat type for display (e.g., "FunAndGames" -> "Fun & Games")
function formatBeatType(beatType: string): string {
  return beatType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^[\s]/, '')
    .replace('And', '&')
    .trim();
}

// Render a single StoryBeat with its nested scenes (existing nodes only)
function StoryBeatContainer({ pp, beatId }: { pp: MergedOutlineStoryBeat; beatId: string }) {
  const { onEditStoryBeat } = useEdit();
  const hasScenes = pp.scenes.length > 0;

  const handleClick = () => {
    // Cast to OutlineStoryBeat for the edit handler (it only needs id, title, intent, scenes)
    onEditStoryBeat(pp as unknown as OutlineStoryBeat);
  };

  return (
    <div className={styles.storyBeatContainer}>
      <div className={styles.storyBeatHeader} onClick={handleClick}>
        <span className={styles.storyBeatTitle}>{pp.title}</span>
        <span className={`${styles.storyBeatIntent} ${styles[pp.intent]}`}>
          {pp.intent}
        </span>
      </div>
      <div className={styles.nestedScenes}>
        {hasScenes ? (
          pp.scenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} beatId={beatId} />
          ))
        ) : (
          <div className={styles.emptyStoryBeat}>No scenes yet</div>
        )}
      </div>
    </div>
  );
}

export function BeatColumn({
  beat,
  onEditProposed,
  onRemoveProposed,
  removedNodeIds,
}: BeatColumnProps) {
  const { currentStoryId, refreshStatus } = useStory();
  const { createStoryBeat, isLoading } = useStoryBeats({
    storyId: currentStoryId ?? '',
  });

  const [showAddPPModal, setShowAddPPModal] = useState(false);

  const hasContent = beat.storyBeats.length > 0;

  const statusClass = beat.status === 'REALIZED'
    ? styles.realized
    : beat.status === 'PLANNED'
    ? styles.planned
    : styles.empty;

  const handleAddStoryBeat = useCallback(
    async (data: CreateStoryBeatRequest) => {
      const result = await createStoryBeat(data);
      if (result) {
        setShowAddPPModal(false);
        refreshStatus?.();
      }
    },
    [createStoryBeat, refreshStatus]
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

      <div className={styles.content}>
        {/* Story Beats with nested scenes - mix of existing and proposed */}
        {beat.storyBeats.length > 0 && (
          <div className={styles.storyBeatsSection}>
            {beat.storyBeats.map((pp) =>
              pp._isProposed ? (
                <ProposedStoryBeatCard
                  key={pp.id}
                  storyBeat={pp}
                  beatId={beat.id}
                  onEdit={onEditProposed!}
                  onRemove={pp._operation === 'add' ? onRemoveProposed : undefined}
                  isRemoved={removedNodeIds?.has(pp.id)}
                />
              ) : (
                <StoryBeatContainer key={pp.id} pp={pp} beatId={beat.id} />
              )
            )}
          </div>
        )}

        {/* Empty state when no content */}
        {!hasContent && (
          <EmptyBeatSlot beatId={beat.id} beatType={beat.beatType} />
        )}
      </div>

      {/* Add Story Beat button */}
      <button
        className={styles.addStoryBeatBtn}
        onClick={() => setShowAddPPModal(true)}
        type="button"
        title="Add a plot point aligned to this beat"
      >
        + Story Beat
      </button>

      {beat.notes && (
        <div className={styles.notes} title={beat.notes}>
          Note
        </div>
      )}

      {/* Add Story Beat Modal */}
      {showAddPPModal && (
        <AddStoryBeatModal
          beatId={beat.id}
          beatType={beat.beatType}
          act={beat.act as 1 | 2 | 3 | 4 | 5}
          onAdd={handleAddStoryBeat}
          onCancel={() => setShowAddPPModal(false)}
          saving={isLoading}
        />
      )}
    </div>
  );
}
