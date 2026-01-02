import { useStory } from '../../context/StoryContext';
import { PatchOpItem } from './PatchOpItem';
import styles from './PatchPreview.module.css';

export function PatchPreview() {
  const { preview, previewLoading } = useStory();

  if (previewLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading preview...</div>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Patch Preview</span>
        <span className={styles.count}>{preview.patch.ops.length} ops</span>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <span className={styles.label}>Patch ID:</span>
          <span className={styles.value}>{preview.patch.id}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.label}>Base Version:</span>
          <span className={styles.value}>
            {preview.patch.baseVersionId.slice(0, 12)}...
          </span>
        </div>
      </div>

      <div className={styles.ops}>
        {preview.patch.ops.map((op, index) => (
          <PatchOpItem key={index} op={op} />
        ))}
      </div>
    </div>
  );
}
