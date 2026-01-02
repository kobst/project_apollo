/**
 * POST /stories/:id/clusters - Generate move cluster
 * Can be triggered by:
 * - oqId: Generate cluster for a specific open question
 * - scopeNodeId: Generate cluster for OQs targeting a specific node
 */

import type { Request, Response, NextFunction } from 'express';
import { deriveOpenQuestions, generateClusterForQuestion, getNode } from '@apollo/core';
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
      const { oqId, scopeNodeId, count = 4, seed: requestedSeed } = req.body;

      // Require either oqId or scopeNodeId
      if (!oqId && !scopeNodeId) {
        throw new BadRequestError('Either oqId or scopeNodeId is required');
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

      // Find the question to use
      let oq: typeof questions[number] | undefined;
      let seedKey: string = '';

      if (oqId) {
        // Direct OQ selection
        oq = questions.find((q) => q.id === oqId);
        if (!oq) {
          throw new NotFoundError(
            `Open question "${oqId}"`,
            'Use GET /stories/:id/open-questions to see available questions'
          );
        }
        seedKey = oqId;
      } else if (scopeNodeId) {
        // Scoped generation - find OQs targeting this node
        const node = getNode(graph, scopeNodeId);
        if (!node) {
          throw new NotFoundError(
            `Node "${scopeNodeId}"`,
            'Use GET /stories/:id/nodes to see available nodes'
          );
        }

        // Find questions that target this node
        const scopedQuestions = questions.filter(
          (q) => q.target_node_id === scopeNodeId
        );

        if (scopedQuestions.length === 0) {
          throw new BadRequestError(
            `No open questions target node "${scopeNodeId}". ` +
            'Try selecting a different node or use Contract view to work with general OQs.'
          );
        }

        // Use the highest priority question (BLOCKING > IMPORTANT > SOFT)
        const priorityOrder = ['BLOCKING', 'IMPORTANT', 'SOFT'];
        scopedQuestions.sort(
          (a, b) =>
            priorityOrder.indexOf(a.severity) - priorityOrder.indexOf(b.severity)
        );
        oq = scopedQuestions[0];
        seedKey = `scope_${scopeNodeId}`;
      } else {
        // This shouldn't happen due to earlier check
        throw new BadRequestError('Either oqId or scopeNodeId is required');
      }

      // Type guard - oq should be defined after the above logic
      if (!oq) {
        throw new BadRequestError('Failed to find a valid open question');
      }

      // Determine seed
      let seed: number;
      if (requestedSeed !== undefined) {
        seed = requestedSeed;
      } else {
        // Get last seed and increment for different results
        const lastSeed = await getLastSeedById(id, seedKey, ctx);
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
      await setLastSeedById(id, seedKey, seed, ctx);

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
