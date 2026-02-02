/**
 * Package to Patch conversion.
 *
 * Converts NarrativePackage (AI output format) to Patch (graph mutation format).
 * Handles Story Context changes separately since they're metadata, not graph nodes.
 *
 * Supports two package structures:
 * 1. Legacy: pkg.changes.nodes, pkg.changes.edges
 * 2. Enhanced: pkg.primary.nodes + pkg.supporting?.nodes, etc.
 *
 * Also handles suggestions:
 * - contextAdditions → Story Context updates
 * - stashedIdeas → Idea node creation
 */

import type { Patch, PatchOp, KGNode } from '../types/patch.js';
import type { Edge } from '../types/edges.js';
import type { Idea, IdeaKind } from '../types/nodes.js';
import type {
  NarrativePackage,
  StoryContextChange,
  StoryContextChangeOperation,
  ContextAddition,
  NodeChange,
  EdgeChange,
  StashedIdea,
} from './types.js';
import { defaultIdGenerator } from './idGenerator.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of converting a package to a patch.
 */
export interface ConversionResult {
  /** The patch to apply to the graph */
  patch: Patch;
  /** Story Context update if any changes were included */
  storyContextUpdate?: {
    /** Structured changes to apply to the StoryContext */
    changes: StoryContextChange[];
  };
  /** Idea nodes to create from stashed ideas */
  ideasToCreate?: Idea[];
}

/**
 * Options for package to patch conversion.
 */
export interface ConversionOptions {
  /** IDs of stashed ideas to exclude from conversion */
  excludedStashedIdeaIds?: Set<string>;
}

// =============================================================================
// Main Conversion Function
// =============================================================================

/**
 * Convert a NarrativePackage into a Patch for graph application.
 *
 * The patch contains node and edge operations that can be applied
 * to the graph using applyPatch(). Story Context changes are
 * returned separately since they update metadata, not the graph.
 *
 * Supports two package structures:
 * 1. Legacy: Uses pkg.changes.nodes, pkg.changes.edges
 * 2. Enhanced: Uses pkg.primary.nodes + pkg.supporting?.nodes, etc.
 *
 * Also handles suggestions:
 * - contextAdditions → Story Context updates (combined with storyContext changes)
 * - stashedIdeas → Idea node creation (returned separately, filtered by excludedStashedIdeaIds)
 *
 * @param pkg - The NarrativePackage to convert
 * @param baseVersionId - The version ID this patch is based on
 * @param currentStoryContext - Current Story Context content (for modifications)
 * @param options - Conversion options (e.g., excluded stashed idea IDs)
 * @returns Conversion result with patch and optional Story Context update
 */
export function packageToPatch(
  pkg: NarrativePackage,
  baseVersionId: string,
  _currentStoryContext?: string, // Deprecated, no longer used
  options?: ConversionOptions
): ConversionResult {
  const ops: PatchOp[] = [];

  // Collect all nodes and edges from either structure
  const allNodes: NodeChange[] = [];
  const allEdges: EdgeChange[] = [];

  // Check if enhanced structure is present (primary takes precedence)
  if (pkg.primary) {
    // Enhanced structure: flatten primary + supporting
    allNodes.push(...pkg.primary.nodes);
    allEdges.push(...pkg.primary.edges);

    if (pkg.supporting) {
      allNodes.push(...pkg.supporting.nodes);
      allEdges.push(...pkg.supporting.edges);
    }
  } else {
    // Legacy structure: use changes directly
    allNodes.push(...pkg.changes.nodes);
    allEdges.push(...pkg.changes.edges);
  }

  // Convert node changes
  for (const change of allNodes) {
    if (change.operation === 'add') {
      // Build the node object with required fields
      // The LLM output validation ensures required fields are present
      // We cast to KGNode since the full node type can't be verified at compile time
      const node = {
        type: change.node_type,
        id: change.node_id,
        ...change.data,
      } as KGNode;

      ops.push({
        op: 'ADD_NODE',
        node,
      });
    } else if (change.operation === 'modify') {
      ops.push({
        op: 'UPDATE_NODE',
        id: change.node_id,
        set: change.data ?? {},
      });
    } else if (change.operation === 'delete') {
      ops.push({
        op: 'DELETE_NODE',
        id: change.node_id,
      });
    }
  }

  // Convert edge changes
  for (const edge of allEdges) {
    if (edge.operation === 'add') {
      const edgeData: Partial<Edge> = {
        id: defaultIdGenerator('edge'),
        type: edge.edge_type as Edge['type'],
        from: edge.from,
        to: edge.to,
        provenance: {
          source: 'extractor',
          patchId: pkg.id,
        },
      };

      if (edge.properties) {
        edgeData.properties = edge.properties as Edge['properties'];
      }

      ops.push({
        op: 'ADD_EDGE',
        edge: edgeData as Edge,
      });
    } else if (edge.operation === 'delete') {
      ops.push({
        op: 'DELETE_EDGE',
        edge: {
          type: edge.edge_type as Edge['type'],
          from: edge.from,
          to: edge.to,
        },
      });
    }
  }

  const patch: Patch = {
    type: 'Patch',
    id: `patch_${Date.now()}_${randomString(5)}`,
    base_story_version_id: baseVersionId,
    created_at: new Date().toISOString(),
    ops,
    metadata: {
      source: 'ai_generation',
      package_id: pkg.id,
      package_title: pkg.title,
      confidence: pkg.confidence,
    },
  };

  const result: ConversionResult = { patch };

  // Handle Story Context changes (structured operations format)
  // Collect from both changes.storyContext and suggestions.contextAdditions
  const storyContextChanges: StoryContextChange[] = [];

  // Direct storyContext changes (already in structured format)
  if (pkg.changes.storyContext && pkg.changes.storyContext.length > 0) {
    storyContextChanges.push(...pkg.changes.storyContext);
  }

  // contextAdditions from suggestions (convert to structured operations)
  if (pkg.suggestions?.contextAdditions && pkg.suggestions.contextAdditions.length > 0) {
    for (const addition of pkg.suggestions.contextAdditions) {
      // Convert section-based addition to structured operation
      const change = convertContextAddition(addition);
      storyContextChanges.push(change);
    }
  }

  // Pass through Story Context changes for API layer to apply
  if (storyContextChanges.length > 0) {
    result.storyContextUpdate = {
      changes: storyContextChanges,
    };
  }

  // Handle stashed ideas → convert to Idea nodes (filter out excluded ones)
  if (pkg.suggestions?.stashedIdeas && pkg.suggestions.stashedIdeas.length > 0) {
    const excludedIds = options?.excludedStashedIdeaIds;
    const filteredIdeas = excludedIds
      ? pkg.suggestions.stashedIdeas.filter((idea) => !excludedIds.has(idea.id))
      : pkg.suggestions.stashedIdeas;

    if (filteredIdeas.length > 0) {
      result.ideasToCreate = convertStashedIdeasToNodes(filteredIdeas, pkg.id);
    }
  }

  return result;
}

/**
 * Convert stashed ideas to Idea nodes.
 */
function convertStashedIdeasToNodes(
  ideas: StashedIdea[],
  sourcePackageId: string,
  generationContext?: { task: string; targetBeat?: string; targetAct?: number; themes?: string[]; promptSnippet?: string }
): Idea[] {
  const timestamp = new Date().toISOString();

  return ideas.map((idea) => {
    const ideaNode: Idea = {
      type: 'Idea' as const,
      id: idea.id.startsWith('idea_') ? idea.id : `idea_${Date.now()}_${randomString(4)}`,
      title: idea.content.slice(0, 50) + (idea.content.length > 50 ? '...' : ''),
      description: idea.content,
      source: 'ai' as const,
      status: 'active' as const,
      category: idea.category,
      sourcePackageId,
      createdAt: timestamp,
      // Enhanced planning defaults
      kind: inferKindFromContent(idea.content),
    } as Idea;

    // Conditional fields
    if (generationContext?.targetBeat) (ideaNode as any).targetBeat = generationContext.targetBeat;
    if (typeof generationContext?.targetAct === 'number') (ideaNode as any).targetAct = generationContext!.targetAct;
    if (generationContext?.themes) (ideaNode as any).themes = generationContext.themes;
    if (generationContext) {
      const gen: { task: string; timestamp: string; promptSnippet?: string } = {
        task: generationContext.task,
        timestamp,
      };
      if (generationContext.promptSnippet) gen.promptSnippet = generationContext.promptSnippet.slice(0, 200);
      (ideaNode as any).generationContext = gen;
    }

    // Only add relatedNodeIds if defined
    if (idea.relatedNodeIds) {
      ideaNode.relatedNodeIds = idea.relatedNodeIds;
    }

    return ideaNode;
  });
}

function inferKindFromContent(content: string): IdeaKind {
  const lower = content.toLowerCase();
  if (/^(who|what|when|where|why|how|should|could|is|are|does)\b/.test(content)) return 'question';
  if (/(must|should not|cannot|avoid|never|^no\s|don't)/.test(lower)) return 'constraint';
  if (/(act\s*\d|scene|beat|should|needs to|has to|make sure)/.test(lower)) return 'direction';
  return 'proposal';
}

/**
 * Convert a ContextAddition to a StoryContextChange.
 * Maps section-based additions to structured operations.
 */
function convertContextAddition(addition: ContextAddition): StoryContextChange {
  const { section, content } = addition;
  let operation: StoryContextChangeOperation;

  // Map section to appropriate operation type
  switch (section) {
    case 'themes':
      operation = { type: 'addThematicPillar', pillar: content };
      break;
    case 'constraints':
      operation = {
        type: 'addHardRule',
        rule: {
          id: `hr_${Date.now()}_${randomString(4)}`,
          text: content
        }
      };
      break;
    case 'tone':
      // For tone, we set the constitution field
      operation = { type: 'setConstitutionField', field: 'toneEssence', value: content };
      break;
    case 'conflicts':
    case 'motifs':
    default:
      // Default to adding as a soft guideline
      operation = {
        type: 'addGuideline',
        guideline: {
          id: `sg_${Date.now()}_${randomString(4)}`,
          tags: ['general'],
          text: content
        }
      };
      break;
  }

  return { operation };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a package before conversion.
 *
 * Checks that:
 * - Modify/delete operations reference existing nodes
 * - Edge delete operations reference existing nodes
 *
 * Supports both legacy and enhanced package structures.
 *
 * @param pkg - Package to validate
 * @param existingNodeIds - Set of existing node IDs
 * @returns Validation result
 */
export function validatePackageForConversion(
  pkg: NarrativePackage,
  existingNodeIds: Set<string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Collect all nodes and edges from either structure
  const allNodes: NodeChange[] = [];
  const allEdges: EdgeChange[] = [];

  if (pkg.primary) {
    // Enhanced structure
    allNodes.push(...pkg.primary.nodes);
    allEdges.push(...pkg.primary.edges);
    if (pkg.supporting) {
      allNodes.push(...pkg.supporting.nodes);
      allEdges.push(...pkg.supporting.edges);
    }
  } else {
    // Legacy structure
    allNodes.push(...pkg.changes.nodes);
    allEdges.push(...pkg.changes.edges);
  }

  // Check for modify/delete operations on non-existent nodes
  for (const change of allNodes) {
    if (change.operation !== 'add' && !existingNodeIds.has(change.node_id)) {
      errors.push(
        `Cannot ${change.operation} non-existent node: ${change.node_id}`
      );
    }
  }

  // Check edge delete operations
  for (const edge of allEdges) {
    if (edge.operation === 'delete') {
      if (!existingNodeIds.has(edge.from) || !existingNodeIds.has(edge.to)) {
        errors.push(
          `Cannot delete edge between non-existent nodes: ${edge.from} -> ${edge.to}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Generate a random alphanumeric string.
 */
function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
