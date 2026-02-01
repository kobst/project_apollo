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
  markSessionArchived,
  type GenerationEntryPoint,
} from '../session.js';
import { getCurrentVersionInfo } from '../savedPackages.js';
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
  console.log(`[generatePackages] Starting generation for story: ${storyId}`);
  console.log(`[generatePackages] Entry point: ${request.entryPoint.type}, depth: ${request.depth}, count: ${request.count}`);

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

  // 3. Build system prompt from metadata (stable, cacheable - constitution only)
  const systemPromptParams: ai.SystemPromptParams = {
    storyName: state.metadata?.name,
    constitution: state.metadata?.storyContext?.constitution,
  };
  const systemPrompt = ai.hasSystemPromptContent(systemPromptParams)
    ? ai.buildSystemPrompt(systemPromptParams)
    : undefined;

  // 4. Serialize story state (without creative direction - that's in system prompt)
  const metadata: ai.StoryMetadata = {};
  if (state.metadata?.name) metadata.name = state.metadata.name;
  // Note: storyContext intentionally omitted - it's in system prompt now
  const storyContext = ai.serializeStoryState(graph, metadata);

  const gapsText = ai.serializeGaps(gaps);

  // 5. Get filtered ideas for generation task
  const entryPointNodeId = entryPoint.targetId;
  const ideasResult = ai.getIdeasForTask(graph, 'generate', entryPointNodeId, 5);

  // 5b. Get filtered guidelines for generation task
  const guidelinesResult = ai.getGuidelinesForTask(
    state.metadata?.storyContext?.operational,
    'generate'
  );

  // 6. Get package count from config
  const packageCount = ai.getPackageCount(count);

  // 7. Build prompt
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
  if (ideasResult.serialized) promptParams.ideas = ideasResult.serialized;
  if (guidelinesResult.serialized) promptParams.guidelines = guidelinesResult.serialized;

  const prompt = ai.buildGenerationPrompt(promptParams);

  // 8. Call LLM (with or without streaming, include system prompt if available)
  console.log(`[generatePackages] Calling LLM (streaming: ${Boolean(streamCallbacks)}, systemPrompt: ${Boolean(systemPrompt)})...`);
  let response: string;

  try {
    if (streamCallbacks) {
      const llmResponse = await llmClient.stream(prompt, systemPrompt, streamCallbacks);
      response = llmResponse.content;
    } else {
      const llmResponse = await llmClient.complete(prompt, systemPrompt);
      response = llmResponse.content;
    }
    console.log(`[generatePackages] LLM response received, length: ${response.length}`);
  } catch (llmError) {
    console.error('[generatePackages] LLM call failed:', llmError);
    throw llmError;
  }

  // 10. Parse response
  console.log('Parsing LLM response...');
  let result: ai.GenerationResult;
  try {
    result = ai.parseGenerationResponse(response);
  } catch (parseError) {
    console.error('Failed to parse LLM response:', parseError);
    console.error('Raw response (first 2000 chars):', response.slice(0, 2000));
    throw parseError;
  }

  // 11. Validate and fix IDs
  const existingNodeIds = new Set(graph.nodes.keys());
  const validation = ai.validateGeneratedIds(result, existingNodeIds);

  if (!validation.valid) {
    console.warn('Regenerating invalid IDs:', validation.errors);
    result = ai.regenerateInvalidIds(result, existingNodeIds);
  }

  // 12. Validate edge references
  const edgeValidation = ai.validateEdgeReferences(result, existingNodeIds);
  if (!edgeValidation.valid) {
    console.warn('Invalid edge references:', edgeValidation.errors);
    // Could attempt to fix or just warn
  }

  // 12b. Validate packages (temporal consistency via mentions)
  const validatedPackages = ai.validatePackages(result.packages, graph);
  const mentionsValidation = ai.getValidationSummary(validatedPackages);
  if (mentionsValidation !== 'No validation warnings') {
    console.warn(`Package validation: ${mentionsValidation}`);
  }
  // 12c. Compute deterministic impact
  result.packages = validatedPackages.map(pkg => ({
    ...pkg,
    impact: ai.computeImpact(pkg, { graph }),
  }));

  // 13. Create or update session
  let session = await loadGenerationSession(storyId, ctx);

  // Get current version info for anchoring
  const versionInfo = await getCurrentVersionInfo(storyId, ctx);

  if (!session || session.status !== 'active') {
    // Create new session
    const sessionParams: { depth: ai.GenerationDepth; count: ai.GenerationCount; direction?: string } = { depth, count };
    if (direction) sessionParams.direction = direction;
    session = await createGenerationSession(
      storyId,
      entryPoint,
      sessionParams,
      ctx,
      versionInfo ?? undefined
    );
  } else {
    // Archive existing active session before replacing
    await markSessionArchived(storyId, ctx);

    // Create new session
    const sessionParams: { depth: ai.GenerationDepth; count: ai.GenerationCount; direction?: string } = { depth, count };
    if (direction) sessionParams.direction = direction;
    session = await createGenerationSession(
      storyId,
      entryPoint,
      sessionParams,
      ctx,
      versionInfo ?? undefined
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
