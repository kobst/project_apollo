import styles from './Column.module.css';
import { ClusterControls } from '../clusters/ClusterControls';
import { ClusterCard } from '../clusters/ClusterCard';
import { useStory } from '../../context/StoryContext';

export function CenterColumn() {
  const { cluster } = useStory();

  return (
    <section className={`${styles.column} ${styles.center}`}>
      <ClusterControls />
      {cluster && <ClusterCard />}
    </section>
  );
}
