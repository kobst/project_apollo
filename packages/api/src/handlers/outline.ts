/**
 * GET /stories/:id/outline - Get story outline structure
 * Returns beats organized by act with plot points containing their scenes
 *
 * Hierarchy: Beat -> PlotPoint -> Scene
 * - PlotPoints align to Beats via alignedBeatId property
 * - Scenes realize PlotPoints via REALIZED_BY edges
 * - Unassigned PlotPoints (no alignedBeatId) returned separately
 * - Unassigned scenes (no PlotPoint connection) returned separately
 */

import type { Request, Response, NextFunction } from 'express';
import { getNodesByType, getEdgesByType, getNode } from '@apollo/core';
import type { Beat, Scene, PlotPoint, Idea } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, deserializeGraph } from '../storage.js';
import { NotFoundError } from '../middleware/error.js';

// Scene data for outline
interface OutlineScene {
  id: string;
  heading: string;
  overview: string;
  orderIndex: number | undefined;
  intExt: string | undefined;
  timeOfDay: string | undefined;
  mood: string | undefined;
  status: string | undefined;
}

// PlotPoint data for outline (with nested scenes)
interface OutlinePlotPoint {
  id: string;
  title: string;
  intent: string | undefined;
  summary: string | undefined;
  priority: string | undefined;
  urgency: string | undefined;
  stakesChange: string | undefined;
  status: string | undefined;
  scenes: OutlineScene[];
}

// Idea data for outline
interface OutlineIdea {
  id: string;
  title: string;
  description: string;
  source: 'user' | 'ai';
  suggestedType: string | undefined;
  createdAt: string;
}

// Beat data for outline
interface OutlineBeat {
  id: string;
  beatType: string;
  act: number;
  positionIndex: number;
  guidance: string | undefined;
  status: string | undefined;
  notes: string | undefined;
  plotPoints: OutlinePlotPoint[];
}

// Act grouping
interface OutlineAct {
  act: number;
  beats: OutlineBeat[];
}

// Response shape
interface OutlineData {
  storyId: string;
  acts: OutlineAct[];
  /** PlotPoints not aligned to any Beat (no alignedBeatId) */
  unassignedPlotPoints: OutlinePlotPoint[];
  /** Scenes not connected to any PlotPoint */
  unassignedScenes: OutlineScene[];
  /** Ideas - informal story ideas not yet promoted to formal nodes */
  unassignedIdeas: OutlineIdea[];
  summary: {
    totalBeats: number;
    totalScenes: number;
    totalPlotPoints: number;
    totalIdeas: number;
    unassignedPlotPointCount: number;
    unassignedSceneCount: number;
    unassignedIdeaCount: number;
  };
}

// Helper to convert Scene to OutlineScene
function toOutlineScene(scene: Scene): OutlineScene {
  return {
    id: scene.id,
    heading: scene.heading,
    overview: scene.scene_overview,
    orderIndex: scene.order_index,
    intExt: scene.int_ext,
    timeOfDay: scene.time_of_day,
    mood: scene.mood,
    status: scene.status,
  };
}

export function createOutlineHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      // Load story state
      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Get all nodes
      const beats = getNodesByType(graph, 'Beat') as Beat[];
      const scenes = getNodesByType(graph, 'Scene') as Scene[];
      const plotPoints = getNodesByType(graph, 'PlotPoint') as PlotPoint[];
      const ideas = getNodesByType(graph, 'Idea') as Idea[];

      // Get edges for fulfillment
      const realizedByEdges = getEdgesByType(graph, 'REALIZED_BY');

      // Build scenesByPlotPoint map (plotPointId -> Scene[])
      // Also track which PlotPoint each scene belongs to
      const scenesByPlotPoint = new Map<string, Scene[]>();
      const sceneToPlotPoint = new Map<string, string>(); // sceneId -> plotPointId
      for (const edge of realizedByEdges) {
        // REALIZED_BY: PlotPoint (from) -> Scene (to)
        const scene = getNode(graph, edge.to) as Scene | undefined;
        if (scene) {
          sceneToPlotPoint.set(scene.id, edge.from);
          const existing = scenesByPlotPoint.get(edge.from) || [];
          existing.push(scene);
          scenesByPlotPoint.set(edge.from, existing);
        }
      }

      // Sort scenes within each plot point by order_index (undefined treated as last)
      for (const [ppId, ppScenes] of scenesByPlotPoint) {
        ppScenes.sort((a, b) => {
          const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        });
        scenesByPlotPoint.set(ppId, ppScenes);
      }

      // Build plotPointsByBeat map using alignedBeatId property
      const plotPointsByBeat = new Map<string, PlotPoint[]>();
      const alignedPlotPoints = new Set<string>(); // PlotPoints with alignedBeatId
      for (const pp of plotPoints) {
        const alignedBeatId = (pp as any).alignedBeatId as string | undefined;
        if (alignedBeatId) {
          alignedPlotPoints.add(pp.id);
          const existing = plotPointsByBeat.get(alignedBeatId) || [];
          existing.push(pp);
          plotPointsByBeat.set(alignedBeatId, existing);
        }
      }

      // Collect unassigned PlotPoints (no alignedBeatId)
      const unassignedPPs: PlotPoint[] = plotPoints.filter(
        (pp) => !alignedPlotPoints.has(pp.id)
      );

      // Collect unassigned scenes (no REALIZED_BY edge from any PlotPoint)
      const unassignedScenes: Scene[] = scenes.filter(
        (scene) => !sceneToPlotPoint.has(scene.id)
      );
      // Sort by order_index (undefined treated as last)
      unassignedScenes.sort((a, b) => {
        const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

      // Build outline beats with nested structure
      const outlineBeats: OutlineBeat[] = beats.map((beat) => {
        const beatPlotPoints = plotPointsByBeat.get(beat.id) || [];

        return {
          id: beat.id,
          beatType: beat.beat_type,
          act: beat.act,
          positionIndex: beat.position_index,
          guidance: beat.guidance,
          status: beat.status,
          notes: beat.notes,
          plotPoints: beatPlotPoints.map((sb) => ({
            id: sb.id,
            title: sb.title,
            intent: sb.intent,
            summary: sb.summary,
            priority: sb.priority,
            urgency: sb.urgency,
            stakesChange: sb.stakes_change,
            status: sb.status,
            scenes: (scenesByPlotPoint.get(sb.id) || []).map(toOutlineScene),
          })),
        };
      });

      // Sort beats by position_index
      outlineBeats.sort((a, b) => a.positionIndex - b.positionIndex);

      // Group beats by act
      const actMap = new Map<number, OutlineBeat[]>();
      for (const beat of outlineBeats) {
        const existing = actMap.get(beat.act) || [];
        existing.push(beat);
        actMap.set(beat.act, existing);
      }

      // Build acts array (sorted 1-5)
      const acts: OutlineAct[] = [];
      for (let actNum = 1; actNum <= 5; actNum++) {
        const actBeats = actMap.get(actNum) || [];
        if (actBeats.length > 0) {
          acts.push({ act: actNum, beats: actBeats });
        }
      }

      // Convert unassigned PlotPoints to OutlinePlotPoint format (with their scenes)
      const unassignedPlotPoints: OutlinePlotPoint[] = unassignedPPs.map((sb) => ({
        id: sb.id,
        title: sb.title,
        intent: sb.intent,
        summary: sb.summary,
        priority: sb.priority,
        urgency: sb.urgency,
        stakesChange: sb.stakes_change,
        status: sb.status,
        scenes: (scenesByPlotPoint.get(sb.id) || []).map(toOutlineScene),
      }));

      // Convert ideas to OutlineIdea format (all ideas are "unassigned" since they don't connect to beats)
      // Sort by createdAt (newest first)
      const sortedIdeas = [...ideas].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const unassignedIdeas: OutlineIdea[] = sortedIdeas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        description: idea.description,
        source: idea.source,
        suggestedType: idea.suggestedType,
        createdAt: idea.createdAt,
      }));

      const data: OutlineData = {
        storyId: id,
        acts,
        unassignedPlotPoints,
        unassignedScenes: unassignedScenes.map(toOutlineScene),
        unassignedIdeas,
        summary: {
          totalBeats: outlineBeats.length,
          totalScenes: scenes.length,
          totalPlotPoints: plotPoints.length,
          totalIdeas: ideas.length,
          unassignedPlotPointCount: unassignedPPs.length,
          unassignedSceneCount: unassignedScenes.length,
          unassignedIdeaCount: ideas.length,
        },
      };

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
