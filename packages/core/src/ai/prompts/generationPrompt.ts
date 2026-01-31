/**
 * Generation prompt builder.
 * Generates N complete narrative packages from an entry point.
 */

import type { GenerationParams, GenerationEntryPoint } from '../types.js';
import { getDepthBudget } from '../config.js';
import { PROMPT_VERSION, JSON_OUTPUT_RULES } from './shared.js';

export function buildGenerationPrompt(params: GenerationParams): string {
  const { entryPoint, storyContext, gaps, direction, depth, count, ideas, guidelines } = params;
  const budget = getDepthBudget(depth);
  const entryDescription = describeEntryPoint(entryPoint);

  return `## Package Generator v${PROMPT_VERSION}

Generate exactly ${count} complete narrative packages from the entry point.

## Entry Point
${entryDescription}

## Story State
${storyContext}

## Open Gaps
${gaps}
${ideas ? `\n${ideas}` : ''}${guidelines ? `\n${guidelines}` : ''}${direction ? `\n## Direction\n"${direction}"\n` : ''}
## Budget
Depth: ${depth} | Max nodes/pkg: ${budget.maxNodes} | Max ops/pkg: ${budget.maxOps}

## Node Types
- Character: name, description, archetype, traits[]
- Location: name, description, parent_location_id
- Object: name, description
- StoryBeat: title, summary, intent (plot|character|tone), priority, stakes_change
- Scene: heading, scene_overview, order_index, mood, key_actions[]

## Edge Types (use ONLY these)
- HAS_CHARACTER: Scene → Character
- LOCATED_AT: Scene → Location
- FEATURES_OBJECT: Scene → Object
- ALIGNS_WITH: StoryBeat → Beat
- SATISFIED_BY: StoryBeat → Scene
- PRECEDES: StoryBeat → StoryBeat
- ADVANCES: StoryBeat → CharacterArc

## Output
${JSON_OUTPUT_RULES}

\`\`\`json
{"packages": [{
  "id": "pkg_{ts}_{5char}",
  "title": "...",
  "rationale": "Why this fits",
  "confidence": 0.85,
  "style_tags": ["..."],
  "changes": {
    "storyContext": [{"operation": {"type": "addThematicPillar", "pillar": "..."}}],
    "nodes": [{"operation": "add", "node_type": "Character", "node_id": "char_{ts}_{5char}", "data": {"name": "...", "description": "..."}}],
    "edges": [{"operation": "add", "edge_type": "HAS_CHARACTER", "from": "scene_xxx", "to": "char_{ts}_{5char}"}]
  },
  "impact": {"fulfills_gaps": [], "creates_gaps": [], "conflicts": []}
}]}
\`\`\`

Rules:
1. Generate EXACTLY ${count} packages
2. Each package takes a different approach
3. Include all supporting elements needed
4. Respect story themes and constraints
5. IDs: \`{type}_{timestamp}_{5chars}\`

Output JSON only. No markdown blocks or explanation.`;
}

function describeEntryPoint(entryPoint: GenerationEntryPoint): string {
  const targetInfo = entryPoint.targetData ? `\nDetails: ${JSON.stringify(entryPoint.targetData)}` : '';

  switch (entryPoint.type) {
    case 'beat': return `Realize structural beat: ${entryPoint.targetId}${targetInfo}`;
    case 'storyBeat': return `Generate scenes for StoryBeat: ${entryPoint.targetId}${targetInfo}`;
    case 'character': return `Develop story for Character: ${entryPoint.targetId}${targetInfo}`;
    case 'gap': return `Resolve gap: ${entryPoint.targetId}${targetInfo}`;
    case 'idea': return `Develop Idea: ${entryPoint.targetId}${targetInfo}`;
    case 'naked':
    default: return `Analyze story and generate highest-value additions (no specific target)`;
  }
}
