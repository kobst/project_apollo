/**
 * Ideas Serializer
 *
 * Provides functionality to filter and serialize Idea nodes for inclusion
 * in AI prompts. Ideas are filtered by category based on the task type,
 * ensuring that relevant ideas inform generation without overwhelming the prompt.
 *
 * Category mapping:
 * - character tasks: character, general
 * - storyBeat tasks: plot, general
 * - scene tasks: scene, plot, general
 * - expand/generate tasks: all categories
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType } from '../core/graph.js';
import type { Idea, IdeaCategory } from '../types/nodes.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Task types that can be used to determine relevant idea categories.
 */
export type IdeaTaskType =
  | 'character'
  | 'storyBeat'
  | 'scene'
  | 'expand'
  | 'generate'
  | 'interpret'
  | 'refine';

/**
 * Options for filtering ideas.
 */
export interface IdeasFilterOptions {
  /** Filter by specific category or categories */
  category?: IdeaCategory | IdeaCategory[];
  /** Filter by related node IDs (ideas that reference these nodes) */
  relatedNodeIds?: string[];
  /** Only include active ideas (default: true) */
  activeOnly?: boolean;
  /** Maximum number of ideas to return (default: 5) */
  maxIdeas?: number;
}

/**
 * Result from serializing ideas.
 */
export interface IdeasSerializationResult {
  /** The serialized ideas as a markdown string */
  serialized: string;
  /** Number of ideas included */
  includedCount: number;
  /** IDs of included ideas */
  includedIds: string[];
}

// =============================================================================
// Category Mapping
// =============================================================================

/**
 * Get relevant idea categories for a given task type.
 *
 * This mapping ensures that generation tasks receive ideas that are
 * contextually relevant. For example, character generation benefits
 * from character and general ideas, but not scene-specific ideas.
 *
 * @param taskType - The type of generation task
 * @returns Array of relevant IdeaCategory values
 */
export function getCategoryForTaskType(taskType: IdeaTaskType): IdeaCategory[] {
  switch (taskType) {
    case 'character':
      return ['character', 'general'];

    case 'storyBeat':
      return ['plot', 'general'];

    case 'scene':
      return ['scene', 'plot', 'general'];

    case 'expand':
    case 'generate':
    case 'interpret':
    case 'refine':
      // These broad tasks benefit from all categories
      return ['character', 'plot', 'scene', 'worldbuilding', 'general'];

    default:
      return ['general'];
  }
}

// =============================================================================
// Filtering
// =============================================================================

/**
 * Filter ideas from the graph based on the provided options.
 *
 * Ideas are filtered by:
 * 1. Status (activeOnly filters to 'active' status)
 * 2. Category (if specified)
 * 3. Related nodes (if specified)
 *
 * Results are sorted by creation date (newest first) and limited
 * to maxIdeas.
 *
 * @param graph - The story graph
 * @param options - Filtering options
 * @returns Array of filtered Idea nodes
 */
export function filterIdeas(
  graph: GraphState,
  options: IdeasFilterOptions = {}
): Idea[] {
  const {
    category,
    relatedNodeIds,
    activeOnly = true,
    maxIdeas = 5,
  } = options;

  // Get all ideas from graph
  let ideas = getNodesByType<Idea>(graph, 'Idea');

  // Filter by status
  if (activeOnly) {
    ideas = ideas.filter((idea) => idea.status === 'active' || idea.status === undefined);
  }

  // Filter by category
  if (category) {
    const categories = Array.isArray(category) ? category : [category];
    ideas = ideas.filter((idea) => {
      // Include ideas without a category (they match any category filter)
      if (!idea.category) return true;
      return categories.includes(idea.category);
    });
  }

  // Filter by related nodes
  if (relatedNodeIds && relatedNodeIds.length > 0) {
    const relatedSet = new Set(relatedNodeIds);
    ideas = ideas.filter((idea) => {
      if (!idea.relatedNodeIds || idea.relatedNodeIds.length === 0) {
        // Ideas without related nodes are included (they're general)
        return true;
      }
      // Include if any of the idea's related nodes match
      return idea.relatedNodeIds.some((id) => relatedSet.has(id));
    });
  }

  // Sort by creation date (newest first)
  ideas.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  // Limit results
  return ideas.slice(0, maxIdeas);
}

// =============================================================================
// Serialization
// =============================================================================

/**
 * Serialize an array of ideas into a markdown string for prompt inclusion.
 *
 * The output format is designed to be:
 * - Readable by the LLM
 * - Compact to minimize token usage
 * - Informative enough to guide generation
 *
 * @param ideas - Array of Idea nodes to serialize
 * @returns Serialization result with markdown and metadata
 */
export function serializeIdeas(ideas: Idea[]): IdeasSerializationResult {
  if (ideas.length === 0) {
    return {
      serialized: '',
      includedCount: 0,
      includedIds: [],
    };
  }

  const lines: string[] = [];
  lines.push('## Relevant Ideas');
  lines.push('');
  lines.push('Consider incorporating or building upon these ideas when relevant:');
  lines.push('');

  for (const idea of ideas) {
    const categoryTag = idea.category ? ` [${idea.category}]` : '';
    const sourceTag = idea.source === 'ai' ? ' (AI suggested)' : '';

    lines.push(`- **${idea.title}**${categoryTag}${sourceTag}`);
    lines.push(`  ${truncateDescription(idea.description, 150)}`);

    if (idea.relatedNodeIds && idea.relatedNodeIds.length > 0) {
      lines.push(`  Related: ${idea.relatedNodeIds.slice(0, 3).join(', ')}${idea.relatedNodeIds.length > 3 ? '...' : ''}`);
    }
  }

  return {
    serialized: lines.join('\n'),
    includedCount: ideas.length,
    includedIds: ideas.map((i) => i.id),
  };
}

/**
 * Convenience function to get filtered and serialized ideas for a specific task.
 *
 * This combines getCategoryForTaskType, filterIdeas, and serializeIdeas into
 * a single call for common use cases in orchestrators.
 *
 * @param graph - The story graph
 * @param taskType - The type of generation task
 * @param entryPointNodeId - Optional node ID to prioritize related ideas
 * @param maxIdeas - Maximum ideas to include (default: 5)
 * @returns Serialization result ready for prompt inclusion
 */
export function getIdeasForTask(
  graph: GraphState,
  taskType: IdeaTaskType,
  entryPointNodeId?: string,
  maxIdeas: number = 5
): IdeasSerializationResult {
  const categories = getCategoryForTaskType(taskType);

  const filterOptions: IdeasFilterOptions = {
    category: categories,
    activeOnly: true,
    maxIdeas,
  };

  // If we have an entry point node, prioritize ideas related to it
  if (entryPointNodeId) {
    filterOptions.relatedNodeIds = [entryPointNodeId];
  }

  const filteredIdeas = filterIdeas(graph, filterOptions);
  return serializeIdeas(filteredIdeas);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Truncate a description to a maximum length.
 */
function truncateDescription(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // Try to truncate at a word boundary
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}
