/**
 * GET /stories/:id/moves/:moveId/preview - Preview a move before accepting
 */

import type { Request, Response, NextFunction } from 'express';
import { validatePatch } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, deserializeGraph } from '../storage.js';
import { findMoveById } from '../session.js';
import { NotFoundError } from '../middleware/error.js';
import type { APIResponse, PreviewData, PatchOpData, ValidationErrorDetail } from '../types.js';

export function createPreviewHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; moveId: string }>,
    res: Response<APIResponse<PreviewData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, moveId } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      // Find the move
      const found = await findMoveById(id, moveId, ctx);
      if (!found) {
        throw new NotFoundError(
          `Move "${moveId}"`,
          'Use POST /stories/:id/clusters to generate moves first'
        );
      }

      const { move, patch } = found;

      // Load graph and validate
      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const validation = validatePatch(graph, patch);

      // Format patch ops
      const ops: PatchOpData[] = patch.ops.map((op) => {
        if (op.op === 'ADD_NODE') {
          return {
            op: op.op,
            type: op.node.type,
            id: op.node.id,
            data: op.node as unknown as Record<string, unknown>,
          };
        } else if (op.op === 'UPDATE_NODE') {
          return {
            op: op.op,
            id: op.id,
            data: op.set as Record<string, unknown>,
          };
        } else if (op.op === 'DELETE_NODE') {
          return {
            op: op.op,
            id: op.id,
          };
        } else if (op.op === 'ADD_EDGE') {
          return {
            op: op.op,
            edge: {
              type: op.edge.type,
              source: op.edge.from,
              target: op.edge.to,
            },
          };
        } else if (op.op === 'DELETE_EDGE') {
          return {
            op: op.op,
            edge: {
              type: op.edge.type,
              source: op.edge.from,
              target: op.edge.to,
            },
          };
        }
        return { op: (op as { op: string }).op };
      });

      // Format validation errors
      const errors: ValidationErrorDetail[] | undefined = validation.success
        ? undefined
        : validation.errors.map((e) => ({
            code: e.code,
            node_id: e.node_id,
            field: e.field,
            suggested_fix: e.message,
          }));

      res.json({
        success: true,
        data: {
          move: {
            id: move.id,
            title: move.title,
            rationale: move.rationale,
            confidence: move.confidence ?? 0,
          },
          patch: {
            id: patch.id,
            baseVersionId: patch.base_story_version_id,
            ops,
          },
          validation: {
            valid: validation.success,
            ...(errors && { errors }),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
