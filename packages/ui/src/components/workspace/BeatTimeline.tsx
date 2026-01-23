/**
 * BeatTimeline - Horizontal beat visualization with dots and labels.
 * Shows filled dots for beats with content, empty dots for empty beats.
 * Supports selected state for focused beat.
 */

import type { MergedOutlineBeat } from '../../utils/outlineMergeUtils';
import styles from './BeatTimeline.module.css';

interface BeatTimelineProps {
  beats: MergedOutlineBeat[];
  selectedBeatId?: string | null;
  onBeatClick?: (beatId: string) => void;
}

// Format beat type for display (e.g., "FunAndGames" -> "Fun & Games")
function formatBeatType(beatType: string): string {
  return beatType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^[\s]/, '')
    .replace('And', '&')
    .trim();
}

// Check if beat has any content
function beatHasContent(beat: MergedOutlineBeat): boolean {
  return beat.storyBeats.length > 0;
}

// Check if beat has proposed content
function beatHasProposed(beat: MergedOutlineBeat): boolean {
  return beat.storyBeats.some(pp => pp._isProposed || pp.scenes.some(s => s._isProposed));
}

export function BeatTimeline({ beats, selectedBeatId, onBeatClick }: BeatTimelineProps) {
  return (
    <div className={styles.container}>
      <div className={styles.timeline}>
        {beats.map((beat, index) => {
          const hasContent = beatHasContent(beat);
          const hasProposed = beatHasProposed(beat);
          const isSelected = beat.id === selectedBeatId;

          return (
            <div key={beat.id} className={`${styles.beatItem} ${isSelected ? styles.selected : ''}`}>
              {/* Connector line (except for first beat) */}
              {index > 0 && <div className={styles.connector} />}

              {/* Beat dot */}
              <button
                type="button"
                className={`${styles.dot} ${hasContent ? styles.filled : styles.empty} ${hasProposed ? styles.proposed : ''} ${isSelected ? styles.selected : ''}`}
                onClick={() => onBeatClick?.(beat.id)}
                title={beat.guidance || formatBeatType(beat.beatType)}
              >
                {hasContent ? '\u25CF' : '\u25CB'}
              </button>

              {/* Beat label */}
              <span className={`${styles.label} ${isSelected ? styles.selected : ''}`}>
                {formatBeatType(beat.beatType)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
