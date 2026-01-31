/**
 * Interpretation prompt builder.
 * Transforms freeform user input into structured proposals.
 */

import type { InterpretationParams } from '../types.js';
import { PROMPT_VERSION, JSON_OUTPUT_RULES } from './shared.js';

export function buildInterpretationPrompt(params: InterpretationParams): string {
  const { userInput, storyContext, recentNodes, ideas, guidelines } = params;

  return `## Interpretation v${PROMPT_VERSION}

Parse user input and propose structured story changes.

## Node Types
- Character: person/entity with agency
- Location: physical space for scenes
- Object: significant prop or item
- StoryBeat: narrative event (story causality)
- Scene: dramatic action unit (heading + overview)
- Idea: unassigned concept (use when uncertain)
- Story Context: thematic/directional content

## Story State
${storyContext}
${recentNodes?.length ? `\n## Recent Nodes\n${recentNodes.join('\n')}` : ''}
${ideas ? `\n${ideas}` : ''}${guidelines ? `\n${guidelines}` : ''}

## User Input
"${userInput}"

## Output
${JSON_OUTPUT_RULES}

\`\`\`json
{
  "interpretation": {"summary": "What you understood", "confidence": 0.85},
  "proposals": [{
    "type": "node",
    "operation": "add",
    "target_type": "Character",
    "data": {"name": "...", "description": "..."},
    "rationale": "Why this interpretation fits",
    "relates_to": ["existing_node_id"]
  }],
  "alternatives": [{"summary": "Alternative interpretation", "confidence": 0.6}]
}
\`\`\`

Rules:
- Concrete element → specific node type
- Thematic/directional → Story Context addition  
- Uncertain → Idea node (can be promoted later)
- Reference existing nodes when related
- Confidence reflects certainty

Output JSON only.`;
}
