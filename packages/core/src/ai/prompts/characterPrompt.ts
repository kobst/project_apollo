/**
 * Character-specific prompt builder.
 *
 * Generates Character nodes with optional CharacterArc nodes.
 * Supports various generation focuses (develop existing, new protagonist, etc.)
 */

import type { CharacterFocus, ExpansionScope } from '../types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for the Character generation prompt.
 */
export interface CharacterPromptParams {
  /** Serialized story context (metadata, themes, constraints) */
  storyContext: string;
  /** Existing characters with summaries */
  existingCharacters: string;
  /** Existing story beats for context */
  existingStoryBeats: string;
  /** Character generation focus */
  focus: CharacterFocus;
  /** Character ID for 'develop_existing' focus */
  characterId?: string;
  /** Character data for 'develop_existing' focus */
  characterData?: string;
  /** Whether to include character arcs */
  includeArcs: boolean;
  /** Number of packages to generate */
  packageCount: number;
  /** Max characters per package */
  maxCharactersPerPackage: number;
  /** Optional user guidance */
  direction?: string;
  /** Creativity level (0-1) */
  creativity: number;
  /** Expansion scope for supporting content (default: 'flexible') */
  expansionScope?: ExpansionScope;
}

// =============================================================================
// Prompt Builder
// =============================================================================

/**
 * Build the Character generation prompt for the LLM.
 *
 * @param params - Character generation parameters
 * @returns Complete prompt string
 */
export function buildCharacterPrompt(params: CharacterPromptParams): string {
  const {
    storyContext,
    existingCharacters,
    existingStoryBeats,
    focus,
    characterId,
    characterData,
    includeArcs,
    packageCount,
    maxCharactersPerPackage,
    direction,
    creativity,
    expansionScope = 'flexible',
  } = params;

  const creativityLabel = creativity < 0.3 ? 'conservative' : creativity > 0.7 ? 'creative' : 'balanced';
  const isConstrained = expansionScope === 'constrained';
  const focusInstructions = getFocusInstructions(focus, characterId, characterData);

  const supportingSection = isConstrained ? '' : `
## Supporting Content (Optional)

When expansionScope is "flexible", you MAY include supporting nodes in the "supporting" section:
- **Location nodes**: Locations associated with characters (homes, workplaces)
- **StoryBeatHints**: Suggestions for story beats featuring these characters

Supporting nodes should only be created if they enrich the character's world.
`;

  const outputSchema = isConstrained
    ? getConstrainedCharacterSchema(includeArcs)
    : getFlexibleCharacterSchema(includeArcs);

  return `You are a character development specialist generating Character nodes for a story.

## CRITICAL CONSTRAINTS - MUST FOLLOW

**STRICT OUTPUT RULES:**
1. PRIMARY section: Character nodes${includeArcs ? ' and CharacterArc nodes' : ''}.
2. Each Character MUST have: name, archetype, description.
${includeArcs ? '3. CharacterArcs are linked via HAS_ARC edge (Character -> CharacterArc).' : ''}
${isConstrained ? `${includeArcs ? '4' : '3'}. NO supporting content - only Characters${includeArcs ? ' and CharacterArcs' : ''} in primary.` : `${includeArcs ? '4' : '3'}. SUPPORTING section: MAY include Location nodes or StoryBeatHints.`}
${isConstrained ? `${includeArcs ? '5' : '4'}` : `${includeArcs ? '5' : '4'}`}. You MUST generate exactly ${packageCount} packages. Not fewer, not more.

**VALID EDGE TYPES:**
- PRIMARY: ${includeArcs ? 'HAS_ARC (Character -> CharacterArc)' : 'None required'}
${isConstrained ? '' : '- SUPPORTING: LOCATED_AT (Character -> Location)'}

## Story Context

${storyContext}

${focusInstructions}

## Existing Characters

${existingCharacters || '[No characters defined yet]'}

## Existing Story Beats (for context)

${existingStoryBeats || '[No story beats defined yet]'}

${direction ? `## User Direction\n\n"${direction}"\n` : ''}
${supportingSection}
## Generation Settings

- **Focus**: ${formatFocus(focus)}
- **Creativity Level**: ${creativityLabel} (${creativity})
- **Expansion Scope**: ${expansionScope}
- **Packages to Generate**: ${packageCount}
- **Max Characters per Package**: ${maxCharactersPerPackage}
- **Include Character Arcs**: ${includeArcs ? 'Yes' : 'No'}

## Character Node Schema

Each Character node must have these fields:
- **name**: Character's full name
- **archetype**: One of "Protagonist" | "Antagonist" | "Mentor" | "Ally" | "Trickster" | "Guardian" | "Herald" | "Shadow" | "Shapeshifter"
- **description**: 2-3 sentence description of the character
- **role** (optional): Character's role in the story
- **motivation** (optional): What drives this character
- **flaw** (optional): Character's key weakness or flaw
- **status**: "ACTIVE" (default)

${includeArcs ? `## CharacterArc Node Schema

Each CharacterArc node must have these fields:
- **arc_type**: One of "growth" | "fall" | "flat" | "transformation"
- **starting_state**: Brief description of character at story start
- **ending_state**: Brief description of character at story end
- **key_moments**: Array of 2-4 strings describing pivotal moments
` : ''}

## Output Format

**CRITICAL: You MUST output valid, parseable JSON. Follow these rules strictly:**

1. **NO newlines inside strings** - Use spaces or \\n escape sequences instead
2. **Escape special characters** - Use \\" for quotes, \\\\ for backslashes
3. **NO trailing commas** - Last item in arrays/objects must NOT have a comma after it
4. **Keep strings concise** - Descriptions should be 2-3 sentences max
5. **Test mentally** - Before outputting, verify the JSON would parse correctly

Schema:

${outputSchema}

## Guidelines

1. **Focus Adherence**: Follow the specified focus type strictly
2. **Variety**: Each package should offer meaningfully different character options
3. **Story Fit**: Characters should fit the story's themes, genre, and existing content
4. **Relationships**: Consider how new characters relate to existing ones
${includeArcs ? '5. **Arc Coherence**: Character arcs should feel natural and connected to the story' : ''}
6. **IDs**: Use format \`char_{timestamp}_{5chars}\` for Characters${includeArcs ? ', \`arc_{timestamp}_{5chars}\` for CharacterArcs' : ''}

**REMINDER: Primary section = Character${includeArcs ? ' + CharacterArc' : ''} nodes only. ${isConstrained ? 'No supporting content.' : 'Supporting section for Locations/hints if needed.'}**

Output ONLY the JSON object, no markdown code blocks, no explanation.`;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get focus-specific instructions.
 */
function getFocusInstructions(
  focus: CharacterFocus,
  characterId?: string,
  characterData?: string
): string {
  switch (focus) {
    case 'develop_existing':
      return `## Focus: Develop Existing Character

You are expanding and deepening an existing character.

**Target Character ID**: ${characterId ?? 'Not specified'}
**Current Character Data**:
${characterData ?? '[Character data not provided]'}

Generate variations that:
- Add depth to the character's background, motivations, or relationships
- Explore different facets of their personality
- Create character arcs if requested
- Do NOT change core identity (name, primary archetype)
`;

    case 'new_protagonist':
      return `## Focus: New Protagonist

You are creating a NEW protagonist character for the story.

Generate variations that:
- Are suitable as the main character / POV character
- Have clear goals, motivations, and flaws
- Can drive the story's central conflict
- Are distinct from existing characters
`;

    case 'new_antagonist':
      return `## Focus: New Antagonist

You are creating a NEW antagonist character for the story.

Generate variations that:
- Present a meaningful challenge to the protagonist
- Have understandable (if not sympathetic) motivations
- Create compelling conflict
- Vary in approach: some overt, some subtle
`;

    case 'new_supporting':
      return `## Focus: New Supporting Character

You are creating NEW supporting characters for the story.

Generate variations that:
- Serve specific roles (mentor, ally, foil, comic relief, etc.)
- Have their own goals and depth
- Complement existing characters
- Enable or complicate the protagonist's journey
`;

    case 'fill_gaps':
      return `## Focus: Fill Character Gaps

You are analyzing the story and creating characters to fill identified gaps.

Generate characters that:
- Fill missing archetypes or roles
- Address gaps in the story's character dynamics
- Balance the existing cast
- Enable story beats that currently lack characters
`;

    default:
      return '## Focus: General Character Generation\n\nGenerate diverse, story-appropriate characters.';
  }
}

/**
 * Format focus type for display.
 */
function formatFocus(focus: CharacterFocus): string {
  const labels: Record<CharacterFocus, string> = {
    develop_existing: 'Develop Existing Character',
    new_protagonist: 'New Protagonist',
    new_antagonist: 'New Antagonist',
    new_supporting: 'New Supporting Character',
    fill_gaps: 'Fill Character Gaps',
  };
  return labels[focus] ?? focus;
}

/**
 * Get the constrained output schema (Characters only).
 */
function getConstrainedCharacterSchema(includeArcs: boolean): string {
  if (includeArcs) {
    return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this package makes sense for the story",
      "confidence": 0.85,
      "style_tags": ["dramatic", "complex"],
      "primary": {
        "type": "Character",
        "nodes": [
          {
            "operation": "add",
            "node_type": "Character",
            "node_id": "char_12345_xyz",
            "data": {
              "name": "Elena Vasquez",
              "archetype": "Protagonist",
              "description": "A determined journalist uncovering corruption.",
              "role": "Main Character",
              "motivation": "Expose the truth",
              "flaw": "Trusts too easily",
              "status": "ACTIVE"
            }
          },
          {
            "operation": "add",
            "node_type": "CharacterArc",
            "node_id": "arc_12345_xyz",
            "data": {
              "arc_type": "growth",
              "starting_state": "Naive and idealistic",
              "ending_state": "Wiser but still hopeful",
              "key_moments": ["First betrayal", "Discovers mentor's secret", "Makes difficult choice"]
            }
          }
        ],
        "edges": [
          {
            "operation": "add",
            "edge_type": "HAS_ARC",
            "from": "char_12345_xyz",
            "to": "arc_12345_xyz"
          }
        ]
      },
      "impact": {
        "fulfills_gaps": [],
        "creates_gaps": [],
        "conflicts": []
      }
    }
  ]
}
\`\`\``;
  }

  return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this package makes sense for the story",
      "confidence": 0.85,
      "style_tags": ["dramatic", "complex"],
      "primary": {
        "type": "Character",
        "nodes": [
          {
            "operation": "add",
            "node_type": "Character",
            "node_id": "char_12345_xyz",
            "data": {
              "name": "Elena Vasquez",
              "archetype": "Protagonist",
              "description": "A determined journalist uncovering corruption.",
              "role": "Main Character",
              "motivation": "Expose the truth",
              "flaw": "Trusts too easily",
              "status": "ACTIVE"
            }
          }
        ],
        "edges": []
      },
      "impact": {
        "fulfills_gaps": [],
        "creates_gaps": [],
        "conflicts": []
      }
    }
  ]
}
\`\`\``;
}

/**
 * Get the flexible output schema (Characters + supporting content).
 */
function getFlexibleCharacterSchema(includeArcs: boolean): string {
  return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this package makes sense for the story",
      "confidence": 0.85,
      "style_tags": ["dramatic", "complex"],
      "primary": {
        "type": "Character",
        "nodes": [
          {
            "operation": "add",
            "node_type": "Character",
            "node_id": "char_12345_xyz",
            "data": {
              "name": "Elena Vasquez",
              "archetype": "Protagonist",
              "description": "A determined journalist uncovering corruption.",
              "role": "Main Character",
              "motivation": "Expose the truth",
              "flaw": "Trusts too easily",
              "status": "ACTIVE"
            }
          }${includeArcs ? `,
          {
            "operation": "add",
            "node_type": "CharacterArc",
            "node_id": "arc_12345_xyz",
            "data": {
              "arc_type": "growth",
              "starting_state": "Naive and idealistic",
              "ending_state": "Wiser but still hopeful",
              "key_moments": ["First betrayal", "Discovers mentor's secret"]
            }
          }` : ''}
        ],
        "edges": [${includeArcs ? `
          {
            "operation": "add",
            "edge_type": "HAS_ARC",
            "from": "char_12345_xyz",
            "to": "arc_12345_xyz"
          }` : ''}]
      },
      "supporting": {
        "nodes": [
          {
            "operation": "add",
            "node_type": "Location",
            "node_id": "loc_12345_abc",
            "data": {
              "name": "The Daily Herald",
              "description": "A struggling newspaper office"
            }
          }
        ],
        "edges": []
      },
      "suggestions": {
        "storyBeatHints": [
          {
            "title": "Elena's First Big Story",
            "summary": "Elena stumbles onto evidence of corruption while investigating a routine story",
            "suggestedBeat": "Catalyst",
            "act": 1
          }
        ]
      },
      "impact": {
        "fulfills_gaps": [],
        "creates_gaps": [],
        "conflicts": []
      }
    }
  ]
}
\`\`\``;
}
