/**
 * Interpretation prompt builder.
 *
 * Transforms freeform user input into structured proposals.
 */

import type { InterpretationParams } from '../types.js';

/**
 * Build the interpretation prompt for the LLM.
 *
 * The interpretation phase:
 * 1. Parses user input for narrative intent
 * 2. Determines appropriate node type
 * 3. Checks for related existing nodes
 * 4. Proposes structured output
 *
 * @param params - Interpretation parameters
 * @returns Complete prompt string
 */
export function buildInterpretationPrompt(
  params: InterpretationParams
): string {
  const { userInput, storyContext, recentNodes } = params;

  return `You are an AI assistant helping to develop a screenplay. Your task is to interpret the user's freeform input and propose appropriate structured changes to the story.

## Your Role

1. Parse the user's input for narrative intent
2. Determine what type of story element is being described
3. Check for existing nodes that relate to or match the input
4. Propose the most appropriate structured output
5. Explain your reasoning

## Available Node Types

- **Character**: A person or entity with agency in the story
- **Location**: A physical space where scenes can occur
- **Object**: A significant prop or item with narrative relevance
- **PlotPoint**: A narrative event that must happen (story causality)
- **Scene**: A unit of dramatic action (heading + overview)
- **Idea**: An unassigned creative concept (use when uncertain)
- **Story Context addition**: Thematic/directional content (themes, constraints, motifs)

## Current Story State

${storyContext}

${recentNodes?.length ? `## Recently Modified Nodes\n${recentNodes.join('\n')}` : ''}

## User Input

"${userInput}"

## Output Format

Respond with a JSON object matching this schema:

\`\`\`json
{
  "interpretation": {
    "summary": "What you understood from the input",
    "confidence": 0.85
  },
  "proposals": [
    {
      "type": "node",
      "operation": "add",
      "target_type": "Character",
      "data": {
        "name": "...",
        "description": "..."
      },
      "rationale": "Why this interpretation makes sense",
      "relates_to": ["existing_node_id"]
    }
  ],
  "alternatives": [
    {
      "summary": "Alternative interpretation",
      "confidence": 0.6
    }
  ]
}
\`\`\`

## Guidelines

- If the input clearly describes a concrete story element, propose a specific node type
- If the input is thematic or directional ("I want more tension"), propose Story Context addition
- If uncertain, propose an Idea node that can be promoted later
- Always explain your reasoning in the rationale
- Reference existing nodes when the input relates to them
- Confidence should reflect how certain you are about the interpretation

Respond with only the JSON object.`;
}
