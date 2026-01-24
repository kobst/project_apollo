/**
 * useIdeas - Hook for managing Ideas with CRUD operations.
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { IdeaData, CreateIdeaRequest, IdeaSuggestedType } from '../api/types';

export type IdeaStatus = 'active' | 'promoted' | 'dismissed';
export type IdeaCategory = 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';

// Map suggestedType to category
function getCategory(suggestedType?: IdeaSuggestedType): IdeaCategory {
  switch (suggestedType) {
    case 'Character':
      return 'character';
    case 'StoryBeat':
      return 'plot';
    case 'Scene':
      return 'scene';
    case 'Location':
    case 'Object':
      return 'worldbuilding';
    default:
      return 'general';
  }
}

// Get status from idea data
function getStatus(idea: IdeaData): IdeaStatus {
  const data = idea.data ?? {};
  if (data.promoted === true) return 'promoted';
  if (data.dismissed === true) return 'dismissed';
  return 'active';
}

export interface IdeaWithMeta {
  id: string;
  title: string;
  description: string;
  source: 'user' | 'ai';
  category: IdeaCategory;
  status: IdeaStatus;
  suggestedType?: IdeaSuggestedType | undefined;
  createdAt: string;
}

interface UseIdeasResult {
  /** List of ideas */
  ideas: IdeaWithMeta[];
  /** Whether loading */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh ideas from API */
  refresh: () => Promise<void>;
  /** Create a new idea */
  createIdea: (title: string, description: string, suggestedType?: IdeaSuggestedType) => Promise<void>;
  /** Update an idea */
  updateIdea: (ideaId: string, changes: { title?: string; description?: string; status?: IdeaStatus }) => Promise<void>;
  /** Delete an idea */
  deleteIdea: (ideaId: string) => Promise<void>;
  /** Filter ideas by status */
  filterByStatus: (status: IdeaStatus | 'all') => IdeaWithMeta[];
  /** Filter ideas by category */
  filterByCategory: (category: IdeaCategory | 'all') => IdeaWithMeta[];
}

export function useIdeas(storyId: string | null): UseIdeasResult {
  const [ideas, setIdeas] = useState<IdeaWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transform API idea to enriched idea
  const transformIdea = useCallback((idea: IdeaData): IdeaWithMeta => ({
    id: idea.id,
    title: (idea.data?.title as string) ?? idea.label ?? 'Untitled Idea',
    description: (idea.data?.description as string) ?? '',
    source: idea.source ?? 'user',
    category: getCategory(idea.suggestedType),
    status: getStatus(idea),
    suggestedType: idea.suggestedType,
    createdAt: (idea.data?.createdAt as string) ?? new Date().toISOString(),
  }), []);

  // Fetch ideas
  const refresh = useCallback(async () => {
    if (!storyId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.listIdeas(storyId);
      setIdeas(data.ideas.map(transformIdea));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [storyId, transformIdea]);

  // Load on mount
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Create idea
  const createIdea = useCallback(async (
    title: string,
    description: string,
    suggestedType?: IdeaSuggestedType
  ) => {
    if (!storyId) return;

    try {
      setLoading(true);
      setError(null);
      const request: CreateIdeaRequest = {
        title,
        description,
        source: 'user',
        ...(suggestedType ? { suggestedType } : {}),
      };
      const data = await api.createIdea(storyId, request);
      setIdeas((prev) => [...prev, transformIdea(data.idea)]);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [storyId, transformIdea]);

  // Update idea
  const updateIdea = useCallback(async (
    ideaId: string,
    changes: { title?: string; description?: string; status?: IdeaStatus }
  ) => {
    if (!storyId) return;

    try {
      setLoading(true);
      setError(null);

      const updates: Record<string, unknown> = {};
      if (changes.title !== undefined) updates.title = changes.title;
      if (changes.description !== undefined) updates.description = changes.description;
      if (changes.status === 'promoted') {
        updates.promoted = true;
        updates.dismissed = false;
      } else if (changes.status === 'dismissed') {
        updates.promoted = false;
        updates.dismissed = true;
      } else if (changes.status === 'active') {
        updates.promoted = false;
        updates.dismissed = false;
      }

      const data = await api.updateIdea(storyId, ideaId, updates);
      setIdeas((prev) =>
        prev.map((idea) => (idea.id === ideaId ? transformIdea(data.idea) : idea))
      );
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [storyId, transformIdea]);

  // Delete idea
  const deleteIdea = useCallback(async (ideaId: string) => {
    if (!storyId) return;

    try {
      setLoading(true);
      setError(null);
      await api.deleteIdea(storyId, ideaId);
      setIdeas((prev) => prev.filter((idea) => idea.id !== ideaId));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  // Filter helpers
  const filterByStatus = useCallback((status: IdeaStatus | 'all'): IdeaWithMeta[] => {
    if (status === 'all') return ideas;
    return ideas.filter((idea) => idea.status === status);
  }, [ideas]);

  const filterByCategory = useCallback((category: IdeaCategory | 'all'): IdeaWithMeta[] => {
    if (category === 'all') return ideas;
    return ideas.filter((idea) => idea.category === category);
  }, [ideas]);

  return {
    ideas,
    loading,
    error,
    refresh,
    createIdea,
    updateIdea,
    deleteIdea,
    filterByStatus,
    filterByCategory,
  };
}
