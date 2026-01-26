/**
 * Regenerate Element Orchestrator
 *
 * Handles regenerating a single element within a package.
 * Takes user guidance and generates N alternative versions of one element
 * while keeping the rest of the package fixed.
 */

import { ai } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadGraphById,
  loadVersionedStateById,
} from '../storage.js';
import {
  loadGenerationSession,
  findPackageInSession,
  updatePackageInSession,
} from '../session.js';
import { LLMClient, type StreamCallbacks } from './llmClient.js';

// =============================================================================
// Types
// =============================================================================

export type ElementType = 'node' | 'edge' | 'storyContext';

export interface RegenerateElementRequest {
  packageId: string;
  elementType: ElementType;
  elementIndex: number;
  guidance?: string;
  count?: ai.GenerationCount;
}

export interface RegenerateElementResponse {
  options: Array<ai.NodeChange | ai.EdgeChange | ai.StoryContextChange>;
}

// =============================================================================
// Prompt Builder
// =============================================================================

function buildRegenerateElementPrompt(params: {
  pkg: ai.NarrativePackage;
  elementType: ElementType;
  elementIndex: number;
  currentElement: ai.NodeChange | ai.EdgeChange | ai.StoryContextChange;
  guidance: string;
  storyContext: string;
  count: number;
}): string {
  const { pkg, elementType, elementIndex, currentElement, guidance, storyContext, count } = params;

  // Format the package context (excluding the element being regenerated)
  const otherElements = formatOtherElements(pkg, elementType, elementIndex);

  const elementTypeLabel = elementType === 'storyContext' ? 'Story Context Change' :
    elementType === 'node' ? 'Node' : 'Edge';

  return `You are refining a single element within a narrative package.

## Story Context
${storyContext}

## Package Being Refined
**Title**: ${pkg.title}
**Rationale**: ${pkg.rationale}

### Other Elements (FIXED - do not modify)
${otherElements}

## Element to Regenerate
**Type**: ${elementTypeLabel}
**Index**: ${elementIndex}
**Current Value**:
\`\`\`json
${JSON.stringify(currentElement, null, 2)}
\`\`\`

${guidance ? `## User Guidance\n"${guidance}"\n` : ''}

## Instructions
Generate exactly ${count} alternative version${count > 1 ? 's' : ''} of ONLY this ${elementTypeLabel.toLowerCase()}.
${elementType === 'node' ? `Keep the same operation ("${(currentElement as ai.NodeChange).operation}") and node_id ("${(currentElement as ai.NodeChange).node_id}").` : ''}
${elementType === 'edge' ? `Keep the same operation ("${(currentElement as ai.EdgeChange).operation}").` : ''}
${elementType === 'storyContext' ? `Keep the same operation ("${(currentElement as ai.StoryContextChange).operation}") and section ("${(currentElement as ai.StoryContextChange).section}").` : ''}
Each option should ${guidance ? 'interpret the guidance differently' : 'offer a meaningfully different alternative'}.
Ensure coherence with the other elements in the package.

## Output Format
Return ONLY a JSON object with an "options" array containing exactly ${count} element${count > 1 ? 's' : ''}:
\`\`\`json
{
  "options": [
    ${getElementTemplate(elementType, currentElement)},
    ...
  ]
}
\`\`\`

Important: Return ONLY the JSON object, no additional text.`;
}

function formatOtherElements(
  pkg: ai.NarrativePackage,
  excludeType: ElementType,
  excludeIndex: number
): string {
  const parts: string[] = [];

  // Story context changes
  if (pkg.changes.storyContext && pkg.changes.storyContext.length > 0) {
    const items = pkg.changes.storyContext
      .map((sc, i) => {
        if (excludeType === 'storyContext' && i === excludeIndex) return null;
        return `  - [${sc.operation}] ${sc.section}: "${sc.content.slice(0, 100)}${sc.content.length > 100 ? '...' : ''}"`;
      })
      .filter(Boolean);
    if (items.length > 0) {
      parts.push(`**Story Context Changes:**\n${items.join('\n')}`);
    }
  }

  // Node changes
  if (pkg.changes.nodes.length > 0) {
    const items = pkg.changes.nodes
      .map((node, i) => {
        if (excludeType === 'node' && i === excludeIndex) return null;
        const label = (node.data as Record<string, unknown>)?.name ??
          (node.data as Record<string, unknown>)?.title ?? node.node_id;
        return `  - [${node.operation}] ${node.node_type}: "${label}"`;
      })
      .filter(Boolean);
    if (items.length > 0) {
      parts.push(`**Node Changes:**\n${items.join('\n')}`);
    }
  }

  // Edge changes
  if (pkg.changes.edges.length > 0) {
    const items = pkg.changes.edges
      .map((edge, i) => {
        if (excludeType === 'edge' && i === excludeIndex) return null;
        return `  - [${edge.operation}] ${edge.edge_type}: ${edge.from} → ${edge.to}`;
      })
      .filter(Boolean);
    if (items.length > 0) {
      parts.push(`**Edge Changes:**\n${items.join('\n')}`);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : 'None';
}

function getElementTemplate(
  elementType: ElementType,
  current: ai.NodeChange | ai.EdgeChange | ai.StoryContextChange
): string {
  if (elementType === 'node') {
    const node = current as ai.NodeChange;
    return `{ "operation": "${node.operation}", "node_type": "${node.node_type}", "node_id": "${node.node_id}", "data": { ... } }`;
  } else if (elementType === 'edge') {
    const edge = current as ai.EdgeChange;
    return `{ "operation": "${edge.operation}", "edge_type": "...", "from": "...", "to": "..." }`;
  } else {
    const sc = current as ai.StoryContextChange;
    return `{ "operation": "${sc.operation}", "section": "${sc.section}", "content": "..." }`;
  }
}

// =============================================================================
// Response Parser
// =============================================================================

function parseRegenerateResponse(
  raw: string,
  elementType: ElementType
): Array<ai.NodeChange | ai.EdgeChange | ai.StoryContextChange> {
  // Extract JSON from response
  let json = raw.trim();

  // Handle markdown code blocks
  const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    json = codeBlockMatch[1].trim();
  }

  // Parse JSON
  let parsed: { options?: unknown[] };
  try {
    parsed = JSON.parse(json);
  } catch {
    // Try to extract just the options array
    const arrayMatch = json.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      try {
        const options = JSON.parse(arrayMatch[0]);
        parsed = { options };
      } catch {
        throw new Error('Failed to parse regenerate response as JSON');
      }
    } else {
      throw new Error('Failed to parse regenerate response as JSON');
    }
  }

  if (!parsed.options || !Array.isArray(parsed.options)) {
    throw new Error('Response missing "options" array');
  }

  // Validate each option based on element type
  return parsed.options.map((opt, i) => {
    if (typeof opt !== 'object' || opt === null) {
      throw new Error(`Option ${i} is not an object`);
    }

    const option = opt as Record<string, unknown>;

    if (elementType === 'node') {
      if (!option.operation || !option.node_type || !option.node_id) {
        throw new Error(`Option ${i} missing required node fields`);
      }
      return option as unknown as ai.NodeChange;
    } else if (elementType === 'edge') {
      if (!option.operation || !option.edge_type || !option.from || !option.to) {
        throw new Error(`Option ${i} missing required edge fields`);
      }
      return option as unknown as ai.EdgeChange;
    } else {
      if (!option.operation || !option.section || !option.content) {
        throw new Error(`Option ${i} missing required storyContext fields`);
      }
      return option as unknown as ai.StoryContextChange;
    }
  });
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Regenerate a single element within a package.
 *
 * Flow:
 * 1. Load session and find package
 * 2. Extract the element to regenerate
 * 3. Load graph state for context
 * 4. Build focused prompt
 * 5. Call LLM
 * 6. Parse and return options
 */
export async function regenerateElement(
  storyId: string,
  request: RegenerateElementRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<RegenerateElementResponse> {
  const {
    packageId,
    elementType,
    elementIndex,
    guidance = '',
    count = 'few',
  } = request;

  // 1. Load session and find package
  const session = await loadGenerationSession(storyId, ctx);
  if (!session) {
    throw new Error(`No active generation session for story ${storyId}`);
  }

  if (session.status !== 'active') {
    throw new Error(`Cannot regenerate: session is ${session.status}`);
  }

  const pkg = await findPackageInSession(storyId, packageId, ctx);
  if (!pkg) {
    throw new Error(`Package ${packageId} not found in session`);
  }

  // 2. Extract the element to regenerate
  let currentElement: ai.NodeChange | ai.EdgeChange | ai.StoryContextChange;

  if (elementType === 'node') {
    if (elementIndex < 0 || elementIndex >= pkg.changes.nodes.length) {
      throw new Error(`Invalid node index ${elementIndex}`);
    }
    currentElement = pkg.changes.nodes[elementIndex]!;
  } else if (elementType === 'edge') {
    if (elementIndex < 0 || elementIndex >= pkg.changes.edges.length) {
      throw new Error(`Invalid edge index ${elementIndex}`);
    }
    currentElement = pkg.changes.edges[elementIndex]!;
  } else if (elementType === 'storyContext') {
    const storyContextChanges = pkg.changes.storyContext ?? [];
    if (elementIndex < 0 || elementIndex >= storyContextChanges.length) {
      throw new Error(`Invalid storyContext index ${elementIndex}`);
    }
    currentElement = storyContextChanges[elementIndex]!;
  } else {
    throw new Error(`Invalid element type: ${elementType}`);
  }

  // 3. Load graph state for context
  const graph = await loadGraphById(storyId, ctx);
  if (!graph) {
    throw new Error(`Story "${storyId}" not found`);
  }

  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" state not found`);
  }

  // 4. Build system prompt from metadata (stable, cacheable)
  const systemPromptParams: ai.SystemPromptParams = {
    storyName: state.metadata?.name,
    logline: state.metadata?.logline,
    storyContext: state.metadata?.storyContext,
  };
  const systemPrompt = ai.hasSystemPromptContent(systemPromptParams)
    ? ai.buildSystemPrompt(systemPromptParams)
    : undefined;

  // 5. Serialize story state (without creative direction - that's in system prompt)
  const metadata: ai.StoryMetadata = {};
  if (state.metadata?.name) metadata.name = state.metadata.name;
  if (state.metadata?.logline) metadata.logline = state.metadata.logline;
  // Note: storyContext intentionally omitted - it's in system prompt now
  const storyContext = ai.serializeStoryState(graph, metadata);

  // 6. Get package count
  const packageCount = ai.getPackageCount(count);

  // 7. Build prompt
  const prompt = buildRegenerateElementPrompt({
    pkg,
    elementType,
    elementIndex,
    currentElement,
    guidance,
    storyContext,
    count: packageCount,
  });

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
  const options = parseRegenerateResponse(response, elementType);

  return { options };
}

/**
 * Apply a selected option to replace an element in a package.
 */
export async function applyElementOption(
  storyId: string,
  packageId: string,
  elementType: ElementType,
  elementIndex: number,
  newElement: ai.NodeChange | ai.EdgeChange | ai.StoryContextChange,
  ctx: StorageContext
): Promise<ai.NarrativePackage> {
  const pkg = await findPackageInSession(storyId, packageId, ctx);
  if (!pkg) {
    throw new Error(`Package ${packageId} not found in session`);
  }

  // Create updated package
  const updatedPkg = { ...pkg };
  updatedPkg.changes = { ...pkg.changes };

  if (elementType === 'node') {
    updatedPkg.changes.nodes = [...pkg.changes.nodes];
    updatedPkg.changes.nodes[elementIndex] = newElement as ai.NodeChange;
  } else if (elementType === 'edge') {
    updatedPkg.changes.edges = [...pkg.changes.edges];
    updatedPkg.changes.edges[elementIndex] = newElement as ai.EdgeChange;
  } else if (elementType === 'storyContext') {
    updatedPkg.changes.storyContext = [...(pkg.changes.storyContext ?? [])];
    updatedPkg.changes.storyContext[elementIndex] = newElement as ai.StoryContextChange;
  }

  // Save updated package
  await updatePackageInSession(storyId, packageId, updatedPkg, ctx);

  return updatedPkg;
}
