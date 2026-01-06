/**
 * Coverage handler - Compute story coverage metrics
 *
 * GET /stories/:id/coverage - Returns tier summaries and gaps
 *
 * @deprecated Use GET /stories/:id/gaps for the unified endpoint
 */

import type { Request, Response, NextFunction } from 'express';
import { computeCoverage } from '@apollo/core';
import type { GapPhase } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, deserializeGraph } from '../storage.js';
import { NotFoundError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

// =============================================================================
// Response Types
// =============================================================================

interface GapData {
  id: string;
  type: 'structural' | 'narrative';
  tier: 'premise' | 'foundations' | 'structure' | 'plotPoints' | 'scenes';
  severity: 'blocker' | 'warn' | 'info';
  title: string;
  description: string;
  scopeRefs: { nodeIds?: string[]; edgeIds?: string[] };
  source: 'rule-engine' | 'derived' | 'user' | 'extractor' | 'import';
  status: 'open' | 'in_progress' | 'resolved';
  phase?: 'OUTLINE' | 'DRAFT' | 'REVISION';
  domain?: 'STRUCTURE' | 'SCENE' | 'CHARACTER' | 'CONFLICT' | 'THEME_MOTIF';
  groupKey?: string;
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
 *
 * @deprecated Use GET /stories/:id/gaps for the unified endpoint
 */
export function createCoverageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, { phase?: string }>,
    res: Response<APIResponse<CoverageResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { phase: queryPhase } = req.query;

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

      // Determine phase from query or story metadata
      const phase: GapPhase =
        (queryPhase as GapPhase) ?? state.metadata?.phase ?? 'OUTLINE';

      const graph = deserializeGraph(currentVersion.graph);
      const coverage = computeCoverage(graph, phase);

      res.json({
        success: true,
        data: coverage,
      });
    } catch (error) {
      next(error);
    }
  };
}
