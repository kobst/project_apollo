import type { OutlineScene } from '../../api/types';
import { useStructureEdit } from '../workspace/StructureSection';
import styles from './SceneCard.module.css';

interface SceneCardProps {
  scene: OutlineScene;
  beatId: string;
  parentStoryBeatId?: string;
  onUpdate?: () => void;
}

export function SceneCard({ scene, beatId: _beatId, parentStoryBeatId: _parentStoryBeatId }: SceneCardProps) {
  const { onEditScene } = useStructureEdit();

  const displayHeading = scene.heading || 'Untitled Scene';
  const maxOverview = 60;
  const displayOverview = scene.overview.length > maxOverview
    ? scene.overview.slice(0, maxOverview) + '...'
    : scene.overview;

  const handleClick = () => {
    onEditScene(scene);
  };

  return (
    <div
      className={styles.container}
      onClick={handleClick}
    >
      <div className={styles.header}>
        {scene.intExt && <span className={styles.intExt}>{scene.intExt}</span>}
        <span className={styles.heading}>{displayHeading}</span>
      </div>

      {displayOverview && (
        <div className={styles.overview}>{displayOverview}</div>
      )}

      <div className={styles.meta}>
        {scene.timeOfDay && (
          <span className={styles.metaItem}>{scene.timeOfDay}</span>
        )}
        {scene.mood && (
          <span className={styles.metaItem}>{scene.mood}</span>
        )}
      </div>
    </div>
  );
}
