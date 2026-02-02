import type { Idea } from '../../types/nodes.js';

export function buildIdeaRefinementPrompt(params: {
  idea: Idea;
  guidance: string;
  storyContext: string;
  relatedIdeas: Idea[];
  constraints: Idea[];
}): string {
  const { idea, guidance, storyContext, relatedIdeas, constraints } = params;

  const constraintLines = constraints.length
    ? `\n## Constraints (must respect)\n${constraints
        .map((c) => `- ${c.title}: ${c.description}`)
        .join('\n')}\n`
    : '';

  const relatedLines = relatedIdeas.length
    ? `\n## Related Ideas\n${relatedIdeas
        .map((i) => `- ${i.title}: ${i.description.slice(0, 100)}`)
        .join('\n')}\n`
    : '';

  return `## Idea Refinement v1.0.0

Refine this planning idea based on user guidance.

## Original Idea
**Kind:** ${idea.kind || 'proposal'}
**Title:** ${idea.title}
**Description:** ${idea.description}
${idea.resolution ? `**Current Resolution:** ${idea.resolution}` : ''}

## User Guidance
"${guidance}"

## Story Context
${storyContext}
${constraintLines}${relatedLines}
## Your Task

Based on the guidance, generate 2-3 refined variants of this idea:

1. **If QUESTION:** Provide more specific sub-questions OR suggest resolution OR clarify intent
2. **If DIRECTION:** Make more specific and actionable OR suggest concrete StoryBeats
3. **If CONSTRAINT:** Clarify boundaries OR add concrete examples

## Output Format

\`\`\`json
{
  "variants": [
    {
      "id": "idea_refined_{timestamp}_{chars}",
      "kind": "question" | "direction" | "constraint" | "note",
      "title": "Refined title",
      "description": "More specific description incorporating guidance",
      "resolution": "If question, suggested answer",
      "confidence": 0.0,
      "suggestedArtifacts": [
        {
          "type": "StoryBeat" | "Scene",
          "title": "...",
          "summary": "...",
          "rationale": "Why this realizes the idea"
        }
      ]
    }
  ]
}
\`\`\`

Each variant should incorporate the user's guidance and move toward either:
- A clearer question with possible resolution
- A more specific, actionable direction
- Concrete artifacts that realize the idea

Output JSON only.`;
}

