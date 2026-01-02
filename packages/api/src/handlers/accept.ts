/**
 * POST /stories/:id/accept - Apply move(s) to the story
 */

import type { Request, Response, NextFunction } from 'express';
import { applyPatch, validatePatch } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  deserializeGraph,
  updateGraphById,
} from '../storage.js';
import { findMoveById, acceptMoveById } from '../session.js';
import { NotFoundError, BadRequestError, ValidationError } from '../middleware/error.js';
import type { APIResponse, AcceptRequest } from '../types.js';

interface AcceptResponseData {
  accepted: Array<{
    moveId: string;
    title: string;
  }>;
  newVersionId: string;
  patchOpsApplied: number;
}

export function createAcceptHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, AcceptRequest>,
    res: Response<APIResponse<AcceptResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { moveIds } = req.body;

      if (!moveIds || !Array.isArray(moveIds) || moveIds.length === 0) {
        throw new BadRequestError(
          'moveIds array is required',
          'Provide an array of move IDs to accept'
        );
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

      let graph = deserializeGraph(currentVersion.graph);
      const accepted: Array<{ moveId: string; title: string }> = [];
      let totalOps = 0;

      // Process each move
      for (const moveId of moveIds) {
        const found = await findMoveById(id, moveId, ctx);
        if (!found) {
          throw new NotFoundError(
            `Move "${moveId}"`,
            'Use POST /stories/:id/clusters to generate moves first'
          );
        }

        const { move, patch } = found;

        // Validate patch against current graph state
        const validation = validatePatch(graph, patch);
        if (!validation.success) {
          throw new ValidationError(
            `Validation failed for move "${moveId}"`,
            validation.errors.map((e) => ({
              code: e.code,
              node_id: e.node_id,
              field: e.field,
              suggested_fix: e.message,
            }))
          );
        }

        // Apply patch
        graph = applyPatch(graph, patch);
        totalOps += patch.ops.length;

        // Accept move (removes from session)
        await acceptMoveById(id, moveId, ctx);

        accepted.push({
          moveId: move.id,
          title: move.title,
        });
      }

      // Save updated graph with version
      const label = accepted.length === 1
        ? `Accept: ${accepted[0]?.title}`
        : `Accept ${accepted.length} moves`;

      const newVersionId = await updateGraphById(id, graph, label, undefined, ctx);

      res.json({
        success: true,
        data: {
          accepted,
          newVersionId,
          patchOpsApplied: totalOps,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
