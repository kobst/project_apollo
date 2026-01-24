/**
 * StoryBeat-specific prompt builder.
 *
 * Generates ONLY StoryBeat nodes to fill structural gaps (beats without alignment).
 * Strict constraints ensure no other node types are generated.
 */

import type { MissingBeatInfo } from '../../coverage/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for the StoryBeat generation prompt.
 */
export interface StoryBeatPromptParams {
  /** Serialized story context (metadata, themes, constraints) */
  storyContext: string;
  /** Existing StoryBeats with their alignments */
  existingStoryBeats: string;
  /** Key characters for reference */
  characters: string;
  /** Beats that have no aligned StoryBeats (opportunities) */
  missingBeats: MissingBeatInfo[];
  /** Beat IDs or types that should be prioritized */
  priorityBeats: string[];
  /** Number of packages to generate */
  packageCount: number;
  /** Maximum StoryBeats per package */
  maxStoryBeatsPerPackage: number;
  /** Optional user guidance */
  direction?: string;
  /** Creativity level (0-1) */
  creativity: number;
}

// =============================================================================
// Prompt Builder
// =============================================================================

/**
 * Build the StoryBeat generation prompt for the LLM.
 *
 * This prompt is designed to:
 * 1. Generate ONLY StoryBeat nodes (no Scene, Character, Location, Object)
 * 2. Each StoryBeat MUST have an ALIGNS_WITH edge to a Beat
 * 3. StoryBeats MAY have PRECEDES edges for causal ordering
 * 4. Priority beats are emphasized for inclusion
 *
 * @param params - StoryBeat generation parameters
 * @returns Complete prompt string
 */
export function buildStoryBeatPrompt(params: StoryBeatPromptParams): string {
  const {
    storyContext,
    existingStoryBeats,
    characters,
    missingBeats,
    priorityBeats,
    packageCount,
    maxStoryBeatsPerPackage,
    direction,
    creativity,
  } = params;

  const creativityLabel = creativity < 0.3 ? 'conservative' : creativity > 0.7 ? 'creative' : 'balanced';
  const missingBeatsText = formatMissingBeats(missingBeats);
  const priorityBeatsText = formatPriorityBeats(priorityBeats, missingBeats);

  return `You are a story structure specialist generating StoryBeat nodes to fill structural gaps.

## CRITICAL CONSTRAINTS - MUST FOLLOW

**STRICT OUTPUT RULES:**
1. Output ONLY StoryBeat nodes. NO Scene, Character, Location, or Object nodes.
2. Each StoryBeat MUST have exactly one ALIGNS_WITH edge to a Beat node.
3. StoryBeats MAY have PRECEDES edges to other StoryBeats for causal ordering.
4. NO other edge types are allowed (no HAS_CHARACTER, LOCATED_AT, FEATURES_OBJECT, etc.)
5. You MUST generate exactly ${packageCount} packages. Not fewer, not more.

**VALID EDGE TYPES (only these are allowed):**
- ALIGNS_WITH: StoryBeat \u2192 Beat (REQUIRED for each StoryBeat)
- PRECEDES: StoryBeat \u2192 StoryBeat (optional, for causal ordering)

## Story Context

${storyContext}

## Missing Beats (Opportunities)

These are structural beats that currently have no StoryBeat aligned to them.
They are sorted by position in the story structure.

${missingBeatsText}

${priorityBeatsText}

## Existing Story Beats

${existingStoryBeats || '[No existing StoryBeats]'}

## Key Characters (for reference only - do NOT create Character nodes)

${characters || '[No characters defined yet]'}

${direction ? `## User Direction\n\n"${direction}"\n` : ''}

## Generation Settings

- **Creativity Level**: ${creativityLabel} (${creativity})
- **Packages to Generate**: ${packageCount}
- **Max StoryBeats per Package**: ${maxStoryBeatsPerPackage}

## StoryBeat Node Schema

Each StoryBeat node must have these fields:
- **title**: Short descriptive title (e.g., "Marcus discovers the truth")
- **summary**: 1-2 sentence description of what happens in this story beat
- **intent**: One of "plot" | "character" | "tone" - what this beat primarily advances
- **priority**: "low" | "medium" | "high" - importance to the story
- **stakes_change**: "raise" | "lower" | "maintain" - how stakes change

## Output Format

**CRITICAL: You MUST output valid, parseable JSON. Follow these rules strictly:**

1. **NO newlines inside strings** - Use spaces or \\n escape sequences instead
2. **Escape special characters** - Use \\" for quotes, \\\\ for backslashes
3. **NO trailing commas** - Last item in arrays/objects must NOT have a comma after it
4. **Keep strings concise** - Summaries should be 1-2 sentences max
5. **Test mentally** - Before outputting, verify the JSON would parse correctly

Schema:

\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "rationale": "Why this package makes sense for the story",
      "confidence": 0.85,
      "style_tags": ["dramatic", "revelation"],
      "changes": {
        "nodes": [
          {
            "operation": "add",
            "node_type": "StoryBeat",
            "node_id": "storybeat_12345_xyz",
            "data": {
              "title": "Marcus discovers the truth",
              "summary": "Marcus finds evidence that reveals the conspiracy.",
              "intent": "plot",
              "priority": "high",
              "stakes_change": "raise"
            }
          }
        ],
        "edges": [
          {
            "operation": "add",
            "edge_type": "ALIGNS_WITH",
            "from": "storybeat_12345_xyz",
            "to": "beat_Midpoint"
          },
          {
            "operation": "add",
            "edge_type": "PRECEDES",
            "from": "storybeat_12345_xyz",
            "to": "storybeat_existing_123"
          }
        ]
      },
      "impact": {
        "fulfills_gaps": ["derived_missing_beat_Midpoint"],
        "creates_gaps": [],
        "conflicts": []
      }
    }
  ]
}
\`\`\`

## Guidelines

1. **Priority Beats**: At least one package SHOULD address each priority beat if possible
2. **Variety**: Each package should take a meaningfully different approach
3. **Coherence**: StoryBeats should fit the story's themes and existing content
4. **Causal Flow**: Use PRECEDES edges when one story beat naturally leads to another
5. **No Supporting Nodes**: Do NOT create Character, Location, or Scene nodes - only reference existing ones in descriptions
6. **IDs**: Use format \`storybeat_{timestamp}_{5chars}\` for new StoryBeat IDs

**REMINDER: Only StoryBeat nodes and ALIGNS_WITH/PRECEDES edges are allowed.**

Output ONLY the JSON object, no markdown code blocks, no explanation.`;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format missing beats for the prompt.
 */
function formatMissingBeats(missingBeats: MissingBeatInfo[]): string {
  if (missingBeats.length === 0) {
    return '[All structural beats have StoryBeat alignment - no gaps to fill]';
  }

  const lines: string[] = [];
  for (const beat of missingBeats) {
    const actLabel = `Act ${beat.act}`;
    const beatTypeFormatted = formatBeatType(beat.beatType);
    lines.push(`- **${beat.beatId}** (${beatTypeFormatted}, ${actLabel}, position ${beat.position})`);
  }

  return lines.join('\n');
}

/**
 * Format priority beats section.
 */
function formatPriorityBeats(priorityBeats: string[], missingBeats: MissingBeatInfo[]): string {
  if (priorityBeats.length === 0) {
    return '';
  }

  // Match priority beats against missing beats
  const matchedPriorities: string[] = [];
  for (const priority of priorityBeats) {
    const matched = missingBeats.find(
      (mb) => mb.beatId === priority || mb.beatType === priority
    );
    if (matched) {
      matchedPriorities.push(`- ${matched.beatId} (${formatBeatType(matched.beatType)})`);
    } else {
      // Priority beat not in missing list - might already be covered
      matchedPriorities.push(`- ${priority} (may already be covered)`);
    }
  }

  return `## Priority Beats (MUST address at least one per package if possible)

The user has indicated these beats are high priority:

${matchedPriorities.join('\n')}

At least one StoryBeat in each package should target a priority beat when feasible.
`;
}

/**
 * Format a beat type for display.
 * E.g., 'BreakIntoTwo' -> 'Break Into Two'
 */
function formatBeatType(beatType: string): string {
  return beatType.replace(/([A-Z])/g, ' $1').trim();
}
