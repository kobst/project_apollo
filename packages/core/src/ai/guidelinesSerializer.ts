/**
 * Guidelines Serializer
 *
 * Provides functionality to filter and serialize soft guidelines for inclusion
 * in AI prompts. Guidelines are filtered by tags based on the task type,
 * ensuring relevant guidelines inform generation without overwhelming the prompt.
 *
 * Tag mapping:
 * - character tasks: character, dialogue, general
 * - storyBeat tasks: plot, pacing, general
 * - scene tasks: scene, action, pacing, general
 * - expand tasks: worldbuilding, general
 * - generate/interpret/refine tasks: all relevant tags
 */

import type {
  GuidelineTag,
  SoftGuideline,
  StoryContextOperational,
} from './storyContextTypes.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Task types that can be used to determine relevant guideline tags.
 */
export type GuidelineTaskType =
  | 'character'
  | 'storyBeat'
  | 'scene'
  | 'expand'
  | 'generate'
  | 'interpret'
  | 'refine';

/**
 * Result from serializing guidelines.
 */
export interface GuidelinesSerializationResult {
  /** The serialized guidelines as a markdown string */
  serialized: string;
  /** Number of guidelines included */
  count: number;
}

// =============================================================================
// Tag Mapping
// =============================================================================

/**
 * Mapping of task types to relevant guideline tags.
 *
 * This ensures generation tasks receive guidelines that are contextually
 * relevant. For example, character generation benefits from character and
 * dialogue guidelines, but not scene-specific guidelines.
 */
const TAG_MAPPING: Record<GuidelineTaskType, GuidelineTag[]> = {
  character: ['character', 'dialogue', 'general'],
  storyBeat: ['plot', 'pacing', 'general'],
  scene: ['scene', 'action', 'pacing', 'general'],
  expand: ['worldbuilding', 'general'],
  generate: ['character', 'plot', 'scene', 'worldbuilding', 'general'],
  interpret: ['general'],
  refine: ['general'],
};

/**
 * Get relevant guideline tags for a given task type.
 *
 * @param taskType - The type of generation task
 * @returns Array of relevant GuidelineTag values
 */
export function getTagsForTaskType(taskType: GuidelineTaskType): GuidelineTag[] {
  return TAG_MAPPING[taskType] ?? ['general'];
}

// =============================================================================
// Filtering
// =============================================================================

/**
 * Filter guidelines to only those matching the specified tags.
 *
 * Guidelines are included if they have at least one tag in common with
 * the filter tags.
 *
 * @param guidelines - Array of SoftGuideline to filter
 * @param tags - Tags to filter by
 * @returns Filtered array of guidelines
 */
export function filterGuidelines(
  guidelines: SoftGuideline[],
  tags: GuidelineTag[]
): SoftGuideline[] {
  if (tags.length === 0) return [];
  if (guidelines.length === 0) return [];

  const tagSet = new Set(tags);

  return guidelines.filter((guideline) =>
    guideline.tags.some((tag) => tagSet.has(tag))
  );
}

// =============================================================================
// Serialization
// =============================================================================

/**
 * Serialize an array of guidelines into a markdown string for prompt inclusion.
 *
 * The output format is designed to be:
 * - Readable by the LLM
 * - Compact to minimize token usage
 * - Clear about the purpose (soft guidelines, apply when relevant)
 *
 * @param guidelines - Array of SoftGuideline to serialize
 * @returns Markdown string, or empty string if no guidelines
 */
export function serializeGuidelines(guidelines: SoftGuideline[]): string {
  if (guidelines.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## Soft Guidelines (Apply When Relevant)');
  lines.push('');
  lines.push('These guidelines should be followed when contextually appropriate:');
  lines.push('');

  for (const guideline of guidelines) {
    const tagLabel = guideline.tags.length > 0
      ? ` [${guideline.tags.join(', ')}]`
      : '';
    lines.push(`- ${guideline.text}${tagLabel}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Convenience Function
// =============================================================================

/**
 * Get filtered and serialized guidelines for a specific task.
 *
 * This combines getTagsForTaskType, filterGuidelines, and serializeGuidelines
 * into a single call for common use cases in orchestrators.
 *
 * @param operational - The operational section of StoryContext (or undefined)
 * @param taskType - The type of generation task
 * @returns Serialization result ready for prompt inclusion
 */
export function getGuidelinesForTask(
  operational: StoryContextOperational | undefined,
  taskType: GuidelineTaskType
): GuidelinesSerializationResult {
  if (!operational || operational.softGuidelines.length === 0) {
    return {
      serialized: '',
      count: 0,
    };
  }

  const tags = getTagsForTaskType(taskType);
  const filteredGuidelines = filterGuidelines(operational.softGuidelines, tags);
  const serialized = serializeGuidelines(filteredGuidelines);

  return {
    serialized,
    count: filteredGuidelines.length,
  };
}
