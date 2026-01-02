import { useState } from 'react';
import { StoryProvider } from './context/StoryContext';
import styles from './App.module.css';
import { Header } from './components/layout/Header';
import { ViewTabs, type ViewMode } from './components/layout/ViewTabs';
import { LeftColumn } from './components/layout/LeftColumn';
import { CenterColumn } from './components/layout/CenterColumn';
import { RightColumn } from './components/layout/RightColumn';
import { Footer } from './components/layout/Footer';
import { ExploreView } from './components/explore/ExploreView';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('contract');

  return (
    <StoryProvider>
      <div className={styles.app}>
        <Header />
        <ViewTabs activeView={viewMode} onViewChange={setViewMode} />

        {viewMode === 'contract' && (
          <>
            <main className={styles.main}>
              <LeftColumn />
              <CenterColumn />
              <RightColumn />
            </main>
            <Footer />
          </>
        )}

        {viewMode === 'explore' && (
          <ExploreView />
        )}

        {viewMode === 'outline' && (
          <div className={styles.placeholder}>
            <h2>Outline View</h2>
            <p>Coming in Phase C.1b</p>
          </div>
        )}
      </div>
    </StoryProvider>
  );
}
