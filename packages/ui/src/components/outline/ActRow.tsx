import type { OutlineAct } from '../../api/types';
import { BeatColumn } from './BeatColumn';
import styles from './ActRow.module.css';

interface ActRowProps {
  act: OutlineAct;
}

const ACT_NAMES: Record<number, string> = {
  1: 'Act 1 - Setup',
  2: 'Act 2A - Fun & Games',
  3: 'Act 3 - Midpoint & Bad Guys',
  4: 'Act 4 - All Is Lost',
  5: 'Act 5 - Finale',
};

// Calculate total scenes for a beat (from all plot points)
function getBeatSceneCount(beat: { plotPoints: { scenes: unknown[] }[] }): number {
  return beat.plotPoints.reduce((sum, pp) => sum + pp.scenes.length, 0);
}

export function ActRow({ act }: ActRowProps) {
  const actName = ACT_NAMES[act.act] || `Act ${act.act}`;
  const sceneCount = act.beats.reduce((sum, b) => sum + getBeatSceneCount(b), 0);
  const emptyCount = act.beats.filter((b) => getBeatSceneCount(b) === 0).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.actTitle}>{actName}</h3>
        <span className={styles.stats}>
          {act.beats.length} beats, {sceneCount} scenes
          {emptyCount > 0 && (
            <span className={styles.emptyWarning}> ({emptyCount} empty)</span>
          )}
        </span>
      </div>

      <div className={styles.beatsRow}>
        {act.beats.map((beat) => (
          <BeatColumn key={beat.id} beat={beat} />
        ))}
      </div>
    </div>
  );
}
