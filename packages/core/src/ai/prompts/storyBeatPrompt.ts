/**
 * PlotPoint-specific prompt builder.
 *
 * Generates ONLY PlotPoint nodes to fill structural gaps (beats without alignment).
 * Strict constraints ensure no other node types are generated.
 */

import type { MissingBeatInfo } from '../../coverage/types.js';
import type { ExpansionScope } from '../types.js';
import {
  PROMPT_VERSION,
  JSON_OUTPUT_RULES,
  getCreativityLabel,
  getProblemStatementSection,
} from './shared.js';

// =============================================================================
// Types
// =============================================================================

export interface PlotPointPromptParams {
  storyContext: string;
  existingPlotPoints: string;
  characters: string;
  missingBeats: MissingBeatInfo[];
  priorityBeats: string[];
  packageCount: number;
  maxPlotPointsPerPackage: number;
  direction?: string;
  creativity: number;
  expansionScope?: ExpansionScope;
  targetAct?: 1 | 2 | 3 | 4 | 5;
  ideas?: string;
  guidelines?: string;
  /** Optional problem statement describing what narrative problem to solve */
  problemStatement?: string;
}

// =============================================================================
// Prompt Builder
// =============================================================================

export function buildPlotPointPrompt(params: PlotPointPromptParams): string {
  const {
    storyContext,
    existingPlotPoints,
    characters,
    missingBeats,
    priorityBeats,
    packageCount,
    maxPlotPointsPerPackage,
    direction,
    creativity,
    expansionScope = 'flexible',
    targetAct,
    ideas,
    guidelines,
    problemStatement,
  } = params;

  const creativityLabel = getCreativityLabel(creativity);
  const isConstrained = expansionScope === 'constrained';

  const filteredMissingBeats = targetAct
    ? missingBeats.filter((b) => b.act === targetAct)
    : missingBeats;

  const missingBeatsText = formatMissingBeats(filteredMissingBeats);
  const priorityBeatsText = formatPriorityBeats(priorityBeats, filteredMissingBeats);

  return `## PlotPoint Generator v${PROMPT_VERSION}

Generate PlotPoint nodes to fill structural gaps.
${getProblemStatementSection(problemStatement)}

## Rules
- PRIMARY: PlotPoint nodes only (no Scene/Character/Location/Object)
- Each PlotPoint MUST include an \`alignedBeatId\` field in its data, referencing a Beat node ID
- Optional PRECEDES edges for causal ordering between PlotPoints
${isConstrained ? '- No supporting content' : '- SUPPORTING: May include Character/Location nodes if essential'}
- Generate exactly ${packageCount} package(s)

## Edge Types
- PRECEDES: PlotPoint → PlotPoint (optional)
${isConstrained ? '' : '- FEATURES_CHARACTER: PlotPoint → Character\n- LOCATED_AT: Scene → Location'}

## Story Context
${storyContext}

## Missing Beats${targetAct ? ` (Act ${targetAct})` : ''}
${missingBeatsText}
${priorityBeatsText}
## Existing PlotPoints
${existingPlotPoints || '[None]'}

## Characters (reference only)
${characters || '[None]'}
${direction ? `\n## Direction\n"${direction}"\n` : ''}${ideas ? `\n${ideas}` : ''}${guidelines ? `\n${guidelines}` : ''}
## Abstraction Guidance
- CRITICAL: PlotPoints are ABSTRACT narrative functions, NOT scene descriptions.
- Do describe narrative intent (what/why), emotional/stakes shift, and purpose.
- Do NOT include specific locations (no "INT./EXT."), dialogue, or concrete actions.
- Think "narrative intent" not "scene synopsis".

Examples:
- BAD (too specific): "At his Keys body shop, Cain breaks up a shakedown when an officer leans on a kid..."
- GOOD (abstract intent): "Establish Cain's personal code — he values honor over institutional authority; show skepticism toward badges."

## Settings
Creativity: ${creativityLabel} (${creativity}) | Scope: ${expansionScope} | Max per pkg: ${maxPlotPointsPerPackage}

## PlotPoint Schema
Required fields:
- title: Short evocative title
- summary: 2-3 sentences (what happens, who, why it matters)
- alignedBeatId: ID of the Beat this PlotPoint aligns with (e.g., "beat_Midpoint")
- narrative_function: "theme_establishment" | "character_introduction" | "character_development" | "plot_revelation" | "reversal" | "escalation" | "resolution" | "tone_setter"
- intent: "plot" | "character" | "tone"
- priority: "low" | "medium" | "high"
- stakes_change: "up" | "down" | "steady"
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
    "type": "PlotPoint",
    "nodes": [{"operation": "add", "node_type": "PlotPoint", "node_id": "plotpoint_{ts}_{5char}", "data": {"title": "...", "summary": "...", "alignedBeatId": "beat_Midpoint", "narrative_function": "theme_establishment", "intent": "plot", "priority": "high", "stakes_change": "up", "urgency": "high"}}],
    "edges": []
  },${isConstrained ? '' : `
  "supporting": {"nodes": [], "edges": []},`}
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
