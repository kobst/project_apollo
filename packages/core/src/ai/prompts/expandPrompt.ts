/**
 * Expand-specific prompt builder.
 *
 * Generic node expansion: expands a node or story context into related content.
 * Output type depends on what is being expanded.
 */

import type { ExpansionScope, ExpandTarget, ContextSection } from '../types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for the Expand generation prompt.
 */
export interface ExpandPromptParams {
  /** Serialized story context */
  storyContext: string;
  /** Target to expand */
  target: ExpandTarget;
  /** Serialized target node data (if expanding a node) */
  targetNodeData?: string;
  /** Target node type (if expanding a node) */
  targetNodeType?: string;
  /** Depth of expansion */
  depth: 'surface' | 'deep';
  /** Number of packages to generate */
  packageCount: number;
  /** Max nodes per package */
  maxNodesPerPackage: number;
  /** Optional user guidance */
  direction?: string;
  /** Creativity level (0-1) */
  creativity: number;
  /** Expansion scope for supporting content (default: 'flexible') */
  expansionScope?: ExpansionScope;
  /** Optional serialized ideas relevant to this expansion */
  ideas?: string;
}

// =============================================================================
// Prompt Builder
// =============================================================================

/**
 * Build the Expand generation prompt for the LLM.
 *
 * @param params - Expand generation parameters
 * @returns Complete prompt string
 */
export function buildExpandPrompt(params: ExpandPromptParams): string {
  const {
    storyContext,
    target,
    targetNodeData,
    targetNodeType,
    depth,
    packageCount,
    maxNodesPerPackage,
    direction,
    creativity,
    expansionScope = 'flexible',
    ideas,
  } = params;

  const creativityLabel = creativity < 0.3 ? 'conservative' : creativity > 0.7 ? 'creative' : 'balanced';
  const isConstrained = expansionScope === 'constrained';
  const depthLabel = depth === 'surface' ? 'Surface (brief additions)' : 'Deep (thorough exploration)';

  // Determine expansion type and instructions
  const { expandType, targetInstructions, outputType } = getTargetInstructions(target, targetNodeType, targetNodeData);

  const supportingSection = isConstrained ? '' : `
## Supporting Content (Optional)

When expansionScope is "flexible", you MAY include supporting nodes in the "supporting" section:
- Additional related nodes that enrich the expansion
- Edges connecting new content to existing story elements
`;

  const outputSchema = getOutputSchema(expandType, isConstrained);

  return `You are a story expansion specialist generating content to expand and deepen story elements.

## CRITICAL CONSTRAINTS - MUST FOLLOW

**STRICT OUTPUT RULES:**
1. Generate content appropriate to the expansion target type.
2. Primary output should focus on ${outputType}.
${isConstrained ? '3. NO supporting content - only expand the primary target.' : '3. SUPPORTING section: MAY include related nodes.'}
4. You MUST generate exactly ${packageCount} packages. Not fewer, not more.

## Story Context

${storyContext}

${targetInstructions}

${direction ? `## User Direction\n\n"${direction}"\n` : ''}
${ideas ? `${ideas}\n` : ''}
${supportingSection}
## Available Node Types

- **Character**: name, description, archetype, traits[]
- **Location**: name, description
- **Object**: name, description
- **StoryBeat**: title, summary, intent (plot|character|tone), priority, stakes_change
- **Scene**: heading, scene_overview, mood, key_actions[]

## Available Edge Types

- HAS_CHARACTER: Scene → Character
- LOCATED_AT: Scene → Location
- FEATURES_OBJECT: Scene → Object
- ALIGNS_WITH: StoryBeat → Beat (aligns with structural beat)
- SATISFIED_BY: StoryBeat → Scene (scene realizes story beat)
- PRECEDES: StoryBeat → StoryBeat (causal/temporal ordering)
- ADVANCES: StoryBeat → CharacterArc
- PART_OF: Location → Setting

**IMPORTANT**: ONLY use edge types from this list. Do NOT invent new edge types.

## Generation Settings

- **Expansion Type**: ${expandType}
- **Depth**: ${depthLabel}
- **Creativity Level**: ${creativityLabel} (${creativity})
- **Expansion Scope**: ${expansionScope}
- **Packages to Generate**: ${packageCount}
- **Max Nodes per Package**: ${maxNodesPerPackage}

## Output Format

**CRITICAL: You MUST output valid, parseable JSON. Follow these rules strictly:**

1. **NO newlines inside strings** - Use spaces or \\n escape sequences instead
2. **Escape special characters** - Use \\" for quotes, \\\\ for backslashes
3. **NO trailing commas** - Last item in arrays/objects must NOT have a comma after it
4. **Keep strings concise**
5. **Test mentally** - Before outputting, verify the JSON would parse correctly

Schema:

${outputSchema}

## Guidelines

1. **Depth Adherence**: ${depth === 'surface' ? 'Keep expansions brief and focused' : 'Explore deeply with rich detail'}
2. **Variety**: Each package should offer meaningfully different expansion options
3. **Coherence**: Expansions should fit seamlessly with existing story content
4. **Relationships**: Consider how expansions connect to existing elements
5. **IDs**: Use appropriate ID formats (e.g., \`char_{timestamp}_{5chars}\`, \`loc_{timestamp}_{5chars}\`)

**REMINDER: Focus expansion on ${outputType}. ${isConstrained ? 'No supporting content.' : 'May include supporting nodes.'}**

Output ONLY the JSON object, no markdown code blocks, no explanation.`;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get target-specific instructions and output type.
 */
function getTargetInstructions(
  target: ExpandTarget,
  targetNodeType?: string,
  targetNodeData?: string
): { expandType: string; targetInstructions: string; outputType: string } {
  if (target.type === 'node') {
    return getNodeExpansionInstructions(target.nodeId, targetNodeType, targetNodeData);
  } else if (target.type === 'story-context') {
    return {
      expandType: 'Story Context',
      targetInstructions: `## Expansion Target: Story Context

You are expanding the entire story context with new thematic, tonal, or structural content.

**IMPORTANT**: Look at the existing sections in the Story Context above (marked with ## headers).
- PREFER adding content to existing sections rather than creating new ones
- Use the EXACT section names that already exist in the document
- Common sections include: "Creative Direction", "Themes & Motifs", "Working Notes", "Constraints & Rules"
- Only create a new section if the content truly doesn't fit any existing section

Generate:
- New themes or thematic variations
- Tonal adjustments or enhancements
- Conflict elaborations
- Constraint refinements
- Motif additions`,
      outputType: 'Context Additions',
    };
  } else if (target.type === 'story-context-section') {
    return getContextSectionInstructions(target.section);
  }

  return {
    expandType: 'Generic',
    targetInstructions: '## Expansion Target: Generic\n\nExpand story content as needed.',
    outputType: 'Mixed content',
  };
}

/**
 * Get instructions for expanding a specific node type.
 */
function getNodeExpansionInstructions(
  nodeId: string,
  nodeType?: string,
  nodeData?: string
): { expandType: string; targetInstructions: string; outputType: string } {
  const commonNodeInfo = `
**Target Node ID**: ${nodeId}
**Node Type**: ${nodeType ?? 'Unknown'}
**Node Data**:
${nodeData ?? '[Node data not provided]'}
`;

  switch (nodeType) {
    case 'Character':
      return {
        expandType: 'Character Expansion',
        targetInstructions: `## Expansion Target: Character
${commonNodeInfo}

Expand this character by generating:
- **CharacterArcs**: Growth, fall, transformation arcs
- **Relationships**: Connections to other characters
- **Background**: Backstory elements, formative experiences
- **Scenes**: Scenes featuring this character
- **Locations**: Places associated with this character`,
        outputType: 'Character-related nodes (arcs, relationships, scenes)',
      };

    case 'StoryBeat':
      return {
        expandType: 'StoryBeat Expansion',
        targetInstructions: `## Expansion Target: StoryBeat
${commonNodeInfo}

Expand this story beat by generating:
- **Scenes**: Scenes that realize this beat
- **Characters**: Characters needed for this beat
- **Locations**: Where this beat takes place
- **Preceding/Following Beats**: Related story beats`,
        outputType: 'Scenes and supporting elements',
      };

    case 'Scene':
      return {
        expandType: 'Scene Expansion',
        targetInstructions: `## Expansion Target: Scene
${commonNodeInfo}

Expand this scene by generating:
- **Characters**: Additional characters for the scene
- **Objects**: Props or items featured in the scene
- **Connected Scenes**: Following or preceding scenes
- **Dialogue hints**: Key exchanges or moments`,
        outputType: 'Scene elements and connected scenes',
      };

    case 'Location':
      return {
        expandType: 'Location Expansion',
        targetInstructions: `## Expansion Target: Location
${commonNodeInfo}

Expand this location by generating:
- **Sub-locations**: Areas within this location
- **Scenes**: Scenes that take place here
- **Characters**: Characters associated with this place
- **Objects**: Items found at this location`,
        outputType: 'Location-related elements',
      };

    default:
      return {
        expandType: `${nodeType ?? 'Node'} Expansion`,
        targetInstructions: `## Expansion Target: ${nodeType ?? 'Node'}
${commonNodeInfo}

Expand this element by generating related content appropriate to its type.`,
        outputType: 'Related story elements',
      };
  }
}

/**
 * Get instructions for expanding a specific story context section.
 */
function getContextSectionInstructions(
  section: ContextSection
): { expandType: string; targetInstructions: string; outputType: string } {
  const sectionLabels: Record<ContextSection, string> = {
    themes: 'Themes',
    conflicts: 'Conflicts',
    motifs: 'Motifs',
    tone: 'Tone',
    constraints: 'Constraints',
  };

  const sectionInstructions: Record<ContextSection, string> = {
    themes: `Generate thematic additions:
- Core themes and their variations
- Sub-themes that complement existing themes
- Thematic tensions and contrasts`,
    conflicts: `Generate conflict additions:
- Central conflicts and their dimensions
- Internal character conflicts
- External obstacles and antagonistic forces
- Conflict escalation points`,
    motifs: `Generate motif additions:
- Recurring symbols or images
- Symbolic patterns
- Visual or narrative echoes`,
    tone: `Generate tonal additions:
- Tonal shifts and variations
- Atmosphere descriptions
- Emotional texture`,
    constraints: `Generate constraint additions:
- Genre conventions to follow
- Structural requirements
- Things to avoid
- Consistency rules`,
  };

  return {
    expandType: `Story Context - ${sectionLabels[section]}`,
    targetInstructions: `## Expansion Target: Story Context (${sectionLabels[section]} Section)

You are expanding the ${sectionLabels[section].toLowerCase()} section of the story context.

${sectionInstructions[section]}`,
    outputType: `Context additions for ${sectionLabels[section].toLowerCase()}`,
  };
}

/**
 * Get the output schema based on expansion type.
 */
function getOutputSchema(expandType: string, isConstrained: boolean): string {
  if (expandType.includes('Story Context')) {
    return getContextExpansionSchema(isConstrained);
  }

  return getNodeExpansionSchema(isConstrained);
}

/**
 * Schema for context expansion.
 * Uses changes.storyContext format to match UI expectations.
 */
function getContextExpansionSchema(isConstrained: boolean): string {
  if (isConstrained) {
    return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this expansion makes sense",
      "confidence": 0.85,
      "style_tags": ["thematic", "tonal"],
      "changes": {
        "storyContext": [
          {
            "operation": "add",
            "section": "Themes & Motifs",
            "content": "The tension between ambition and integrity drives character choices"
          },
          {
            "operation": "add",
            "section": "Constraints & Rules",
            "content": "External pressure from society conflicts with internal moral compass"
          }
        ],
        "nodes": [],
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
\`\`\`

**IMPORTANT**: Use the section names that ALREADY EXIST in the story context. Look at the ## headers in the document and use those exact names.`;
  }

  return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this expansion makes sense",
      "confidence": 0.85,
      "style_tags": ["thematic", "tonal"],
      "changes": {
        "storyContext": [
          {
            "operation": "add",
            "section": "Themes & Motifs",
            "content": "The tension between ambition and integrity drives character choices"
          },
          {
            "operation": "add",
            "section": "Constraints & Rules",
            "content": "External pressure from society conflicts with internal moral compass"
          }
        ],
        "nodes": [],
        "edges": []
      },
      "suggestions": {
        "stashedIdeas": [
          {
            "id": "idea_12345",
            "content": "Consider a scene where the protagonist must choose between career and conscience",
            "category": "scene",
            "relatedNodeIds": []
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
\`\`\`

**IMPORTANT**: Use the section names that ALREADY EXIST in the story context. Look at the ## headers in the document and use those exact names.`;
}

/**
 * Schema for node expansion.
 */
function getNodeExpansionSchema(isConstrained: boolean): string {
  if (isConstrained) {
    return `\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "summary": "Why this expansion makes sense",
      "confidence": 0.85,
      "style_tags": ["character", "development"],
      "primary": {
        "type": "Mixed",
        "nodes": [
          {
            "operation": "add",
            "node_type": "Scene",
            "node_id": "scene_12345_xyz",
            "data": {
              "heading": "INT. LOCATION - TIME",
              "scene_overview": "Description of what happens"
            }
          }
        ],
        "edges": [
          {
            "operation": "add",
            "edge_type": "HAS_CHARACTER",
            "from": "scene_12345_xyz",
            "to": "char_target_id"
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
      "summary": "Why this expansion makes sense",
      "confidence": 0.85,
      "style_tags": ["character", "development"],
      "primary": {
        "type": "Mixed",
        "nodes": [
          {
            "operation": "add",
            "node_type": "Scene",
            "node_id": "scene_12345_xyz",
            "data": {
              "heading": "INT. LOCATION - TIME",
              "scene_overview": "Description of what happens"
            }
          }
        ],
        "edges": [
          {
            "operation": "add",
            "edge_type": "HAS_CHARACTER",
            "from": "scene_12345_xyz",
            "to": "char_target_id"
          }
        ]
      },
      "supporting": {
        "nodes": [
          {
            "operation": "add",
            "node_type": "Location",
            "node_id": "loc_12345_abc",
            "data": {
              "name": "New Location",
              "description": "A place relevant to the expansion"
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
