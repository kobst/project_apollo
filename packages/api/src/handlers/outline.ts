/**
 * GET /stories/:id/outline - Get story outline structure
 * Returns beats organized by act with their scenes
 */

import type { Request, Response, NextFunction } from 'express';
import { getNodesByType } from '@apollo/core';
import type { Beat, Scene } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, deserializeGraph } from '../storage.js';
import { NotFoundError } from '../middleware/error.js';

// Beat data for outline
interface OutlineBeat {
  id: string;
  beatType: string;
  act: number;
  positionIndex: number;
  guidance: string | undefined;
  status: string | undefined;
  notes: string | undefined;
  scenes: OutlineScene[];
}

// Scene data for outline
interface OutlineScene {
  id: string;
  heading: string;
  overview: string;
  orderIndex: number;
  intExt: string | undefined;
  timeOfDay: string | undefined;
  mood: string | undefined;
  status: string | undefined;
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
  summary: {
    totalBeats: number;
    totalScenes: number;
    emptyBeats: number;
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

      // Get all beats
      const beats = getNodesByType(graph, 'Beat') as Beat[];

      // Get all scenes
      const scenes = getNodesByType(graph, 'Scene') as Scene[];

      // Group scenes by beat_id
      const scenesByBeat = new Map<string, Scene[]>();
      for (const scene of scenes) {
        const existing = scenesByBeat.get(scene.beat_id) || [];
        existing.push(scene);
        scenesByBeat.set(scene.beat_id, existing);
      }

      // Sort scenes within each beat by order_index
      for (const [beatId, beatScenes] of scenesByBeat) {
        beatScenes.sort((a, b) => a.order_index - b.order_index);
        scenesByBeat.set(beatId, beatScenes);
      }

      // Build outline beats with their scenes
      const outlineBeats: OutlineBeat[] = beats.map((beat) => {
        const beatScenes = scenesByBeat.get(beat.id) || [];
        return {
          id: beat.id,
          beatType: beat.beat_type,
          act: beat.act,
          positionIndex: beat.position_index,
          guidance: beat.guidance,
          status: beat.status,
          notes: beat.notes,
          scenes: beatScenes.map((scene) => ({
            id: scene.id,
            heading: scene.heading,
            overview: scene.scene_overview,
            orderIndex: scene.order_index,
            intExt: scene.int_ext,
            timeOfDay: scene.time_of_day,
            mood: scene.mood,
            status: scene.status,
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

      // Calculate summary
      const emptyBeats = outlineBeats.filter((b) => b.scenes.length === 0).length;

      const data: OutlineData = {
        storyId: id,
        acts,
        summary: {
          totalBeats: outlineBeats.length,
          totalScenes: scenes.length,
          emptyBeats,
        },
      };

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
