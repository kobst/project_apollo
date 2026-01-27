/**
 * System Prompt Builder
 *
 * Builds system prompts that contain stable story context (constitution) for
 * Anthropic prompt caching efficiency.
 *
 * The system prompt establishes:
 * - AI role definition
 * - Story identity (name, logline)
 * - Story constitution (themes, hard rules, tone, banned elements)
 * - General guidelines for consistency
 *
 * Dynamic content (soft guidelines) is NOT included here - it goes in user prompts.
 */

import type { StoryContextConstitution } from './storyContextTypes.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for building the system prompt.
 */
export interface SystemPromptParams {
  /** Story name */
  storyName?: string | undefined;
  /** Story constitution (stable creative direction) */
  constitution?: StoryContextConstitution | undefined;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Check if there is meaningful content to include in a system prompt.
 *
 * Returns true if any of the story identity or constitution fields
 * have content. This allows callers to skip system prompt entirely if
 * there's nothing to include (graceful fallback).
 *
 * @param params - System prompt parameters
 * @returns True if system prompt would have meaningful content
 */
export function hasSystemPromptContent(params: SystemPromptParams): boolean {
  const { storyName, constitution } = params;

  // Check story identity
  const hasStoryName = Boolean(storyName && storyName.trim());

  // Check constitution - any non-empty field
  const hasConstitution = Boolean(
    constitution && (
      constitution.logline.trim() ||
      constitution.premise.trim() ||
      constitution.genre.trim() ||
      constitution.setting.trim() ||
      constitution.thematicPillars.length > 0 ||
      constitution.hardRules.length > 0 ||
      constitution.toneEssence.trim() ||
      constitution.banned.length > 0
    )
  );

  return hasStoryName || hasConstitution;
}

/**
 * Serialize constitution to structured markdown for the system prompt.
 *
 * @param constitution - Story constitution
 * @returns Markdown representation
 */
function serializeConstitution(constitution: StoryContextConstitution): string {
  const sections: string[] = [];

  // Logline
  if (constitution.logline.trim()) {
    sections.push(`**Logline**: ${constitution.logline.trim()}`);
  }

  // Premise
  if (constitution.premise.trim()) {
    sections.push('');
    sections.push(`**Premise**: ${constitution.premise.trim()}`);
  }

  // Genre
  if (constitution.genre.trim()) {
    sections.push('');
    sections.push(`**Genre**: ${constitution.genre.trim()}`);
  }

  // Setting
  if (constitution.setting.trim()) {
    sections.push('');
    sections.push(`**Setting**: ${constitution.setting.trim()}`);
  }

  // Thematic Pillars
  if (constitution.thematicPillars.length > 0) {
    sections.push('');
    sections.push('### Thematic Pillars');
    for (const pillar of constitution.thematicPillars) {
      sections.push(`- ${pillar}`);
    }
  }

  // Hard Rules
  if (constitution.hardRules.length > 0) {
    sections.push('');
    sections.push('### Hard Rules (DO NOT VIOLATE)');
    for (const rule of constitution.hardRules) {
      sections.push(`- [${rule.id}] ${rule.text}`);
    }
  }

  // Tone & Voice
  if (constitution.toneEssence.trim()) {
    sections.push('');
    sections.push('### Tone & Voice');
    sections.push(constitution.toneEssence.trim());
  }

  // Banned Elements
  if (constitution.banned.length > 0) {
    sections.push('');
    sections.push('### Banned Elements (NEVER include)');
    for (const item of constitution.banned) {
      sections.push(`- ${item}`);
    }
  }

  return sections.join('\n');
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
 * "what to do now" (current state, specific task, filtered guidelines).
 *
 * @param params - System prompt parameters
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(params: SystemPromptParams): string {
  const { storyName, constitution } = params;

  const sections: string[] = [];

  // Role definition
  sections.push(`You are an AI story development assistant helping to craft a compelling narrative. Your role is to generate creative, coherent story content that respects the established creative direction and maintains consistency with the story's identity.`);
  sections.push('');

  // Story identity section
  if (storyName) {
    sections.push('## Story Identity');
    sections.push('');
    sections.push(`**Title**: ${storyName}`);
    sections.push('');
  }

  // Story Constitution
  if (constitution) {
    const constitutionContent = serializeConstitution(constitution);
    if (constitutionContent.trim()) {
      sections.push('## Story Constitution');
      sections.push('');
      sections.push('The following creative constitution has been established for this story. All generated content MUST align with these elements. Hard rules are absolute constraints.');
      sections.push('');
      sections.push(constitutionContent);
      sections.push('');
    }
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
  sections.push('- NEVER violate hard rules or include banned elements');

  return sections.join('\n');
}
