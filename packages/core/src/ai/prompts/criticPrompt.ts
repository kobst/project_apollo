/**
 * Critic Prompt Builder
 *
 * Builds a prompt for LLM-based narrative enrichment of deterministic impact results.
 * The LLM is grounded by deterministic results — it can explain, not invent.
 */

import { PROMPT_VERSION, JSON_OUTPUT_RULES } from './shared.js';

// =============================================================================
// Types
// =============================================================================

export interface CriticPromptParams {
  /** Serialized story context (constitution, themes, etc.) */
  storyContext: string;
  /** Serialized package content (nodes, edges, rationale) */
  packageSummary: string;
  /** Human-readable fulfills_gaps descriptions from deterministic analysis */
  fulfillsDescriptions: string[];
  /** Human-readable creates_gaps descriptions from deterministic analysis */
  createsDescriptions: string[];
}

// =============================================================================
// Prompt Builder
// =============================================================================

export function buildCriticPrompt(params: CriticPromptParams): string {
  const {
    storyContext,
    packageSummary,
    fulfillsDescriptions,
    createsDescriptions,
  } = params;

  const fulfillsSection = fulfillsDescriptions.length > 0
    ? fulfillsDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')
    : '[None]';

  const createsSection = createsDescriptions.length > 0
    ? createsDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')
    : '[None]';

  return `## Impact Critic v${PROMPT_VERSION}

You are a narrative analyst. Given a story package and its deterministic impact analysis, provide narrative enrichment explaining WHY each impact matters for the story.

## Story Context
${storyContext}

## Package Being Analyzed
${packageSummary}

## Deterministic Impact — Gaps Fulfilled
${fulfillsSection}

## Deterministic Impact — Gaps Created
${createsSection}

## Your Task

For each fulfilled gap, explain its **narrative significance** — why resolving this gap matters for the story's themes, character arcs, or dramatic structure.

For each created gap, explain the **narrative implications** — what story decisions remain open and what opportunities this creates.

Finally, provide an overall **thematic analysis** (2-3 sentences) of how this package shapes the story's direction.

**Ground your analysis in the deterministic results above. Do not invent new gaps or conflicts.**

## Output Format
${JSON_OUTPUT_RULES}

\`\`\`json
{
  "fulfills": [
    {"description": "...(from above)...", "narrative": "Why this matters for the story..."}
  ],
  "creates": [
    {"description": "...(from above)...", "narrative": "What this opens up..."}
  ],
  "thematic_analysis": "Overall assessment of how this package shapes the story..."
}
\`\`\`

Output JSON only. No markdown blocks or explanation.`;
}
