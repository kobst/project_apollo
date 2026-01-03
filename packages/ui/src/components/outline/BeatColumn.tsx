import type { OutlineBeat } from '../../api/types';
import { SceneCard } from './SceneCard';
import { EmptyBeatSlot } from './EmptyBeatSlot';
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
  const hasScenes = beat.scenes.length > 0;
  const statusClass = beat.status === 'REALIZED'
    ? styles.realized
    : beat.status === 'PLANNED'
    ? styles.planned
    : styles.empty;

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

      {beat.notes && (
        <div className={styles.notes} title={beat.notes}>
          Note
        </div>
      )}
    </div>
  );
}
