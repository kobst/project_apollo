/**
 * POST /stories/:id/clusters - Generate move cluster for an open question
 */

import type { Request, Response, NextFunction } from 'express';
import { deriveOpenQuestions, generateClusterForQuestion } from '@apollo/core';
import type { OQPhase } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, deserializeGraph } from '../storage.js';
import {
  addClusterById,
  clearClustersById,
  getLastSeedById,
  setLastSeedById,
} from '../session.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse, ClusterRequest, ClusterData, MoveData } from '../types.js';

export function createClustersHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ClusterRequest>,
    res: Response<APIResponse<ClusterData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { oqId, count = 4, seed: requestedSeed } = req.body;

      if (!oqId) {
        throw new BadRequestError('oqId is required');
      }

      if (count < 1 || count > 12) {
        throw new BadRequestError('count must be between 1 and 12');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const phase: OQPhase = state.metadata?.phase ?? 'OUTLINE';
      const questions = deriveOpenQuestions(graph, phase);

      // Find the question
      const oq = questions.find((q) => q.id === oqId);
      if (!oq) {
        throw new NotFoundError(
          `Open question "${oqId}"`,
          'Use GET /stories/:id/open-questions to see available questions'
        );
      }

      // Determine seed
      let seed: number;
      if (requestedSeed !== undefined) {
        seed = requestedSeed;
      } else {
        // Get last seed and increment for different results
        const lastSeed = await getLastSeedById(id, oqId, ctx);
        seed = lastSeed ? lastSeed + 1 : Date.now();
      }

      // Clear existing clusters (implicit rejection)
      await clearClustersById(id, ctx);

      // Generate cluster
      const clusterResult = generateClusterForQuestion(
        oq,
        state.history.currentVersionId,
        phase,
        { count, seed }
      );

      // Save seed
      await setLastSeedById(id, oqId, seed, ctx);

      // Save to session
      await addClusterById(id, clusterResult, ctx);

      // Format response
      const moves: MoveData[] = clusterResult.moves.map((m) => ({
        id: m.move.id,
        title: m.move.title,
        rationale: m.move.rationale,
        confidence: m.move.confidence ?? 0,
      }));

      res.json({
        success: true,
        data: {
          clusterId: clusterResult.cluster.id,
          title: clusterResult.cluster.title,
          clusterType: clusterResult.cluster.cluster_type ?? 'UNKNOWN',
          scope: clusterResult.cluster.scope_budget.allowed_depth,
          seed,
          moves,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
