import { useState } from 'react';
import { useStory } from '../../context/StoryContext';
import { StoryMap, type StoryMapCategory } from './StoryMap';
import { FoundationsPanel } from './FoundationsPanel';
import { OutlineView } from '../outline/OutlineView';
import { StoryContextEditor } from '../context/StoryContextEditor';
import styles from './WorkspaceView.module.css';

// Map StoryMapCategory to node types for the foundations panel
// null values indicate special categories that don't use FoundationsPanel
const CATEGORY_TO_NODE_TYPE: Record<StoryMapCategory, string | null> = {
  storyContext: null, // Special: uses StoryContextEditor
  logline: 'Logline',
  genreTone: 'GenreTone',
  setting: 'Setting',
  characters: 'Character',
  conflicts: 'Conflict',
  themes: 'Theme', // Will also include Motif
  locations: 'Location',
  objects: 'Object',
  board: null, // Special: uses OutlineView
  plotPoints: 'PlotPoint',
  scenes: 'Scene',
  unassigned: null, // Special: staging area (will use OutlineView)
};

export function WorkspaceView() {
  const { currentStoryId, status } = useStory();
  const [selectedCategory, setSelectedCategory] = useState<StoryMapCategory>('logline');

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
    // Story Context uses a dedicated editor
    if (selectedCategory === 'storyContext') {
      return <StoryContextEditor />;
    }

    // Board and Unassigned use the OutlineView
    if (selectedCategory === 'board' || selectedCategory === 'unassigned') {
      return <OutlineView />;
    }

    // All other categories use the FoundationsPanel (list + editor)
    const nodeType = CATEGORY_TO_NODE_TYPE[selectedCategory];
    if (!nodeType) {
      return <div>Unknown category</div>;
    }

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
