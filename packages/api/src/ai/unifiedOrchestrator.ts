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

export interface StateAnalysis {
  gaps: ai.Coverage['gaps'];
  coverage: ai.Coverage;
  suggestions: string[];
}

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
  const resolvedIntent = resolveIntent({
    structured: intent,
    freeform: direction,
    storyState: { gaps, coverage },
  });

  // 3. Route to appropriate generator
  let sessionId = '';
  let packages: ai.NarrativePackage[] = [];

  switch (resolvedIntent.mode) {
    case 'storyBeats': {
      const req: ProposeStoryBeatsRequest = {
        priorityBeats: resolvedIntent.targets,
        direction: resolvedIntent.direction,
        packageCount: packageCount,
        creativity,
      };
      const result = await proposeStoryBeats(storyId, req, ctx, llmClient);
      sessionId = result.sessionId;
      packages = result.packages;
      break;
    }
    case 'characters': {
      const req: ProposeCharactersRequest = {
        direction: resolvedIntent.direction,
        packageCount: packageCount,
        creativity,
      };
      const result = await proposeCharacters(storyId, req, ctx, llmClient);
      sessionId = result.sessionId;
      packages = result.packages;
      break;
    }
    case 'scenes': {
      const req: ProposeScenesRequest = {
        storyBeatIds: resolvedIntent.targets,
        direction: resolvedIntent.direction,
        packageCount: packageCount,
        creativity,
      };
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
      const result = await generatePackages(
        storyId,
        {
          entryPoint: { type: 'naked' },
          depth: 'medium',
          count: 'few',
          direction: resolvedIntent.direction || direction,
        },
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

