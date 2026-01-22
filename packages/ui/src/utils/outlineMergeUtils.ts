/**
 * outlineMergeUtils - Merges proposed nodes from staged packages into the outline structure.
 *
 * Uses edge relationships to determine placement:
 * - ALIGNS_WITH: PlotPoint -> Beat (determines which beat a PlotPoint belongs to)
 * - SATISFIED_BY: PlotPoint -> Scene (determines which PlotPoint a Scene fulfills)
 */

import type {
  OutlineData,
  OutlineAct,
  OutlineBeat,
  OutlinePlotPoint,
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

export interface MergedOutlineAct extends Omit<OutlineAct, 'beats'> {
  beats: MergedOutlineBeat[];
}

export interface MergedOutlineData extends Omit<OutlineData, 'acts' | 'unassignedPlotPoints' | 'unassignedScenes'> {
  acts: MergedOutlineAct[];
  unassignedPlotPoints: MergedOutlinePlotPoint[];
  unassignedScenes: MergedOutlineScene[];
  unassignedIdeas: OutlineIdea[];
  // Track proposed items that have no assignment edges
  proposedUnassignedPlotPoints: MergedOutlinePlotPoint[];
  proposedUnassignedScenes: MergedOutlineScene[];
}

/**
 * Merge proposed nodes from a staged package into the outline structure.
 *
 * Algorithm:
 * 1. Build map of proposed PlotPoints by ID
 * 2. Build map of proposed Scenes by ID
 * 3. Build alignment map: Beat ID -> proposed PlotPoint IDs (from ALIGNS_WITH edges)
 * 4. Build satisfaction map: PlotPoint ID -> proposed Scene IDs (from SATISFIED_BY edges)
 * 5. Clone outline structure
 * 6. For each beat, insert proposed PlotPoints that align to it
 * 7. For each PlotPoint (existing + proposed), insert proposed Scenes that satisfy it
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

  // Step 3: Build alignment map: Beat ID -> proposed PlotPoint IDs (from ALIGNS_WITH edges)
  const beatToPlotPoints = new Map<string, string[]>();
  for (const edgeChange of stagedPackage.changes.edges) {
    if (edgeChange.operation === 'add' && edgeChange.edge_type === 'ALIGNS_WITH') {
      // ALIGNS_WITH: from=PlotPoint, to=Beat
      const plotPointId = edgeChange.from;
      const beatId = edgeChange.to;

      if (proposedPlotPoints.has(plotPointId)) {
        const existing = beatToPlotPoints.get(beatId) ?? [];
        existing.push(plotPointId);
        beatToPlotPoints.set(beatId, existing);
      }
    }
  }

  // Step 4: Build satisfaction map: PlotPoint ID -> proposed Scene IDs (from SATISFIED_BY edges)
  const plotPointToScenes = new Map<string, string[]>();
  for (const edgeChange of stagedPackage.changes.edges) {
    if (edgeChange.operation === 'add' && edgeChange.edge_type === 'SATISFIED_BY') {
      // SATISFIED_BY: from=PlotPoint, to=Scene
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

  // Step 8: Collect proposed items that have no assignment edges
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

  return {
    storyId: outline.storyId,
    acts: mergedActs,
    unassignedPlotPoints: mergedUnassignedPlotPoints,
    unassignedScenes: mergedUnassignedScenes,
    unassignedIdeas: outline.unassignedIdeas,
    proposedUnassignedPlotPoints,
    proposedUnassignedScenes,
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
