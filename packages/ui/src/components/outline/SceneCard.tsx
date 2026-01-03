import type { OutlineScene } from '../../api/types';
import styles from './SceneCard.module.css';

interface SceneCardProps {
  scene: OutlineScene;
  beatId: string;
}

export function SceneCard({ scene, beatId: _beatId }: SceneCardProps) {
  // Format heading for display
  const displayHeading = scene.heading || 'Untitled Scene';

  // Truncate overview if too long
  const maxOverview = 60;
  const displayOverview = scene.overview.length > maxOverview
    ? scene.overview.slice(0, maxOverview) + '...'
    : scene.overview;

  const handleClick = () => {
    // TODO: Navigate to Explore view with this scene selected
    console.log('Navigate to scene:', scene.id);
  };

  return (
    <div className={styles.container} onClick={handleClick}>
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
