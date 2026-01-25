/**
 * Scene Generation Orchestrator
 *
 * Handles Scene-focused generation: generates Scene nodes linked to
 * committed StoryBeats via SATISFIED_BY edges.
 *
 * Key features:
 * - Validates StoryBeats are committed before generation
 * - Links scenes to characters and locations
 * - Session management for reviewing/accepting packages
 */

import {
  ai,
  getNodesByType,
  getEdgesByType,
  getNode,
  type Character,
  type Location,
  type Scene,
  type StoryBeat,
  type GraphState,
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
type ScenePromptParams = ai.ScenePromptParams;

// =============================================================================
// Types
// =============================================================================

export interface ProposeScenesRequest {
  /** StoryBeat IDs to generate scenes for (must be committed) */
  storyBeatIds: string[];
  /** Number of scenes per StoryBeat (default: 1) */
  scenesPerBeat?: number;
  /** Max scenes per package (default: 5) */
  maxScenesPerPackage?: number;
  /** Expansion scope: 'constrained' or 'flexible' */
  expansionScope?: ai.ExpansionScope;
  /** User guidance for generation */
  direction?: string;
  /** Number of package alternatives to generate (default: 3) */
  packageCount?: number;
  /** Creativity level 0-1 (default: 0.5) */
  creativity?: number;
}

export interface ProposeScenesResponse {
  sessionId: string;
  packages: ai.NarrativePackage[];
  validatedBeats: ai.ValidatedBeatInfo[];
  rejectedBeats: ai.RejectedBeatInfo[];
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Generate Scene packages for committed StoryBeats.
 *
 * Flow:
 * 1. Load graph state
 * 2. Validate StoryBeats (must exist and be committed)
 * 3. Serialize context
 * 4. Build Scene-specific prompt
 * 5. Call LLM
 * 6. Parse and validate response
 * 7. Create/update session
 * 8. Return packages with validation info
 */
export async function proposeScenes(
  storyId: string,
  request: ProposeScenesRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<ProposeScenesResponse> {
  console.log(`[proposeScenes] Starting generation for story: ${storyId}`);

  const {
    storyBeatIds,
    scenesPerBeat = 1,
    maxScenesPerPackage = 5,
    expansionScope = 'flexible',
    direction,
    packageCount = 3,
    creativity = 0.5,
  } = request;

  if (!storyBeatIds || storyBeatIds.length === 0) {
    throw new Error('storyBeatIds is required and must contain at least one ID');
  }

  // 1. Load graph state
  const graph = await loadGraphById(storyId, ctx);
  if (!graph) {
    throw new Error(`Story "${storyId}" not found`);
  }

  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" state not found`);
  }

  // 2. Validate StoryBeats
  const { validatedBeats, rejectedBeats } = validateStoryBeats(storyBeatIds, graph);

  if (validatedBeats.length === 0) {
    console.log('[proposeScenes] No valid StoryBeats to generate scenes for');
    return {
      sessionId: '',
      packages: [],
      validatedBeats: [],
      rejectedBeats,
    };
  }

  console.log(`[proposeScenes] Validated ${validatedBeats.length} StoryBeats, rejected ${rejectedBeats.length}`);

  // 3. Serialize context
  const metadata: ai.StoryMetadata = {};
  if (state.metadata?.name) metadata.name = state.metadata.name;
  if (state.metadata?.logline) metadata.logline = state.metadata.logline;
  if (state.metadata?.storyContext) metadata.storyContext = state.metadata.storyContext;

  const storyContext = ai.serializeStoryContext(graph, metadata);
  const existingCharacters = serializeExistingCharacters(graph);
  const existingLocations = serializeExistingLocations(graph);
  const existingScenes = serializeExistingScenes(graph);

  // 4. Build prompt
  const promptParams: ScenePromptParams = {
    storyContext,
    validatedBeats,
    existingCharacters,
    existingLocations,
    existingScenes,
    scenesPerBeat,
    packageCount,
    maxScenesPerPackage,
    creativity,
    expansionScope,
  };
  if (direction) {
    promptParams.direction = direction;
  }

  const prompt = ai.buildScenePrompt(promptParams);

  // 5. Call LLM
  console.log(`[proposeScenes] Calling LLM (streaming: ${Boolean(streamCallbacks)})...`);
  let response: string;

  try {
    if (streamCallbacks) {
      const llmResponse = await llmClient.stream(prompt, undefined, streamCallbacks);
      response = llmResponse.content;
    } else {
      const llmResponse = await llmClient.complete(prompt);
      response = llmResponse.content;
    }
    console.log(`[proposeScenes] LLM response received, length: ${response.length}`);
  } catch (llmError) {
    console.error('[proposeScenes] LLM call failed:', llmError);
    throw llmError;
  }

  // 6. Parse response
  console.log('[proposeScenes] Parsing LLM response...');
  let result: ai.GenerationResult;
  try {
    result = ai.parseGenerationResponse(response);
  } catch (parseError) {
    console.error('[proposeScenes] Failed to parse LLM response:', parseError);
    console.error('Raw response (first 2000 chars):', response.slice(0, 2000));
    throw parseError;
  }

  // 7. Filter packages to ensure valid node types and edges
  const filteredPackages = filterScenePackages(result.packages, validatedBeats);

  // 8. Validate and fix IDs
  const existingNodeIds = new Set(graph.nodes.keys());
  const filteredResult = { packages: filteredPackages };
  const validation = ai.validateGeneratedIds(filteredResult, existingNodeIds);

  if (!validation.valid) {
    console.warn('[proposeScenes] Regenerating invalid IDs:', validation.errors);
    const fixedResult = ai.regenerateInvalidIds(filteredResult, existingNodeIds);
    filteredResult.packages = fixedResult.packages;
  }

  // 9. Create or update session
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

  const entryPoint: ai.GenerationEntryPoint = storyBeatIds.length > 0 && storyBeatIds[0]
    ? { type: 'storyBeat', targetId: storyBeatIds[0] }
    : { type: 'naked' };

  session = await createGenerationSession(
    storyId,
    entryPoint,
    sessionParams,
    ctx,
    versionInfo ?? undefined
  );

  session = await addPackagesToSession(storyId, filteredResult.packages, ctx);

  return {
    sessionId: session.id,
    packages: filteredResult.packages,
    validatedBeats,
    rejectedBeats,
  };
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate that StoryBeats exist and are committed.
 */
function validateStoryBeats(
  storyBeatIds: string[],
  graph: GraphState
): {
  validatedBeats: ai.ValidatedBeatInfo[];
  rejectedBeats: ai.RejectedBeatInfo[];
} {
  const validatedBeats: ai.ValidatedBeatInfo[] = [];
  const rejectedBeats: ai.RejectedBeatInfo[] = [];

  // Get ALIGNS_WITH edges to find beat alignments
  const alignsWithEdges = getEdgesByType(graph, 'ALIGNS_WITH');

  // Get SATISFIED_BY edges to check for existing scenes
  const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');
  const storyBeatsWithScenes = new Set(satisfiedByEdges.map((e) => e.to));

  for (const sbId of storyBeatIds) {
    const node = getNode(graph, sbId);

    // Check if node exists
    if (!node) {
      rejectedBeats.push({ storyBeatId: sbId, reason: 'not_found' });
      continue;
    }

    // Check if node is a StoryBeat
    if (node.type !== 'StoryBeat') {
      rejectedBeats.push({ storyBeatId: sbId, reason: 'not_found' });
      continue;
    }

    const storyBeat = node as StoryBeat;

    // Check if StoryBeat is approved (committed)
    // Note: 'approved' status means the story beat is committed and ready for scene generation
    if (storyBeat.status !== 'approved') {
      rejectedBeats.push({ storyBeatId: sbId, reason: 'not_committed' });
      continue;
    }

    // Check if StoryBeat already has scenes (optional - could be a warning instead)
    if (storyBeatsWithScenes.has(sbId)) {
      rejectedBeats.push({ storyBeatId: sbId, reason: 'already_has_scenes' });
      continue;
    }

    // Find the beat alignment
    const alignsWithEdge = alignsWithEdges.find((e) => e.from === sbId);
    const alignedTo = alignsWithEdge?.to ?? 'Unknown';

    validatedBeats.push({
      storyBeatId: sbId,
      title: storyBeat.title,
      alignedTo,
    });
  }

  return { validatedBeats, rejectedBeats };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Serialize existing characters for the prompt.
 */
function serializeExistingCharacters(graph: GraphState): string {
  const characters = getNodesByType<Character>(graph, 'Character');
  const activeCharacters = characters.filter((c) => c.status !== 'INACTIVE');

  if (activeCharacters.length === 0) {
    return '[No characters defined]';
  }

  const lines: string[] = [];
  for (const char of activeCharacters) {
    lines.push(`- **${char.id}**: ${char.name} (${char.archetype ?? 'Unknown archetype'})`);
  }

  return lines.join('\n');
}

/**
 * Serialize existing locations for the prompt.
 */
function serializeExistingLocations(graph: GraphState): string {
  const locations = getNodesByType<Location>(graph, 'Location');

  if (locations.length === 0) {
    return '[No locations defined]';
  }

  const lines: string[] = [];
  for (const loc of locations) {
    let line = `- **${loc.id}**: ${loc.name}`;
    if (loc.description) {
      line += ` - ${truncate(loc.description, 50)}`;
    }
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Serialize existing scenes for context.
 */
function serializeExistingScenes(graph: GraphState): string {
  const scenes = getNodesByType<Scene>(graph, 'Scene');

  if (scenes.length === 0) {
    return '[No existing scenes]';
  }

  const lines: string[] = [];
  for (const scene of scenes.slice(0, 10)) {
    lines.push(`- ${scene.heading ?? 'Untitled'}: ${truncate(scene.scene_overview ?? '', 60)}`);
  }
  if (scenes.length > 10) {
    lines.push(`... and ${scenes.length - 10} more`);
  }

  return lines.join('\n');
}

/**
 * Filter packages to ensure valid Scene-related nodes and edges.
 */
function filterScenePackages(
  packages: ai.NarrativePackage[],
  validatedBeats: ai.ValidatedBeatInfo[]
): ai.NarrativePackage[] {
  const validPrimaryNodeTypes = new Set(['Scene']);
  const validSupportingNodeTypes = new Set(['Character', 'Location', 'Object']);
  const validPrimaryEdgeTypes = new Set(['SATISFIED_BY', 'HAS_CHARACTER', 'LOCATED_AT', 'FEATURES_OBJECT']);
  const validBeatIds = new Set(validatedBeats.map((b) => b.storyBeatId));

  return packages.map((pkg) => {
    // Handle both old (changes) and new (primary/supporting) structure
    if ('primary' in pkg && pkg.primary) {
      // New structure
      const primaryNodes = (pkg.primary as ai.PrimaryOutput).nodes.filter((node) => {
        if (!validPrimaryNodeTypes.has(node.node_type)) {
          console.warn(`[filterScenePackages] Filtering out non-Scene primary node: ${node.node_type}`);
          return false;
        }
        return true;
      });

      // Validate SATISFIED_BY edges point to valid StoryBeats
      const primaryEdges = (pkg.primary as ai.PrimaryOutput).edges.filter((edge) => {
        if (!validPrimaryEdgeTypes.has(edge.edge_type)) {
          console.warn(`[filterScenePackages] Filtering out invalid edge type: ${edge.edge_type}`);
          return false;
        }
        if (edge.edge_type === 'SATISFIED_BY' && !validBeatIds.has(edge.to)) {
          console.warn(`[filterScenePackages] SATISFIED_BY edge targets invalid StoryBeat: ${edge.to}`);
          return false;
        }
        return true;
      });

      let supportingNodes: ai.NodeChange[] = [];
      if ('supporting' in pkg && pkg.supporting) {
        supportingNodes = (pkg.supporting as ai.SupportingOutput).nodes.filter((node) => {
          if (!validSupportingNodeTypes.has(node.node_type)) {
            console.warn(`[filterScenePackages] Filtering out invalid supporting node: ${node.node_type}`);
            return false;
          }
          return true;
        });
      }

      return {
        ...pkg,
        primary: {
          ...(pkg.primary as ai.PrimaryOutput),
          nodes: primaryNodes,
          edges: primaryEdges,
        },
        supporting: 'supporting' in pkg && pkg.supporting ? {
          ...(pkg.supporting as ai.SupportingOutput),
          nodes: supportingNodes,
        } : undefined,
      } as ai.NarrativePackage;
    } else {
      // Old structure - keep as is
      return pkg;
    }
  });
}

/**
 * Truncate text to a maximum length.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
