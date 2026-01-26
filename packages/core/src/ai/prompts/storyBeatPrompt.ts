/**
 * StoryBeat-specific prompt builder.
 *
 * Generates ONLY StoryBeat nodes to fill structural gaps (beats without alignment).
 * Strict constraints ensure no other node types are generated.
 */

import type { MissingBeatInfo } from '../../coverage/types.js';
import type { ExpansionScope } from '../types.js';

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
  /** Expansion scope for supporting content (default: 'flexible') */
  expansionScope?: ExpansionScope;
  /** Target specific act for generation */
  targetAct?: 1 | 2 | 3 | 4 | 5;
  /** Optional serialized ideas relevant to story beat generation */
  ideas?: string;
}

// =============================================================================
// Prompt Builder
// =============================================================================

/**
 * Build the StoryBeat generation prompt for the LLM.
 *
 * This prompt is designed to:
 * 1. Generate ONLY StoryBeat nodes (no Scene, Character, Location, Object) in primary
 * 2. Each StoryBeat MUST have an ALIGNS_WITH edge to a Beat
 * 3. StoryBeats MAY have PRECEDES edges for causal ordering
 * 4. Priority beats are emphasized for inclusion
 * 5. When flexible: may include supporting Characters/Locations in supporting section
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
    expansionScope = 'flexible',
    targetAct,
    ideas,
  } = params;

  const creativityLabel = creativity < 0.3 ? 'conservative' : creativity > 0.7 ? 'creative' : 'balanced';
  const isConstrained = expansionScope === 'constrained';

  // Filter missing beats by target act if specified
  const filteredMissingBeats = targetAct
    ? missingBeats.filter((b) => b.act === targetAct)
    : missingBeats;

  const missingBeatsText = formatMissingBeats(filteredMissingBeats);
  const priorityBeatsText = formatPriorityBeats(priorityBeats, filteredMissingBeats);

  const supportingSection = isConstrained ? '' : `
## Supporting Content (Optional)

When expansionScope is "flexible", you MAY include supporting nodes in the "supporting" section:
- **Character nodes**: New characters referenced in StoryBeats
- **Location nodes**: New locations mentioned in StoryBeats

Supporting nodes should only be created if they are essential to understanding the StoryBeats.
`;

  const outputSchema = isConstrained ? getConstrainedSchema() : getFlexibleSchema();

  return `You are a story structure specialist generating StoryBeat nodes to fill structural gaps.

## CRITICAL CONSTRAINTS - MUST FOLLOW

**STRICT OUTPUT RULES:**
1. PRIMARY section: ONLY StoryBeat nodes. NO Scene, Character, Location, or Object nodes in primary.
2. Each StoryBeat MUST have exactly one ALIGNS_WITH edge to a Beat node.
3. StoryBeats MAY have PRECEDES edges to other StoryBeats for causal ordering.
${isConstrained ? '4. NO supporting content - only StoryBeats in primary.' : '4. SUPPORTING section: MAY include Character or Location nodes if needed.'}
5. You MUST generate exactly ${packageCount} packages. Not fewer, not more.

**VALID EDGE TYPES:**
- PRIMARY: ALIGNS_WITH (StoryBeat -> Beat, REQUIRED), PRECEDES (StoryBeat -> StoryBeat, optional)
${isConstrained ? '' : '- SUPPORTING: FEATURES_CHARACTER (StoryBeat -> Character), LOCATED_AT (Scene -> Location)'}

## Story Context

${storyContext}

## Missing Beats (Opportunities)

These are structural beats that currently have no StoryBeat aligned to them.
${targetAct ? `**Filtered to Act ${targetAct} only.**` : 'They are sorted by position in the story structure.'}

${missingBeatsText}

${priorityBeatsText}

## Existing Story Beats

${existingStoryBeats || '[No existing StoryBeats]'}

## Key Characters (for reference only${isConstrained ? ' - do NOT create Character nodes' : ''})

${characters || '[No characters defined yet]'}

${direction ? `## User Direction\n\n"${direction}"\n` : ''}
${ideas ? `${ideas}\n` : ''}
${supportingSection}
## Generation Settings

- **Creativity Level**: ${creativityLabel} (${creativity})
- **Expansion Scope**: ${expansionScope}
- **Packages to Generate**: ${packageCount}
- **Max StoryBeats per Package**: ${maxStoryBeatsPerPackage}
${targetAct ? `- **Target Act**: Act ${targetAct}` : ''}

## StoryBeat Node Schema

**IMPORTANT: ALL fields below are REQUIRED. Do not leave any field empty.**

Each StoryBeat node MUST have these fields with meaningful content:
- **title**: Short, evocative title capturing the beat's essence (e.g., "Marcus discovers the truth about his partner")
- **summary**: 2-3 sentences describing what happens, who is involved, and why it matters. This should give enough context to understand the beat without reading scenes. Include emotional stakes and character motivations.
- **intent**: One of "plot" | "character" | "tone" - the primary story function
- **priority**: "low" | "medium" | "high" - how essential to the core narrative
- **stakes_change**: "raise" | "lower" | "maintain" - how tension/stakes shift
- **urgency**: "low" | "medium" | "high" - how soon this needs to happen in the story

**Summary Quality Guidelines:**
- BAD: "They meet and talk" (too vague)
- GOOD: "Marcus confronts his partner in the precinct parking lot, demanding to know why evidence went missing. The confrontation reveals Marcus's deepening paranoia and sets up the partnership's eventual fracture."

## Output Format

**CRITICAL: You MUST output valid, parseable JSON. Follow these rules strictly:**

1. **NO newlines inside strings** - Use spaces or \\n escape sequences instead
2. **Escape special characters** - Use \\" for quotes, \\\\ for backslashes
3. **NO trailing commas** - Last item in arrays/objects must NOT have a comma after it
4. **Keep strings concise** - Summaries should be 1-2 sentences max
5. **Test mentally** - Before outputting, verify the JSON would parse correctly

Schema:

${outputSchema}

## Guidelines

1. **Priority Beats**: At least one package SHOULD address each priority beat if possible
2. **Variety**: Each package should take a meaningfully different approach
3. **Coherence**: StoryBeats should fit the story's themes and existing content
4. **Causal Flow**: Use PRECEDES edges when one story beat naturally leads to another
${isConstrained ? '5. **No Supporting Nodes**: Do NOT create any supporting nodes' : '5. **Supporting Nodes**: Only include Characters/Locations if essential to the StoryBeats'}
6. **IDs**: Use format \`storybeat_{timestamp}_{5chars}\` for new StoryBeat IDs

**REMINDER: Primary section = StoryBeat nodes only. ${isConstrained ? 'No supporting content.' : 'Supporting section for Character/Location if needed.'}**

Output ONLY the JSON object, no markdown code blocks, no explanation.`;
}

/**
 * Get the constrained output schema (StoryBeats only).
 */
function getConstrainedSchema(): string {
  return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this package makes sense for the story",
      "confidence": 0.85,
      "style_tags": ["dramatic", "revelation"],
      "primary": {
        "type": "StoryBeat",
        "nodes": [
          {
            "operation": "add",
            "node_type": "StoryBeat",
            "node_id": "storybeat_12345_xyz",
            "data": {
              "title": "Marcus discovers the truth about his partner",
              "summary": "Marcus finds hidden financial records in his partner's desk that prove a connection to the crime syndicate. This discovery shatters his trust and forces him to question every case they've worked together. The revelation transforms Marcus from investigator to target.",
              "intent": "plot",
              "priority": "high",
              "urgency": "high",
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
\`\`\``;
}

/**
 * Get the flexible output schema (StoryBeats + supporting content).
 */
function getFlexibleSchema(): string {
  return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this package makes sense for the story",
      "confidence": 0.85,
      "style_tags": ["dramatic", "revelation"],
      "primary": {
        "type": "StoryBeat",
        "nodes": [
          {
            "operation": "add",
            "node_type": "StoryBeat",
            "node_id": "storybeat_12345_xyz",
            "data": {
              "title": "Marcus discovers the truth about his partner",
              "summary": "Marcus finds hidden financial records in his partner's desk that prove a connection to the crime syndicate. This discovery shatters his trust and forces him to question every case they've worked together. The revelation transforms Marcus from investigator to target.",
              "intent": "plot",
              "priority": "high",
              "urgency": "high",
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
          }
        ]
      },
      "supporting": {
        "nodes": [
          {
            "operation": "add",
            "node_type": "Character",
            "node_id": "char_12345_abc",
            "data": {
              "name": "The Informant",
              "archetype": "Ally",
              "description": "A mysterious figure who aids Marcus"
            }
          }
        ],
        "edges": []
      },
      "suggestions": {
        "contextAdditions": [
          {
            "id": "ctx_12345",
            "section": "conflicts",
            "content": "Marcus's discovery puts him at odds with those he trusted",
            "action": "append"
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
\`\`\``;
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
