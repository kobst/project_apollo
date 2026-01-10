/**
 * POST /stories/init - Create a new story
 */

import type { Request, Response, NextFunction } from 'express';
import {
  createEmptyGraph,
  applyPatch,
  validatePatch,
  initializeStory,
  seedBeats,
  getGraphStats,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  createStory,
  storyExists,
  generateStoryId,
} from '../storage.js';
import { clearSessionById } from '../session.js';
import { BadRequestError, APIError, ValidationError } from '../middleware/error.js';
import type { InitRequest, APIResponse, StoryStats } from '../types.js';

interface InitResponseData {
  storyId: string;
  name: string;
  logline?: string;
  versionId: string;
  stats: StoryStats;
}

export function createInitHandler(ctx: StorageContext) {
  return async (
    req: Request<unknown, unknown, InitRequest>,
    res: Response<APIResponse<InitResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { name, logline } = req.body;

      if (!logline && !name) {
        throw new BadRequestError(
          'Either name or logline is required',
          'Provide a logline to initialize the story structure'
        );
      }

      // Generate story ID
      const storyId = generateStoryId(name, logline);

      // Check if story exists
      if (await storyExists(storyId, ctx)) {
        throw new APIError(
          `Story "${storyId}" already exists`,
          409,
          'Use a different name or delete the existing story'
        );
      }

      // Create version ID
      const versionId = `sv_${Date.now()}`;

      // Create graph
      const graph = createEmptyGraph();

      // Use logline-based initialization or just seed beats
      const initPatch = logline
        ? initializeStory(logline, versionId)
        : seedBeats(versionId);

      // Validate before applying
      const validation = validatePatch(graph, initPatch);
      if (!validation.success) {
        throw new ValidationError(
          'Failed to initialize story',
          validation.errors.map((e) => ({
            code: e.code,
            node_id: e.node_id,
            field: e.field,
            suggested_fix: e.message,
          }))
        );
      }

      const initializedGraph = applyPatch(graph, initPatch);

      // Save story
      await createStory(
        storyId,
        initializedGraph,
        versionId,
        {
          name: name ?? storyId,
          ...(logline && { logline }),
          phase: 'OUTLINE',
        },
        ctx
      );

      // Clear any existing session
      await clearSessionById(storyId, ctx);

      // Get stats
      const graphStats = getGraphStats(initializedGraph);

      res.status(201).json({
        success: true,
        data: {
          storyId,
          name: name ?? storyId,
          ...(logline && { logline }),
          versionId,
          stats: {
            scenes: graphStats.nodeCountByType.Scene ?? 0,
            beats: graphStats.nodeCountByType.Beat ?? 0,
            characters: graphStats.nodeCountByType.Character ?? 0,
            locations: graphStats.nodeCountByType.Location ?? 0,
            objects: graphStats.nodeCountByType.Object ?? 0,
            plotPoints: graphStats.nodeCountByType.PlotPoint ?? 0,
            edges: graphStats.edgeCount,
            loglines: graphStats.nodeCountByType.Logline ?? 0,
            settings: graphStats.nodeCountByType.Setting ?? 0,
            genreTones: graphStats.nodeCountByType.GenreTone ?? 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
