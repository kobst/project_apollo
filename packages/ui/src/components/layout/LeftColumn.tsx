import styles from './Column.module.css';
import { StorySelector } from '../story/StorySelector';
import { StoryStatus } from '../story/StoryStatus';
import { OpenQuestionsList } from '../questions/OpenQuestionsList';

export function LeftColumn() {
  return (
    <aside className={styles.column}>
      <StorySelector />
      <StoryStatus />
      <OpenQuestionsList />
    </aside>
  );
}
