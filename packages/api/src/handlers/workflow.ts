/**
 * Workflow Handler
 *
 * Composes the full generation pipeline behind a single endpoint:
 * interpret → (clarify?) → generate → impact diff → (critique?) → return
 *
 * POST /stories/:id/workflows/run
 */

import type { Request, Response, NextFunction } from 'express';
import {
  ai,
  computeCoverage,
  computeImpactDiff,
  type ImpactDiff,
  type TierSummary,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadGraphById } from '../storage.js';
import { interpretUserInput, type InterpretRequest } from '../ai/interpretOrchestrator.js';
import { orchestrate } from '../ai/unifiedOrchestrator.js';
import {
  createLLMClient,
  isLLMConfigured,
  getMissingKeyError,
} from '../ai/llmClient.js';
import { BadRequestError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

// =============================================================================
// Types
// =============================================================================

export interface WorkflowRequest {
  /** Workflow type (currently only 'generate') */
  type: 'generate';
  /** Problem statement describing what narrative problem to solve */
  problemStatement?: string;
  /** Entry point for generation (beat, plotPoint, character, gap, idea, naked) */
  entryPoint?: ai.GenerationEntryPoint;
  /** Freeform user direction */
  direction?: string;
  /** Answers to clarification questions (for re-submission after clarification) */
  clarificationAnswers?: Record<string, string>;
  /** Skip the clarification step */
  skipClarification?: boolean;
  /** Skip the critique step */
  skipCritique?: boolean;
  /** Number of packages to generate */
  packageCount?: number;
  /** Creativity level 0-1 */
  creativity?: number;
}

export interface WorkflowPackage extends ai.NarrativePackage {
  /** LLM-generated critique (if critique step was not skipped) */
  critique?: ai.PackageCritique;
  /** Mechanical impact diff (before/after coverage comparison) */
  impactDiff?: ImpactDiff;
}

export interface WorkflowResponse {
  /** Current workflow status */
  status: 'needs_clarification' | 'packages_ready';
  /** Clarification request (when status is 'needs_clarification') */
  clarification?: ai.ClarificationRequest;
  /** Generated packages with critique and impact data */
  packages?: WorkflowPackage[];
  /** Coverage snapshot before any package is applied */
  coverageBefore?: TierSummary[];
}

// =============================================================================
// Handler
// =============================================================================

export function createWorkflowHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, WorkflowRequest>,
    res: Response<APIResponse<WorkflowResponse>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        type: workflowType,
        problemStatement,
        entryPoint,
        direction,
        clarificationAnswers,
        skipClarification = false,
        skipCritique = false,
        packageCount = 3,
        creativity = 0.5,
      } = req.body;

      if (workflowType !== 'generate') {
        throw new BadRequestError(`Unknown workflow type: ${workflowType}`);
      }

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient({ enableCache: false });

      // Load graph for impact diffing
      const graph = await loadGraphById(id, ctx);
      if (!graph) {
        throw new BadRequestError(`Story ${id} not found`);
      }

      // Step 1: Interpretation (if direction is freeform and no entry point)
      let resolvedDirection = direction || '';
      if (clarificationAnswers) {
        // Append clarification answers to direction
        const answersText = Object.entries(clarificationAnswers)
          .map(([q, a]) => `${q}: ${a}`)
          .join('. ');
        resolvedDirection = resolvedDirection
          ? `${resolvedDirection}. Clarifications: ${answersText}`
          : answersText;
      }

      // Step 2: Check for clarification (via interpretation phase)
      if (!skipClarification && !clarificationAnswers && direction && !entryPoint) {
        const interpretResult = await interpretUserInput(
          id,
          { userInput: direction } as InterpretRequest,
          ctx,
          llmClient
        );

        if (interpretResult.clarification?.needed) {
          res.json({
            success: true,
            data: {
              status: 'needs_clarification',
              clarification: interpretResult.clarification,
            },
          });
          return;
        }
      }

      // Step 3: Generate packages via unified orchestrator
      const orchestrationRequest: Record<string, unknown> = {
        storyId: id,
        packageCount,
        creativity,
      };
      if (resolvedDirection) orchestrationRequest.direction = resolvedDirection;
      if (problemStatement) orchestrationRequest.problemStatement = problemStatement;
      if (entryPoint) {
        const mode = resolveMode(entryPoint);
        if (mode) orchestrationRequest.intent = { mode };
      }
      const orchestrationResult = await orchestrate(
        orchestrationRequest as unknown as Parameters<typeof orchestrate>[0],
        ctx,
        llmClient
      );

      let packages: WorkflowPackage[] = orchestrationResult.packages.map(pkg => ({ ...pkg }));

      // Step 4: Compute impact diff for each package
      for (const pkg of packages) {
        try {
          pkg.impactDiff = computeImpactDiff(graph, pkg);
        } catch {
          // Impact diff failure is non-fatal
        }
      }

      // Step 5: Critique pass (if not skipped)
      if (!skipCritique && packages.length > 0) {
        try {
          const coverage = computeCoverage(graph);
          const coverageSummary = coverage.summary
            .map(t => `${t.label}: ${t.covered}/${t.total} (${t.percent.toFixed(0)}%)`)
            .join('\n');

          // Serialize story context for critique
          const storyContextStr = orchestrationResult.orchestration?.stateAnalysis
            ? JSON.stringify(orchestrationResult.orchestration.stateAnalysis)
            : 'Story context unavailable';

          const critiquePkgs: ai.CritiquePackageSummary[] = packages.map(pkg => {
            const summary: ai.CritiquePackageSummary = {
              id: pkg.id,
              title: pkg.title,
              rationale: pkg.rationale,
              nodesSummary: pkg.changes.nodes
                .map((n: ai.NodeChange) => `${n.node_type}: ${(n.data as any)?.title || (n.data as any)?.name || (n.data as any)?.heading || n.node_id}`)
                .join('\n'),
            };
            if (pkg.impactDiff) {
              summary.impactDiff = pkg.impactDiff;
            }
            return summary;
          });

          const critiqueParams: ai.CritiqueParams = {
            packages: critiquePkgs,
            storyContext: storyContextStr,
            coverageSummary,
          };

          const critiquePrompt = ai.buildCritiquePrompt(critiqueParams);
          const critiqueRaw = await llmClient.complete(critiquePrompt);
          const critiques = ai.parseCritiqueResponse(critiqueRaw.content);

          // Attach critiques to packages by ID
          for (const critique of critiques) {
            const pkg = packages.find(p => p.id === critique.packageId);
            if (pkg) {
              pkg.critique = critique;
            }
          }
        } catch {
          // Critique failure is non-fatal — packages still usable without critique
        }
      }

      // Compute baseline coverage for the response
      const coverage = computeCoverage(graph);

      res.json({
        success: true,
        data: {
          status: 'packages_ready',
          packages,
          coverageBefore: coverage.summary,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

// =============================================================================
// Helpers
// =============================================================================

function resolveMode(entryPoint: ai.GenerationEntryPoint): 'plotPoints' | 'characters' | 'scenes' | 'expand' | undefined {
  switch (entryPoint.type) {
    case 'plotPoint': return 'plotPoints';
    case 'character': return 'characters';
    case 'beat': return 'plotPoints';
    default: return undefined;
  }
}
