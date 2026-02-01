/**
 * StoryBeat Generation Orchestrator
 *
 * Handles StoryBeat-only generation: generates StoryBeat nodes to fill
 * structural gaps (beats without ALIGNS_WITH edges).
 *
 * Key constraints:
 * - ONLY StoryBeat nodes are generated
 * - ONLY ALIGNS_WITH and PRECEDES edges are allowed
 * - Session management for reviewing/accepting packages
 */

import {
  ai,
  computeUnalignedBeats,
  getNodesByType,
  type MissingBeatInfo,
  type StoryBeat,
  type Character,
  type Beat,
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

// =============================================================================
// Types
// =============================================================================

export interface ProposeStoryBeatsRequest {
  /** Beat IDs or BeatTypes to always include */
  priorityBeats?: string[];
  /** Number of package alternatives to generate (default: 3) */
  packageCount?: number;
  /** Max StoryBeats per package (default: 5) */
  maxStoryBeatsPerPackage?: number;
  /** User guidance for generation */
  direction?: string;
  /** Creativity level 0-1 (default: 0.5) */
  creativity?: number;
  /** Expansion scope: 'constrained' (StoryBeats only) or 'flexible' (may include supporting) */
  expansionScope?: ai.ExpansionScope;
  /** Target specific act for generation */
  targetAct?: 1 | 2 | 3 | 4 | 5;
}

export interface ProposeStoryBeatsResponse {
  sessionId: string;
  packages: ai.NarrativePackage[];
  missingBeats: MissingBeatInfo[];
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Generate StoryBeat packages to fill structural gaps.
 *
 * Flow:
 * 1. Load graph state and compute unaligned beats
 * 2. Serialize context (story context, existing StoryBeats, characters)
 * 3. Build StoryBeat-specific prompt
 * 4. Call LLM
 * 5. Parse and validate response (filter non-StoryBeat nodes)
 * 6. Create/update session
 * 7. Return packages with missing beats info
 */
export async function proposeStoryBeats(
  storyId: string,
  request: ProposeStoryBeatsRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<ProposeStoryBeatsResponse> {
  console.log(`[proposeStoryBeats] Starting generation for story: ${storyId}`);

  const {
    priorityBeats = [],
    packageCount = 3,
    maxStoryBeatsPerPackage = 5,
    direction,
    creativity = 0.5,
    expansionScope = 'flexible',
    targetAct,
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

  // 2. Compute unaligned beats (opportunities)
  const missingBeats = computeUnalignedBeats(graph);
  console.log(`[proposeStoryBeats] Found ${missingBeats.length} unaligned beats`);

  // If no missing beats, return early with empty packages
  if (missingBeats.length === 0) {
    console.log('[proposeStoryBeats] No missing beats to fill');
    return {
      sessionId: '',
      packages: [],
      missingBeats: [],
    };
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
  const existingStoryBeats = serializeExistingStoryBeats(graph);
  const characters = serializeCharacters(graph);

  // 5. Get filtered ideas for storyBeat task
  const ideasResult = ai.getIdeasForTask(graph, 'storyBeat', undefined, 5);

  // 5b. Get filtered guidelines for storyBeat task
  const guidelinesResult = ai.getGuidelinesForTask(
    state.metadata?.storyContext?.operational,
    'storyBeat'
  );

  // 6. Build prompt
  const promptParams: ai.StoryBeatPromptParams = {
    storyContext,
    existingStoryBeats,
    characters,
    missingBeats,
    priorityBeats,
    packageCount,
    maxStoryBeatsPerPackage,
    creativity,
    expansionScope,
  };
  if (direction) {
    promptParams.direction = direction;
  }
  if (targetAct) {
    promptParams.targetAct = targetAct;
  }
  if (ideasResult.serialized) {
    promptParams.ideas = ideasResult.serialized;
  }
  if (guidelinesResult.serialized) {
    promptParams.guidelines = guidelinesResult.serialized;
  }

  const prompt = ai.buildStoryBeatPrompt(promptParams);

  // 7. Call LLM (with system prompt if available)
  console.log(`[proposeStoryBeats] Calling LLM (streaming: ${Boolean(streamCallbacks)}, systemPrompt: ${Boolean(systemPrompt)})...`);
  let response: string;

  try {
    if (streamCallbacks) {
      const llmResponse = await llmClient.stream(prompt, systemPrompt, streamCallbacks);
      response = llmResponse.content;
    } else {
      const llmResponse = await llmClient.complete(prompt, systemPrompt);
      response = llmResponse.content;
    }
    console.log(`[proposeStoryBeats] LLM response received, length: ${response.length}`);
  } catch (llmError) {
    console.error('[proposeStoryBeats] LLM call failed:', llmError);
    throw llmError;
  }

  // 8. Parse response
  console.log('[proposeStoryBeats] Parsing LLM response...');
  let result: ai.GenerationResult;
  try {
    result = ai.parseGenerationResponse(response);
  } catch (parseError) {
    console.error('[proposeStoryBeats] Failed to parse LLM response:', parseError);
    console.error('Raw response (first 2000 chars):', response.slice(0, 2000));
    throw parseError;
  }

  // 9. Validate and filter - ONLY allow StoryBeat nodes and valid edges
  const filteredPackages = filterStoryBeatPackages(result.packages, graph);

  // 10. Validate and fix IDs
  const existingNodeIds = new Set(graph.nodes.keys());
  const filteredResult = { packages: filteredPackages };
  const validation = ai.validateGeneratedIds(filteredResult, existingNodeIds);

  if (!validation.valid) {
    console.warn('[proposeStoryBeats] Regenerating invalid IDs:', validation.errors);
    const fixedResult = ai.regenerateInvalidIds(filteredResult, existingNodeIds);
    filteredResult.packages = fixedResult.packages;
  }

  // 11. Validate edge references
  const edgeValidation = ai.validateEdgeReferences(filteredResult, existingNodeIds);
  if (!edgeValidation.valid) {
    console.warn('[proposeStoryBeats] Invalid edge references:', edgeValidation.errors);
  }

  // 10. Check if any package addresses priority beats
  if (priorityBeats.length > 0) {
    const addressesPriority = checkPriorityBeatsCoverage(
      filteredResult.packages,
      priorityBeats,
      missingBeats
    );
    if (!addressesPriority) {
      console.warn('[proposeStoryBeats] Warning: No package addresses priority beats');
    }
  }

  // 10b. Validate packages (temporal consistency via mentions)
  const validatedPackages = ai.validatePackages(filteredResult.packages, graph);
  const validationSummary = ai.getValidationSummary(validatedPackages);
  if (validationSummary !== 'No validation warnings') {
    console.warn(`[proposeStoryBeats] Package validation: ${validationSummary}`);
  }
  // 10c. Compute deterministic impact
  filteredResult.packages = validatedPackages.map(pkg => ({
    ...pkg,
    impact: ai.computeImpact(pkg, { graph }),
  }));

  // 11. Create or update session
  let session = await loadGenerationSession(storyId, ctx);
  const versionInfo = await getCurrentVersionInfo(storyId, ctx);

  if (session && session.status === 'active') {
    // Archive existing active session before replacing
    await markSessionArchived(storyId, ctx);
  }

  // Create new session
  const sessionParams = {
    depth: 'medium' as ai.GenerationDepth,
    count: 'few' as ai.GenerationCount,
  };
  if (direction) {
    (sessionParams as { depth: ai.GenerationDepth; count: ai.GenerationCount; direction?: string }).direction = direction;
  }

  session = await createGenerationSession(
    storyId,
    { type: 'naked' }, // StoryBeat generation doesn't have a specific target
    sessionParams,
    ctx,
    versionInfo ?? undefined
  );

  // Add packages to session
  session = await addPackagesToSession(storyId, filteredResult.packages, ctx);

  return {
    sessionId: session.id,
    packages: filteredResult.packages,
    missingBeats,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Serialize existing StoryBeats with their alignments.
 */
function serializeExistingStoryBeats(graph: import('@apollo/core').GraphState): string {
  const storyBeats = getNodesByType<StoryBeat>(graph, 'StoryBeat');
  const activeStoryBeats = storyBeats.filter((sb) => sb.status !== 'deprecated');

  if (activeStoryBeats.length === 0) {
    return '[No existing StoryBeats]';
  }

  // Get ALIGNS_WITH edges to find beat alignments
  const alignsWithEdges = graph.edges.filter((e) => e.type === 'ALIGNS_WITH');
  const alignmentMap = new Map<string, string[]>();
  for (const edge of alignsWithEdges) {
    const existing = alignmentMap.get(edge.from) ?? [];
    existing.push(edge.to);
    alignmentMap.set(edge.from, existing);
  }

  // Get PRECEDES edges for ordering
  const precedesEdges = graph.edges.filter((e) => e.type === 'PRECEDES');
  const precedesMap = new Map<string, string[]>();
  for (const edge of precedesEdges) {
    const existing = precedesMap.get(edge.from) ?? [];
    existing.push(edge.to);
    precedesMap.set(edge.from, existing);
  }

  const lines: string[] = [];
  for (const sb of activeStoryBeats) {
    const alignments = alignmentMap.get(sb.id) ?? [];
    const precedes = precedesMap.get(sb.id) ?? [];

    let line = `- **${sb.id}**: "${sb.title}"`;
    if (sb.summary) {
      line += ` - ${truncate(sb.summary, 60)}`;
    }
    if (alignments.length > 0) {
      line += ` [ALIGNS_WITH: ${alignments.join(', ')}]`;
    }
    if (precedes.length > 0) {
      line += ` [PRECEDES: ${precedes.join(', ')}]`;
    }
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Serialize characters for context.
 */
function serializeCharacters(graph: import('@apollo/core').GraphState): string {
  const characters = getNodesByType<Character>(graph, 'Character');
  const activeCharacters = characters.filter((c) => c.status !== 'INACTIVE');

  if (activeCharacters.length === 0) {
    return '[No characters defined]';
  }

  const lines: string[] = [];
  for (const char of activeCharacters) {
    let line = `- **${char.name}**`;
    if (char.archetype) {
      line += ` (${char.archetype})`;
    }
    if (char.description) {
      line += `: ${truncate(char.description, 80)}`;
    }
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Filter packages to only include StoryBeat nodes and valid edges.
 */
function filterStoryBeatPackages(
  packages: ai.NarrativePackage[],
  graph: import('@apollo/core').GraphState
): ai.NarrativePackage[] {
  const validEdgeTypes = new Set(['ALIGNS_WITH', 'PRECEDES']);

  // Get all Beat IDs for validating ALIGNS_WITH targets
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const beatIds = new Set(beats.map((b) => b.id));

  return packages.map((pkg) => {
    // Filter nodes - only StoryBeats
    const validNodes = pkg.changes.nodes.filter((node) => {
      if (node.node_type !== 'StoryBeat') {
        console.warn(`[filterStoryBeatPackages] Filtering out non-StoryBeat node: ${node.node_type}`);
        return false;
      }
      return true;
    });

    // Build set of new StoryBeat IDs for validating PRECEDES edges
    const newStoryBeatIds = new Set(validNodes.map((n) => n.node_id));

    // Get existing StoryBeat IDs
    const existingStoryBeats = getNodesByType<StoryBeat>(graph, 'StoryBeat');
    const existingStoryBeatIds = new Set(existingStoryBeats.map((sb) => sb.id));

    // Filter edges - only ALIGNS_WITH and PRECEDES with valid targets
    const validEdges = pkg.changes.edges.filter((edge) => {
      if (!validEdgeTypes.has(edge.edge_type)) {
        console.warn(`[filterStoryBeatPackages] Filtering out invalid edge type: ${edge.edge_type}`);
        return false;
      }

      // Validate ALIGNS_WITH targets are Beat IDs
      if (edge.edge_type === 'ALIGNS_WITH') {
        if (!beatIds.has(edge.to)) {
          console.warn(`[filterStoryBeatPackages] ALIGNS_WITH edge targets non-Beat: ${edge.to}`);
          return false;
        }
      }

      // Validate PRECEDES targets are StoryBeat IDs (new or existing)
      if (edge.edge_type === 'PRECEDES') {
        if (!newStoryBeatIds.has(edge.to) && !existingStoryBeatIds.has(edge.to)) {
          console.warn(`[filterStoryBeatPackages] PRECEDES edge targets non-StoryBeat: ${edge.to}`);
          return false;
        }
      }

      return true;
    });

    // Build changes object without storyContext (not relevant for StoryBeat-only generation)
    const changes: ai.NarrativePackage['changes'] = {
      nodes: validNodes,
      edges: validEdges,
    };

    return {
      ...pkg,
      changes,
    };
  });
}

/**
 * Check if any package addresses priority beats.
 */
function checkPriorityBeatsCoverage(
  packages: ai.NarrativePackage[],
  priorityBeats: string[],
  missingBeats: MissingBeatInfo[]
): boolean {
  // Build set of priority beat IDs (could be ID or type)
  const priorityBeatIds = new Set<string>();
  for (const priority of priorityBeats) {
    // Check if it's a beat ID directly
    const directMatch = missingBeats.find((mb) => mb.beatId === priority);
    if (directMatch) {
      priorityBeatIds.add(directMatch.beatId);
      continue;
    }

    // Check if it's a beat type
    const typeMatches = missingBeats.filter((mb) => mb.beatType === priority);
    for (const match of typeMatches) {
      priorityBeatIds.add(match.beatId);
    }
  }

  // Check if any package has an ALIGNS_WITH edge to a priority beat
  for (const pkg of packages) {
    for (const edge of pkg.changes.edges) {
      if (edge.edge_type === 'ALIGNS_WITH' && priorityBeatIds.has(edge.to)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Truncate text to a maximum length.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
