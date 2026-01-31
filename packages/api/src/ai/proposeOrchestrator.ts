/**
 * Unified Propose Orchestrator
 *
 * Provides a single entry point for all AI-assisted story generation:
 * - Interpretation (freeText + low creativity)
 * - Generation (beat/gap entry points, high creativity)
 * - Refinement (edit existing packages)
 *
 * Uses strategy pattern to route requests to appropriate underlying orchestrators.
 */

import { ai } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadGenerationSession,
  markSessionArchived,
  createGenerationSession,
  addPackagesToSession,
  type GenerationEntryPoint,
} from '../session.js';
import { getCurrentVersionInfo } from '../savedPackages.js';
import { LLMClient, type StreamCallbacks } from './llmClient.js';
import { interpretUserInput, proposalToPackage } from './interpretOrchestrator.js';
import { generatePackages } from './generateOrchestrator.js';
import { refinePackage } from './refineOrchestrator.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Request with resolved constraints and options.
 * All fields that were optional in ProposeRequest are now required.
 */
interface ResolvedRequest {
  intent: ai.ProposeIntent;
  scope: ai.ProposeScope;
  input?: ai.ProposeInput;
  mode?: ai.ProposalMode;
  constraints: ai.ResolvedConstraints;
  options: ai.ResolvedOptions;
}

/**
 * Strategy interface for propose request handling.
 */
interface ProposeStrategy {
  execute(
    storyId: string,
    request: ResolvedRequest,
    ctx: StorageContext,
    llmClient: LLMClient,
    streamCallbacks?: StreamCallbacks
  ): Promise<ai.ProposeResponse>;
}

// =============================================================================
// Constraint Resolution
// =============================================================================

/**
 * Resolve constraints and options by applying mode defaults and explicit overrides.
 *
 * Priority order (highest to lowest):
 * 1. Explicit values in request.constraints/options
 * 2. Mode defaults (if request.mode is set)
 * 3. System defaults
 *
 * @param request - The incoming propose request
 * @returns Request with fully resolved constraints and options
 */
function resolveConstraints(request: ai.ProposeRequest): ResolvedRequest {
  // 1. Start with system defaults
  let constraints: ai.ResolvedConstraints = { ...ai.SYSTEM_DEFAULTS.constraints };
  let options: ai.ResolvedOptions = { ...ai.SYSTEM_DEFAULTS.options };

  // 2. Apply mode defaults if mode is specified and exists in defaults
  if (request.mode && ai.MODE_DEFAULTS[request.mode]) {
    const modeConfig = ai.MODE_DEFAULTS[request.mode];
    constraints = { ...modeConfig.constraints };
    options = { ...modeConfig.options };
  }

  // 3. Apply explicit overrides from request
  if (request.constraints) {
    if (request.constraints.creativity !== undefined) {
      constraints.creativity = request.constraints.creativity;
    }
    if (request.constraints.inventNewEntities !== undefined) {
      constraints.inventNewEntities = request.constraints.inventNewEntities;
    }
    if (request.constraints.respectStructure !== undefined) {
      constraints.respectStructure = request.constraints.respectStructure;
    }
  }

  if (request.options) {
    if (request.options.packageCount !== undefined) {
      options.packageCount = request.options.packageCount;
    }
    if (request.options.maxNodesPerPackage !== undefined) {
      options.maxNodesPerPackage = request.options.maxNodesPerPackage;
    }
  }

  // Build result with proper handling of optional fields
  const result: ResolvedRequest = {
    intent: request.intent,
    scope: request.scope,
    constraints,
    options,
  };

  if (request.input) {
    result.input = request.input;
  }
  if (request.mode) {
    result.mode = request.mode;
  }

  return result;
}

// =============================================================================
// Strategy Implementations
// =============================================================================

/**
 * Interpret Strategy
 *
 * Used for freeText input with low creativity (< 0.3).
 * Transforms natural language into structured proposals.
 */
class InterpretStrategy implements ProposeStrategy {
  async execute(
    storyId: string,
    request: ResolvedRequest,
    ctx: StorageContext,
    llmClient: LLMClient,
    streamCallbacks?: StreamCallbacks
  ): Promise<ai.ProposeResponse> {
    const userInput = request.input?.text ?? '';
    const targetType = request.scope.targetType;

    // Call existing interpret orchestrator
    const interpretRequest: { userInput: string; targetType?: string } = { userInput };
    if (targetType) {
      interpretRequest.targetType = targetType;
    }
    const result = await interpretUserInput(
      storyId,
      interpretRequest,
      ctx,
      llmClient,
      streamCallbacks
    );

    // Convert proposals to NarrativePackages
    const packages = result.proposals.map((proposal) => proposalToPackage(proposal));

    // Create generation session to hold packages
    const versionInfo = await getCurrentVersionInfo(storyId, ctx);
    const session = await createGenerationSession(
      storyId,
      { type: 'naked' } as GenerationEntryPoint, // freeText has no specific entry point
      {
        depth: getDepthFromMaxNodes(request.options.maxNodesPerPackage),
        count: getCountFromPackageCount(request.options.packageCount),
      },
      ctx,
      versionInfo ?? undefined
    );

    // Add packages to session
    if (packages.length > 0) {
      await addPackagesToSession(storyId, packages, ctx);
    }

    const response: ai.ProposeResponse = {
      sessionId: session.id,
      packages,
      interpretation: {
        summary: result.interpretation.summary,
        confidence: result.interpretation.confidence,
      },
    };
    if (result.alternatives) {
      response.interpretation!.alternatives = result.alternatives;
    }
    return response;
  }
}

/**
 * Generate Strategy
 *
 * Used for beat/gap/idea entry points or high creativity freeText.
 * Generates N complete narrative packages.
 */
class GenerateStrategy implements ProposeStrategy {
  async execute(
    storyId: string,
    request: ResolvedRequest,
    ctx: StorageContext,
    llmClient: LLMClient,
    streamCallbacks?: StreamCallbacks
  ): Promise<ai.ProposeResponse> {
    // Map ProposeEntryPointType to GenerationEntryPointType
    const entryPointType = mapEntryPointType(request.scope.entryPoint);

    const entryPoint: GenerationEntryPoint = {
      type: entryPointType,
    };

    // Set target ID from scope
    const firstTargetId = request.scope.targetIds?.[0];
    if (firstTargetId) {
      entryPoint.targetId = firstTargetId;
    }

    // Determine depth and count from resolved options
    const depth = getDepthFromMaxNodes(request.options.maxNodesPerPackage);
    const count = getCountFromPackageCount(request.options.packageCount);

    // Build generate request
    const generateRequest: {
      entryPoint: GenerationEntryPoint;
      depth: ai.GenerationDepth;
      count: ai.GenerationCount;
      direction?: string;
    } = { entryPoint, depth, count };

    // Add direction from input text if present
    if (request.input?.text) {
      generateRequest.direction = request.input.text;
    }

    // Call existing generate orchestrator
    const result = await generatePackages(
      storyId,
      generateRequest,
      ctx,
      llmClient,
      streamCallbacks
    );

    return {
      sessionId: result.sessionId,
      packages: result.packages,
    };
  }
}

/**
 * Refine Strategy
 *
 * Used for editing existing packages (node entry point + edit intent).
 * Generates variations of a base package.
 */
class RefineStrategy implements ProposeStrategy {
  async execute(
    storyId: string,
    request: ResolvedRequest,
    ctx: StorageContext,
    llmClient: LLMClient,
    streamCallbacks?: StreamCallbacks
  ): Promise<ai.ProposeResponse> {
    // For refine, targetIds should contain the base package ID
    const basePackageId = request.scope.targetIds?.[0];
    if (!basePackageId) {
      throw new Error('Refine strategy requires a base package ID in scope.targetIds');
    }

    // Extract guidance from input
    const guidance = request.input?.text ?? '';

    // Determine depth and count from resolved options
    const depth = getDepthFromMaxNodes(request.options.maxNodesPerPackage);
    const count = getCountFromPackageCount(request.options.packageCount);

    // For now, regenerate all elements (could be extended to support partial regeneration)
    const result = await refinePackage(
      storyId,
      {
        basePackageId,
        keepElements: [],
        regenerateElements: [],
        guidance,
        depth,
        count,
      },
      ctx,
      llmClient,
      streamCallbacks
    );

    // Get current session to return sessionId
    const session = await loadGenerationSession(storyId, ctx);
    if (!session) {
      throw new Error('No active session after refinement');
    }

    return {
      sessionId: session.id,
      packages: result.variations,
    };
  }
}

// =============================================================================
// Strategy Selection
// =============================================================================

/**
 * Select the appropriate strategy based on request parameters.
 *
 * Routing rules:
 * 1. freeText + creativity < 0.3 → InterpretStrategy (conservative extraction)
 * 2. beat/gap entry points → GenerateStrategy
 * 3. node + edit intent → RefineStrategy
 * 4. Default → GenerateStrategy
 */
function selectStrategy(request: ResolvedRequest): ProposeStrategy {
  const { entryPoint } = request.scope;
  const { creativity } = request.constraints;
  const { intent } = request;

  // freeText with low creativity → interpret path
  if (entryPoint === 'freeText' && creativity < 0.3) {
    return new InterpretStrategy();
  }

  // beat or gap → generate path
  if (entryPoint === 'beat' || entryPoint === 'gap') {
    return new GenerateStrategy();
  }

  // node with edit intent → refine path
  if (entryPoint === 'node' && intent === 'edit') {
    return new RefineStrategy();
  }

  // Default: generate
  return new GenerateStrategy();
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map ProposeEntryPointType to GenerationEntryPointType.
 */
function mapEntryPointType(
  entryPoint: ai.ProposeEntryPointType
): 'beat' | 'storyBeat' | 'character' | 'gap' | 'idea' | 'naked' {
  switch (entryPoint) {
    case 'freeText':
      return 'naked';
    case 'node':
      return 'character'; // Default for node - could be improved with targetType
    case 'beat':
      return 'beat';
    case 'gap':
      return 'gap';
    case 'document':
      return 'naked';
    default:
      return 'naked';
  }
}

/**
 * Map maxNodesPerPackage to GenerationDepth.
 *
 * - 1-2 nodes: narrow (focused, single element)
 * - 3-4 nodes: medium (element + supporting)
 * - 5+ nodes: wide (expansive generation)
 */
function getDepthFromMaxNodes(maxNodes: number): ai.GenerationDepth {
  if (maxNodes <= 2) return 'narrow';
  if (maxNodes <= 4) return 'medium';
  return 'wide';
}

/**
 * Map packageCount number to GenerationCount.
 */
function getCountFromPackageCount(packageCount: number): ai.GenerationCount {
  if (packageCount <= 3) return 'few';
  if (packageCount <= 5) return 'standard';
  return 'many';
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Unified propose endpoint.
 *
 * Handles all AI-assisted story generation through a single entry point.
 * Routes to appropriate strategy based on intent, entry point, and creativity.
 *
 * @param storyId - The story ID
 * @param request - The propose request
 * @param ctx - Storage context
 * @param llmClient - LLM client for API calls
 * @param streamCallbacks - Optional streaming callbacks
 * @returns Propose response with session ID and packages
 */
export async function propose(
  storyId: string,
  request: ai.ProposeRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<ai.ProposeResponse> {
  // 1. Resolve constraints (apply mode defaults + explicit overrides)
  console.log(`[propose] Incoming request options:`, request.options);
  const resolved = resolveConstraints(request);

  console.log(`[propose] Starting propose for story: ${storyId}`);
  console.log(`[propose] Intent: ${resolved.intent}, EntryPoint: ${resolved.scope.entryPoint}`);
  console.log(`[propose] Mode: ${resolved.mode ?? 'none'}, Creativity: ${resolved.constraints.creativity}`);
  console.log(`[propose] Options: packageCount=${resolved.options.packageCount}, maxNodesPerPackage=${resolved.options.maxNodesPerPackage}`);

  // 2. Auto-discard existing active session
  const existingSession = await loadGenerationSession(storyId, ctx);
  if (existingSession?.status === 'active') {
    console.log(`[propose] Archiving existing session: ${existingSession.id}`);
    await markSessionArchived(storyId, ctx);
  }

  // 3. Select strategy based on resolved request
  const strategy = selectStrategy(resolved);
  console.log(`[propose] Selected strategy: ${strategy.constructor.name}`);

  // 4. Execute strategy with resolved constraints
  const result = await strategy.execute(storyId, resolved, ctx, llmClient, streamCallbacks);

  console.log(`[propose] Completed with ${result.packages.length} packages, sessionId: ${result.sessionId}`);
  return result;
}

/**
 * Refine an existing package in the active session.
 *
 * Convenience wrapper for propose with edit intent.
 */
export async function proposeRefine(
  storyId: string,
  basePackageId: string,
  guidance: string,
  creativity: number,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<ai.ProposeResponse> {
  const request: ai.ProposeRequest = {
    intent: 'edit',
    scope: {
      entryPoint: 'node',
      targetIds: [basePackageId],
    },
    input: { text: guidance },
    constraints: {
      creativity,
      inventNewEntities: creativity > 0.5,
      respectStructure: creativity < 0.5 ? 'strict' : 'soft',
    },
    options: {
      packageCount: 3,
    },
  };

  return propose(storyId, request, ctx, llmClient, streamCallbacks);
}

/**
 * Get the active proposal for a story.
 *
 * Returns null if no active session exists.
 */
export async function getActiveProposal(
  storyId: string,
  ctx: StorageContext
): Promise<{ sessionId: string; packages: ai.NarrativePackage[] } | null> {
  const session = await loadGenerationSession(storyId, ctx);
  if (!session || session.status !== 'active') {
    return null;
  }

  return {
    sessionId: session.id,
    packages: session.packages,
  };
}

/**
 * Discard the active proposal for a story.
 */
export async function discardActiveProposal(
  storyId: string,
  ctx: StorageContext
): Promise<void> {
  await markSessionArchived(storyId, ctx);
}
