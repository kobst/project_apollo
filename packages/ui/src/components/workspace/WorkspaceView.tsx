import { useState } from 'react';
import { useStory } from '../../context/StoryContext';
import { StoryMap, type StoryMapCategory } from './StoryMap';
import { FoundationsPanel } from './FoundationsPanel';
import { OutlineView } from '../outline/OutlineView';
import styles from './WorkspaceView.module.css';

// Map StoryMapCategory to node types for the foundations panel
const CATEGORY_TO_NODE_TYPE: Record<StoryMapCategory, string> = {
  premise: 'Premise',
  genreTone: 'GenreTone',
  setting: 'Setting',
  characters: 'Character',
  conflicts: 'Conflict',
  themes: 'Theme', // Will also include Motif
  board: 'Beat', // Not used directly, board uses OutlineView
  plotPoints: 'PlotPoint',
  scenes: 'Scene',
};

export function WorkspaceView() {
  const { currentStoryId, status } = useStory();
  const [selectedCategory, setSelectedCategory] = useState<StoryMapCategory>('premise');

  if (!currentStoryId) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No Story Selected</h2>
          <p>Select a story from the Stories tab to begin.</p>
        </div>
      </div>
    );
  }

  // Determine what to render in the main panel
  const renderMainPanel = () => {
    // Board view uses the existing OutlineView
    if (selectedCategory === 'board') {
      return <OutlineView />;
    }

    // All other categories use the FoundationsPanel (list + editor)
    const nodeType = CATEGORY_TO_NODE_TYPE[selectedCategory];
    const includeMotifs = selectedCategory === 'themes';

    return (
      <FoundationsPanel
        key={selectedCategory}
        category={selectedCategory}
        nodeType={nodeType}
        includeMotifs={includeMotifs}
      />
    );
  };

  return (
    <div className={styles.container}>
      <StoryMap
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <div className={styles.mainPanel}>
        <div className={styles.mainHeader}>
          <h2 className={styles.storyTitle}>{status?.name || currentStoryId}</h2>
        </div>
        <div className={styles.mainContent}>
          {renderMainPanel()}
        </div>
      </div>
    </div>
  );
}
