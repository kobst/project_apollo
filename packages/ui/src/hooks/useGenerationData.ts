/**
 * useGenerationData - Hook to fetch data needed for the generation form.
 * Fetches structural beats, characters, and story beats.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import type { OutlineData, NodeData } from '../api/types';

// Types for the generation form
export interface BeatInfo {
  id: string;
  beatType: string;
  act: number;
  positionIndex: number;
  hasMissingStoryBeats: boolean;
}

export interface CharacterInfo {
  id: string;
  name: string;
  role?: string | undefined;
}

export interface StoryBeatInfo {
  id: string;
  title: string;
  intent: string;
  act?: number | undefined;
  sceneCount: number;
  status: 'proposed' | 'approved' | 'deprecated';
}

interface UseGenerationDataResult {
  /** Structural beats (Save the Cat scaffolding) */
  beats: BeatInfo[];
  /** Characters in the story */
  characters: CharacterInfo[];
  /** Story beats (approved ones for scene generation) */
  storyBeats: StoryBeatInfo[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh data */
  refresh: () => Promise<void>;
}

export function useGenerationData(storyId: string | null): UseGenerationDataResult {
  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [characterNodes, setCharacterNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all required data
  const refresh = useCallback(async () => {
    if (!storyId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch outline and characters in parallel
      const [outlineData, nodesData] = await Promise.all([
        api.getOutline(storyId),
        api.listNodes(storyId, 'Character', 100),
      ]);

      setOutline(outlineData);
      setCharacterNodes(nodesData.nodes);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  // Load on mount and when storyId changes
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Transform outline data into BeatInfo array
  const beats = useMemo((): BeatInfo[] => {
    if (!outline) return [];

    const result: BeatInfo[] = [];
    for (const act of outline.acts) {
      for (const beat of act.beats) {
        result.push({
          id: beat.id,
          beatType: beat.beatType,
          act: beat.act,
          positionIndex: beat.positionIndex,
          // A beat has missing story beats if it has no story beats aligned
          hasMissingStoryBeats: beat.storyBeats.length === 0,
        });
      }
    }
    return result;
  }, [outline]);

  // Transform character nodes into CharacterInfo array
  const characters = useMemo((): CharacterInfo[] => {
    return characterNodes.map((node) => ({
      id: node.id,
      name: (node.data?.name as string) ?? node.label ?? 'Unknown',
      role: node.data?.role as string | undefined,
    }));
  }, [characterNodes]);

  // Extract story beats from outline
  const storyBeats = useMemo((): StoryBeatInfo[] => {
    if (!outline) return [];

    const result: StoryBeatInfo[] = [];

    // Collect story beats from all acts
    for (const act of outline.acts) {
      for (const beat of act.beats) {
        for (const storyBeat of beat.storyBeats) {
          result.push({
            id: storyBeat.id,
            title: storyBeat.title,
            intent: storyBeat.intent,
            act: beat.act,
            sceneCount: storyBeat.scenes.length,
            // Assume status is 'approved' if not specified (committed beats)
            status: (storyBeat.status as 'proposed' | 'approved' | 'deprecated') ?? 'approved',
          });
        }
      }
    }

    // Add unassigned story beats
    for (const storyBeat of outline.unassignedStoryBeats) {
      result.push({
        id: storyBeat.id,
        title: storyBeat.title,
        intent: storyBeat.intent,
        act: undefined,
        sceneCount: storyBeat.scenes.length,
        status: (storyBeat.status as 'proposed' | 'approved' | 'deprecated') ?? 'approved',
      });
    }

    return result;
  }, [outline]);

  return {
    beats,
    characters,
    storyBeats,
    loading,
    error,
    refresh,
  };
}
