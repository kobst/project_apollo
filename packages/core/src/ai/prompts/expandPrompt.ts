/**
 * Expand-specific prompt builder.
 * Generic node expansion: expands a node or story context into related content.
 */

import type { ExpansionScope, ExpandTarget, ContextSection } from '../types.js';
import { PROMPT_VERSION, JSON_OUTPUT_RULES, getCreativityLabel } from './shared.js';

// =============================================================================
// Types
// =============================================================================

export interface ExpandPromptParams {
  storyContext: string;
  target: ExpandTarget;
  targetNodeData?: string;
  targetNodeType?: string;
  depth: 'surface' | 'deep';
  packageCount: number;
  maxNodesPerPackage: number;
  direction?: string;
  creativity: number;
  expansionScope?: ExpansionScope;
  ideas?: string;
  guidelines?: string;
}

// =============================================================================
// Prompt Builder
// =============================================================================

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
    guidelines,
  } = params;

  const creativityLabel = getCreativityLabel(creativity);
  const isConstrained = expansionScope === 'constrained';
  const { expandType, targetInstructions, outputType } = getTargetInstructions(target, targetNodeType, targetNodeData);
  const outputSchema = getOutputSchema(expandType, isConstrained);

  return `## Expand Generator v${PROMPT_VERSION}

Expand and deepen story elements.

## Rules
- Generate content appropriate to expansion target
- Primary: ${outputType}
${isConstrained ? '- No supporting content' : '- SUPPORTING: May include related nodes'}
- Generate exactly ${packageCount} package(s)

## Edge Types (use ONLY these)
- HAS_CHARACTER: Scene → Character
- LOCATED_AT: Scene → Location
- FEATURES_OBJECT: Scene → Object
- ALIGNS_WITH: StoryBeat → Beat
- SATISFIED_BY: StoryBeat → Scene
- PRECEDES: StoryBeat → StoryBeat
- ADVANCES: StoryBeat → CharacterArc
- HAS_ARC: Character → CharacterArc

## Story Context
${storyContext}

${targetInstructions}
${direction ? `\n## Direction\n"${direction}"\n` : ''}${ideas ? `\n${ideas}` : ''}${guidelines ? `\n${guidelines}` : ''}
## Settings
Type: ${expandType} | Depth: ${depth} | Creativity: ${creativityLabel} (${creativity}) | Scope: ${expansionScope} | Max/pkg: ${maxNodesPerPackage}

## Node Types
- Character: name, description, archetype, traits[]
- Location: name, description
- Object: name, description
- StoryBeat: title, summary, intent, priority, stakes_change
- Scene: heading, scene_overview, mood, key_actions[]

## Output
${JSON_OUTPUT_RULES}

${outputSchema}

Output JSON only. No markdown blocks or explanation.`;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getTargetInstructions(target: ExpandTarget, nodeType?: string, nodeData?: string): { expandType: string; targetInstructions: string; outputType: string } {
  if (target.type === 'node') {
    const info = `Target: ${target.nodeId} (${nodeType ?? 'Unknown'})\n${nodeData ? `Data: ${nodeData}` : ''}`;
    
    const nodeExpansions: Record<string, { output: string; content: string }> = {
      Character: { output: 'Character-related (arcs, scenes)', content: 'CharacterArcs, relationships, scenes, locations' },
      StoryBeat: { output: 'Scenes and elements', content: 'Scenes realizing this beat, characters, locations' },
      Scene: { output: 'Scene elements', content: 'Characters, objects, connected scenes' },
      Location: { output: 'Location elements', content: 'Sub-locations, scenes, characters, objects' },
    };
    
    const exp = nodeExpansions[nodeType ?? ''] ?? { output: 'Related elements', content: 'Related content' };
    return {
      expandType: `${nodeType ?? 'Node'} Expansion`,
      targetInstructions: `## Target: ${nodeType ?? 'Node'}\n${info}\n\nGenerate: ${exp.content}`,
      outputType: exp.output,
    };
  }

  if (target.type === 'story-context') {
    return {
      expandType: 'Story Context',
      targetInstructions: `## Target: Story Context

Generate STRUCTURED OPERATIONS only:
- addThematicPillar: Core themes/tensions
- setConstitutionField: premise|genre|setting|toneEssence
- addHardRule: Rules AI must never violate (id + text)
- addGuideline: Soft guidelines (id + tags[] + text)
- addBanned: Elements to avoid

Do NOT use: addSection, addText (invalid)`,
      outputType: 'Context Operations',
    };
  }

  if (target.type === 'story-context-section') {
    const sectionContent: Record<ContextSection, string> = {
      themes: 'Core themes, sub-themes, thematic tensions',
      conflicts: 'Central conflicts, internal/external obstacles, escalation points',
      motifs: 'Recurring symbols, patterns, visual/narrative echoes',
      tone: 'Tonal shifts, atmosphere, emotional texture',
      constraints: 'Genre conventions, structural requirements, things to avoid',
    };
    return {
      expandType: `Context - ${target.section}`,
      targetInstructions: `## Target: Story Context (${target.section})\n\nGenerate: ${sectionContent[target.section]}`,
      outputType: `${target.section} additions`,
    };
  }

  return { expandType: 'Generic', targetInstructions: '## Target: Generic\nExpand as needed.', outputType: 'Mixed content' };
}

function getOutputSchema(expandType: string, isConstrained: boolean): string {
  if (expandType.includes('Story Context') || expandType.includes('Context -')) {
    return `\`\`\`json
{"packages": [{
  "id": "pkg_{ts}_{5char}",
  "title": "...",
  "rationale": "Why this fits",
  "confidence": 0.85,
  "style_tags": ["..."],
  "changes": {
    "storyContext": [
      {"operation": {"type": "addThematicPillar", "pillar": "..."}},
      {"operation": {"type": "addHardRule", "rule": {"id": "hr_{ts}_{5char}", "text": "..."}}},
      {"operation": {"type": "addGuideline", "guideline": {"id": "sg_{ts}_{5char}", "tags": ["character"], "text": "..."}}}
    ],
    "nodes": [],
    "edges": []
  },
  "impact": {"fulfills_gaps": [], "creates_gaps": [], "conflicts": []}
}]}
\`\`\`

Valid operation types: addThematicPillar, addHardRule, addGuideline, setConstitutionField, addBanned, setWorkingNotes`;
  }

  const supporting = isConstrained ? '' : `
  "supporting": {"nodes": [], "edges": []},`;
  
  return `\`\`\`json
{"packages": [{
  "id": "pkg_{ts}_{5char}",
  "title": "...",
  "rationale": "Why this fits",
  "confidence": 0.85,
  "style_tags": ["..."],
  "primary": {
    "type": "Mixed",
    "nodes": [{"operation": "add", "node_type": "Scene", "node_id": "scene_{ts}_{5char}", "data": {"heading": "INT. LOCATION - TIME", "scene_overview": "..."}}],
    "edges": [{"operation": "add", "edge_type": "HAS_CHARACTER", "from": "scene_{ts}_{5char}", "to": "char_xxx"}]
  },${supporting}
  "impact": {"fulfills_gaps": [], "creates_gaps": [], "conflicts": []}
}]}
\`\`\``;
}
