/**
 * PremiseHeader - Simple header showing only the story title.
 * Premise editing is now handled by PremisePanel in the sidebar navigation.
 */

import { useStory } from '../../context/StoryContext';
import styles from './PremiseHeader.module.css';

export function PremiseHeader() {
  const { currentStoryId, status } = useStory();
  const storyName = status?.name || currentStoryId || 'Untitled Story';

  return (
    <div className={styles.container}>
      <h1 className={styles.storyName}>{storyName}</h1>
    </div>
  );
}
