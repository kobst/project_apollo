/**
 * GET /stories/:id/outline - Get story outline structure
 * Returns beats organized by act with plot points containing their scenes
 *
 * Hierarchy: Beat → PlotPoint → Scene
 * - PlotPoints align to Beats via ALIGNS_WITH edges
 * - Scenes satisfy PlotPoints via SATISFIED_BY edges
 * - Unassigned scenes (no PlotPoint, or PlotPoint not aligned to Beat) returned separately
 */

import type { Request, Response, NextFunction } from 'express';
import { getNodesByType, getEdgesByType, getNode } from '@apollo/core';
import type { Beat, Scene, PlotPoint } from '@apollo/core';
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
  intent: string;
  status: string | undefined;
  scenes: OutlineScene[];
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
  /** Scenes not connected to any PlotPoint, or connected to PlotPoint without Beat alignment */
  unassignedScenes: OutlineScene[];
  summary: {
    totalBeats: number;
    totalScenes: number;
    totalPlotPoints: number;
    unassignedSceneCount: number;
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

      // Get edges for alignment and fulfillment
      const alignsWithEdges = getEdgesByType(graph, 'ALIGNS_WITH');
      const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');

      // Build scenesByPlotPoint map (plotPointId -> Scene[])
      // Also track which PlotPoint each scene belongs to
      const scenesByPlotPoint = new Map<string, Scene[]>();
      const sceneToPlotPoint = new Map<string, string>(); // sceneId -> plotPointId
      for (const edge of satisfiedByEdges) {
        // SATISFIED_BY: PlotPoint (from) → Scene (to)
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

      // Build plotPointsByBeat map (beatId -> PlotPoint[])
      // Also track which PlotPoints are aligned to beats
      const plotPointsByBeat = new Map<string, PlotPoint[]>();
      const alignedPlotPoints = new Set<string>(); // PlotPoints with ALIGNS_WITH edge
      for (const edge of alignsWithEdges) {
        // ALIGNS_WITH: PlotPoint (from) → Beat (to)
        const plotPoint = getNode(graph, edge.from) as PlotPoint | undefined;
        if (plotPoint) {
          alignedPlotPoints.add(plotPoint.id);
          const existing = plotPointsByBeat.get(edge.to) || [];
          existing.push(plotPoint);
          plotPointsByBeat.set(edge.to, existing);
        }
      }

      // Collect unassigned scenes:
      // - Scenes with no PlotPoint connection, OR
      // - Scenes with PlotPoint that has no Beat alignment
      const unassignedScenes: Scene[] = [];
      for (const scene of scenes) {
        const ppId = sceneToPlotPoint.get(scene.id);
        if (!ppId) {
          // No PlotPoint connection
          unassignedScenes.push(scene);
        } else if (!alignedPlotPoints.has(ppId)) {
          // PlotPoint exists but not aligned to any Beat
          unassignedScenes.push(scene);
        }
      }
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
          plotPoints: beatPlotPoints.map((pp) => ({
            id: pp.id,
            title: pp.title,
            intent: pp.intent,
            status: pp.status,
            scenes: (scenesByPlotPoint.get(pp.id) || []).map(toOutlineScene),
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

      const data: OutlineData = {
        storyId: id,
        acts,
        unassignedScenes: unassignedScenes.map(toOutlineScene),
        summary: {
          totalBeats: outlineBeats.length,
          totalScenes: scenes.length,
          totalPlotPoints: plotPoints.length,
          unassignedSceneCount: unassignedScenes.length,
        },
      };

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
