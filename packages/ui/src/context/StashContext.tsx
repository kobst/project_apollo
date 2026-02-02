/**
 * StashContext - Unified state for the Stash section.
 * Combines Ideas (via listIdeas API) with unassigned StoryBeats and Scenes
 * (via getOutline API) into a single collection of StashItems.
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
  IdeaData,
  CreateIdeaRequest,
  IdeaSuggestedType,
  OutlineStoryBeat,
  OutlineScene,
  CreateStoryBeatRequest,
  CreateSceneRequest,
} from '../api/types';
import { useStory } from './StoryContext';

export type IdeaStatus = 'active' | 'promoted' | 'dismissed';
export type IdeaCategory = 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';

// Discriminated union for items in the stash
export type StashItemKind = 'idea' | 'storybeat' | 'scene';

export interface StashIdeaItem {
  kind: 'idea';
  id: string;
  title: string;
  description: string;
  source: 'user' | 'ai';
  category: IdeaCategory;
  status: IdeaStatus;
  suggestedType?: IdeaSuggestedType | undefined;
  createdAt: string;
  // Planning metadata (optional)
  planningKind?: 'proposal' | 'question' | 'direction' | 'constraint' | 'note';
  resolutionStatus?: 'open' | 'discussed' | 'resolved' | 'archived';
  resolution?: string;
  targetBeat?: string;
  targetAct?: number;
  themes?: string[];
  lastUsedInPrompt?: string;
  usageCount?: number;
  informedCount?: number;
}

export interface StashStoryBeatItem {
  kind: 'storybeat';
  id: string;
  title: string;
  summary?: string | undefined;
  intent: string;
  priority?: string | undefined;
  scenes: OutlineScene[];
}

export interface StashSceneItem {
  kind: 'scene';
  id: string;
  heading: string;
  overview: string;
  mood?: string | undefined;
  intExt?: string | undefined;
}

export type StashItem = StashIdeaItem | StashStoryBeatItem | StashSceneItem;

// Re-export IdeaWithMeta as alias for backward compat
export type IdeaWithMeta = StashIdeaItem;

// ---- Helpers ----

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

function getStatus(idea: IdeaData): IdeaStatus {
  const data = idea.data ?? {};
  if (data.promoted === true) return 'promoted';
  if (data.dismissed === true) return 'dismissed';
  return 'active';
}

function transformIdea(idea: IdeaData): StashIdeaItem {
  const d = (idea.data ?? {}) as Record<string, unknown>;
  const informedArtifacts = Array.isArray(d.informedArtifacts) ? (d.informedArtifacts as unknown[]) : [];
  const base: StashIdeaItem = {
    kind: 'idea',
    id: idea.id,
    title: (d.title as string) ?? idea.label ?? 'Untitled Idea',
    description: (d.description as string) ?? '',
    source: idea.source ?? 'user',
    category: getCategory(idea.suggestedType),
    status: getStatus(idea),
    suggestedType: idea.suggestedType,
    createdAt: (d.createdAt as string) ?? new Date().toISOString(),
    planningKind: (d.kind as StashIdeaItem['planningKind']) ?? 'proposal',
    resolutionStatus: (d.resolutionStatus as StashIdeaItem['resolutionStatus']) ?? 'open',
    informedCount: informedArtifacts.length,
  };
  if (typeof d.resolution === 'string') (base as any).resolution = d.resolution;
  if (typeof d.targetBeat === 'string') (base as any).targetBeat = d.targetBeat;
  if (typeof d.targetAct === 'number') (base as any).targetAct = d.targetAct;
  if (Array.isArray(d.themes)) (base as any).themes = d.themes as string[];
  if (typeof d.lastUsedInPrompt === 'string') (base as any).lastUsedInPrompt = d.lastUsedInPrompt;
  if (typeof d.usageCount === 'number') (base as any).usageCount = d.usageCount as number;
  return base;
}

function transformStoryBeat(sb: OutlineStoryBeat): StashStoryBeatItem {
  return {
    kind: 'storybeat',
    id: sb.id,
    title: sb.title,
    summary: sb.summary,
    intent: sb.intent,
    priority: sb.priority,
    scenes: sb.scenes,
  };
}

function transformScene(scene: OutlineScene): StashSceneItem {
  return {
    kind: 'scene',
    id: scene.id,
    heading: scene.heading,
    overview: scene.overview,
    mood: scene.mood,
    intExt: scene.intExt,
  };
}

// ---- Context ----

interface StashContextValue {
  /** All stash items (ideas + unassigned story beats + unassigned scenes) */
  items: StashItem[];
  /** Just the idea items (convenience accessor) */
  ideas: StashIdeaItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createIdea: (
    title: string,
    description: string,
    suggestedType?: IdeaSuggestedType,
    source?: 'user' | 'ai',
    planningExtras?: Partial<{
      kind: 'proposal' | 'question' | 'direction' | 'constraint' | 'note';
      resolutionStatus: 'open' | 'discussed' | 'resolved' | 'archived';
      resolution: string;
      targetBeat: string;
      targetAct: number;
      themes: string[];
    }>
  ) => Promise<void>;
  updateIdea: (ideaId: string, changes: { title?: string; description?: string; status?: IdeaStatus }) => Promise<void>;
  deleteIdea: (ideaId: string) => Promise<void>;
  /** Create a real StoryBeat node (unassigned) and refresh the stash */
  createStoryBeat: (data: CreateStoryBeatRequest) => Promise<void>;
  /** Create a real Scene node (unassigned) and refresh the stash */
  createScene: (data: CreateSceneRequest) => Promise<void>;
}

const StashContext = createContext<StashContextValue | null>(null);

export function StashProvider({ children }: { children: ReactNode }) {
  const { currentStoryId } = useStory();
  const [ideaItems, setIdeaItems] = useState<StashIdeaItem[]>([]);
  const [storyBeatItems, setStoryBeatItems] = useState<StashStoryBeatItem[]>([]);
  const [sceneItems, setSceneItems] = useState<StashSceneItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentStoryId) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch ideas and outline in parallel
      const [ideasData, outlineData] = await Promise.all([
        api.listIdeas(currentStoryId),
        api.getOutline(currentStoryId).catch(() => null),
      ]);

      setIdeaItems(ideasData.ideas.map(transformIdea));
      setStoryBeatItems((outlineData?.unassignedStoryBeats ?? []).map(transformStoryBeat));
      setSceneItems((outlineData?.unassignedScenes ?? []).map(transformScene));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  useEffect(() => {
    if (currentStoryId) {
      void refresh();
    } else {
      setIdeaItems([]);
      setStoryBeatItems([]);
      setSceneItems([]);
    }
  }, [currentStoryId, refresh]);

  const createIdea = useCallback(async (
    title: string,
    description: string,
    suggestedType?: IdeaSuggestedType,
    source: 'user' | 'ai' = 'user',
    planningExtras?: Partial<{
      kind: 'proposal' | 'question' | 'direction' | 'constraint' | 'note';
      resolutionStatus: 'open' | 'discussed' | 'resolved' | 'archived';
      resolution: string;
      targetBeat: string;
      targetAct: number;
      themes: string[];
    }>,
  ) => {
    if (!currentStoryId) return;
    try {
      setLoading(true);
      setError(null);
      const request: CreateIdeaRequest = {
        title,
        description,
        source,
        ...(suggestedType ? { suggestedType } : {}),
        ...(planningExtras?.kind ? { kind: planningExtras.kind } : {}),
        ...(planningExtras?.resolutionStatus ? { resolutionStatus: planningExtras.resolutionStatus } : {}),
        ...(planningExtras?.resolution ? { resolution: planningExtras.resolution } : {}),
        ...(planningExtras?.targetBeat ? { targetBeat: planningExtras.targetBeat } : {}),
        ...(typeof planningExtras?.targetAct === 'number' ? { targetAct: planningExtras.targetAct } : {}),
        ...(planningExtras?.themes ? { themes: planningExtras.themes } : {}),
      };
      const data = await api.createIdea(currentStoryId, request);
      setIdeaItems((prev) => [...prev, transformIdea(data.idea)]);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  const updateIdea = useCallback(async (
    ideaId: string,
    changes: { title?: string; description?: string; status?: IdeaStatus },
  ) => {
    if (!currentStoryId) return;
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
      const data = await api.updateIdea(currentStoryId, ideaId, updates);
      setIdeaItems((prev) =>
        prev.map((idea) => (idea.id === ideaId ? transformIdea(data.idea) : idea))
      );
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  const deleteIdea = useCallback(async (ideaId: string) => {
    if (!currentStoryId) return;
    try {
      setLoading(true);
      setError(null);
      await api.deleteIdea(currentStoryId, ideaId);
      setIdeaItems((prev) => prev.filter((idea) => idea.id !== ideaId));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentStoryId]);

  const createStoryBeat = useCallback(async (data: CreateStoryBeatRequest) => {
    if (!currentStoryId) return;
    try {
      await api.createStoryBeat(currentStoryId, data);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [currentStoryId, refresh]);

  const createScene = useCallback(async (data: CreateSceneRequest) => {
    if (!currentStoryId) return;
    try {
      await api.createScene(currentStoryId, data);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [currentStoryId, refresh]);

  const items: StashItem[] = [...storyBeatItems, ...sceneItems, ...ideaItems];

  const value: StashContextValue = {
    items,
    ideas: ideaItems,
    loading,
    error,
    refresh,
    createIdea,
    updateIdea,
    deleteIdea,
    createStoryBeat,
    createScene,
  };

  return (
    <StashContext.Provider value={value}>
      {children}
    </StashContext.Provider>
  );
}

export function useStashContext(): StashContextValue {
  const context = useContext(StashContext);
  if (!context) {
    throw new Error('useStashContext must be used within a StashProvider');
  }
  return context;
}
