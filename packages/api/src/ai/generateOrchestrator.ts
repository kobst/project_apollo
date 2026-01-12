/**
 * Generation Orchestrator
 *
 * Handles the Generation phase: entry point → N packages.
 * Coordinates context serialization, LLM calls, response parsing,
 * and session management.
 */

import {
  ai,
  computeCoverage,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadGraphById,
  loadVersionedStateById,
} from '../storage.js';
import {
  createGenerationSession,
  addPackagesToSession,
  loadGenerationSession,
  type GenerationEntryPoint,
} from '../session.js';
import { LLMClient, type StreamCallbacks } from './llmClient.js';

// =============================================================================
// Types
// =============================================================================

export interface GenerateRequest {
  entryPoint: GenerationEntryPoint;
  depth: ai.GenerationDepth;
  count: ai.GenerationCount;
  direction?: string;
}

export interface GenerateResponse {
  sessionId: string;
  packages: ai.NarrativePackage[];
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Generate narrative packages based on entry point.
 *
 * Flow:
 * 1. Load graph state, metadata, and compute gaps
 * 2. Serialize context and gaps
 * 3. Build prompt
 * 4. Call LLM
 * 5. Parse and validate response
 * 6. Create/update session
 * 7. Return packages
 */
export async function generatePackages(
  storyId: string,
  request: GenerateRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<GenerateResponse> {
  const { entryPoint, depth, count, direction } = request;

  // 1. Load graph state and metadata
  const graph = await loadGraphById(storyId, ctx);
  if (!graph) {
    throw new Error(`Story "${storyId}" not found`);
  }

  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" state not found`);
  }

  // 2. Compute coverage/gaps
  const coverage = computeCoverage(graph);
  const gaps = coverage.gaps;

  // 3. Serialize context
  const metadata: ai.StoryMetadata = {};
  if (state.metadata?.name) metadata.name = state.metadata.name;
  if (state.metadata?.logline) metadata.logline = state.metadata.logline;
  if (state.metadata?.storyContext) metadata.storyContext = state.metadata.storyContext;
  const storyContext = ai.serializeStoryContext(graph, metadata);

  const gapsText = ai.serializeGaps(gaps);

  // 4. Get package count from config
  const packageCount = ai.getPackageCount(count);

  // 5. Build prompt
  const promptEntryPoint: ai.GenerationEntryPoint = { type: entryPoint.type };
  if (entryPoint.targetId) promptEntryPoint.targetId = entryPoint.targetId;
  if (entryPoint.targetData) promptEntryPoint.targetData = entryPoint.targetData;

  const promptParams: ai.GenerationParams = {
    entryPoint: promptEntryPoint,
    storyContext,
    gaps: gapsText,
    depth,
    count: packageCount,
  };
  if (direction) promptParams.direction = direction;

  const prompt = ai.buildGenerationPrompt(promptParams);

  // 6. Call LLM (with or without streaming)
  let response: string;

  if (streamCallbacks) {
    const llmResponse = await llmClient.stream(prompt, undefined, streamCallbacks);
    response = llmResponse.content;
  } else {
    const llmResponse = await llmClient.complete(prompt);
    response = llmResponse.content;
  }

  // 7. Parse response
  let result = ai.parseGenerationResponse(response);

  // 8. Validate and fix IDs
  const existingNodeIds = new Set(graph.nodes.keys());
  const validation = ai.validateGeneratedIds(result, existingNodeIds);

  if (!validation.valid) {
    console.warn('Regenerating invalid IDs:', validation.errors);
    result = ai.regenerateInvalidIds(result, existingNodeIds);
  }

  // 9. Validate edge references
  const edgeValidation = ai.validateEdgeReferences(result, existingNodeIds);
  if (!edgeValidation.valid) {
    console.warn('Invalid edge references:', edgeValidation.errors);
    // Could attempt to fix or just warn
  }

  // 10. Create or update session
  let session = await loadGenerationSession(storyId, ctx);

  if (!session || session.status !== 'active') {
    // Create new session
    const sessionParams: { depth: ai.GenerationDepth; count: ai.GenerationCount; direction?: string } = { depth, count };
    if (direction) sessionParams.direction = direction;
    session = await createGenerationSession(
      storyId,
      entryPoint,
      sessionParams,
      ctx
    );
  }

  // Add packages to session
  session = await addPackagesToSession(storyId, result.packages, ctx);

  return {
    sessionId: session.id,
    packages: result.packages,
  };
}

/**
 * Regenerate all packages for an existing session.
 */
export async function regenerateAll(
  storyId: string,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<GenerateResponse> {
  const session = await loadGenerationSession(storyId, ctx);
  if (!session) {
    throw new Error(`No active generation session for story ${storyId}`);
  }

  if (session.status !== 'active') {
    throw new Error(`Cannot regenerate: session is ${session.status}`);
  }

  // Use same parameters but generate fresh
  const request: GenerateRequest = {
    entryPoint: session.entryPoint,
    depth: session.initialParams.depth,
    count: session.initialParams.count,
  };
  if (session.initialParams.direction) {
    request.direction = session.initialParams.direction;
  }
  return generatePackages(storyId, request, ctx, llmClient, streamCallbacks);
}

/**
 * Get entry point details from the graph.
 */
export async function getEntryPointData(
  storyId: string,
  entryPoint: GenerationEntryPoint,
  ctx: StorageContext
): Promise<Record<string, unknown> | null> {
  if (!entryPoint.targetId) {
    return null;
  }

  const graph = await loadGraphById(storyId, ctx);
  if (!graph) {
    return null;
  }

  const node = graph.nodes.get(entryPoint.targetId);
  if (!node) {
    return null;
  }

  // Return relevant node data
  return {
    id: node.id,
    type: node.type,
    ...(node as unknown as Record<string, unknown>),
  };
}
