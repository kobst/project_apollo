/**
 * Scene-specific prompt builder.
 * Generates Scene nodes linked to StoryBeats via SATISFIED_BY edges.
 */

import type { ExpansionScope, ValidatedBeatInfo } from '../types.js';
import { PROMPT_VERSION, JSON_OUTPUT_RULES, getCreativityLabel } from './shared.js';

// =============================================================================
// Types
// =============================================================================

export interface ScenePromptParams {
  storyContext: string;
  validatedBeats: ValidatedBeatInfo[];
  existingCharacters: string;
  existingLocations: string;
  existingScenes: string;
  scenesPerBeat: number;
  packageCount: number;
  maxScenesPerPackage: number;
  direction?: string;
  creativity: number;
  expansionScope?: ExpansionScope;
  ideas?: string;
  guidelines?: string;
}

// =============================================================================
// Prompt Builder
// =============================================================================

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

  const creativityLabel = getCreativityLabel(creativity);
  const isConstrained = expansionScope === 'constrained';
  const beatsSection = formatValidatedBeats(validatedBeats);

  return `## Scene Generator v${PROMPT_VERSION}

Generate Scene nodes for StoryBeats.

## Rules
- PRIMARY: Scene nodes only
- Each Scene MUST have SATISFIED_BY edge to a StoryBeat
- Use HAS_CHARACTER edges to existing Characters
- Use LOCATED_AT edges to existing Locations
${isConstrained ? '- No supporting content - use only existing nodes' : '- SUPPORTING: May create Character/Location/Object nodes'}
- Generate exactly ${packageCount} package(s)

## Edge Types
- SATISFIED_BY: Scene → StoryBeat (REQUIRED)
- HAS_CHARACTER: Scene → Character
- LOCATED_AT: Scene → Location
- FEATURES_OBJECT: Scene → Object

## Story Context
${storyContext}

## StoryBeats to Generate Scenes For
${beatsSection}

## Existing Characters (for HAS_CHARACTER)
${existingCharacters || '[None - create supporting if needed]'}

## Existing Locations (for LOCATED_AT)
${existingLocations || '[None - create supporting if needed]'}

## Existing Scenes (context)
${existingScenes || '[None]'}
${direction ? `\n## Direction\n"${direction}"\n` : ''}${ideas ? `\n${ideas}` : ''}${guidelines ? `\n${guidelines}` : ''}
## Settings
Creativity: ${creativityLabel} (${creativity}) | Scope: ${expansionScope} | Scenes/beat: ${scenesPerBeat} | Max/pkg: ${maxScenesPerPackage}

## Scene Schema
- heading: Screenplay format (e.g., "INT. OFFICE - DAY")
- scene_overview: 2-3 sentences of what happens
- goal, conflict, outcome: optional

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
    "type": "Scene",
    "nodes": [{"operation": "add", "node_type": "Scene", "node_id": "scene_{ts}_{5char}", "data": {"heading": "INT. LOCATION - TIME", "scene_overview": "...", "goal": "...", "conflict": "...", "outcome": "..."}}],
    "edges": [
      {"operation": "add", "edge_type": "SATISFIED_BY", "from": "scene_{ts}_{5char}", "to": "storybeat_xxx"},
      {"operation": "add", "edge_type": "HAS_CHARACTER", "from": "scene_{ts}_{5char}", "to": "char_xxx"},
      {"operation": "add", "edge_type": "LOCATED_AT", "from": "scene_{ts}_{5char}", "to": "loc_xxx"}
    ]
  },${isConstrained ? '' : `
  "supporting": {"nodes": [], "edges": []},`}
}]}
\`\`\`

Output JSON only. No markdown blocks or explanation.`;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatValidatedBeats(beats: ValidatedBeatInfo[]): string {
  if (beats.length === 0) return '[No StoryBeats to generate scenes for]';
  return beats.map((b) => `- ${b.storyBeatId}: "${b.title}" (→ ${b.alignedTo})`).join('\n');
}
