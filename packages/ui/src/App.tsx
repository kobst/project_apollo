import { useState } from 'react';
import { StoryProvider } from './context/StoryContext';
import { GenerationProvider } from './context/GenerationContext';
import styles from './App.module.css';
import { Header } from './components/layout/Header';
import { ViewTabs, type ViewMode } from './components/layout/ViewTabs';
import { StoriesView } from './components/stories/StoriesView';
import { WorkspaceView } from './components/workspace';
import { GenerationView } from './components/generation';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('stories');

  return (
    <StoryProvider>
      <GenerationProvider>
        <div className={styles.app}>
          <Header />
          <ViewTabs activeView={viewMode} onViewChange={setViewMode} />

          {viewMode === 'stories' && <StoriesView />}

          {viewMode === 'workspace' && <WorkspaceView />}

          {viewMode === 'generation' && <GenerationView />}
        </div>
      </GenerationProvider>
    </StoryProvider>
  );
}
