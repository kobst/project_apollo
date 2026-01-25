/**
 * Character Generation Orchestrator
 *
 * Handles Character-focused generation: generates Character nodes with optional
 * CharacterArc nodes based on the specified focus.
 *
 * Key features:
 * - Support for various focus types (develop_existing, new_protagonist, etc.)
 * - Optional CharacterArc generation
 * - Session management for reviewing/accepting packages
 */

import {
  ai,
  getNodesByType,
  getEdgesByType,
  getNode,
  type Character,
  type StoryBeat,
  type Scene,
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
type CharacterPromptParams = ai.CharacterPromptParams;

// =============================================================================
// Types
// =============================================================================

export interface ProposeCharactersRequest {
  /** Character generation focus */
  focus: ai.CharacterFocus;
  /** Existing character ID for 'develop_existing' focus */
  characterId?: string;
  /** Whether to include character arcs (default: true) */
  includeArcs?: boolean;
  /** Max characters per package (default: 3) */
  maxCharactersPerPackage?: number;
  /** Expansion scope: 'constrained' or 'flexible' */
  expansionScope?: ai.ExpansionScope;
  /** User guidance for generation */
  direction?: string;
  /** Number of package alternatives to generate (default: 3) */
  packageCount?: number;
  /** Creativity level 0-1 (default: 0.5) */
  creativity?: number;
}

export interface ProposeCharactersResponse {
  sessionId: string;
  packages: ai.NarrativePackage[];
  existingCharacters: ai.CharacterSummary[];
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Generate Character packages based on the specified focus.
 *
 * Flow:
 * 1. Load graph state
 * 2. Validate focus and characterId if needed
 * 3. Serialize context
 * 4. Build Character-specific prompt
 * 5. Call LLM
 * 6. Parse and validate response
 * 7. Create/update session
 * 8. Return packages with existing characters summary
 */
export async function proposeCharacters(
  storyId: string,
  request: ProposeCharactersRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<ProposeCharactersResponse> {
  console.log(`[proposeCharacters] Starting generation for story: ${storyId}`);

  const {
    focus,
    characterId,
    includeArcs = true,
    maxCharactersPerPackage = 3,
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

  // 2. Validate focus-specific requirements
  let characterData: string | undefined;
  if (focus === 'develop_existing') {
    if (!characterId) {
      throw new Error('characterId is required for "develop_existing" focus');
    }
    const existingChar = getNode(graph, characterId);
    if (!existingChar || existingChar.type !== 'Character') {
      throw new Error(`Character "${characterId}" not found`);
    }
    characterData = serializeCharacterDetails(existingChar as Character, graph);
  }

  // 3. Get existing characters for context and response
  const characters = getNodesByType<Character>(graph, 'Character');
  const activeCharacters = characters.filter((c) => c.status !== 'INACTIVE');
  const existingCharacters = computeCharacterSummaries(activeCharacters, graph);

  // 4. Serialize context
  const metadata: ai.StoryMetadata = {};
  if (state.metadata?.name) metadata.name = state.metadata.name;
  if (state.metadata?.logline) metadata.logline = state.metadata.logline;
  if (state.metadata?.storyContext) metadata.storyContext = state.metadata.storyContext;

  const storyContext = ai.serializeStoryContext(graph, metadata);
  const existingCharactersText = serializeExistingCharacters(activeCharacters);
  const existingStoryBeatsText = serializeExistingStoryBeats(graph);

  // 5. Build prompt
  const promptParams: CharacterPromptParams = {
    storyContext,
    existingCharacters: existingCharactersText,
    existingStoryBeats: existingStoryBeatsText,
    focus,
    includeArcs,
    packageCount,
    maxCharactersPerPackage,
    creativity,
    expansionScope,
  };
  if (characterId) {
    promptParams.characterId = characterId;
  }
  if (characterData) {
    promptParams.characterData = characterData;
  }
  if (direction) {
    promptParams.direction = direction;
  }

  const prompt = ai.buildCharacterPrompt(promptParams);

  // 6. Call LLM
  console.log(`[proposeCharacters] Calling LLM (streaming: ${Boolean(streamCallbacks)})...`);
  let response: string;

  try {
    if (streamCallbacks) {
      const llmResponse = await llmClient.stream(prompt, undefined, streamCallbacks);
      response = llmResponse.content;
    } else {
      const llmResponse = await llmClient.complete(prompt);
      response = llmResponse.content;
    }
    console.log(`[proposeCharacters] LLM response received, length: ${response.length}`);
  } catch (llmError) {
    console.error('[proposeCharacters] LLM call failed:', llmError);
    throw llmError;
  }

  // 7. Parse response
  console.log('[proposeCharacters] Parsing LLM response...');
  let result: ai.GenerationResult;
  try {
    result = ai.parseGenerationResponse(response);
  } catch (parseError) {
    console.error('[proposeCharacters] Failed to parse LLM response:', parseError);
    console.error('Raw response (first 2000 chars):', response.slice(0, 2000));
    throw parseError;
  }

  // 8. Filter packages to ensure only valid node types
  const filteredPackages = filterCharacterPackages(result.packages, includeArcs);

  // 9. Validate and fix IDs
  const existingNodeIds = new Set(graph.nodes.keys());
  const filteredResult = { packages: filteredPackages };
  const validation = ai.validateGeneratedIds(filteredResult, existingNodeIds);

  if (!validation.valid) {
    console.warn('[proposeCharacters] Regenerating invalid IDs:', validation.errors);
    const fixedResult = ai.regenerateInvalidIds(filteredResult, existingNodeIds);
    filteredResult.packages = fixedResult.packages;
  }

  // 10. Create or update session
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

  const entryPoint = characterId
    ? { type: 'character' as const, targetId: characterId }
    : { type: 'naked' as const };

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
    existingCharacters,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Serialize existing characters for the prompt.
 */
function serializeExistingCharacters(characters: Character[]): string {
  if (characters.length === 0) {
    return '[No characters defined]';
  }

  const lines: string[] = [];
  for (const char of characters) {
    let line = `- **${char.name}** (${char.archetype ?? 'Unknown archetype'})`;
    if (char.description) {
      line += `: ${truncate(char.description, 80)}`;
    }
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Serialize detailed character info for develop_existing focus.
 */
function serializeCharacterDetails(char: Character, graph: GraphState): string {
  const lines: string[] = [];
  lines.push(`Name: ${char.name}`);
  lines.push(`Archetype: ${char.archetype ?? 'Not set'}`);
  if (char.description) lines.push(`Description: ${char.description}`);
  if (char.traits && char.traits.length > 0) lines.push(`Traits: ${char.traits.join(', ')}`);
  if (char.notes) lines.push(`Notes: ${char.notes}`);

  // Get character arcs
  const hasArcEdges = getEdgesByType(graph, 'HAS_ARC').filter((e) => e.from === char.id);
  if (hasArcEdges.length > 0) {
    lines.push('\nExisting Arcs:');
    for (const edge of hasArcEdges) {
      const arcNode = getNode(graph, edge.to);
      if (arcNode && 'arc_type' in arcNode) {
        const arc = arcNode as { arc_type?: string; start_state?: string; end_state?: string };
        lines.push(`  - ${arc.arc_type}: ${arc.start_state ?? ''} -> ${arc.end_state ?? ''}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Serialize existing story beats for context.
 */
function serializeExistingStoryBeats(graph: GraphState): string {
  const storyBeats = getNodesByType<StoryBeat>(graph, 'StoryBeat');
  const activeBeats = storyBeats.filter((sb) => sb.status !== 'deprecated');

  if (activeBeats.length === 0) {
    return '[No story beats defined]';
  }

  const lines: string[] = [];
  for (const sb of activeBeats.slice(0, 10)) {
    lines.push(`- ${sb.title}: ${truncate(sb.summary ?? '', 60)}`);
  }
  if (activeBeats.length > 10) {
    lines.push(`... and ${activeBeats.length - 10} more`);
  }

  return lines.join('\n');
}

/**
 * Compute character summaries for response.
 */
function computeCharacterSummaries(
  characters: Character[],
  graph: GraphState
): ai.CharacterSummary[] {
  const scenes = getNodesByType<Scene>(graph, 'Scene');
  const hasCharacterEdges = getEdgesByType(graph, 'HAS_CHARACTER');

  // Count scenes per character
  const sceneCountMap = new Map<string, number>();
  for (const edge of hasCharacterEdges) {
    // Check if from is a scene
    const fromNode = scenes.find((s) => s.id === edge.from);
    if (fromNode) {
      const count = sceneCountMap.get(edge.to) ?? 0;
      sceneCountMap.set(edge.to, count + 1);
    }
  }

  return characters.map((char) => {
    const summary: ai.CharacterSummary = {
      id: char.id,
      name: char.name,
      sceneCount: sceneCountMap.get(char.id) ?? 0,
    };
    if (char.archetype) {
      summary.archetype = char.archetype;
    }
    return summary;
  });
}

/**
 * Filter packages to only include valid Character-related nodes.
 */
function filterCharacterPackages(
  packages: ai.NarrativePackage[],
  includeArcs: boolean
): ai.NarrativePackage[] {
  const validPrimaryNodeTypes = new Set(['Character']);
  if (includeArcs) {
    validPrimaryNodeTypes.add('CharacterArc');
  }
  const validSupportingNodeTypes = new Set(['Location', 'Object']);

  return packages.map((pkg) => {
    // Handle both old (changes) and new (primary/supporting) structure
    if ('primary' in pkg && pkg.primary) {
      // New structure
      const primaryNodes = (pkg.primary as ai.PrimaryOutput).nodes.filter((node) => {
        if (!validPrimaryNodeTypes.has(node.node_type)) {
          console.warn(`[filterCharacterPackages] Filtering out non-Character primary node: ${node.node_type}`);
          return false;
        }
        return true;
      });

      let supportingNodes: ai.NodeChange[] = [];
      if ('supporting' in pkg && pkg.supporting) {
        supportingNodes = (pkg.supporting as ai.SupportingOutput).nodes.filter((node) => {
          if (!validSupportingNodeTypes.has(node.node_type)) {
            console.warn(`[filterCharacterPackages] Filtering out invalid supporting node: ${node.node_type}`);
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
