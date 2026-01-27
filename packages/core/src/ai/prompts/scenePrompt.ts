/**
 * Scene-specific prompt builder.
 *
 * Generates Scene nodes linked to StoryBeats via SATISFIED_BY edges.
 * Only committed StoryBeats can have scenes generated for them.
 */

import type { ExpansionScope, ValidatedBeatInfo } from '../types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for the Scene generation prompt.
 */
export interface ScenePromptParams {
  /** Serialized story context (metadata, themes, constraints) */
  storyContext: string;
  /** StoryBeats to generate scenes for (validated as committed) */
  validatedBeats: ValidatedBeatInfo[];
  /** Existing characters for HAS_CHARACTER edges */
  existingCharacters: string;
  /** Existing locations for LOCATED_AT edges */
  existingLocations: string;
  /** Existing scenes for context */
  existingScenes: string;
  /** Number of scenes per StoryBeat */
  scenesPerBeat: number;
  /** Number of packages to generate */
  packageCount: number;
  /** Max scenes per package */
  maxScenesPerPackage: number;
  /** Optional user guidance */
  direction?: string;
  /** Creativity level (0-1) */
  creativity: number;
  /** Expansion scope for supporting content (default: 'flexible') */
  expansionScope?: ExpansionScope;
  /** Optional serialized ideas relevant to scene generation */
  ideas?: string;
  /** Optional serialized soft guidelines filtered for this task */
  guidelines?: string;
}

// =============================================================================
// Prompt Builder
// =============================================================================

/**
 * Build the Scene generation prompt for the LLM.
 *
 * @param params - Scene generation parameters
 * @returns Complete prompt string
 */
export function buildScenePrompt(params: ScenePromptParams): string {
  const {
    storyContext,
    validatedBeats,
    existingCharacters,
    existingLocations,
    existingScenes,
    scenesPerBeat,
    packageCount,
    maxScenesPerPackage,
    direction,
    creativity,
    expansionScope = 'flexible',
    ideas,
    guidelines,
  } = params;

  const creativityLabel = creativity < 0.3 ? 'conservative' : creativity > 0.7 ? 'creative' : 'balanced';
  const isConstrained = expansionScope === 'constrained';

  const beatsSection = formatValidatedBeats(validatedBeats);

  const supportingSection = isConstrained ? '' : `
## Supporting Content (Optional)

When expansionScope is "flexible", you MAY include supporting nodes in the "supporting" section:
- **Character nodes**: New characters needed for scenes
- **Location nodes**: New locations where scenes take place
- **Object nodes**: Important props or MacGuffins

Supporting nodes should only be created if essential to the scenes.
`;

  const outputSchema = isConstrained ? getConstrainedSceneSchema() : getFlexibleSceneSchema();

  return `You are a scene development specialist generating Scene nodes for a story.

## CRITICAL CONSTRAINTS - MUST FOLLOW

**STRICT OUTPUT RULES:**
1. PRIMARY section: ONLY Scene nodes.
2. Each Scene MUST have a SATISFIED_BY edge to a StoryBeat.
3. Scenes SHOULD have HAS_CHARACTER edges to existing Characters.
4. Scenes SHOULD have LOCATED_AT edges to existing Locations.
${isConstrained ? '5. NO supporting content - only Scenes in primary with edges to EXISTING nodes.' : '5. SUPPORTING section: MAY include new Character, Location, or Object nodes.'}
6. You MUST generate exactly ${packageCount} packages. Not fewer, not more.

**VALID EDGE TYPES:**
- PRIMARY: SATISFIED_BY (Scene -> StoryBeat, REQUIRED)
- PRIMARY: HAS_CHARACTER (Scene -> Character)
- PRIMARY: LOCATED_AT (Scene -> Location)
- PRIMARY: FEATURES_OBJECT (Scene -> Object)
${isConstrained ? '' : '- SUPPORTING edges: Any edges connecting new supporting nodes'}

## Story Context

${storyContext}

## StoryBeats to Generate Scenes For

${beatsSection}

## Existing Characters (use these for HAS_CHARACTER edges)

${existingCharacters || '[No characters defined - create supporting characters if needed]'}

## Existing Locations (use these for LOCATED_AT edges)

${existingLocations || '[No locations defined - create supporting locations if needed]'}

## Existing Scenes (for context and continuity)

${existingScenes || '[No existing scenes]'}

${direction ? `## User Direction\n\n"${direction}"\n` : ''}
${ideas ? `${ideas}\n` : ''}
${guidelines ? `${guidelines}\n` : ''}
${supportingSection}
## Generation Settings

- **Creativity Level**: ${creativityLabel} (${creativity})
- **Expansion Scope**: ${expansionScope}
- **Packages to Generate**: ${packageCount}
- **Scenes per StoryBeat**: ${scenesPerBeat}
- **Max Scenes per Package**: ${maxScenesPerPackage}

## Scene Node Schema

Each Scene node must have these fields:
- **heading**: Scene heading in screenplay format (e.g., "INT. OFFICE - DAY")
- **scene_overview**: 2-3 sentence description of what happens
- **goal** (optional): What the scene achieves narratively
- **conflict** (optional): The central tension or obstacle
- **outcome** (optional): How the scene resolves

## Output Format

**CRITICAL: You MUST output valid, parseable JSON. Follow these rules strictly:**

1. **NO newlines inside strings** - Use spaces or \\n escape sequences instead
2. **Escape special characters** - Use \\" for quotes, \\\\ for backslashes
3. **NO trailing commas** - Last item in arrays/objects must NOT have a comma after it
4. **Keep strings concise** - Overviews should be 2-3 sentences max
5. **Test mentally** - Before outputting, verify the JSON would parse correctly

Schema:

${outputSchema}

## Guidelines

1. **StoryBeat Coverage**: Each validated StoryBeat should have at least ${scenesPerBeat} scene(s)
2. **Character Usage**: Use existing characters when possible via HAS_CHARACTER edges
3. **Location Usage**: Use existing locations when possible via LOCATED_AT edges
4. **Variety**: Each package should approach scenes differently
5. **Continuity**: Scenes should flow logically and maintain story continuity
6. **IDs**: Use format \`scene_{timestamp}_{5chars}\` for Scene IDs

**REMINDER: Primary section = Scene nodes only. SATISFIED_BY edges are REQUIRED. ${isConstrained ? 'Use only existing nodes.' : 'May create supporting nodes.'}**

Output ONLY the JSON object, no markdown code blocks, no explanation.`;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format validated beats for the prompt.
 */
function formatValidatedBeats(beats: ValidatedBeatInfo[]): string {
  if (beats.length === 0) {
    return '[No StoryBeats to generate scenes for]';
  }

  const lines: string[] = [];
  for (const beat of beats) {
    lines.push(`- **${beat.storyBeatId}**: "${beat.title}" (aligned to ${beat.alignedTo})`);
  }

  return lines.join('\n');
}

/**
 * Get the constrained output schema (Scenes only with existing nodes).
 */
function getConstrainedSceneSchema(): string {
  return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this package makes sense for the story",
      "confidence": 0.85,
      "style_tags": ["dramatic", "tense"],
      "primary": {
        "type": "Scene",
        "nodes": [
          {
            "operation": "add",
            "node_type": "Scene",
            "node_id": "scene_12345_xyz",
            "data": {
              "heading": "INT. DETECTIVE'S OFFICE - NIGHT",
              "scene_overview": "Marcus confronts his partner about the missing evidence. Tension builds as lies unravel.",
              "goal": "Reveal the betrayal",
              "conflict": "Trust vs evidence",
              "outcome": "Partnership fractures"
            }
          }
        ],
        "edges": [
          {
            "operation": "add",
            "edge_type": "SATISFIED_BY",
            "from": "scene_12345_xyz",
            "to": "storybeat_existing_123"
          },
          {
            "operation": "add",
            "edge_type": "HAS_CHARACTER",
            "from": "scene_12345_xyz",
            "to": "char_marcus"
          },
          {
            "operation": "add",
            "edge_type": "LOCATED_AT",
            "from": "scene_12345_xyz",
            "to": "loc_office"
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

/**
 * Get the flexible output schema (Scenes + supporting content).
 */
function getFlexibleSceneSchema(): string {
  return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this package makes sense for the story",
      "confidence": 0.85,
      "style_tags": ["dramatic", "tense"],
      "primary": {
        "type": "Scene",
        "nodes": [
          {
            "operation": "add",
            "node_type": "Scene",
            "node_id": "scene_12345_xyz",
            "data": {
              "heading": "INT. DETECTIVE'S OFFICE - NIGHT",
              "scene_overview": "Marcus confronts his partner about the missing evidence. Tension builds as lies unravel.",
              "goal": "Reveal the betrayal",
              "conflict": "Trust vs evidence",
              "outcome": "Partnership fractures"
            }
          }
        ],
        "edges": [
          {
            "operation": "add",
            "edge_type": "SATISFIED_BY",
            "from": "scene_12345_xyz",
            "to": "storybeat_existing_123"
          },
          {
            "operation": "add",
            "edge_type": "HAS_CHARACTER",
            "from": "scene_12345_xyz",
            "to": "char_marcus"
          },
          {
            "operation": "add",
            "edge_type": "HAS_CHARACTER",
            "from": "scene_12345_xyz",
            "to": "char_12345_new"
          },
          {
            "operation": "add",
            "edge_type": "LOCATED_AT",
            "from": "scene_12345_xyz",
            "to": "loc_12345_new"
          }
        ]
      },
      "supporting": {
        "nodes": [
          {
            "operation": "add",
            "node_type": "Character",
            "node_id": "char_12345_new",
            "data": {
              "name": "Detective Chen",
              "archetype": "Ally",
              "description": "Marcus's conflicted partner"
            }
          },
          {
            "operation": "add",
            "node_type": "Location",
            "node_id": "loc_12345_new",
            "data": {
              "name": "Precinct 12 - Detective's Office",
              "description": "A cluttered office with case files everywhere"
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
