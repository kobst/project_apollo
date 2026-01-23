/**
 * POST /stories/:id/recompute-order
 *
 * Recomputes order_index for all StoryBeats and Scenes based on their
 * attachment relationships (ALIGNS_WITH and SATISFIED_BY edges).
 *
 * Use this endpoint to migrate existing stories to the new auto-computed
 * ordering system, or to fix any inconsistencies.
 */

import type { Request, Response, NextFunction } from 'express';
import { computeOrder, applyOrderUpdates } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  saveVersionedStateById,
  deserializeGraph,
  serializeGraph,
} from '../storage.js';
import { NotFoundError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

interface RecomputeOrderResponse {
  plotPointsUpdated: number;
  scenesUpdated: number;
  newVersionId: string;
}

/**
 * POST /stories/:id/recompute-order
 *
 * Recomputes order_index for all StoryBeats and Scenes.
 * - StoryBeats get order_index based on ALIGNS_WITH edges to Beats
 * - Scenes get order_index based on SATISFIED_BY edges to StoryBeats
 * - Unattached items have order_index set to undefined
 */
export function createRecomputeOrderHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<RecomputeOrderResponse>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      // Load state
      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Compute new order values
      const orderResult = computeOrder(graph);

      // If nothing changed, return early
      if (orderResult.ops.length === 0) {
        res.json({
          success: true,
          data: {
            plotPointsUpdated: 0,
            scenesUpdated: 0,
            newVersionId: currentVersionId,
          },
        });
        return;
      }

      // Apply updates
      const updatedGraph = applyOrderUpdates(graph, orderResult);

      // Count updates by type
      let plotPointsUpdated = 0;
      let scenesUpdated = 0;
      for (const op of orderResult.ops) {
        const node = graph.nodes.get(op.id);
        if (node?.type === 'StoryBeat') {
          plotPointsUpdated++;
        } else if (node?.type === 'Scene') {
          scenesUpdated++;
        }
      }

      // Create new version
      const timestamp = new Date().toISOString();
      const newVersionId = `ver_${Date.now()}`;

      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Recomputed order: ${plotPointsUpdated} StoryBeats, ${scenesUpdated} Scenes`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          plotPointsUpdated,
          scenesUpdated,
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
