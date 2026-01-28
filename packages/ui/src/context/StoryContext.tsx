/**
 * Global story state context
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import type { StatusData, OpenQuestionData, DiffData } from '../api/types';

interface StoryContextValue {
  // Story state
  stories: string[];
  currentStoryId: string | null;
  status: StatusData | null;
  loading: boolean;
  error: string | null;

  // OQ state
  openQuestions: OpenQuestionData[];
  selectedOQ: OpenQuestionData | null;

  // (clusters/moves removed)

  // Diff state
  diff: DiffData | null;

  // Actions
  refreshStories: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  selectStory: (id: string) => Promise<void>;
  createStory: (name: string, logline: string) => Promise<void>;
  selectOQ: (oq: OpenQuestionData | null) => void;
  // (clusters/moves removed)
}

const StoryContext = createContext<StoryContextValue | null>(null);

export function useStory(): StoryContextValue {
  const context = useContext(StoryContext);
  if (!context) {
    throw new Error('useStory must be used within StoryProvider');
  }
  return context;
}

interface StoryProviderProps {
  children: ReactNode;
}

export function StoryProvider({ children }: StoryProviderProps) {
  // Story state
  const [stories, setStories] = useState<string[]>([]);
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OQ state
  const [openQuestions, setOpenQuestions] = useState<OpenQuestionData[]>([]);
  const [selectedOQ, setSelectedOQ] = useState<OpenQuestionData | null>(null);

  // (clusters/moves removed)

  // Diff state
  const [diff, setDiff] = useState<DiffData | null>(null);

  // Refresh stories list
  const refreshStories = useCallback(async () => {
    try {
      const data = await api.listStories();
      setStories(data.stories);
    } catch (err) {
      console.error('Failed to list stories:', err);
    }
  }, []);

  // Refresh status for current story (updates stats, etc.)
  const refreshStatus = useCallback(async () => {
    if (!currentStoryId) return;
    try {
      const [statusData, oqData] = await Promise.all([
        api.getStatus(currentStoryId),
        api.getOpenQuestions(currentStoryId),
      ]);
      setStatus(statusData);
      setOpenQuestions(oqData.questions);
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
  }, [currentStoryId]);

  // Load stories on mount
  useEffect(() => {
    void refreshStories();
  }, [refreshStories]);

  // Select a story
  const selectStory = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setSelectedOQ(null);
    setDiff(null);

    try {
      const [statusData, oqData] = await Promise.all([
        api.getStatus(id),
        api.getOpenQuestions(id),
      ]);
      setCurrentStoryId(id);
      setStatus(statusData);
      setOpenQuestions(oqData.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load story');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new story
  const createStory = useCallback(
    async (name: string, logline: string) => {
      setLoading(true);
      setError(null);

      try {
        const data = await api.createStory({ name, logline });
        await refreshStories();
        await selectStory(data.storyId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create story');
        setLoading(false);
      }
    },
    [refreshStories, selectStory]
  );

  // Select an open question
  const selectOQ = useCallback((oq: OpenQuestionData | null) => {
    setSelectedOQ(oq);
  }, []);

  // (clusters/moves removed)

  const value: StoryContextValue = {
    stories,
    currentStoryId,
    status,
    loading,
    error,
    openQuestions,
    selectedOQ,
    // clusters/moves removed
    diff,
    refreshStories,
    refreshStatus,
    selectStory,
    createStory,
    selectOQ,
    // clusters/moves removed
  };

  return (
    <StoryContext.Provider value={value}>{children}</StoryContext.Provider>
  );
}
