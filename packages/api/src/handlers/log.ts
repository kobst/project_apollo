/**
 * GET /stories/:id/log - Get version history
 */

import type { Request, Response, NextFunction } from 'express';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  getVersionHistoryById,
} from '../storage.js';
import { NotFoundError } from '../middleware/error.js';
import type { APIResponse, LogData, VersionData } from '../types.js';

interface LogQuery {
  limit?: string;
}

export function createLogHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, LogQuery>,
    res: Response<APIResponse<LogData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { limit } = req.query;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      let versions = await getVersionHistoryById(id, ctx);

      // Apply limit if specified
      if (limit) {
        const limitNum = parseInt(limit, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          versions = versions.slice(0, limitNum);
        }
      }

      const versionData: VersionData[] = versions.map((v) => ({
        id: v.id,
        label: v.label,
        parentId: v.parent_id,
        createdAt: v.created_at,
        isCurrent: v.isCurrent,
        ...(v.branch && { branch: v.branch }),
      }));

      res.json({
        success: true,
        data: {
          versions: versionData,
          currentBranch: state.history.currentBranch,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
