/**
 * GET /stories - List all stories
 */

import type { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { StorageContext } from '../config.js';
import type { APIResponse } from '../types.js';

export interface ListStoriesData {
  stories: string[];
}

export function createListStoriesHandler(ctx: StorageContext) {
  return async (
    _req: Request,
    res: Response<APIResponse<ListStoriesData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const storiesDir = path.join(ctx.dataDir, 'stories');

      // Check if stories directory exists
      try {
        await fs.access(storiesDir);
      } catch {
        // Directory doesn't exist yet, return empty list
        res.json({
          success: true,
          data: { stories: [] },
        });
        return;
      }

      // Read directory entries
      const entries = await fs.readdir(storiesDir, { withFileTypes: true });

      // Filter to directories only (each story is a directory)
      const storyIds = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      res.json({
        success: true,
        data: { stories: storyIds },
      });
    } catch (error) {
      next(error);
    }
  };
}
