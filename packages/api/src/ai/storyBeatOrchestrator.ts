/**
 * PlotPoint Generation Orchestrator
 *
 * Handles PlotPoint-only generation: generates PlotPoint nodes to fill
 * structural gaps (beats without aligned PlotPoints).
 *
 * Key constraints:
 * - ONLY PlotPoint nodes are generated
 * - ONLY PRECEDES edges are allowed (alignment uses alignedBeatId property)
 * - Session management for reviewing/accepting packages
 */

import {
  ai,
  computeUnalignedBeats,
  getNodesByType,
  type MissingBeatInfo,
  type PlotPoint,
  type Character,
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

export interface ProposePlotPointsRequest {
  /** Beat IDs or BeatTypes to always include */
  priorityBeats?: string[];
  /** Number of package alternatives to generate (default: 3) */
  packageCount?: number;
  /** Max PlotPoints per package (default: 5) */
  maxPlotPointsPerPackage?: number;
  /** User guidance for generation */
  direction?: string;
  /** Creativity level 0-1 (default: 0.5) */
  creativity?: number;
  /** Expansion scope: 'constrained' (PlotPoints only) or 'flexible' (may include supporting) */
  expansionScope?: ai.ExpansionScope;
  /** Target specific act for generation */
  targetAct?: 1 | 2 | 3 | 4 | 5;
  /** Optional problem statement describing what narrative problem to solve */
  problemStatement?: string;
}

export interface ProposePlotPointsResponse {
  sessionId: string;
  packages: ai.NarrativePackage[];
  missingBeats: MissingBeatInfo[];
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Generate PlotPoint packages to fill structural gaps.
 *
 * Flow:
 * 1. Load graph state and compute unaligned beats
 * 2. Serialize context (story context, existing PlotPoints, characters)
 * 3. Build PlotPoint-specific prompt
 * 4. Call LLM
 * 5. Parse and validate response (filter non-PlotPoint nodes)
 * 6. Create/update session
 * 7. Return packages with missing beats info
 */
export async function proposePlotPoints(
  storyId: string,
  request: ProposePlotPointsRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<ProposePlotPointsResponse> {
  console.log(`[proposePlotPoints] Starting generation for story: ${storyId}`);

  const {
    priorityBeats = [],
    packageCount = 3,
    maxPlotPointsPerPackage = 5,
    direction,
    creativity = 0.5,
    expansionScope = 'flexible',
    targetAct,
    problemStatement,
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
  console.log(`[proposePlotPoints] Found ${missingBeats.length} unaligned beats`);

  // If no missing beats, return early with empty packages
  if (missingBeats.length === 0) {
    console.log('[proposePlotPoints] No missing beats to fill');
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
  const existingPlotPoints = serializeExistingPlotPoints(graph);
  const characters = serializeCharacters(graph);

  // 5. Get filtered ideas for plotPoint task
  const ideasResult = ai.getIdeasForTask(graph, 'plotPoint', undefined, 5);

  // 5b. Get filtered guidelines for plotPoint task
  const guidelinesResult = ai.getGuidelinesForTask(
    state.metadata?.storyContext?.operational,
    'storyBeat'
  );

  // 6. Build prompt
  const promptParams: ai.PlotPointPromptParams = {
    storyContext,
    existingPlotPoints: existingPlotPoints,
    characters,
    missingBeats,
    priorityBeats,
    packageCount,
    maxPlotPointsPerPackage: maxPlotPointsPerPackage,
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
  if (problemStatement) {
    promptParams.problemStatement = problemStatement;
  }

  const prompt = ai.buildPlotPointPrompt(promptParams);

  // 7. Call LLM (with system prompt if available)
  console.log(`[proposePlotPoints] Calling LLM (streaming: ${Boolean(streamCallbacks)}, systemPrompt: ${Boolean(systemPrompt)})...`);
  let response: string;

  try {
    if (streamCallbacks) {
      const llmResponse = await llmClient.stream(prompt, systemPrompt, streamCallbacks);
      response = llmResponse.content;
    } else {
      const llmResponse = await llmClient.complete(prompt, systemPrompt);
      response = llmResponse.content;
    }
    console.log(`[proposePlotPoints] LLM response received, length: ${response.length}`);
  } catch (llmError) {
    console.error('[proposePlotPoints] LLM call failed:', llmError);
    throw llmError;
  }

  // 8. Parse response
  console.log('[proposePlotPoints] Parsing LLM response...');
  let result: ai.GenerationResult;
  try {
    result = ai.parseGenerationResponse(response);
  } catch (parseError) {
    console.error('[proposePlotPoints] Failed to parse LLM response:', parseError);
    console.error('Raw response (first 2000 chars):', response.slice(0, 2000));
    throw parseError;
  }

  // 9. Validate and filter - ONLY allow PlotPoint nodes and valid edges
  const filteredPackages = filterPlotPointPackages(result.packages, graph);

  // 10. Validate and fix IDs
  const existingNodeIds = new Set(graph.nodes.keys());
  const filteredResult = { packages: filteredPackages };
  const validation = ai.validateGeneratedIds(filteredResult, existingNodeIds);

  if (!validation.valid) {
    console.warn('[proposePlotPoints] Regenerating invalid IDs:', validation.errors);
    const fixedResult = ai.regenerateInvalidIds(filteredResult, existingNodeIds);
    filteredResult.packages = fixedResult.packages;
  }

  // 11. Validate edge references
  const edgeValidation = ai.validateEdgeReferences(filteredResult, existingNodeIds);
  if (!edgeValidation.valid) {
    console.warn('[proposePlotPoints] Invalid edge references:', edgeValidation.errors);
  }

  // 10. Check if any package addresses priority beats
  if (priorityBeats.length > 0) {
    const addressesPriority = checkPriorityBeatsCoverage(
      filteredResult.packages,
      priorityBeats,
      missingBeats
    );
    if (!addressesPriority) {
      console.warn('[proposePlotPoints] Warning: No package addresses priority beats');
    }
  }

  // 10b. Validate packages (temporal consistency via mentions)
  const validatedPackages = ai.validatePackages(filteredResult.packages, graph);
  const validationSummary = ai.getValidationSummary(validatedPackages);
  if (validationSummary !== 'No validation warnings') {
    console.warn(`[proposePlotPoints] Package validation: ${validationSummary}`);
  }
  // 10c. Compute deterministic impact
  filteredResult.packages = validatedPackages.map(pkg => ({
    ...pkg,
    impact: ai.computeImpact(pkg, { graph }),
  }));

  // 10d. Simple constraint linting (basic keywords for common constraints)
  try {
    const allIdeas = getNodesByType<any>(graph, 'Idea');
    const constraintIdeas = allIdeas.filter((i: any) => (i.kind || 'proposal') === 'constraint');
    const hasNoSupernatural = constraintIdeas.some((c: any) =>
      /no\s+supernatural|stay[s]? grounded|no magic/i.test(`${c.title}\n${c.description}`)
    );
    if (hasNoSupernatural) {
      const banned = ['magic', 'wizard', 'ghost', 'spirit', 'vampire', 'witch', 'supernatural'];
      for (const pkg of filteredResult.packages) {
        const texts: string[] = [];
        for (const nc of pkg.changes.nodes) {
          if (nc.node_type === 'PlotPoint' && nc.data) {
            const t = `${nc.data.title ?? ''}\n${nc.data.summary ?? ''}`;
            texts.push(String(t).toLowerCase());
          }
        }
        const violations = banned.filter((w) => texts.some((t) => t.includes(w)));
        if (violations.length > 0) {
          (pkg as any).validation = {
            ...((pkg as any).validation || {}),
            constraintWarnings: [`Potentially violates 'No supernatural' constraint: ${violations.join(', ')}`],
          };
        }
      }
    }
  } catch {
    // best-effort lint; ignore errors
  }

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
    { type: 'naked' }, // PlotPoint generation doesn't have a specific target
    sessionParams,
    ctx,
    versionInfo ?? undefined
  );

  // Add packages to session with included idea IDs context for provenance
  const packageContext = Object.fromEntries(
    filteredResult.packages.map((p) => [p.id, { includedIdeaIds: ideasResult.includedIds }])
  );
  session = await addPackagesToSession(storyId, filteredResult.packages, ctx, packageContext);

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
 * Serialize existing PlotPoints with their alignments.
 */
function serializeExistingPlotPoints(graph: import('@apollo/core').GraphState): string {
  const plotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');
  const activePlotPoints = plotPoints.filter((sb) => sb.status !== 'deprecated');

  if (activePlotPoints.length === 0) {
    return '[No existing PlotPoints]';
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
  for (const sb of activePlotPoints) {
    const alignedBeatId = (sb as any).alignedBeatId as string | undefined;
    const precedes = precedesMap.get(sb.id) ?? [];

    let line = `- **${sb.id}**: "${sb.title}"`;
    if (sb.summary) {
      line += ` - ${truncate(sb.summary, 60)}`;
    }
    if (alignedBeatId) {
      line += ` [alignedBeatId: ${alignedBeatId}]`;
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
 * Filter packages to only include PlotPoint nodes and valid edges.
 */
function filterPlotPointPackages(
  packages: ai.NarrativePackage[],
  graph: import('@apollo/core').GraphState
): ai.NarrativePackage[] {
  const validEdgeTypes = new Set(['PRECEDES']);

  return packages.map((pkg) => {
    // Filter nodes - only PlotPoints
    const validNodes = pkg.changes.nodes.filter((node) => {
      if (node.node_type !== 'PlotPoint') {
        console.warn(`[filterPlotPointPackages] Filtering out non-PlotPoint node: ${node.node_type}`);
        return false;
      }
      return true;
    });

    // Build set of new PlotPoint IDs for validating PRECEDES edges
    const newPlotPointIds = new Set(validNodes.map((n) => n.node_id));

    // Get existing PlotPoint IDs
    const existingPlotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');
    const existingPlotPointIds = new Set(existingPlotPoints.map((sb) => sb.id));

    // Filter edges - only PRECEDES with valid targets
    const validEdges = pkg.changes.edges.filter((edge) => {
      if (!validEdgeTypes.has(edge.edge_type)) {
        console.warn(`[filterPlotPointPackages] Filtering out invalid edge type: ${edge.edge_type}`);
        return false;
      }

      // Validate PRECEDES targets are PlotPoint IDs (new or existing)
      if (edge.edge_type === 'PRECEDES') {
        if (!newPlotPointIds.has(edge.to) && !existingPlotPointIds.has(edge.to)) {
          console.warn(`[filterPlotPointPackages] PRECEDES edge targets non-PlotPoint: ${edge.to}`);
          return false;
        }
      }

      return true;
    });

    // Build changes object without storyContext (not relevant for PlotPoint-only generation)
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

  // Check if any package has nodes with alignedBeatId pointing to a priority beat
  for (const pkg of packages) {
    for (const nodeChange of pkg.changes.nodes) {
      if (nodeChange.data?.alignedBeatId && priorityBeatIds.has(nodeChange.data.alignedBeatId as string)) {
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
