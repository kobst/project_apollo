/**
 * Refinement Orchestrator
 *
 * Handles the Refinement phase: base package → variations.
 * Takes user feedback and generates N variations of a selected package.
 */

import { ai } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadGraphById,
  loadVersionedStateById,
} from '../storage.js';
import {
  loadGenerationSession,
  addPackagesToSession,
  findPackageInSession,
} from '../session.js';
import { LLMClient, type StreamCallbacks } from './llmClient.js';

// =============================================================================
// Types
// =============================================================================

export interface RefineRequest {
  basePackageId: string;
  keepElements: string[];
  regenerateElements: string[];
  guidance: string;
  depth: ai.GenerationDepth;
  count: ai.GenerationCount;
}

export interface RefineResponse {
  variations: ai.NarrativePackage[];
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Refine a package to generate variations.
 *
 * Flow:
 * 1. Load session and find base package
 * 2. Load graph state
 * 3. Build refinement prompt
 * 4. Call LLM
 * 5. Parse and validate response
 * 6. Set parent_package_id on variations
 * 7. Add to session
 * 8. Return variations
 */
export async function refinePackage(
  storyId: string,
  request: RefineRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<RefineResponse> {
  const {
    basePackageId,
    keepElements,
    regenerateElements,
    guidance,
    depth,
    count,
  } = request;

  // 1. Load session and find base package
  const session = await loadGenerationSession(storyId, ctx);
  if (!session) {
    throw new Error(`No active generation session for story ${storyId}`);
  }

  if (session.status !== 'active') {
    throw new Error(`Cannot refine: session is ${session.status}`);
  }

  const basePackage = await findPackageInSession(storyId, basePackageId, ctx);
  if (!basePackage) {
    throw new Error(`Package ${basePackageId} not found in session`);
  }

  // 2. Load graph state
  const graph = await loadGraphById(storyId, ctx);
  if (!graph) {
    throw new Error(`Story "${storyId}" not found`);
  }

  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" state not found`);
  }

  // 3. Build system prompt from metadata (stable, cacheable - constitution only)
  const systemPromptParams: ai.SystemPromptParams = {
    storyName: state.metadata?.name,
    logline: state.metadata?.logline,
    constitution: state.metadata?.storyContext?.constitution,
  };
  const systemPrompt = ai.hasSystemPromptContent(systemPromptParams)
    ? ai.buildSystemPrompt(systemPromptParams)
    : undefined;

  // 4. Serialize story state (without creative direction - that's in system prompt)
  const metadata: ai.StoryMetadata = {};
  if (state.metadata?.name) metadata.name = state.metadata.name;
  if (state.metadata?.logline) metadata.logline = state.metadata.logline;
  // Note: storyContext intentionally omitted - it's in system prompt now
  const storyContext = ai.serializeStoryState(graph, metadata);

  // 5. Get filtered ideas for refine task
  const ideasResult = ai.getIdeasForTask(graph, 'refine', undefined, 5);

  // 5b. Get filtered guidelines for refine task
  const guidelinesResult = ai.getGuidelinesForTask(
    state.metadata?.storyContext?.operational,
    'refine'
  );

  // 6. Get package count
  const packageCount = ai.getPackageCount(count);

  // 7. Build prompt
  const promptParams: ai.RefinementParams = {
    basePackage,
    keepElements,
    regenerateElements,
    guidance,
    storyContext,
    depth,
    count: packageCount,
  };
  if (ideasResult.serialized) {
    promptParams.ideas = ideasResult.serialized;
  }
  if (guidelinesResult.serialized) {
    promptParams.guidelines = guidelinesResult.serialized;
  }
  const prompt = ai.buildRefinementPrompt(promptParams);

  // 8. Call LLM (with system prompt if available)
  let response: string;

  if (streamCallbacks) {
    const llmResponse = await llmClient.stream(prompt, systemPrompt, streamCallbacks);
    response = llmResponse.content;
  } else {
    const llmResponse = await llmClient.complete(prompt, systemPrompt);
    response = llmResponse.content;
  }

  // 9. Parse response
  let result = ai.parseGenerationResponse(response);

  // 10. Validate and fix IDs
  const existingNodeIds = new Set(graph.nodes.keys());
  const validation = ai.validateGeneratedIds(result, existingNodeIds);

  if (!validation.valid) {
    console.warn('Regenerating invalid IDs:', validation.errors);
    result = ai.regenerateInvalidIds(result, existingNodeIds);
  }

  // 11. Set parent_package_id on all variations
  const variations = result.packages.map((pkg) => ({
    ...pkg,
    parent_package_id: basePackageId,
    refinement_prompt: guidance.slice(0, 200), // Store truncated guidance
  }));

  // 10. Add to session
  await addPackagesToSession(storyId, variations, ctx);

  return { variations };
}

/**
 * Get refinement options from a package.
 * Lists the elements that can be kept or regenerated.
 */
export function getRefinableElements(pkg: ai.NarrativePackage): {
  nodes: Array<{ id: string; type: string; label: string }>;
  storyContextChanges: Array<{ operationType: string; summary: string }>;
} {
  const nodes = pkg.changes.nodes.map((change) => ({
    id: change.node_id,
    type: change.node_type,
    label: String(
      (change.data as Record<string, unknown>)?.name ??
      (change.data as Record<string, unknown>)?.title ??
      change.node_id
    ),
  }));

  const storyContextChanges = (pkg.changes.storyContext ?? []).map((change) => {
    const op = change.operation;
    return {
      operationType: op.type,
      summary: formatOperationSummary(op),
    };
  });

  return { nodes, storyContextChanges };
}

/**
 * Format a story context operation for display.
 */
function formatOperationSummary(op: ai.StoryContextChangeOperation): string {
  switch (op.type) {
    case 'setConstitutionField':
      return `Set ${op.field}`;
    case 'addThematicPillar':
      return `Add pillar: ${op.pillar.slice(0, 30)}...`;
    case 'removeThematicPillar':
      return `Remove pillar at index ${op.index}`;
    case 'setThematicPillars':
      return `Set ${op.pillars.length} pillars`;
    case 'addBanned':
      return `Add banned: ${op.item}`;
    case 'removeBanned':
      return `Remove banned at index ${op.index}`;
    case 'setBanned':
      return `Set ${op.banned.length} banned items`;
    case 'addHardRule':
      return `Add rule: ${op.rule.text.slice(0, 30)}...`;
    case 'updateHardRule':
      return `Update rule ${op.id}`;
    case 'removeHardRule':
      return `Remove rule ${op.id}`;
    case 'addGuideline':
      return `Add guideline: ${op.guideline.text.slice(0, 30)}...`;
    case 'updateGuideline':
      return `Update guideline ${op.id}`;
    case 'removeGuideline':
      return `Remove guideline ${op.id}`;
    case 'setWorkingNotes':
      return `Set working notes`;
    default:
      return 'Unknown operation';
  }
}
