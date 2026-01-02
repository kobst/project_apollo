/**
 * POST /stories/:id/checkout - Switch version or branch
 */

import type { Request, Response, NextFunction } from 'express';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  checkoutVersionById,
  switchBranchById,
} from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse, CheckoutRequest } from '../types.js';

interface CheckoutResponseData {
  currentVersionId: string;
  currentBranch: string | null;
  detached: boolean;
}

export function createCheckoutHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, CheckoutRequest>,
    res: Response<APIResponse<CheckoutResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { target } = req.body;

      if (!target) {
        throw new BadRequestError(
          'target is required',
          'Provide a version ID or branch name'
        );
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      // Check if target is a branch name
      if (state.history.branches[target]) {
        await switchBranchById(id, target, ctx);

        const branch = state.history.branches[target];
        res.json({
          success: true,
          data: {
            currentVersionId: branch?.headVersionId ?? '',
            currentBranch: target,
            detached: false,
          },
        });
        return;
      }

      // Check if target is a version ID
      if (state.history.versions[target]) {
        const result = await checkoutVersionById(id, target, ctx);

        res.json({
          success: true,
          data: {
            currentVersionId: target,
            currentBranch: result.branch,
            detached: result.branch === null,
          },
        });
        return;
      }

      throw new NotFoundError(
        `Version or branch "${target}"`,
        'Use GET /stories/:id/log or GET /stories/:id/branches to see available targets'
      );
    } catch (error) {
      next(error);
    }
  };
}
