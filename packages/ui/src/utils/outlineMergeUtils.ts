/**
 * outlineMergeUtils - Merges proposed nodes from staged packages into the outline structure.
 *
 * Uses edge relationships to determine placement:
 * - ALIGNS_WITH: StoryBeat -> Beat (determines which beat a StoryBeat belongs to)
 * - SATISFIED_BY: StoryBeat -> Scene (determines which StoryBeat a Scene fulfills)
 */

import type {
  OutlineData,
  OutlineAct,
  OutlineBeat,
  OutlineStoryBeat,
  OutlineScene,
  OutlineIdea,
  NarrativePackage,
} from '../api/types';

// Extended types with proposed metadata
export interface MergedOutlineScene extends OutlineScene {
  _isProposed?: boolean | undefined;
  _operation?: 'add' | 'modify' | 'delete' | undefined;
  _packageId?: string | undefined;
  _previousData?: Record<string, unknown> | undefined;
}

export interface MergedOutlineStoryBeat extends Omit<OutlineStoryBeat, 'scenes'> {
  _isProposed?: boolean | undefined;
  _operation?: 'add' | 'modify' | 'delete' | undefined;
  _packageId?: string | undefined;
  _previousData?: Record<string, unknown> | undefined;
  scenes: MergedOutlineScene[];
}

export interface MergedOutlineBeat extends Omit<OutlineBeat, 'storyBeats'> {
  storyBeats: MergedOutlineStoryBeat[];
}

export interface MergedOutlineAct extends Omit<OutlineAct, 'beats'> {
  beats: MergedOutlineBeat[];
}

export interface MergedOutlineData extends Omit<OutlineData, 'acts' | 'unassignedStoryBeats' | 'unassignedScenes'> {
  acts: MergedOutlineAct[];
  unassignedStoryBeats: MergedOutlineStoryBeat[];
  unassignedScenes: MergedOutlineScene[];
  unassignedIdeas: OutlineIdea[];
  // Track proposed items that have no assignment edges
  proposedUnassignedStoryBeats: MergedOutlineStoryBeat[];
  proposedUnassignedScenes: MergedOutlineScene[];
}

/**
 * Merge proposed nodes from a staged package into the outline structure.
 *
 * Algorithm:
 * 1. Build map of proposed StoryBeats by ID
 * 2. Build map of proposed Scenes by ID
 * 3. Build alignment map: Beat ID -> proposed StoryBeat IDs (from ALIGNS_WITH edges)
 * 4. Build satisfaction map: StoryBeat ID -> proposed Scene IDs (from SATISFIED_BY edges)
 * 5. Clone outline structure
 * 6. For each beat, insert proposed StoryBeats that align to it
 * 7. For each StoryBeat (existing + proposed), insert proposed Scenes that satisfy it
 * 8. Track unassigned proposed items (no matching edges)
 */
export function mergeProposedIntoOutline(
  outline: OutlineData,
  stagedPackage: NarrativePackage | null,
  editedNodes: Map<string, Partial<Record<string, unknown>>>,
  removedNodeIds: Set<string>
): MergedOutlineData {
  // If no staged package, just return the outline with empty proposed arrays
  if (!stagedPackage) {
    return {
      ...outline,
      acts: outline.acts.map((act) => ({
        ...act,
        beats: act.beats.map((beat) => ({
          ...beat,
          storyBeats: beat.storyBeats.map((pp) => ({
            ...pp,
            scenes: pp.scenes as MergedOutlineScene[],
          })),
        })),
      })),
      unassignedStoryBeats: outline.unassignedStoryBeats.map((pp) => ({
        ...pp,
        scenes: pp.scenes as MergedOutlineScene[],
      })),
      unassignedScenes: outline.unassignedScenes as MergedOutlineScene[],
      proposedUnassignedStoryBeats: [],
      proposedUnassignedScenes: [],
    };
  }

  // Step 1: Build map of proposed StoryBeats
  const proposedStoryBeats = new Map<string, MergedOutlineStoryBeat>();
  for (const nodeChange of stagedPackage.changes.nodes) {
    if (nodeChange.node_type === 'StoryBeat') {
      // Skip if removed
      if (nodeChange.operation === 'add' && removedNodeIds.has(nodeChange.node_id)) {
        continue;
      }

      const localEdits = editedNodes.get(nodeChange.node_id);
      const data = { ...nodeChange.data, ...localEdits };

      const pp: MergedOutlineStoryBeat = {
        id: nodeChange.node_id,
        title: (data.title as string) ?? 'Untitled',
        intent: (data.intent as string) ?? 'plot',
        scenes: [],
        _isProposed: true,
        _operation: nodeChange.operation,
        _packageId: stagedPackage.id,
      };
      if (data.status !== undefined) pp.status = data.status as string;
      if (nodeChange.previous_data !== undefined) pp._previousData = nodeChange.previous_data;

      proposedStoryBeats.set(nodeChange.node_id, pp);
    }
  }

  // Step 2: Build map of proposed Scenes
  const proposedScenes = new Map<string, MergedOutlineScene>();
  for (const nodeChange of stagedPackage.changes.nodes) {
    if (nodeChange.node_type === 'Scene') {
      // Skip if removed
      if (nodeChange.operation === 'add' && removedNodeIds.has(nodeChange.node_id)) {
        continue;
      }

      const localEdits = editedNodes.get(nodeChange.node_id);
      const data = { ...nodeChange.data, ...localEdits };

      const scene: MergedOutlineScene = {
        id: nodeChange.node_id,
        heading: (data.heading as string) ?? 'Untitled Scene',
        overview: (data.scene_overview as string) ?? '',
        orderIndex: (data.order_index as number) ?? 0,
        _isProposed: true,
        _operation: nodeChange.operation,
        _packageId: stagedPackage.id,
      };
      if (data.int_ext !== undefined) scene.intExt = data.int_ext as string;
      if (data.time_of_day !== undefined) scene.timeOfDay = data.time_of_day as string;
      if (data.mood !== undefined) scene.mood = data.mood as string;
      if (data.status !== undefined) scene.status = data.status as string;
      if (nodeChange.previous_data !== undefined) scene._previousData = nodeChange.previous_data;

      proposedScenes.set(nodeChange.node_id, scene);
    }
  }

  // Step 3: Build alignment map: Beat ID -> proposed StoryBeat IDs (from ALIGNS_WITH edges)
  const beatToStoryBeats = new Map<string, string[]>();
  for (const edgeChange of stagedPackage.changes.edges) {
    if (edgeChange.operation === 'add' && edgeChange.edge_type === 'ALIGNS_WITH') {
      // ALIGNS_WITH: from=StoryBeat, to=Beat
      const storyBeatId = edgeChange.from;
      const beatId = edgeChange.to;

      if (proposedStoryBeats.has(storyBeatId)) {
        const existing = beatToStoryBeats.get(beatId) ?? [];
        existing.push(storyBeatId);
        beatToStoryBeats.set(beatId, existing);
      }
    }
  }

  // Step 4: Build satisfaction map: StoryBeat ID -> proposed Scene IDs (from SATISFIED_BY edges)
  const storyBeatToScenes = new Map<string, string[]>();
  for (const edgeChange of stagedPackage.changes.edges) {
    if (edgeChange.operation === 'add' && edgeChange.edge_type === 'SATISFIED_BY') {
      // SATISFIED_BY: from=StoryBeat, to=Scene
      const storyBeatId = edgeChange.from;
      const sceneId = edgeChange.to;

      if (proposedScenes.has(sceneId)) {
        const existing = storyBeatToScenes.get(storyBeatId) ?? [];
        existing.push(sceneId);
        storyBeatToScenes.set(storyBeatId, existing);
      }
    }
  }

  // Track which proposed items got assigned
  const assignedStoryBeatIds = new Set<string>();
  const assignedSceneIds = new Set<string>();

  // Helper: attach proposed scenes to a plot point
  const attachProposedScenes = (storyBeatId: string, existingScenes: OutlineScene[]): MergedOutlineScene[] => {
    const mergedScenes: MergedOutlineScene[] = existingScenes.map((s) => ({ ...s }));

    const sceneIds = storyBeatToScenes.get(storyBeatId) ?? [];
    for (const sceneId of sceneIds) {
      const proposedScene = proposedScenes.get(sceneId);
      if (proposedScene) {
        mergedScenes.push(proposedScene);
        assignedSceneIds.add(sceneId);
      }
    }

    return mergedScenes;
  };

  // Step 5-7: Clone and merge outline structure
  const mergedActs: MergedOutlineAct[] = outline.acts.map((act) => ({
    ...act,
    beats: act.beats.map((beat) => {
      // Clone existing plot points with their scenes
      const mergedStoryBeats: MergedOutlineStoryBeat[] = beat.storyBeats.map((pp) => ({
        ...pp,
        scenes: attachProposedScenes(pp.id, pp.scenes),
      }));

      // Add proposed plot points that align to this beat
      const proposedPpIds = beatToStoryBeats.get(beat.id) ?? [];
      for (const ppId of proposedPpIds) {
        const proposedPp = proposedStoryBeats.get(ppId);
        if (proposedPp) {
          // Attach any proposed scenes to this proposed plot point
          proposedPp.scenes = attachProposedScenes(ppId, []);
          mergedStoryBeats.push(proposedPp);
          assignedStoryBeatIds.add(ppId);
        }
      }

      return {
        ...beat,
        storyBeats: mergedStoryBeats,
      };
    }),
  }));

  // Handle existing unassigned plot points
  const mergedUnassignedStoryBeats: MergedOutlineStoryBeat[] = outline.unassignedStoryBeats.map((pp) => ({
    ...pp,
    scenes: attachProposedScenes(pp.id, pp.scenes),
  }));

  // Handle existing unassigned scenes (no change needed)
  const mergedUnassignedScenes: MergedOutlineScene[] = outline.unassignedScenes.map((s) => ({ ...s }));

  // Step 8: Collect proposed items that have no assignment edges
  const proposedUnassignedStoryBeats: MergedOutlineStoryBeat[] = [];
  for (const [ppId, pp] of proposedStoryBeats) {
    if (!assignedStoryBeatIds.has(ppId)) {
      // Attach any proposed scenes to this unassigned proposed plot point
      pp.scenes = attachProposedScenes(ppId, []);
      proposedUnassignedStoryBeats.push(pp);
    }
  }

  const proposedUnassignedScenes: MergedOutlineScene[] = [];
  for (const [sceneId, scene] of proposedScenes) {
    if (!assignedSceneIds.has(sceneId)) {
      proposedUnassignedScenes.push(scene);
    }
  }

  return {
    storyId: outline.storyId,
    acts: mergedActs,
    unassignedStoryBeats: mergedUnassignedStoryBeats,
    unassignedScenes: mergedUnassignedScenes,
    unassignedIdeas: outline.unassignedIdeas,
    proposedUnassignedStoryBeats,
    proposedUnassignedScenes,
    summary: outline.summary,
  };
}

/**
 * Check if a plot point has any proposed content (itself or its scenes)
 */
export function storyBeatHasProposedContent(pp: MergedOutlineStoryBeat): boolean {
  if (pp._isProposed) return true;
  return pp.scenes.some((s) => s._isProposed);
}

/**
 * Check if a beat has any proposed content
 */
export function beatHasProposedContent(beat: MergedOutlineBeat): boolean {
  return beat.storyBeats.some(storyBeatHasProposedContent);
}

/**
 * Get display label for an operation
 */
export function getOperationDisplay(operation: 'add' | 'modify' | 'delete'): { label: string; color: string } {
  switch (operation) {
    case 'add':
      return { label: 'NEW', color: '#4ade80' };
    case 'modify':
      return { label: 'MODIFIED', color: '#fb923c' };
    case 'delete':
      return { label: 'REMOVING', color: '#ef4444' };
  }
}
