/**
 * GET /stories/:id/status - Get story status (bootstrap endpoint)
 */

import type { Request, Response, NextFunction } from 'express';
import { getGraphStats, deriveOpenQuestions } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  deserializeGraph,
  updateGraphById,
} from '../storage.js';
import { NotFoundError } from '../middleware/error.js';
import type { APIResponse, StatusData } from '../types.js';
import {
  hasLegacyNodes,
  migrateConflictsThemesToContext,
} from '../migrations/migrateConflictsThemes.js';

export function createStatusHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<StatusData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      let state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      // Load graph from current version
      let currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      let graph = deserializeGraph(currentVersion.graph);

      // Check for and migrate legacy Conflict/Theme/Motif nodes
      if (hasLegacyNodes(graph)) {
        const migration = migrateConflictsThemesToContext(
          graph,
          state.metadata?.storyContext
        );

        if (migration.migrated) {
          // Remove legacy nodes from graph
          for (const nodeId of migration.nodesToDelete) {
            graph.nodes.delete(nodeId);
          }

          // Remove legacy edges from graph
          graph.edges = graph.edges.filter(
            (e) => !migration.edgesToDelete.includes(e.id)
          );

          // Create new version with migrated graph and updated context
          const summary = migration.summary;
          const label = `Auto-migrate: ${summary.conflicts} conflicts, ${summary.themes} themes, ${summary.motifs} motifs → Story Context`;

          await updateGraphById(
            id,
            graph,
            label,
            { storyContext: migration.newContext },
            ctx
          );

          // Reload state to get the new version
          state = await loadVersionedStateById(id, ctx);
          if (!state) {
            throw new NotFoundError('Story after migration');
          }
          currentVersion = state.history.versions[state.history.currentVersionId];
          if (!currentVersion) {
            throw new NotFoundError('Current version after migration');
          }
          graph = deserializeGraph(currentVersion.graph);
        }
      }

      // Get stats and open questions
      const stats = getGraphStats(graph);
      const questions = deriveOpenQuestions(graph);

      res.json({
        success: true,
        data: {
          storyId: id,
          name: state.metadata?.name,
          logline: state.metadata?.logline,
          currentVersionId: state.history.currentVersionId,
          currentBranch: state.history.currentBranch,
          updatedAt: state.updatedAt,
          hasStoryContext: !!state.metadata?.storyContext,
          stats: {
            scenes: stats.nodeCountByType.Scene ?? 0,
            beats: stats.nodeCountByType.Beat ?? 0,
            characters: stats.nodeCountByType.Character ?? 0,
            locations: stats.nodeCountByType.Location ?? 0,
            objects: stats.nodeCountByType.Object ?? 0,
            storyBeats: stats.nodeCountByType.StoryBeat ?? 0,
            ideas: stats.nodeCountByType.Idea ?? 0,
            edges: stats.edgeCount,
            loglines: stats.nodeCountByType.Logline ?? 0,
            settings: stats.nodeCountByType.Setting ?? 0,
            genreTones: stats.nodeCountByType.GenreTone ?? 0,
          },
          openQuestions: {
            total: questions.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
