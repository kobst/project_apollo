import styles from './Column.module.css';
import { PatchPreview } from '../preview/PatchPreview';
import { DiffVisualization } from '../diff/DiffVisualization';
import { ValidationStatus } from '../preview/ValidationStatus';
import { useStory } from '../../context/StoryContext';

export function RightColumn() {
  const { preview, diff } = useStory();

  return (
    <aside className={styles.column}>
      {preview && (
        <>
          <PatchPreview />
          <ValidationStatus />
        </>
      )}
      {diff && <DiffVisualization />}
      {!preview && !diff && (
        <div className={styles.empty}>
          Select a move to see preview
        </div>
      )}
    </aside>
  );
}
