import { useStory } from '../../context/StoryContext';
import { OpenQuestionItem } from './OpenQuestionItem';
import styles from './OpenQuestionsList.module.css';

export function OpenQuestionsList() {
  const { openQuestions, selectedOQ, status } = useStory();

  if (!status) {
    return null;
  }

  const blockingCount = openQuestions.filter((q) => q.severity === 'BLOCKING').length;
  const importantCount = openQuestions.filter((q) => q.severity === 'IMPORTANT').length;
  const softCount = openQuestions.filter((q) => q.severity === 'SOFT').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Open Questions</span>
        <span className={styles.count}>{openQuestions.length}</span>
      </div>

      <div className={styles.summary}>
        {blockingCount > 0 && (
          <span className={styles.blocking}>{blockingCount} blocking</span>
        )}
        {importantCount > 0 && (
          <span className={styles.important}>{importantCount} important</span>
        )}
        {softCount > 0 && (
          <span className={styles.soft}>{softCount} soft</span>
        )}
      </div>

      <div className={styles.list}>
        {openQuestions.map((oq) => (
          <OpenQuestionItem
            key={oq.id}
            question={oq}
            selected={selectedOQ?.id === oq.id}
          />
        ))}
        {openQuestions.length === 0 && (
          <div className={styles.empty}>No open questions</div>
        )}
      </div>
    </div>
  );
}
