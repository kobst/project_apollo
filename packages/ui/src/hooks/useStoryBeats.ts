/**
 * useStoryBeats - React hook for story beat CRUD operations
 *
 * Provides:
 * - List story beats with filters
 * - Create story beat
 * - Update story beat
 * - Delete story beat
 */

import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type {
  StoryBeatData,
  StoryBeatFilters,
  CreateStoryBeatRequest,
  CreateStoryBeatData,
  UpdateStoryBeatData,
  DeleteStoryBeatData,
} from '../api/types';

// =============================================================================
// Types
// =============================================================================

export interface UseStoryBeatsOptions {
  storyId: string;
}

export interface UseStoryBeatsResult {
  // State
  storyBeats: StoryBeatData[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchStoryBeats: (filters?: StoryBeatFilters, limit?: number, offset?: number) => Promise<void>;
  createStoryBeat: (data: CreateStoryBeatRequest) => Promise<CreateStoryBeatData | null>;
  updateStoryBeat: (ppId: string, changes: Record<string, unknown>) => Promise<UpdateStoryBeatData | null>;
  deleteStoryBeat: (ppId: string) => Promise<DeleteStoryBeatData | null>;
  getStoryBeat: (ppId: string) => Promise<StoryBeatData | null>;
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useStoryBeats({ storyId }: UseStoryBeatsOptions): UseStoryBeatsResult {
  // State
  const [storyBeats, setStoryBeats] = useState<StoryBeatData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track last used filters for refresh
  const [lastFilters, setLastFilters] = useState<StoryBeatFilters | undefined>();
  const [lastLimit, setLastLimit] = useState<number | undefined>();
  const [lastOffset, setLastOffset] = useState<number | undefined>();

  // Fetch story beats
  const fetchStoryBeats = useCallback(
    async (filters?: StoryBeatFilters, limit?: number, offset?: number) => {
      if (!storyId) return;

      setIsLoading(true);
      setError(null);
      setLastFilters(filters);
      setLastLimit(limit);
      setLastOffset(offset);

      try {
        const result = await api.listStoryBeats(storyId, filters, limit, offset);
        setStoryBeats(result.storyBeats);
        setTotalCount(result.totalCount);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch story beats';
        setError(message);
        console.error('Failed to fetch story beats:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [storyId]
  );

  // Refresh with last used filters
  const refresh = useCallback(async () => {
    await fetchStoryBeats(lastFilters, lastLimit, lastOffset);
  }, [fetchStoryBeats, lastFilters, lastLimit, lastOffset]);

  // Create story beat
  const createStoryBeat = useCallback(
    async (data: CreateStoryBeatRequest): Promise<CreateStoryBeatData | null> => {
      if (!storyId) return null;

      setIsLoading(true);
      setError(null);

      try {
        const result = await api.createStoryBeat(storyId, data);
        // Refresh list after creation
        await refresh();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create story beat';
        setError(message);
        console.error('Failed to create story beat:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [storyId, refresh]
  );

  // Update story beat
  const updateStoryBeat = useCallback(
    async (ppId: string, changes: Record<string, unknown>): Promise<UpdateStoryBeatData | null> => {
      if (!storyId) return null;

      setIsLoading(true);
      setError(null);

      try {
        const result = await api.updateStoryBeat(storyId, ppId, changes);
        // Update local state
        setStoryBeats((prev) =>
          prev.map((pp) => (pp.id === ppId ? result.storyBeat : pp))
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update story beat';
        setError(message);
        console.error('Failed to update story beat:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [storyId]
  );

  // Delete story beat
  const deleteStoryBeat = useCallback(
    async (ppId: string): Promise<DeleteStoryBeatData | null> => {
      if (!storyId) return null;

      setIsLoading(true);
      setError(null);

      try {
        const result = await api.deleteStoryBeat(storyId, ppId);
        // Remove from local state
        setStoryBeats((prev) => prev.filter((pp) => pp.id !== ppId));
        setTotalCount((prev) => prev - 1);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete story beat';
        setError(message);
        console.error('Failed to delete story beat:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [storyId]
  );

  // Get single story beat
  const getStoryBeat = useCallback(
    async (ppId: string): Promise<StoryBeatData | null> => {
      if (!storyId) return null;

      try {
        return await api.getStoryBeat(storyId, ppId);
      } catch (err) {
        console.error('Failed to get story beat:', err);
        return null;
      }
    },
    [storyId]
  );

  return {
    // State
    storyBeats,
    totalCount,
    isLoading,
    error,

    // Actions
    fetchStoryBeats,
    createStoryBeat,
    updateStoryBeat,
    deleteStoryBeat,
    getStoryBeat,
    refresh,
  };
}
