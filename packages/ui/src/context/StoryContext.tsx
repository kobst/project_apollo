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
import type {
  StatusData,
  OpenQuestionData,
  ClusterData,
  PreviewData,
  DiffData,
} from '../api/types';

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

  // Cluster state
  cluster: ClusterData | null;
  clusterLoading: boolean;
  clusterCount: number;
  showSeed: boolean;

  // Scoped generation state
  scopedNodeId: string | null;

  // Move state
  selectedMoveId: string | null;
  preview: PreviewData | null;
  previewLoading: boolean;

  // Diff state
  diff: DiffData | null;

  // Actions
  refreshStories: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  selectStory: (id: string) => Promise<void>;
  createStory: (name: string, logline: string) => Promise<void>;
  selectOQ: (oq: OpenQuestionData | null) => void;
  generateCluster: () => Promise<void>;
  generateScopedCluster: (nodeId: string) => Promise<void>;
  selectMove: (moveId: string | null) => Promise<void>;
  acceptMove: () => Promise<void>;
  rejectAll: () => void;
  setClusterCount: (count: number) => void;
  setShowSeed: (show: boolean) => void;
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

  // Cluster state
  const [cluster, setCluster] = useState<ClusterData | null>(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [clusterCount, setClusterCount] = useState(4);
  const [showSeed, setShowSeed] = useState(false);

  // Scoped generation state
  const [scopedNodeId, setScopedNodeId] = useState<string | null>(null);

  // Move state
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
    setCluster(null);
    setSelectedOQ(null);
    setSelectedMoveId(null);
    setPreview(null);
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
    setCluster(null);
    setSelectedMoveId(null);
    setPreview(null);
  }, []);

  // Generate cluster for selected OQ
  const generateCluster = useCallback(async () => {
    if (!currentStoryId || !selectedOQ) return;

    setClusterLoading(true);
    setSelectedMoveId(null);
    setPreview(null);
    setScopedNodeId(null);

    try {
      const data = await api.generateCluster(currentStoryId, {
        oqId: selectedOQ.id,
        count: clusterCount,
      });
      setCluster(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate cluster'
      );
    } finally {
      setClusterLoading(false);
    }
  }, [currentStoryId, selectedOQ, clusterCount]);

  // Generate cluster scoped to a specific node
  const generateScopedCluster = useCallback(async (nodeId: string) => {
    if (!currentStoryId) return;

    setClusterLoading(true);
    setSelectedMoveId(null);
    setPreview(null);
    setSelectedOQ(null);
    setScopedNodeId(nodeId);

    try {
      const data = await api.generateCluster(currentStoryId, {
        scopeNodeId: nodeId,
        count: clusterCount,
      });
      setCluster(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate cluster'
      );
      setScopedNodeId(null);
    } finally {
      setClusterLoading(false);
    }
  }, [currentStoryId, clusterCount]);

  // Select a move and load preview
  const selectMove = useCallback(
    async (moveId: string | null) => {
      setSelectedMoveId(moveId);

      if (!moveId || !currentStoryId) {
        setPreview(null);
        return;
      }

      setPreviewLoading(true);

      try {
        const data = await api.previewMove(currentStoryId, moveId);
        setPreview(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load preview'
        );
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [currentStoryId]
  );

  // Accept the selected move
  const acceptMove = useCallback(async () => {
    if (!currentStoryId || !selectedMoveId) return;

    setLoading(true);

    try {
      await api.acceptMoves(currentStoryId, [selectedMoveId]);

      // Get diff before refreshing
      const diffData = await api.getDiff(currentStoryId);
      setDiff(diffData);

      // Refresh status and OQs
      const [statusData, oqData] = await Promise.all([
        api.getStatus(currentStoryId),
        api.getOpenQuestions(currentStoryId),
      ]);

      setStatus(statusData);
      setOpenQuestions(oqData.questions);
      setCluster(null);
      setSelectedMoveId(null);
      setPreview(null);
      setSelectedOQ(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept move');
    } finally {
      setLoading(false);
    }
  }, [currentStoryId, selectedMoveId]);

  // Reject all moves (clear cluster)
  const rejectAll = useCallback(() => {
    setCluster(null);
    setSelectedMoveId(null);
    setPreview(null);
    setScopedNodeId(null);
  }, []);

  const value: StoryContextValue = {
    stories,
    currentStoryId,
    status,
    loading,
    error,
    openQuestions,
    selectedOQ,
    cluster,
    clusterLoading,
    clusterCount,
    showSeed,
    scopedNodeId,
    selectedMoveId,
    preview,
    previewLoading,
    diff,
    refreshStories,
    refreshStatus,
    selectStory,
    createStory,
    selectOQ,
    generateCluster,
    generateScopedCluster,
    selectMove,
    acceptMove,
    rejectAll,
    setClusterCount,
    setShowSeed,
  };

  return (
    <StoryContext.Provider value={value}>{children}</StoryContext.Provider>
  );
}
