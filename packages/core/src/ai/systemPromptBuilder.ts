/**
 * System Prompt Builder
 *
 * Builds system prompts that contain stable story context (themes, constraints,
 * creative direction) for Anthropic prompt caching efficiency.
 *
 * The system prompt establishes:
 * - AI role definition
 * - Story identity (name, logline)
 * - Creative direction (full storyContext markdown)
 * - General guidelines for consistency
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for building the system prompt.
 */
export interface SystemPromptParams {
  /** Story name */
  storyName?: string | undefined;
  /** One-sentence story summary */
  logline?: string | undefined;
  /** Story Context markdown (themes, conflicts, constraints, creative direction) */
  storyContext?: string | undefined;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Check if there is meaningful content to include in a system prompt.
 *
 * Returns true if any of the story identity or creative direction fields
 * have content. This allows callers to skip system prompt entirely if
 * there's nothing to include (graceful fallback).
 *
 * @param params - System prompt parameters
 * @returns True if system prompt would have meaningful content
 */
export function hasSystemPromptContent(params: SystemPromptParams): boolean {
  const { storyName, logline, storyContext } = params;

  // Check if we have any meaningful content
  const hasStoryName = Boolean(storyName && storyName.trim());
  const hasLogline = Boolean(logline && logline.trim());
  const hasStoryContext = Boolean(storyContext && storyContext.trim());

  return hasStoryName || hasLogline || hasStoryContext;
}

/**
 * Build a system prompt containing stable story context.
 *
 * The system prompt is designed to be:
 * - Stable across multiple generation calls (enables prompt caching)
 * - Treated with high priority by the LLM
 * - Contain "who we are" information (identity + creative direction)
 *
 * This separates creative direction from the user prompt, which contains
 * "what to do now" (current state, specific task, filtered ideas).
 *
 * @param params - System prompt parameters
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(params: SystemPromptParams): string {
  const { storyName, logline, storyContext } = params;

  const sections: string[] = [];

  // Role definition
  sections.push(`You are an AI story development assistant helping to craft a compelling narrative. Your role is to generate creative, coherent story content that respects the established creative direction and maintains consistency with the story's identity.`);
  sections.push('');

  // Story identity section
  if (storyName || logline) {
    sections.push('## Story Identity');
    sections.push('');
    if (storyName) {
      sections.push(`**Title**: ${storyName}`);
    }
    if (logline) {
      sections.push(`**Logline**: ${logline}`);
    }
    sections.push('');
  }

  // Creative direction (Story Context)
  if (storyContext && storyContext.trim()) {
    sections.push('## Creative Direction');
    sections.push('');
    sections.push('The following creative direction has been established for this story. All generated content should align with these themes, constraints, and guidelines.');
    sections.push('');
    sections.push(storyContext.trim());
    sections.push('');
  }

  // General guidelines
  sections.push('## Guidelines');
  sections.push('');
  sections.push('When generating content:');
  sections.push('- Maintain consistency with established story elements');
  sections.push('- Respect the creative constraints and thematic direction');
  sections.push('- Generate content that serves the story\'s logline and central premise');
  sections.push('- Consider how new elements connect to and support existing content');
  sections.push('- Prioritize narrative coherence over novelty');

  return sections.join('\n');
}
