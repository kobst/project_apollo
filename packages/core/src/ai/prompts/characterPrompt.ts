/**
 * Character-specific prompt builder.
 * Generates Character nodes with optional CharacterArc nodes.
 */

import type { CharacterFocus, ExpansionScope } from '../types.js';
import { PROMPT_VERSION, JSON_OUTPUT_RULES, getCreativityLabel } from './shared.js';

// =============================================================================
// Types
// =============================================================================

export interface CharacterPromptParams {
  storyContext: string;
  existingCharacters: string;
  existingStoryBeats: string;
  focus: CharacterFocus;
  characterId?: string;
  characterData?: string;
  includeArcs: boolean;
  packageCount: number;
  maxCharactersPerPackage: number;
  direction?: string;
  creativity: number;
  expansionScope?: ExpansionScope;
  ideas?: string;
  guidelines?: string;
}

// =============================================================================
// Prompt Builder
// =============================================================================

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
    ideas,
    guidelines,
  } = params;

  const creativityLabel = getCreativityLabel(creativity);
  const isConstrained = expansionScope === 'constrained';
  const focusInstructions = getFocusInstructions(focus, characterId, characterData);

  return `## Character Generator v${PROMPT_VERSION}

Generate Character${includeArcs ? ' and CharacterArc' : ''} nodes.

## Rules
- PRIMARY: Character${includeArcs ? ' + CharacterArc' : ''} nodes only
- Each Character needs: name, archetype, description
${includeArcs ? '- Link arcs via HAS_ARC edge (Character → CharacterArc)' : ''}
${isConstrained ? '- No supporting content' : '- SUPPORTING: May include Location nodes'}
- Generate exactly ${packageCount} package(s)

## Edge Types
${includeArcs ? '- HAS_ARC: Character → CharacterArc' : '- None required for primary'}
${isConstrained ? '' : '- LOCATED_AT: Character → Location (supporting)'}

## Story Context
${storyContext}

${focusInstructions}
## Existing Characters
${existingCharacters || '[None]'}

## Story Beats (context)
${existingStoryBeats || '[None]'}
${direction ? `\n## Direction\n"${direction}"\n` : ''}${ideas ? `\n${ideas}` : ''}${guidelines ? `\n${guidelines}` : ''}
## Settings
Focus: ${formatFocus(focus)} | Creativity: ${creativityLabel} (${creativity}) | Scope: ${expansionScope} | Max/pkg: ${maxCharactersPerPackage} | Arcs: ${includeArcs ? 'yes' : 'no'}

## Character Schema
- name: Full name
- archetype: Protagonist | Antagonist | Mentor | Ally | Trickster | Guardian | Herald | Shadow | Shapeshifter
- description: 2-3 sentences
- role, motivation, flaw: optional
- status: "ACTIVE"
${includeArcs ? `
## CharacterArc Schema
- arc_type: growth | fall | flat | transformation
- starting_state, ending_state: Brief descriptions
- key_moments: Array of 2-4 pivotal moments` : ''}

## Output
${JSON_OUTPUT_RULES}

\`\`\`json
{"packages": [{
  "id": "pkg_{ts}_{5char}",
  "title": "...",
  "rationale": "Why this fits",
  "confidence": 0.85,
  "style_tags": ["..."],
  "primary": {
    "type": "Character",
    "nodes": [
      {"operation": "add", "node_type": "Character", "node_id": "char_{ts}_{5char}", "data": {"name": "...", "archetype": "Protagonist", "description": "...", "status": "ACTIVE"}}${includeArcs ? `,
      {"operation": "add", "node_type": "CharacterArc", "node_id": "arc_{ts}_{5char}", "data": {"arc_type": "growth", "starting_state": "...", "ending_state": "...", "key_moments": ["..."]}}` : ''}
    ],
    "edges": [${includeArcs ? '{"operation": "add", "edge_type": "HAS_ARC", "from": "char_{ts}_{5char}", "to": "arc_{ts}_{5char}"}' : ''}]
  },${isConstrained ? '' : `
  "supporting": {"nodes": [], "edges": []},`}
}]}
\`\`\`

Output JSON only. No markdown blocks or explanation.`;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getFocusInstructions(focus: CharacterFocus, characterId?: string, characterData?: string): string {
  const focusText: Record<CharacterFocus, string> = {
    develop_existing: `## Focus: Develop Existing Character
Target: ${characterId ?? 'Not specified'}
${characterData ? `Current data:\n${characterData}` : ''}
Add depth to background, motivations, relationships. Don't change core identity.`,

    new_protagonist: `## Focus: New Protagonist
Create main character with clear goals, motivations, flaws. Must drive central conflict.`,

    new_antagonist: `## Focus: New Antagonist
Create meaningful challenge to protagonist with understandable motivations. Vary approach.`,

    new_supporting: `## Focus: New Supporting Character
Create characters that serve specific roles (mentor, ally, foil) with own goals and depth.`,

    fill_gaps: `## Focus: Fill Character Gaps
Create characters to fill missing archetypes, balance cast, enable story beats.`,
  };

  return focusText[focus] ?? '## Focus: General Character Generation\nGenerate diverse, story-appropriate characters.';
}

function formatFocus(focus: CharacterFocus): string {
  const labels: Record<CharacterFocus, string> = {
    develop_existing: 'Develop Existing',
    new_protagonist: 'New Protagonist',
    new_antagonist: 'New Antagonist',
    new_supporting: 'New Supporting',
    fill_gaps: 'Fill Gaps',
  };
  return labels[focus] ?? focus;
}
