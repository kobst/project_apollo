import { useState } from 'react';
import { StoryProvider } from './context/StoryContext';
import styles from './App.module.css';
import { Header } from './components/layout/Header';
import { ViewTabs, type ViewMode } from './components/layout/ViewTabs';
import { ExploreView } from './components/explore/ExploreView';
import { OutlineView } from './components/outline/OutlineView';
import { CoverageView } from './components/coverage/CoverageView';
import { StoriesView } from './components/stories/StoriesView';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('stories');

  return (
    <StoryProvider>
      <div className={styles.app}>
        <Header />
        <ViewTabs activeView={viewMode} onViewChange={setViewMode} />

        {viewMode === 'stories' && <StoriesView />}

        {viewMode === 'coverage' && <CoverageView />}

        {viewMode === 'explore' && <ExploreView />}

        {viewMode === 'outline' && <OutlineView />}
      </div>
    </StoryProvider>
  );
}
