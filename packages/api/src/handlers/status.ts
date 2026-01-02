/**
 * GET /stories/:id/status - Get story status (bootstrap endpoint)
 */

import type { Request, Response, NextFunction } from 'express';
import { getGraphStats, deriveOpenQuestions } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, deserializeGraph } from '../storage.js';
import { NotFoundError } from '../middleware/error.js';
import type { APIResponse, StatusData } from '../types.js';

export function createStatusHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<StatusData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      // Load graph from current version
      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Get stats and open questions
      const stats = getGraphStats(graph);
      const phase = state.metadata?.phase ?? 'OUTLINE';
      const questions = deriveOpenQuestions(graph, phase);

      res.json({
        success: true,
        data: {
          storyId: id,
          name: state.metadata?.name,
          logline: state.metadata?.logline,
          phase,
          currentVersionId: state.history.currentVersionId,
          currentBranch: state.history.currentBranch,
          updatedAt: state.updatedAt,
          stats: {
            scenes: stats.nodeCountByType.Scene ?? 0,
            beats: stats.nodeCountByType.Beat ?? 0,
            characters: stats.nodeCountByType.Character ?? 0,
            conflicts: stats.nodeCountByType.Conflict ?? 0,
            locations: stats.nodeCountByType.Location ?? 0,
            edges: stats.edgeCount,
          },
          openQuestions: {
            total: questions.length,
            blocking: questions.filter((q) => q.severity === 'BLOCKING').length,
            important: questions.filter((q) => q.severity === 'IMPORTANT').length,
            soft: questions.filter((q) => q.severity === 'SOFT').length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
