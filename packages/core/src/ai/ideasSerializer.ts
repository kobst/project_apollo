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
import type { Idea, IdeaCategory, IdeaKind, IdeaResolutionStatus } from '../types/nodes.js';

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

  // --- Enhanced planning filters (optional) ---
  /** Filter by planning kind(s) */
  kind?: IdeaKind | IdeaKind[];
  /** Filter by planning resolution status */
  resolutionStatus?: IdeaResolutionStatus | IdeaResolutionStatus[];
  /** Only include ideas targeting this beat */
  targetBeat?: string;
  /** Only include ideas targeting this act */
  targetAct?: number;
  /** Filter by overlapping themes */
  themes?: string[];
  /** Always include constraints at the top */
  includeConstraints?: boolean;
  /** Filter out stale items (0..1 freshness) */
  minFreshnessScore?: number;
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
    kind,
    resolutionStatus,
    targetBeat,
    targetAct,
    themes,
    includeConstraints,
    minFreshnessScore,
  } = options;

  // Get all ideas from graph
  let ideas = getNodesByType<Idea>(graph, 'Idea');

  // 1) Filter by active and not archived (planning resolution)
  if (activeOnly) {
    ideas = ideas.filter((idea) =>
      (idea.status === 'active' || idea.status === undefined) &&
      (idea.resolutionStatus || 'open') !== 'archived'
    );
  }

  // 2) Filter by kind(s)
  if (kind) {
    const kinds = Array.isArray(kind) ? kind : [kind];
    ideas = ideas.filter((i) => kinds.includes(i.kind || 'proposal'));
  }

  // 3) Filter by planning resolution status
  if (resolutionStatus) {
    const statuses = Array.isArray(resolutionStatus) ? resolutionStatus : [resolutionStatus];
    ideas = ideas.filter((i) => statuses.includes(i.resolutionStatus || 'open'));
  }

  // 4) Auto-fulfilled proposals (basic heuristic)
  ideas = ideas.filter((i) => !isIdeaFulfilled(i, graph));

  // 5) Category
  if (category) {
    const categories = Array.isArray(category) ? category : [category];
    ideas = ideas.filter((idea) => {
      if (!idea.category) return true; // uncategorized matches any
      return categories.includes(idea.category);
    });
  }

  // 6) Targeting filters
  if (targetBeat) {
    ideas = ideas.filter((i) => !i.targetBeat || i.targetBeat === targetBeat);
  }
  if (targetAct) {
    ideas = ideas.filter((i) => !i.targetAct || i.targetAct === targetAct);
  }

  // 7) Theme overlap (if provided)
  if (themes && themes.length > 0) {
    ideas = ideas.filter((i) => !i.themes || i.themes.some((t) => themes.includes(t)));
  }

  // 8) Related nodes
  if (relatedNodeIds && relatedNodeIds.length > 0) {
    const relatedSet = new Set(relatedNodeIds);
    ideas = ideas.filter((idea) => {
      if (!idea.relatedNodeIds || idea.relatedNodeIds.length === 0) return true;
      return idea.relatedNodeIds.some((id) => relatedSet.has(id));
    });
  }

  // 9) Separate constraints for guaranteed inclusion
  let constraints: Idea[] = [];
  if (includeConstraints) {
    constraints = ideas.filter((i) => (i.kind || 'proposal') === 'constraint');
    ideas = ideas.filter((i) => (i.kind || 'proposal') !== 'constraint');
  }

  // 10) Freshness score and filtering
  const ideasWithFreshness = ideas.map((i) => ({ i, s: computeFreshnessScore(i) }));
  let filtered = ideasWithFreshness;
  if (minFreshnessScore !== undefined) {
    filtered = ideasWithFreshness.filter(({ s }) => s >= minFreshnessScore);
  }

  // 11) Sort by freshness desc
  filtered.sort((a, b) => b.s - a.s);

  // 12) Limit and reassemble
  const limited = filtered.slice(0, maxIdeas).map(({ i }) => i);
  return [...constraints, ...limited];
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
    return { serialized: '', includedCount: 0, includedIds: [] };
  }

  // Group by kind (default to proposal)
  const byKind = ideas.reduce((acc, i) => {
    const k = (i.kind || 'proposal') as IdeaKind;
    if (!acc[k]) acc[k] = [] as Idea[];
    acc[k].push(i);
    return acc;
  }, {} as Record<IdeaKind, Idea[]>);

  const lines: string[] = [];
  lines.push('## Planning Context');
  lines.push('');

  // Constraints first
  if (byKind.constraint?.length) {
    lines.push('### Constraints (must follow)');
    for (const i of byKind.constraint) {
      lines.push(`- ${i.title}`);
      if (i.description) lines.push(`  ${truncateDescription(i.description, 100)}`);
    }
    lines.push('');
  }

  // Resolved questions
  const resolvedQs = (byKind.question || []).filter((q) => (q.resolutionStatus || 'open') === 'resolved');
  if (resolvedQs.length) {
    lines.push('### Established Context');
    for (const i of resolvedQs) {
      lines.push(`- **${i.title}**`);
      if (i.resolution) lines.push(`  Resolution: ${truncateDescription(i.resolution, 150)}`);
    }
    lines.push('');
  }

  // Open questions
  const openQs = (byKind.question || []).filter((q) => (q.resolutionStatus || 'open') === 'open');
  if (openQs.length) {
    lines.push('### Open Questions');
    for (const i of openQs) {
      lines.push(`- ${i.title}`);
      if (i.description) lines.push(`  ${truncateDescription(i.description, 100)}`);
    }
    lines.push('');
  }

  // Directions
  if (byKind.direction?.length) {
    lines.push('### Story Direction');
    for (const i of byKind.direction) {
      lines.push(`- ${i.title}`);
      if (i.description) lines.push(`  ${truncateDescription(i.description, 150)}`);
    }
    lines.push('');
  }

  // Notes
  if (byKind.note?.length) {
    lines.push('### Creative Notes');
    for (const i of byKind.note) {
      lines.push(`- ${i.title}: ${truncateDescription(i.description, 100)}`);
    }
    lines.push('');
  }

  // Proposals
  if (byKind.proposal?.length) {
    lines.push('### Story Ideas');
    for (const idea of byKind.proposal) {
      const categoryTag = idea.category ? ` [${idea.category}]` : '';
      const sourceTag = idea.source === 'ai' ? ' (AI suggested)' : '';
      lines.push(`- **${idea.title}**${categoryTag}${sourceTag}`);
      lines.push(`  ${truncateDescription(idea.description, 150)}`);
      if (idea.relatedNodeIds && idea.relatedNodeIds.length > 0) {
        lines.push(
          `  Related: ${idea.relatedNodeIds.slice(0, 3).join(', ')}${idea.relatedNodeIds.length > 3 ? '...' : ''}`
        );
      }
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
// Overloads: support legacy (entryPointNodeId?: string) and enhanced context
export function getIdeasForTask(
  graph: GraphState,
  taskType: IdeaTaskType,
  entryPointNodeId?: string,
  maxIdeas?: number
): IdeasSerializationResult;
export function getIdeasForTask(
  graph: GraphState,
  taskType: IdeaTaskType,
  context?: { entryPointNodeId?: string; targetBeat?: string; targetAct?: number; themes?: string[] },
  maxIdeas?: number
): IdeasSerializationResult;
export function getIdeasForTask(
  graph: GraphState,
  taskType: IdeaTaskType,
  third?: string | { entryPointNodeId?: string; targetBeat?: string; targetAct?: number; themes?: string[] },
  maxIdeas: number = 5
): IdeasSerializationResult {
  const categories = getCategoryForTaskType(taskType);

  const context = typeof third === 'string' || third === undefined
    ? { entryPointNodeId: third }
    : (third || {});

  // Kinds always include proposals; add questions/directions/notes for generative tasks
  const relevantKinds: IdeaKind[] = ['proposal'];
  if (['storyBeat', 'scene', 'generate', 'expand'].includes(taskType)) {
    relevantKinds.push('question', 'direction', 'note');
  }

  const filterOptions: IdeasFilterOptions = {
    category: categories,
    activeOnly: true,
    maxIdeas,
    includeConstraints: true,
    minFreshnessScore: 0.2,
    kind: relevantKinds,
  };

  if ('entryPointNodeId' in context && context.entryPointNodeId) filterOptions.relatedNodeIds = [context.entryPointNodeId];
  if ('targetBeat' in context && context.targetBeat) filterOptions.targetBeat = context.targetBeat;
  if ('targetAct' in context && context.targetAct) filterOptions.targetAct = context.targetAct;
  if ('themes' in context && context.themes) filterOptions.themes = context.themes;

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

// === Helper Functions for enhanced filtering ===
function isIdeaFulfilled(idea: Idea, graph: GraphState): boolean {
  if (!idea.suggestedType || !idea.title) return false;
  const title = idea.title.toLowerCase();

  switch (idea.suggestedType) {
    case 'Character': {
      const chars = getNodesByType<any>(graph, 'Character');
      return chars.some((c) =>
        (c.name || '').toLowerCase().includes(title) || title.includes((c.name || '').toLowerCase())
      );
    }
    case 'Location': {
      const locs = getNodesByType<any>(graph, 'Location');
      return locs.some((l) => (l.name || '').toLowerCase().includes(title));
    }
    case 'StoryBeat': {
      const beats = getNodesByType<any>(graph, 'StoryBeat');
      return beats.some((b) =>
        (b.title || '').toLowerCase().includes(title) || title.includes((b.title || '').toLowerCase())
      );
    }
    default:
      return false;
  }
}

function computeFreshnessScore(idea: Idea): number {
  const now = Date.now();
  const created = new Date(idea.createdAt).getTime();
  const ageDays = (now - created) / (1000 * 60 * 60 * 24);

  // Base: newer is fresher (0 after 90 days)
  let score = Math.max(0, 1 - ageDays / 90);

  if (idea.lastReviewedAt) {
    const reviewAge = (now - new Date(idea.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (reviewAge < 7) score += 0.3;
    else if (reviewAge < 30) score += 0.1;
  }

  if (idea.lastUsedInPrompt) {
    const usageAge = (now - new Date(idea.lastUsedInPrompt).getTime()) / (1000 * 60 * 60 * 24);
    if (usageAge < 7) score += 0.2;
  }

  if (!idea.usageCount && ageDays > 30) score *= 0.5;
  if ((idea.kind || 'proposal') === 'constraint') score += 0.5;
  if ((idea.kind || 'proposal') === 'question' && (idea.resolutionStatus || 'open') === 'resolved') score += 0.3;
  if (idea.source === 'ai') score += 0.1;

  return Math.min(1, score);
}
