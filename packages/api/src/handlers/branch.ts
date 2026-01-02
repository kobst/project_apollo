/**
 * POST /stories/:id/branch - Create a new branch
 */

import type { Request, Response, NextFunction } from 'express';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  createBranchById,
  listBranchesById,
} from '../storage.js';
import { NotFoundError, BadRequestError, APIError } from '../middleware/error.js';
import type { APIResponse, BranchRequest, BranchData } from '../types.js';

interface BranchResponseData {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
}

export function createBranchHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, BranchRequest>,
    res: Response<APIResponse<BranchResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      if (!name) {
        throw new BadRequestError('name is required');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      // Check if branch exists
      if (state.history.branches[name]) {
        throw new APIError(
          `Branch "${name}" already exists`,
          409,
          'Use a different name'
        );
      }

      // Create branch
      await createBranchById(id, name, description, ctx);

      // Return created branch info
      res.status(201).json({
        success: true,
        data: {
          name,
          headVersionId: state.history.currentVersionId,
          createdAt: new Date().toISOString(),
          ...(description && { description }),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * GET /stories/:id/branches - List branches
 */
export function createListBranchesHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<{ branches: BranchData[] }>>,
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

      const branches = await listBranchesById(id, ctx);

      res.json({
        success: true,
        data: {
          branches: branches.map((b) => ({
            name: b.name,
            headVersionId: b.headVersionId,
            createdAt: b.createdAt,
            ...(b.description && { description: b.description }),
            isCurrent: b.isCurrent,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
