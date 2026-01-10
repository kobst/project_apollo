/**
 * Unified Gaps handler - Query story gaps with filtering
 *
 * GET /stories/:id/gaps - Returns unified gaps (structural + narrative)
 *
 * This endpoint replaces both /coverage and /open-questions with a unified
 * Gap model that supports filtering by tier, severity, domain, and type.
 */

import type { Request, Response, NextFunction } from 'express';
import { computeCoverage } from '@apollo/core';
import type {
  GapTier,
  GapDomain,
  GapType,
  Gap,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, deserializeGraph } from '../storage.js';
import { NotFoundError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

// =============================================================================
// Response Types
// =============================================================================

interface GapData {
  id: string;
  type: GapType;
  tier: GapTier;
  title: string;
  description: string;
  scopeRefs: { nodeIds?: string[]; edgeIds?: string[] };
  source: 'rule-engine' | 'derived' | 'user' | 'extractor' | 'import';
  status: 'open' | 'in_progress' | 'resolved';
  domain?: GapDomain;
  groupKey?: string;
  dependencies?: string[];
  resolvedBy?: {
    versionId: string;
    patchId?: string;
    timestamp: string;
  };
}

interface TierSummaryData {
  tier: GapTier;
  label: string;
  covered: number;
  total: number;
  percent: number;
}

interface GapsResponseData {
  summary: TierSummaryData[];
  gaps: GapData[];
}

// =============================================================================
// Query Parameters
// =============================================================================

interface GapsQuery {
  /** Filter by tier (premise, foundations, structure, plotPoints, scenes) */
  tier?: string;
  /** Filter by domain (STRUCTURE, SCENE, CHARACTER) */
  domain?: string;
  /** Filter by type (structural, narrative) */
  type?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert internal Gap to API GapData.
 */
function gapToData(gap: Gap): GapData {
  // Build result with required fields first
  const result: GapData = {
    id: gap.id,
    type: gap.type,
    tier: gap.tier,
    title: gap.title,
    description: gap.description,
    scopeRefs: gap.scopeRefs,
    source: gap.source,
    status: gap.status,
  };

  // Add optional fields only if defined
  if (gap.domain !== undefined) {
    result.domain = gap.domain;
  }
  if (gap.groupKey !== undefined) {
    result.groupKey = gap.groupKey;
  }
  if (gap.dependencies !== undefined) {
    result.dependencies = gap.dependencies;
  }
  if (gap.resolvedBy !== undefined) {
    result.resolvedBy = gap.resolvedBy;
  }

  return result;
}

// =============================================================================
// Handler
// =============================================================================

/**
 * GET /stories/:id/gaps - Get unified gaps with filtering
 *
 * Query parameters:
 * - tier: premise | foundations | structure | plotPoints | scenes
 * - domain: STRUCTURE | SCENE | CHARACTER
 * - type: structural | narrative
 */
export function createGapsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, GapsQuery>,
    res: Response<APIResponse<GapsResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        tier: filterTier,
        domain: filterDomain,
        type: filterType,
      } = req.query;

      // Load story state
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

      // Compute coverage (includes both structural and narrative gaps)
      const graph = deserializeGraph(currentVersion.graph);
      const coverage = computeCoverage(graph);

      // Apply filters
      let gaps = coverage.gaps;

      if (filterTier) {
        gaps = gaps.filter((g) => g.tier === filterTier);
      }

      if (filterDomain) {
        const domain = filterDomain.toUpperCase() as GapDomain;
        gaps = gaps.filter((g) => g.domain === domain);
      }

      if (filterType) {
        gaps = gaps.filter((g) => g.type === filterType);
      }

      // Convert to response format
      res.json({
        success: true,
        data: {
          summary: coverage.summary,
          gaps: gaps.map(gapToData),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
