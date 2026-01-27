/**
 * Interpretation Orchestrator
 *
 * Handles the Interpretation phase: freeform input → structured proposals.
 * Transforms user's natural language into node/edge/Story Context proposals.
 */

import { ai } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadGraphById,
  loadVersionedStateById,
} from '../storage.js';
import { loadSessionById } from '../session.js';
import { LLMClient, type StreamCallbacks } from './llmClient.js';

// =============================================================================
// Types
// =============================================================================

export interface InterpretRequest {
  userInput: string;
  targetType?: string; // Optional hint for expected output type
}

export interface InterpretResponse {
  interpretation: {
    summary: string;
    confidence: number;
  };
  proposals: ai.InterpretationProposal[];
  alternatives?: Array<{
    summary: string;
    confidence: number;
  }>;
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Interpret user input and generate structured proposals.
 *
 * Flow:
 * 1. Load graph state and metadata
 * 2. Get recent nodes from session
 * 3. Serialize context
 * 4. Build interpretation prompt
 * 5. Call LLM
 * 6. Parse response
 * 7. Return proposals
 */
export async function interpretUserInput(
  storyId: string,
  request: InterpretRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<InterpretResponse> {
  const { userInput, targetType } = request;

  // 1. Load graph state and metadata
  const graph = await loadGraphById(storyId, ctx);
  if (!graph) {
    throw new Error(`Story "${storyId}" not found`);
  }

  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" state not found`);
  }

  // 2. Get recent nodes from session (for context)
  const session = await loadSessionById(storyId, ctx);
  const recentNodeIds = session.recentMoves
    .slice(-5)
    .map((m) => m.id);

  // Get recent node summaries
  const recentNodes: string[] = [];
  for (const nodeId of recentNodeIds) {
    const node = graph.nodes.get(nodeId);
    if (node) {
      const data = node as unknown as Record<string, unknown>;
      const label = String(data.name ?? data.title ?? node.id);
      recentNodes.push(`- ${node.type}: ${label}`);
    }
  }

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

  // 5. Get filtered ideas for interpret task
  const ideasResult = ai.getIdeasForTask(graph, 'interpret', undefined, 5);

  // 5b. Get filtered guidelines for interpret task
  const guidelinesResult = ai.getGuidelinesForTask(
    state.metadata?.storyContext?.operational,
    'interpret'
  );

  // 6. Build prompt
  // If targetType is specified, add it as a hint in the user input
  let enrichedInput = userInput;
  if (targetType) {
    enrichedInput = `[Hint: User expects a ${targetType}]\n${userInput}`;
  }

  const promptParams: ai.InterpretationParams = {
    userInput: enrichedInput,
    storyContext,
  };
  if (recentNodes.length > 0) {
    promptParams.recentNodes = recentNodes;
  }
  if (ideasResult.serialized) {
    promptParams.ideas = ideasResult.serialized;
  }
  if (guidelinesResult.serialized) {
    promptParams.guidelines = guidelinesResult.serialized;
  }
  const prompt = ai.buildInterpretationPrompt(promptParams);

  // 7. Call LLM (with system prompt if available)
  let response: string;

  if (streamCallbacks) {
    const llmResponse = await llmClient.stream(prompt, systemPrompt, streamCallbacks);
    response = llmResponse.content;
  } else {
    const llmResponse = await llmClient.complete(prompt, systemPrompt);
    response = llmResponse.content;
  }

  // 8. Parse response
  const result = ai.parseInterpretationResponse(response);

  const response_: InterpretResponse = {
    interpretation: result.interpretation,
    proposals: result.proposals,
  };
  if (result.alternatives) {
    response_.alternatives = result.alternatives;
  }
  return response_;
}

/**
 * Convert an interpretation proposal to a NarrativePackage.
 * Used when user accepts a proposal from interpretation.
 */
export function proposalToPackage(
  proposal: ai.InterpretationProposal
): ai.NarrativePackage {
  const packageId = `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const changes: ai.NarrativePackage['changes'] = {
    nodes: [],
    edges: [],
  };

  if (proposal.type === 'node' && proposal.target_type) {
    const nodeId = ai.defaultIdGenerator(proposal.target_type);

    changes.nodes.push({
      operation: proposal.operation,
      node_type: proposal.target_type,
      node_id: nodeId,
      data: proposal.data,
    });

    // Note: relates_to is informational only - we don't create edges here
    // because we can't determine the correct edge type without knowing
    // the types of the related nodes. Users can add edges manually.
  } else if (proposal.type === 'storyContext') {
    // Convert interpretation proposal to structured operation
    const content = String(proposal.data.content ?? '');
    const section = String(proposal.data.section ?? '').toLowerCase();

    // Map section to appropriate operation
    let operation: ai.StoryContextChangeOperation;
    if (section.includes('theme') || section.includes('pillar')) {
      operation = { type: 'addThematicPillar', pillar: content };
    } else if (section.includes('rule') || section.includes('constraint')) {
      operation = { type: 'addHardRule', rule: { id: `hr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text: content } };
    } else if (section.includes('note') || section.includes('working')) {
      operation = { type: 'setWorkingNotes', content };
    } else {
      // Default to adding as a soft guideline
      operation = { type: 'addGuideline', guideline: { id: `sg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, tags: ['general'], text: content } };
    }

    changes.storyContext = [{ operation }];
  }

  return {
    id: packageId,
    title: `Interpreted: ${proposal.target_type ?? proposal.type}`,
    rationale: proposal.rationale,
    confidence: 0.8, // Default confidence for interpreted proposals
    style_tags: [],
    changes,
    impact: {
      fulfills_gaps: [],
      creates_gaps: [],
      conflicts: [],
    },
  };
}
