/**
 * Expand Generation Orchestrator
 *
 * Handles generic node expansion: expands a node or story context
 * into related content based on the target type.
 *
 * Key features:
 * - Node-based expansion (Character, StoryBeat, Scene, Location)
 * - Story Context expansion (all or specific section)
 * - Session management for reviewing/accepting packages
 */

import {
  ai,
  getNode,
  type GraphState,
  type Character,
  type StoryBeat,
  type Scene,
  type Location,
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
} from '../session.js';
import { getCurrentVersionInfo } from '../savedPackages.js';
import { LLMClient, type StreamCallbacks } from './llmClient.js';

// Type alias for prompt params
type ExpandPromptParams = ai.ExpandPromptParams;

// =============================================================================
// Types
// =============================================================================

export interface ProposeExpandRequest {
  /** Target to expand */
  target: ai.ExpandTarget;
  /** Depth of expansion */
  depth?: 'surface' | 'deep';
  /** Max nodes per package (default: 5) */
  maxNodesPerPackage?: number;
  /** Expansion scope: 'constrained' or 'flexible' */
  expansionScope?: ai.ExpansionScope;
  /** User guidance for generation */
  direction?: string;
  /** Number of package alternatives to generate (default: 3) */
  packageCount?: number;
  /** Creativity level 0-1 (default: 0.5) */
  creativity?: number;
}

export interface ProposeExpandResponse {
  sessionId: string;
  packages: ai.NarrativePackage[];
  expandedTarget: {
    type: 'node' | 'story-context';
    nodeId?: string;
    nodeType?: string;
    section?: ai.ContextSection;
  };
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Generate expansion packages for a target node or story context.
 *
 * Flow:
 * 1. Load graph state
 * 2. Validate target (node exists if node expansion)
 * 3. Serialize context and target
 * 4. Build Expand-specific prompt
 * 5. Call LLM
 * 6. Parse and validate response
 * 7. Create/update session
 * 8. Return packages with target info
 */
export async function proposeExpand(
  storyId: string,
  request: ProposeExpandRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<ProposeExpandResponse> {
  console.log(`[proposeExpand] Starting generation for story: ${storyId}`);

  const {
    target,
    depth = 'deep',
    maxNodesPerPackage = 5,
    expansionScope = 'flexible',
    direction,
    packageCount = 3,
    creativity = 0.5,
  } = request;

  // 1. Load graph state
  const graph = await loadGraphById(storyId, ctx);
  if (!graph) {
    throw new Error(`Story "${storyId}" not found`);
  }

  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" state not found`);
  }

  // 2. Validate and get target info
  let targetNodeData: string | undefined;
  let targetNodeType: string | undefined;
  let entryPointNodeId: string | undefined;

  if (target.type === 'node') {
    const node = getNode(graph, target.nodeId);
    if (!node) {
      throw new Error(`Node "${target.nodeId}" not found`);
    }
    targetNodeType = node.type;
    targetNodeData = serializeNodeForExpansion(node as ExpandableNode, graph);
    entryPointNodeId = target.nodeId;
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

  // 5. Get filtered ideas for expand task
  const ideasResult = ai.getIdeasForTask(graph, 'expand', entryPointNodeId, 5);

  // 5b. Get filtered guidelines for expand task
  const guidelinesResult = ai.getGuidelinesForTask(
    state.metadata?.storyContext?.operational,
    'expand'
  );

  // 6. Build prompt
  const promptParams: ExpandPromptParams = {
    storyContext,
    target,
    depth,
    packageCount,
    maxNodesPerPackage,
    creativity,
    expansionScope,
  };
  if (targetNodeData) {
    promptParams.targetNodeData = targetNodeData;
  }
  if (targetNodeType) {
    promptParams.targetNodeType = targetNodeType;
  }
  if (direction) {
    promptParams.direction = direction;
  }
  if (ideasResult.serialized) {
    promptParams.ideas = ideasResult.serialized;
  }
  if (guidelinesResult.serialized) {
    promptParams.guidelines = guidelinesResult.serialized;
  }

  const prompt = ai.buildExpandPrompt(promptParams);

  // 7. Call LLM (with system prompt if available)
  console.log(`[proposeExpand] Calling LLM (streaming: ${Boolean(streamCallbacks)}, systemPrompt: ${Boolean(systemPrompt)})...`);
  let response: string;

  try {
    if (streamCallbacks) {
      const llmResponse = await llmClient.stream(prompt, systemPrompt, streamCallbacks);
      response = llmResponse.content;
    } else {
      const llmResponse = await llmClient.complete(prompt, systemPrompt);
      response = llmResponse.content;
    }
    console.log(`[proposeExpand] LLM response received, length: ${response.length}`);
  } catch (llmError) {
    console.error('[proposeExpand] LLM call failed:', llmError);
    throw llmError;
  }

  // 8. Parse response
  console.log('[proposeExpand] Parsing LLM response...');
  console.log('[proposeExpand] Raw response (first 3000 chars):', response.slice(0, 3000));
  let result: ai.GenerationResult;
  try {
    result = ai.parseGenerationResponse(response);
    // Debug: log storyContext changes for each package
    result.packages.forEach((pkg, i) => {
      console.log(`[proposeExpand] Package ${i} storyContext:`, JSON.stringify(pkg.changes.storyContext ?? []));
    });
  } catch (parseError) {
    console.error('[proposeExpand] Failed to parse LLM response:', parseError);
    console.error('Raw response (first 2000 chars):', response.slice(0, 2000));
    throw parseError;
  }

  // 7. Validate and fix IDs
  const existingNodeIds = new Set(graph.nodes.keys());
  const validation = ai.validateGeneratedIds(result, existingNodeIds);

  if (!validation.valid) {
    console.warn('[proposeExpand] Regenerating invalid IDs:', validation.errors);
    result = ai.regenerateInvalidIds(result, existingNodeIds);
  }

  // 8. Create or update session
  let session = await loadGenerationSession(storyId, ctx);
  const versionInfo = await getCurrentVersionInfo(storyId, ctx);

  if (session && session.status === 'active') {
    await markSessionArchived(storyId, ctx);
  }

  const sessionParams = {
    depth: 'medium' as ai.GenerationDepth,
    count: 'few' as ai.GenerationCount,
  };
  if (direction) {
    (sessionParams as { depth: ai.GenerationDepth; count: ai.GenerationCount; direction?: string }).direction = direction;
  }

  // Map 'node' target type to a valid GenerationEntryPointType
  const entryPoint = target.type === 'node'
    ? { type: 'gap' as const, targetId: target.nodeId }
    : { type: 'naked' as const };

  session = await createGenerationSession(
    storyId,
    entryPoint,
    sessionParams,
    ctx,
    versionInfo ?? undefined
  );

  session = await addPackagesToSession(storyId, result.packages, ctx);

  // Build expanded target info for response
  const expandedTarget: ProposeExpandResponse['expandedTarget'] = {
    type: target.type === 'node' ? 'node' : 'story-context',
  };
  if (target.type === 'node') {
    expandedTarget.nodeId = target.nodeId;
    if (targetNodeType) {
      expandedTarget.nodeType = targetNodeType;
    }
  } else if (target.type === 'story-context-section') {
    expandedTarget.section = target.section;
  }

  return {
    sessionId: session.id,
    packages: result.packages,
    expandedTarget,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

// Union type for nodes we handle
type ExpandableNode = Character | StoryBeat | Scene | Location | { type: string; id: string; [key: string]: unknown };

/**
 * Serialize a node for expansion context.
 */
function serializeNodeForExpansion(
  node: ExpandableNode,
  _graph: GraphState
): string {
  const lines: string[] = [];

  // Common fields
  lines.push(`ID: ${node.id}`);
  lines.push(`Type: ${node.type}`);

  // Type-specific fields
  switch (node.type) {
    case 'Character': {
      const char = node as Character;
      lines.push(`Name: ${char.name}`);
      if (char.archetype) lines.push(`Archetype: ${char.archetype}`);
      if (char.description) lines.push(`Description: ${char.description}`);
      if (char.traits && char.traits.length > 0) lines.push(`Traits: ${char.traits.join(', ')}`);
      break;
    }
    case 'StoryBeat': {
      const sb = node as StoryBeat;
      lines.push(`Title: ${sb.title}`);
      if (sb.summary) lines.push(`Summary: ${sb.summary}`);
      if (sb.intent) lines.push(`Intent: ${sb.intent}`);
      if (sb.priority) lines.push(`Priority: ${sb.priority}`);
      break;
    }
    case 'Scene': {
      const scene = node as Scene;
      if (scene.heading) lines.push(`Heading: ${scene.heading}`);
      if (scene.scene_overview) lines.push(`Overview: ${scene.scene_overview}`);
      if (scene.mood) lines.push(`Mood: ${scene.mood}`);
      break;
    }
    case 'Location': {
      const loc = node as Location;
      lines.push(`Name: ${loc.name}`);
      if (loc.description) lines.push(`Description: ${loc.description}`);
      break;
    }
    default:
      // Generic serialization for other node types
      const nodeAny = node as Record<string, unknown>;
      for (const [key, value] of Object.entries(nodeAny)) {
        if (key !== 'id' && key !== 'type' && value && typeof value === 'string') {
          lines.push(`${key}: ${value}`);
        }
      }
  }

  return lines.join('\n');
}
