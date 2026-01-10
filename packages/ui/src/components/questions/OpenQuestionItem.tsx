import { useStory } from '../../context/StoryContext';
import type { OpenQuestionData } from '../../api/types';
import styles from './OpenQuestionItem.module.css';

interface Props {
  question: OpenQuestionData;
  selected: boolean;
}

export function OpenQuestionItem({ question, selected }: Props) {
  const { selectOQ } = useStory();

  return (
    <button
      className={`${styles.item} ${selected ? styles.selected : ''}`}
      onClick={() => selectOQ(question)}
      type="button"
    >
      <div className={styles.top}>
        <span className={styles.domain}>{question.domain}</span>
      </div>
      <div className={styles.message}>{question.message}</div>
      {question.target_node_id && (
        <div className={styles.target}>
          Target: {question.target_node_id}
        </div>
      )}
    </button>
  );
}
