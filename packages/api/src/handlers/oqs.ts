/**
 * GET /stories/:id/open-questions - List open questions
 *
 * @deprecated Use GET /stories/:id/gaps instead, which provides a unified
 * Gap model combining structural gaps (from rule violations) and narrative
 * gaps (from this endpoint). Filter by `type=narrative` to get equivalent data.
 */

import type { Request, Response, NextFunction } from 'express';
import { deriveOpenQuestions } from '@apollo/core';
import type { OQPhase, OQSeverity, OQDomain } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, deserializeGraph } from '../storage.js';
import { NotFoundError } from '../middleware/error.js';
import type { APIResponse, OpenQuestionsData, OpenQuestionData } from '../types.js';

interface OQsQuery {
  phase?: string;
  severity?: string;
  domain?: string;
}

export function createOQsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, OQsQuery>,
    res: Response<APIResponse<OpenQuestionsData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { phase: queryPhase, severity, domain } = req.query;

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
      const phase: OQPhase = (queryPhase as OQPhase) ?? state.metadata?.phase ?? 'OUTLINE';

      let questions = deriveOpenQuestions(graph, phase);

      // Apply filters
      if (severity) {
        const severityFilter = severity.toUpperCase() as OQSeverity;
        questions = questions.filter((q) => q.severity === severityFilter);
      }
      if (domain) {
        const domainFilter = domain.toUpperCase() as OQDomain;
        questions = questions.filter((q) => q.domain === domainFilter);
      }

      const questionData: OpenQuestionData[] = questions.map((q) => ({
        id: q.id,
        message: q.message,
        phase: q.phase,
        severity: q.severity,
        domain: q.domain,
        ...(q.target_node_id !== undefined && { target_node_id: q.target_node_id }),
      }));

      res.json({
        success: true,
        data: {
          questions: questionData,
          phase,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
