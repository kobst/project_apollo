/**
 * POST /stories/:id/clusters - Generate move cluster
 *
 * Can be triggered by:
 * - gapId: Generate cluster for a specific Gap (preferred)
 * - oqId: Generate cluster for a specific open question (deprecated, use gapId)
 * - scopeNodeId: Generate cluster for gaps targeting a specific node
 */

import type { Request, Response, NextFunction } from 'express';
import {
  computeCoverage,
  generateClusterForGap,
  getNode,
} from '@apollo/core';
import type { Gap } from '@apollo/core';
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
      const { gapId, oqId, scopeNodeId, count = 4, seed: requestedSeed } = req.body;

      // Require at least one selector
      if (!gapId && !oqId && !scopeNodeId) {
        throw new BadRequestError('One of gapId, oqId, or scopeNodeId is required');
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

      // Compute coverage to get unified gaps
      const coverage = computeCoverage(graph);
      // Filter to narrative gaps (only these need cluster generation)
      const narrativeGaps = coverage.gaps.filter((g) => g.type === 'narrative');

      // Find the gap to use
      let gap: Gap | undefined;
      let seedKey: string = '';

      if (gapId) {
        // Direct Gap selection (new unified model)
        gap = narrativeGaps.find((g) => g.id === gapId);
        if (!gap) {
          throw new NotFoundError(
            `Gap "${gapId}"`,
            'Use GET /stories/:id/gaps to see available gaps'
          );
        }
        seedKey = gapId;
      } else if (oqId) {
        // Legacy OQ selection - find matching gap by ID
        gap = narrativeGaps.find((g) => g.id === oqId);
        if (!gap) {
          throw new NotFoundError(
            `Gap/OQ "${oqId}"`,
            'Use GET /stories/:id/gaps to see available gaps (oqId is deprecated)'
          );
        }
        seedKey = oqId;
      } else if (scopeNodeId) {
        // Scoped generation - find gaps targeting this node
        const node = getNode(graph, scopeNodeId);
        if (!node) {
          throw new NotFoundError(
            `Node "${scopeNodeId}"`,
            'Use GET /stories/:id/nodes to see available nodes'
          );
        }

        // Find gaps that target this node
        const scopedGaps = narrativeGaps.filter((g) =>
          g.scopeRefs.nodeIds?.includes(scopeNodeId)
        );

        if (scopedGaps.length === 0) {
          throw new BadRequestError(
            `No narrative gaps target node "${scopeNodeId}". ` +
              'Try selecting a different node or use GET /stories/:id/gaps to see all gaps.'
          );
        }

        // Use the highest priority gap by tier (premise > foundations > structure > storyBeats > scenes)
        const tierPriority = ['premise', 'foundations', 'structure', 'storyBeats', 'scenes'];
        scopedGaps.sort(
          (a, b) =>
            tierPriority.indexOf(a.tier) - tierPriority.indexOf(b.tier)
        );
        gap = scopedGaps[0];
        seedKey = `scope_${scopeNodeId}`;
      } else {
        // This shouldn't happen due to earlier check
        throw new BadRequestError('One of gapId, oqId, or scopeNodeId is required');
      }

      // Type guard - gap should be defined after the above logic
      if (!gap) {
        throw new BadRequestError('Failed to find a valid gap');
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

      // Generate cluster using Gap-based generation
      const clusterResult = generateClusterForGap(
        gap,
        state.history.currentVersionId,
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
          seed,
          moves,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
