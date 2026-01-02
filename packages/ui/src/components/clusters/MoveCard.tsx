import { useStory } from '../../context/StoryContext';
import type { MoveData } from '../../api/types';
import styles from './MoveCard.module.css';

interface Props {
  move: MoveData;
  selected: boolean;
}

export function MoveCard({ move, selected }: Props) {
  const { selectMove, previewLoading } = useStory();

  const handleClick = () => {
    void selectMove(selected ? null : move.id);
  };

  const confidencePercent = Math.round(move.confidence * 100);
  const confidenceClass =
    confidencePercent >= 80
      ? styles.high
      : confidencePercent >= 50
        ? styles.medium
        : styles.low;

  return (
    <button
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={handleClick}
      disabled={previewLoading}
      type="button"
    >
      <div className={styles.header}>
        <span className={styles.title}>{move.title}</span>
        <span className={`${styles.confidence} ${confidenceClass}`}>
          {confidencePercent}%
        </span>
      </div>
      <div className={styles.rationale}>{move.rationale}</div>
      <div className={styles.footer}>
        <span className={styles.id}>{move.id}</span>
        {selected && <span className={styles.badge}>Selected</span>}
      </div>
    </button>
  );
}
