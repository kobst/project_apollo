import { useStory } from '../../context/StoryContext';
import styles from './ValidationStatus.module.css';

export function ValidationStatus() {
  const { preview } = useStory();

  if (!preview) {
    return null;
  }

  const { validation } = preview;
  const isValid = validation.valid;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Validation</span>
        <span className={`${styles.status} ${isValid ? styles.valid : styles.invalid}`}>
          {isValid ? '✓ Valid' : '✗ Invalid'}
        </span>
      </div>

      {!isValid && validation.errors && validation.errors.length > 0 && (
        <div className={styles.errors}>
          {validation.errors.map((error, index) => (
            <div key={index} className={styles.error}>
              <span className={styles.code}>{error.code}</span>
              {error.node_id && (
                <span className={styles.nodeId}>Node: {error.node_id}</span>
              )}
              {error.field && (
                <span className={styles.field}>Field: {error.field}</span>
              )}
              {error.suggested_fix && (
                <span className={styles.fix}>{error.suggested_fix}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
