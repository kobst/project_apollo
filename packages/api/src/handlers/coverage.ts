/**
 * Coverage handler - Compute story coverage metrics
 *
 * GET /stories/:id/coverage - Returns tier summaries and gaps
 */

import type { Request, Response, NextFunction } from 'express';
import { computeCoverage } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, deserializeGraph } from '../storage.js';
import { NotFoundError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

// =============================================================================
// Response Types
// =============================================================================

interface GapData {
  id: string;
  type: 'structural' | 'completeness' | 'creative';
  tier: 'premise' | 'foundations' | 'structure' | 'plotPoints' | 'scenes';
  severity: 'blocker' | 'warn' | 'info';
  title: string;
  message: string;
  nodeRefs: { nodeIds?: string[]; edgeIds?: string[] };
  source: 'rule-engine' | 'derived' | 'user';
  status: 'open' | 'resolved';
}

interface TierSummaryData {
  tier: 'premise' | 'foundations' | 'structure' | 'plotPoints' | 'scenes';
  label: string;
  covered: number;
  total: number;
  percent: number;
}

interface CoverageResponseData {
  summary: TierSummaryData[];
  gaps: GapData[];
}

// =============================================================================
// Handler
// =============================================================================

/**
 * GET /stories/:id/coverage - Get coverage metrics
 */
export function createCoverageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<CoverageResponseData>>,
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

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const coverage = computeCoverage(graph);

      res.json({
        success: true,
        data: coverage,
      });
    } catch (error) {
      next(error);
    }
  };
}
