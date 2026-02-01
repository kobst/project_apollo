/**
 * Unified Orchestrator
 *
 * Accepts optional structured intent and/or freeform direction, analyzes
 * story state, resolves intent, routes to specialized generators, and
 * returns packages with orchestration metadata.
 */

import { ai, computeCoverage } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadGraphById } from '../storage.js';
import { LLMClient } from './llmClient.js';
import { resolveIntent, type OrchestrationIntent, type ResolvedIntent } from './intentResolver.js';
import { proposeStoryBeats, type ProposeStoryBeatsRequest } from './storyBeatOrchestrator.js';
import { proposeCharacters, type ProposeCharactersRequest } from './characterOrchestrator.js';
import { proposeScenes, type ProposeScenesRequest } from './sceneOrchestrator.js';
import { proposeExpand, type ProposeExpandRequest } from './expandOrchestrator.js';
import { generatePackages } from './generateOrchestrator.js';

export interface OrchestrationRequest {
  storyId: string;
  intent?: OrchestrationIntent;
  direction?: string;
  packageCount?: number;
  creativity?: number;
}

export interface StateAnalysis { gaps: any[]; coverage: unknown; suggestions: string[] }

export interface OrchestrationResponse {
  sessionId: string;
  packages: ai.NarrativePackage[];
  orchestration: {
    resolvedIntent: ResolvedIntent;
    strategyUsed: string;
    stateAnalysis: StateAnalysis;
  };
}

export async function orchestrate(
  request: OrchestrationRequest,
  ctx: StorageContext,
  llmClient: LLMClient
): Promise<OrchestrationResponse> {
  const { storyId, intent, direction, packageCount, creativity } = request;

  // 1. Load story state
  const graph = await loadGraphById(storyId, ctx);
  if (!graph) throw new Error(`Story "${storyId}" not found`);
  const coverage = computeCoverage(graph);
  const gaps = coverage.gaps;

  // 2. Resolve intent
  const resolverInput: any = { structured: intent as any, storyState: { gaps: gaps as any, coverage } };
  if (direction) resolverInput.freeform = direction;
  const resolvedIntent = resolveIntent(resolverInput);

  // 3. Route to appropriate generator
  let sessionId = '';
  let packages: ai.NarrativePackage[] = [];

  switch (resolvedIntent.mode) {
    case 'storyBeats': {
      const req: ProposeStoryBeatsRequest = {
        priorityBeats: resolvedIntent.targets,
      } as ProposeStoryBeatsRequest;
      if (resolvedIntent.direction) (req as any).direction = resolvedIntent.direction;
      if (packageCount !== undefined) (req as any).packageCount = packageCount;
      if (creativity !== undefined) (req as any).creativity = creativity;
      const result = await proposeStoryBeats(storyId, req, ctx, llmClient);
      sessionId = result.sessionId;
      packages = result.packages;
      break;
    }
    case 'characters': {
      const req: ProposeCharactersRequest = {
        focus: 'fill_gaps',
      } as ProposeCharactersRequest;
      if (resolvedIntent.direction) (req as any).direction = resolvedIntent.direction;
      if (packageCount !== undefined) (req as any).packageCount = packageCount;
      if (creativity !== undefined) (req as any).creativity = creativity;
      const result = await proposeCharacters(storyId, req, ctx, llmClient);
      sessionId = result.sessionId;
      packages = result.packages;
      break;
    }
    case 'scenes': {
      const req: ProposeScenesRequest = {
        storyBeatIds: resolvedIntent.targets,
      } as ProposeScenesRequest;
      if (resolvedIntent.direction) (req as any).direction = resolvedIntent.direction;
      if (packageCount !== undefined) (req as any).packageCount = packageCount;
      if (creativity !== undefined) (req as any).creativity = creativity;
      const result = await proposeScenes(storyId, req, ctx, llmClient);
      sessionId = result.sessionId;
      packages = result.packages;
      break;
    }
    case 'expand': {
      const req: ProposeExpandRequest = {
        target: {
          type: resolvedIntent.targets.length > 0 ? 'node' : 'story-context',
          nodeId: resolvedIntent.targets[0],
        },
        direction: resolvedIntent.direction,
        packageCount: packageCount,
        creativity,
      } as ProposeExpandRequest;
      const result = await proposeExpand(storyId, req, ctx, llmClient);
      sessionId = result.sessionId;
      packages = result.packages;
      break;
    }
    case 'interpret':
    default: {
      // Fall back to generic generation with freeform direction
      const genReq: any = {
        entryPoint: { type: 'naked' },
        depth: 'medium',
        count: 'few',
      };
      if (resolvedIntent.direction || direction) genReq.direction = resolvedIntent.direction || direction;
      const result = await generatePackages(
        storyId,
        genReq,
        ctx,
        llmClient
      );
      sessionId = result.sessionId;
      packages = result.packages;
      break;
    }
  }

  // 4. Validate/attach impact (ensure across all paths)
  const packagesWithImpact = ai.validatePackages(packages, graph);

  return {
    sessionId,
    packages: packagesWithImpact,
    orchestration: {
      resolvedIntent,
      strategyUsed: resolvedIntent.mode,
      stateAnalysis: {
        gaps,
        coverage,
        suggestions: [],
      },
    },
  };
}
