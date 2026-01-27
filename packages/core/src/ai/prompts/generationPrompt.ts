/**
 * Generation prompt builder.
 *
 * Generates N complete narrative packages from an entry point.
 */

import type { GenerationParams, GenerationEntryPoint } from '../types.js';
import { getDepthBudget } from '../config.js';

/**
 * Build the generation prompt for the LLM.
 *
 * The generation phase:
 * 1. Analyzes the entry point and context
 * 2. Consults story state and gaps
 * 3. Generates N distinct, complete packages
 * 4. Each package is self-contained and ready to apply
 *
 * @param params - Generation parameters
 * @returns Complete prompt string
 */
export function buildGenerationPrompt(params: GenerationParams): string {
  const { entryPoint, storyContext, gaps, direction, depth, count, ideas, guidelines } = params;
  const budget = getDepthBudget(depth);

  const entryDescription = describeEntryPoint(entryPoint);

  // Build ideas section if provided
  const ideasSection = ideas ? `\n${ideas}\n` : '';
  // Build guidelines section if provided
  const guidelinesSection = guidelines ? `\n${guidelines}\n` : '';

  return `You are an AI assistant helping to develop a screenplay. Your task is to generate EXACTLY ${count} complete narrative packages based on the given entry point.

**IMPORTANT: You MUST generate exactly ${count} packages. Not fewer, not more. This is a strict requirement.**

## Your Role

1. Understand the entry point and generation context
2. Consult the story state for thematic alignment
3. Review gaps for opportunities to fulfill
4. Generate EXACTLY ${count} distinct, complete packages
5. Each package must be self-contained and ready to apply

## Entry Point

${entryDescription}

## Current Story State

${storyContext}

## Open Gaps (Opportunities)

${gaps}
${ideasSection}
${guidelinesSection}
${direction ? `## User Direction\n\n"${direction}"\n` : ''}

## Generation Budget

- **Depth**: ${depth}
- Maximum new nodes per package: ${budget.maxNodes}
- Maximum total operations per package: ${budget.maxOps}

## Available Node Types

- **Character**: name, description, archetype, traits[]
- **Location**: name, description, parent_location_id
- **Object**: name, description
- **StoryBeat**: title, summary, intent (plot|character|tone), priority, stakes_change
- **Scene**: heading, scene_overview, order_index, mood, key_actions[]

## Available Edge Types

- HAS_CHARACTER: Scene → Character
- LOCATED_AT: Scene → Location
- FEATURES_OBJECT: Scene → Object
- ALIGNS_WITH: StoryBeat → Beat
- SATISFIED_BY: StoryBeat → Scene
- PRECEDES: StoryBeat → StoryBeat (causal ordering)
- ADVANCES: StoryBeat → CharacterArc

## Output Format

**CRITICAL: You MUST output valid, parseable JSON. Follow these rules strictly:**

1. **NO newlines inside strings** - Use spaces or \\n escape sequences instead
2. **Escape special characters** - Use \\" for quotes, \\\\ for backslashes
3. **NO trailing commas** - Last item in arrays/objects must NOT have a comma after it
4. **Keep strings concise** - Descriptions should be 1-2 sentences max
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
      "style_tags": ["betrayal", "dramatic"],
      "changes": {
        "storyContext": [
          { "operation": { "type": "addThematicPillar", "pillar": "New thematic element" } },
          { "operation": { "type": "setConstitutionField", "field": "toneEssence", "value": "Updated tone" } },
          { "operation": { "type": "addGuideline", "guideline": { "id": "sg_timestamp_xxxx", "tags": ["character"], "text": "Guideline text" } } }
        ],
        "nodes": [
          {
            "operation": "add",
            "node_type": "Character",
            "node_id": "character_12345_xyz",
            "data": { "name": "Character Name", "description": "Brief description in one sentence." }
          }
        ],
        "edges": [
          {
            "operation": "add",
            "edge_type": "HAS_CHARACTER",
            "from": "scene_123",
            "to": "character_12345_xyz"
          }
        ]
      },
      "impact": {
        "fulfills_gaps": ["gap_id_1"],
        "creates_gaps": ["New gap description"],
        "conflicts": []
      }
    }
  ]
}
\`\`\`

## Guidelines

1. **Variety**: Each package should take a meaningfully different approach
2. **Completeness**: Include all supporting elements (characters, locations) needed
3. **Coherence**: All elements within a package should work together
4. **Alignment**: Respect the story's themes, tone, and constraints
5. **Gaps**: Try to fulfill open gaps when relevant
6. **Conflicts**: Flag any conflicts with existing content (empty array if none)
7. **IDs**: Use format \`{type}_{timestamp}_{5chars}\` for new node IDs

Output ONLY the JSON object, no markdown code blocks, no explanation.`;
}

/**
 * Generate a description for the entry point.
 */
function describeEntryPoint(entryPoint: GenerationEntryPoint): string {
  const targetInfo = entryPoint.targetData
    ? `\nDetails: ${JSON.stringify(entryPoint.targetData)}`
    : '';

  switch (entryPoint.type) {
    case 'beat':
      return `Generate content to realize structural beat: ${entryPoint.targetId}${targetInfo}`;

    case 'storyBeat':
      return `Generate scenes and supporting elements for StoryBeat: ${entryPoint.targetId}${targetInfo}`;

    case 'character':
      return `Generate story developments featuring Character: ${entryPoint.targetId}${targetInfo}`;

    case 'gap':
      return `Generate content to resolve gap: ${entryPoint.targetId}${targetInfo}`;

    case 'idea':
      return `Develop Idea into concrete story elements: ${entryPoint.targetId}${targetInfo}`;

    case 'naked':
    default:
      return `Analyze the story and generate highest-value additions. No specific target - use your judgment to identify what would most benefit the story.`;
  }
}
