/**
 * Story Context handlers
 *
 * GET /stories/:id/context - Get story context
 * PATCH /stories/:id/context - Update story context
 */

import type { Request, Response, NextFunction } from 'express';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  saveVersionedStateById,
} from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type {
  APIResponse,
  StoryContextData,
  UpdateContextData,
  UpdateContextRequest,
} from '../types.js';

/**
 * GET /stories/:id/context - Get story context
 */
export function createGetContextHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<StoryContextData>>,
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

      res.json({
        success: true,
        data: {
          context: state.metadata?.storyContext ?? null,
          modifiedAt: state.metadata?.storyContextModifiedAt ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * PATCH /stories/:id/context - Update story context
 */
export function createUpdateContextHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, UpdateContextRequest>,
    res: Response<APIResponse<UpdateContextData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { context } = req.body;

      if (typeof context !== 'string') {
        throw new BadRequestError(`'context' must be a string, got ${typeof context}`);
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const now = new Date().toISOString();

      // Generate new version ID
      const newVersionId = `sv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Get current graph from current version
      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      // Create new version with same graph but updated metadata
      const newVersion = {
        id: newVersionId,
        parent_id: state.history.currentVersionId,
        label: 'Update Story Context',
        created_at: now,
        graph: currentVersion.graph,
      };

      // Update branch head if on a branch
      const updatedBranches = { ...state.history.branches };
      if (state.history.currentBranch) {
        const currentBranchData = updatedBranches[state.history.currentBranch];
        if (currentBranchData) {
          updatedBranches[state.history.currentBranch] = {
            name: currentBranchData.name,
            headVersionId: newVersionId,
            createdAt: currentBranchData.createdAt,
            ...(currentBranchData.description !== undefined && { description: currentBranchData.description }),
          };
        }
      }

      // Update state with new metadata and version
      const updatedState = {
        ...state,
        updatedAt: now,
        metadata: {
          ...state.metadata,
          storyContext: context,
          storyContextModifiedAt: now,
        },
        history: {
          ...state.history,
          versions: {
            ...state.history.versions,
            [newVersionId]: newVersion,
          },
          branches: updatedBranches,
          currentVersionId: newVersionId,
        },
      };

      await saveVersionedStateById(id, updatedState, ctx);

      res.json({
        success: true,
        data: {
          context,
          modifiedAt: now,
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
