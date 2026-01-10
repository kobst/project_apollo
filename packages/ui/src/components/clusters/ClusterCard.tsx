import { useStory } from '../../context/StoryContext';
import { MoveCard } from './MoveCard';
import styles from './ClusterCard.module.css';

export function ClusterCard() {
  const { cluster, selectedMoveId } = useStory();

  if (!cluster) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{cluster.title}</h3>
        <div className={styles.meta}>
          <span className={styles.type}>{cluster.clusterType}</span>
        </div>
      </div>

      <div className={styles.moves}>
        {cluster.moves.map((move) => (
          <MoveCard
            key={move.id}
            move={move}
            selected={selectedMoveId === move.id}
          />
        ))}
      </div>
    </div>
  );
}
