import styles from './Column.module.css';
import { useStory } from '../../context/StoryContext';

export function CenterColumn() {
  const { cluster } = useStory();

  return (
    <section className={`${styles.column} ${styles.center}`}>
      {/* Cluster UI removed */}
    </section>
  );
}
