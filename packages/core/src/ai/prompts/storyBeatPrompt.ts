/**
 * StoryBeat-specific prompt builder.
 *
 * Generates ONLY StoryBeat nodes to fill structural gaps (beats without alignment).
 * Strict constraints ensure no other node types are generated.
 */

import type { MissingBeatInfo } from '../../coverage/types.js';
import type { ExpansionScope } from '../types.js';
import {
  PROMPT_VERSION,
  JSON_OUTPUT_RULES,
  getCreativityLabel,
} from './shared.js';

// =============================================================================
// Types
// =============================================================================

export interface StoryBeatPromptParams {
  storyContext: string;
  existingStoryBeats: string;
  characters: string;
  missingBeats: MissingBeatInfo[];
  priorityBeats: string[];
  packageCount: number;
  maxStoryBeatsPerPackage: number;
  direction?: string;
  creativity: number;
  expansionScope?: ExpansionScope;
  targetAct?: 1 | 2 | 3 | 4 | 5;
  ideas?: string;
  guidelines?: string;
}

// =============================================================================
// Prompt Builder
// =============================================================================

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
    guidelines,
  } = params;

  const creativityLabel = getCreativityLabel(creativity);
  const isConstrained = expansionScope === 'constrained';

  const filteredMissingBeats = targetAct
    ? missingBeats.filter((b) => b.act === targetAct)
    : missingBeats;

  const missingBeatsText = formatMissingBeats(filteredMissingBeats);
  const priorityBeatsText = formatPriorityBeats(priorityBeats, filteredMissingBeats);

  return `## StoryBeat Generator v${PROMPT_VERSION}

Generate StoryBeat nodes to fill structural gaps.

## Rules
- PRIMARY: StoryBeat nodes only (no Scene/Character/Location/Object)
- Each StoryBeat MUST have ALIGNS_WITH edge to a Beat
- Optional PRECEDES edges for causal ordering between StoryBeats
${isConstrained ? '- No supporting content' : '- SUPPORTING: May include Character/Location nodes if essential'}
- Generate exactly ${packageCount} package(s)

## Edge Types
- ALIGNS_WITH: StoryBeat → Beat (REQUIRED)
- PRECEDES: StoryBeat → StoryBeat (optional)
${isConstrained ? '' : '- FEATURES_CHARACTER: StoryBeat → Character\n- LOCATED_AT: Scene → Location'}

## Story Context
${storyContext}

## Missing Beats${targetAct ? ` (Act ${targetAct})` : ''}
${missingBeatsText}
${priorityBeatsText}
## Existing StoryBeats
${existingStoryBeats || '[None]'}

## Characters (reference only)
${characters || '[None]'}
${direction ? `\n## Direction\n"${direction}"\n` : ''}${ideas ? `\n${ideas}` : ''}${guidelines ? `\n${guidelines}` : ''}
## Settings
Creativity: ${creativityLabel} (${creativity}) | Scope: ${expansionScope} | Max per pkg: ${maxStoryBeatsPerPackage}

## StoryBeat Schema
Required fields:
- title: Short evocative title
- summary: 2-3 sentences (what happens, who, why it matters)
- intent: "plot" | "character" | "tone"
- priority: "low" | "medium" | "high"
- stakes_change: "raise" | "lower" | "maintain"
- urgency: "low" | "medium" | "high"

## Output
${JSON_OUTPUT_RULES}

\`\`\`json
{"packages": [{
  "id": "pkg_{ts}_{5char}",
  "title": "...",
  "rationale": "Why this fits the story",
  "confidence": 0.85,
  "style_tags": ["..."],
  "primary": {
    "type": "StoryBeat",
    "nodes": [{"operation": "add", "node_type": "StoryBeat", "node_id": "storybeat_{ts}_{5char}", "data": {"title": "...", "summary": "...", "intent": "plot", "priority": "high", "stakes_change": "raise", "urgency": "high"}}],
    "edges": [{"operation": "add", "edge_type": "ALIGNS_WITH", "from": "storybeat_{ts}_{5char}", "to": "beat_Midpoint"}]
  },${isConstrained ? '' : `
  "supporting": {"nodes": [], "edges": []},`}
  "impact": {"fulfills_gaps": [], "creates_gaps": [], "conflicts": []}
}]}
\`\`\`

Output JSON only. No markdown blocks or explanation.`;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatMissingBeats(missingBeats: MissingBeatInfo[]): string {
  if (missingBeats.length === 0) {
    return '[All beats aligned]';
  }
  return missingBeats
    .map((b) => `- ${b.beatId} (${formatBeatType(b.beatType)}, Act ${b.act}, pos ${b.position})`)
    .join('\n');
}

function formatPriorityBeats(priorityBeats: string[], missingBeats: MissingBeatInfo[]): string {
  if (priorityBeats.length === 0) return '';

  const matched = priorityBeats.map((p) => {
    const beat = missingBeats.find((mb) => mb.beatId === p || mb.beatType === p);
    return beat ? `- ${beat.beatId} (${formatBeatType(beat.beatType)})` : `- ${p}`;
  });

  return `\n## Priority Beats (address if possible)\n${matched.join('\n')}\n`;
}

function formatBeatType(beatType: string): string {
  return beatType.replace(/([A-Z])/g, ' $1').trim();
}
