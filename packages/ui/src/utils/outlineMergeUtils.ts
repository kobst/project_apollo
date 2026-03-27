/**
 * outlineMergeUtils - Merges proposed nodes from staged packages into the outline structure.
 *
 * Uses relationships to determine placement:
 * - alignedBeatId: PlotPoint property pointing to Beat (determines which beat a PlotPoint belongs to)
 * - REALIZED_BY: PlotPoint -> Scene (determines which PlotPoint a Scene fulfills)
 */

import type {
  OutlineData,
  OutlineAct,
  OutlineBeat,
  OutlinePlotPoint,
  OutlineScene,
  OutlineIdea,
  NarrativePackage,
  IdeaSource,
} from '../api/types';

// Re-use types from core for Ideas
export type IdeaCategory = 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
export type IdeaStatus = 'active' | 'promoted' | 'dismissed';

// Extended types with proposed metadata
export interface MergedOutlineScene extends OutlineScene {
  _isProposed?: boolean | undefined;
  _operation?: 'add' | 'modify' | 'delete' | undefined;
  _packageId?: string | undefined;
  _previousData?: Record<string, unknown> | undefined;
}

export interface MergedOutlinePlotPoint extends Omit<OutlinePlotPoint, 'scenes'> {
  _isProposed?: boolean | undefined;
  _operation?: 'add' | 'modify' | 'delete' | undefined;
  _packageId?: string | undefined;
  _previousData?: Record<string, unknown> | undefined;
  scenes: MergedOutlineScene[];
}

export interface MergedOutlineBeat extends Omit<OutlineBeat, 'plotPoints'> {
  plotPoints: MergedOutlinePlotPoint[];
}

/**
 * Merged outline idea with proposal tracking metadata.
 * Used for displaying stashed ideas from AI packages.
 */
export interface MergedOutlineIdea {
  id: string;
  title: string;
  description: string;
  category: IdeaCategory;
  status: IdeaStatus;
  source: IdeaSource;
  // Proposal tracking
  _isProposed?: boolean | undefined;
  _operation?: 'add' | undefined;
  _packageId?: string | undefined;
  _sourceType?: 'stashedIdea' | 'ideaNode' | undefined;
}

export interface MergedOutlineAct extends Omit<OutlineAct, 'beats'> {
  beats: MergedOutlineBeat[];
}

export interface MergedOutlineData extends Omit<OutlineData, 'acts' | 'unassignedPlotPoints' | 'unassignedScenes'> {
  acts: MergedOutlineAct[];
  unassignedPlotPoints: MergedOutlinePlotPoint[];
  unassignedScenes: MergedOutlineScene[];
  unassignedIdeas: OutlineIdea[];
  // Track proposed items that have no assignment
  proposedUnassignedPlotPoints: MergedOutlinePlotPoint[];
  proposedUnassignedScenes: MergedOutlineScene[];
  // Track proposed ideas from stashed ideas in packages
  proposedIdeas: MergedOutlineIdea[];
}

/**
 * Merge proposed nodes from a staged package into the outline structure.
 *
 * Algorithm:
 * 1. Build map of proposed PlotPoints by ID
 * 2. Build map of proposed Scenes by ID
 * 3. Build alignment map: Beat ID -> proposed PlotPoint IDs (from alignedBeatId property)
 * 4. Build realization map: PlotPoint ID -> proposed Scene IDs (from REALIZED_BY edges)
 * 5. Clone outline structure
 * 6. For each beat, insert proposed PlotPoints that align to it
 * 7. For each PlotPoint (existing + proposed), insert proposed Scenes that realize it
 * 8. Track unassigned proposed items (no matching relationships)
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
          plotPoints: beat.plotPoints.map((pp) => ({
            ...pp,
            scenes: pp.scenes as MergedOutlineScene[],
          })),
        })),
      })),
      unassignedPlotPoints: outline.unassignedPlotPoints.map((pp) => ({
        ...pp,
        scenes: pp.scenes as MergedOutlineScene[],
      })),
      unassignedScenes: outline.unassignedScenes as MergedOutlineScene[],
      proposedUnassignedPlotPoints: [],
      proposedUnassignedScenes: [],
      proposedIdeas: [],
    };
  }

  // Step 1: Build map of proposed PlotPoints
  const proposedPlotPoints = new Map<string, MergedOutlinePlotPoint>();
  for (const nodeChange of stagedPackage.changes.nodes) {
    if (nodeChange.node_type === 'PlotPoint') {
      // Skip if removed
      if (nodeChange.operation === 'add' && removedNodeIds.has(nodeChange.node_id)) {
        continue;
      }

      const localEdits = editedNodes.get(nodeChange.node_id);
      const data = { ...nodeChange.data, ...localEdits };

      const pp: MergedOutlinePlotPoint = {
        id: nodeChange.node_id,
        title: (data.title as string) ?? 'Untitled',
        intent: (data.intent as string) ?? 'plot',
        scenes: [],
        _isProposed: true,
        _operation: nodeChange.operation,
        _packageId: stagedPackage.id,
      };
      // Extract optional fields from node data
      if (data.summary !== undefined) pp.summary = data.summary as string;
      if (data.priority !== undefined) pp.priority = data.priority as string;
      if (data.urgency !== undefined) pp.urgency = data.urgency as string;
      // Handle both camelCase and snake_case for stakes change
      if (data.stakesChange !== undefined) pp.stakesChange = data.stakesChange as string;
      if (data.stakes_change !== undefined) pp.stakesChange = data.stakes_change as string;
      if (data.status !== undefined) pp.status = data.status as string;
      if (nodeChange.previous_data !== undefined) pp._previousData = nodeChange.previous_data;

      proposedPlotPoints.set(nodeChange.node_id, pp);
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

  // Step 3: Build alignment map: Beat ID -> proposed PlotPoint IDs (from alignedBeatId property)
  const beatToPlotPoints = new Map<string, string[]>();
  for (const [ppId] of proposedPlotPoints) {
    // Read alignedBeatId from the node data (set during node creation)
    const nodeChange = stagedPackage.changes.nodes.find(n => n.node_id === ppId);
    const beatId = nodeChange?.data?.alignedBeatId as string | undefined;
    if (beatId) {
      const existing = beatToPlotPoints.get(beatId) ?? [];
      existing.push(ppId);
      beatToPlotPoints.set(beatId, existing);
    }
  }

  // Step 4: Build realization map: PlotPoint ID -> proposed Scene IDs (from REALIZED_BY edges)
  const plotPointToScenes = new Map<string, string[]>();
  for (const edgeChange of stagedPackage.changes.edges) {
    if (edgeChange.operation === 'add' && edgeChange.edge_type === 'REALIZED_BY') {
      // REALIZED_BY: from=PlotPoint, to=Scene
      const plotPointId = edgeChange.from;
      const sceneId = edgeChange.to;

      if (proposedScenes.has(sceneId)) {
        const existing = plotPointToScenes.get(plotPointId) ?? [];
        existing.push(sceneId);
        plotPointToScenes.set(plotPointId, existing);
      }
    }
  }

  // Track which proposed items got assigned
  const assignedPlotPointIds = new Set<string>();
  const assignedSceneIds = new Set<string>();

  // Helper: attach proposed scenes to a plot point
  const attachProposedScenes = (plotPointId: string, existingScenes: OutlineScene[]): MergedOutlineScene[] => {
    const mergedScenes: MergedOutlineScene[] = existingScenes.map((s) => ({ ...s }));

    const sceneIds = plotPointToScenes.get(plotPointId) ?? [];
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
      const mergedPlotPoints: MergedOutlinePlotPoint[] = beat.plotPoints.map((pp) => ({
        ...pp,
        scenes: attachProposedScenes(pp.id, pp.scenes),
      }));

      // Add proposed plot points that align to this beat
      const proposedPpIds = beatToPlotPoints.get(beat.id) ?? [];
      for (const ppId of proposedPpIds) {
        const proposedPp = proposedPlotPoints.get(ppId);
        if (proposedPp) {
          // Attach any proposed scenes to this proposed plot point
          proposedPp.scenes = attachProposedScenes(ppId, []);
          mergedPlotPoints.push(proposedPp);
          assignedPlotPointIds.add(ppId);
        }
      }

      return {
        ...beat,
        plotPoints: mergedPlotPoints,
      };
    }),
  }));

  // Handle existing unassigned plot points
  const mergedUnassignedPlotPoints: MergedOutlinePlotPoint[] = outline.unassignedPlotPoints.map((pp) => ({
    ...pp,
    scenes: attachProposedScenes(pp.id, pp.scenes),
  }));

  // Handle existing unassigned scenes (no change needed)
  const mergedUnassignedScenes: MergedOutlineScene[] = outline.unassignedScenes.map((s) => ({ ...s }));

  // Step 8: Collect proposed items that have no assignment
  const proposedUnassignedPlotPoints: MergedOutlinePlotPoint[] = [];
  for (const [ppId, pp] of proposedPlotPoints) {
    if (!assignedPlotPointIds.has(ppId)) {
      // Attach any proposed scenes to this unassigned proposed plot point
      pp.scenes = attachProposedScenes(ppId, []);
      proposedUnassignedPlotPoints.push(pp);
    }
  }

  const proposedUnassignedScenes: MergedOutlineScene[] = [];
  for (const [sceneId, scene] of proposedScenes) {
    if (!assignedSceneIds.has(sceneId)) {
      proposedUnassignedScenes.push(scene);
    }
  }

  // Step 9: Extract stashed ideas from package suggestions
  const proposedIdeas: MergedOutlineIdea[] = [];
  // Check for suggestions.stashedIdeas in the package (enhanced structure)
  const stashedIdeas = (stagedPackage as { suggestions?: { stashedIdeas?: Array<{ id: string; content: string; category?: string; relatedNodeIds?: string[] }> } }).suggestions?.stashedIdeas;
  if (stashedIdeas) {
    for (const idea of stashedIdeas) {
      // Skip if removed
      if (removedNodeIds.has(idea.id)) {
        continue;
      }

      proposedIdeas.push({
        id: idea.id,
        title: idea.content.slice(0, 50) + (idea.content.length > 50 ? '...' : ''),
        description: idea.content,
        category: (idea.category as IdeaCategory) ?? 'general',
        status: 'active',
        source: 'ai',
        _isProposed: true,
        _operation: 'add',
        _packageId: stagedPackage.id,
        _sourceType: 'stashedIdea',
      });
    }
  }

  return {
    storyId: outline.storyId,
    acts: mergedActs,
    unassignedPlotPoints: mergedUnassignedPlotPoints,
    unassignedScenes: mergedUnassignedScenes,
    unassignedIdeas: outline.unassignedIdeas,
    proposedUnassignedPlotPoints,
    proposedUnassignedScenes,
    proposedIdeas,
    summary: outline.summary,
  };
}

/**
 * Check if a plot point has any proposed content (itself or its scenes)
 */
export function plotPointHasProposedContent(pp: MergedOutlinePlotPoint): boolean {
  if (pp._isProposed) return true;
  return pp.scenes.some((s) => s._isProposed);
}

/**
 * Check if a beat has any proposed content
 */
export function beatHasProposedContent(beat: MergedOutlineBeat): boolean {
  return beat.plotPoints.some(plotPointHasProposedContent);
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
