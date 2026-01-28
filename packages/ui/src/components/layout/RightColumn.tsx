import styles from './Column.module.css';
import { DiffVisualization } from '../diff/DiffVisualization';
import { useStory } from '../../context/StoryContext';

export function RightColumn() {
  const { diff } = useStory();

  return (
    <aside className={styles.column}>
      {diff && <DiffVisualization />}
      {!diff && (
        <div className={styles.empty}>
          No changes to display
        </div>
      )}
    </aside>
  );
}
