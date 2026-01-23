/**
 * GET /stories/:id/outline - Get story outline structure
 * Returns beats organized by act with plot points containing their scenes
 *
 * Hierarchy: Beat → StoryBeat → Scene
 * - StoryBeats align to Beats via ALIGNS_WITH edges
 * - Scenes satisfy StoryBeats via SATISFIED_BY edges
 * - Unassigned StoryBeats (no ALIGNS_WITH edge) returned separately
 * - Unassigned scenes (no StoryBeat connection) returned separately
 */

import type { Request, Response, NextFunction } from 'express';
import { getNodesByType, getEdgesByType, getNode } from '@apollo/core';
import type { Beat, Scene, StoryBeat, Idea } from '@apollo/core';
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

// StoryBeat data for outline (with nested scenes)
interface OutlineStoryBeat {
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
  storyBeats: OutlineStoryBeat[];
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
  /** StoryBeats not aligned to any Beat (no ALIGNS_WITH edge) */
  unassignedStoryBeats: OutlineStoryBeat[];
  /** Scenes not connected to any StoryBeat */
  unassignedScenes: OutlineScene[];
  /** Ideas - informal story ideas not yet promoted to formal nodes */
  unassignedIdeas: OutlineIdea[];
  summary: {
    totalBeats: number;
    totalScenes: number;
    totalStoryBeats: number;
    totalIdeas: number;
    unassignedStoryBeatCount: number;
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
      const plotPoints = getNodesByType(graph, 'StoryBeat') as StoryBeat[];
      const ideas = getNodesByType(graph, 'Idea') as Idea[];

      // Get edges for alignment and fulfillment
      const alignsWithEdges = getEdgesByType(graph, 'ALIGNS_WITH');
      const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');

      // Build scenesByStoryBeat map (plotPointId -> Scene[])
      // Also track which StoryBeat each scene belongs to
      const scenesByStoryBeat = new Map<string, Scene[]>();
      const sceneToStoryBeat = new Map<string, string>(); // sceneId -> plotPointId
      for (const edge of satisfiedByEdges) {
        // SATISFIED_BY: StoryBeat (from) → Scene (to)
        const scene = getNode(graph, edge.to) as Scene | undefined;
        if (scene) {
          sceneToStoryBeat.set(scene.id, edge.from);
          const existing = scenesByStoryBeat.get(edge.from) || [];
          existing.push(scene);
          scenesByStoryBeat.set(edge.from, existing);
        }
      }

      // Sort scenes within each plot point by order_index (undefined treated as last)
      for (const [ppId, ppScenes] of scenesByStoryBeat) {
        ppScenes.sort((a, b) => {
          const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        });
        scenesByStoryBeat.set(ppId, ppScenes);
      }

      // Build plotPointsByBeat map (beatId -> StoryBeat[])
      // Also track which StoryBeats are aligned to beats
      const plotPointsByBeat = new Map<string, StoryBeat[]>();
      const alignedStoryBeats = new Set<string>(); // StoryBeats with ALIGNS_WITH edge
      for (const edge of alignsWithEdges) {
        // ALIGNS_WITH: StoryBeat (from) → Beat (to)
        const plotPoint = getNode(graph, edge.from) as StoryBeat | undefined;
        if (plotPoint) {
          alignedStoryBeats.add(plotPoint.id);
          const existing = plotPointsByBeat.get(edge.to) || [];
          existing.push(plotPoint);
          plotPointsByBeat.set(edge.to, existing);
        }
      }

      // Collect unassigned StoryBeats (no ALIGNS_WITH edge to any Beat)
      const unassignedPPs: StoryBeat[] = plotPoints.filter(
        (pp) => !alignedStoryBeats.has(pp.id)
      );

      // Collect unassigned scenes (no SATISFIED_BY edge from any StoryBeat)
      const unassignedScenes: Scene[] = scenes.filter(
        (scene) => !sceneToStoryBeat.has(scene.id)
      );
      // Sort by order_index (undefined treated as last)
      unassignedScenes.sort((a, b) => {
        const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

      // Build outline beats with nested structure
      const outlineBeats: OutlineBeat[] = beats.map((beat) => {
        const beatStoryBeats = plotPointsByBeat.get(beat.id) || [];

        return {
          id: beat.id,
          beatType: beat.beat_type,
          act: beat.act,
          positionIndex: beat.position_index,
          guidance: beat.guidance,
          status: beat.status,
          notes: beat.notes,
          storyBeats: beatStoryBeats.map((sb) => ({
            id: sb.id,
            title: sb.title,
            intent: sb.intent,
            summary: sb.summary,
            priority: sb.priority,
            urgency: sb.urgency,
            stakesChange: sb.stakes_change,
            status: sb.status,
            scenes: (scenesByStoryBeat.get(sb.id) || []).map(toOutlineScene),
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

      // Convert unassigned StoryBeats to OutlineStoryBeat format (with their scenes)
      const unassignedStoryBeats: OutlineStoryBeat[] = unassignedPPs.map((sb) => ({
        id: sb.id,
        title: sb.title,
        intent: sb.intent,
        summary: sb.summary,
        priority: sb.priority,
        urgency: sb.urgency,
        stakesChange: sb.stakes_change,
        status: sb.status,
        scenes: (scenesByStoryBeat.get(sb.id) || []).map(toOutlineScene),
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
        unassignedStoryBeats,
        unassignedScenes: unassignedScenes.map(toOutlineScene),
        unassignedIdeas,
        summary: {
          totalBeats: outlineBeats.length,
          totalScenes: scenes.length,
          totalStoryBeats: plotPoints.length,
          totalIdeas: ideas.length,
          unassignedStoryBeatCount: unassignedPPs.length,
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
