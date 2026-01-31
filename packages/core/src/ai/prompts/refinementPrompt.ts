/**
 * Refinement prompt builder.
 * Generates variations of a selected package based on user constraints.
 */

import type { RefinementParams, NarrativePackage, StoryContextChangeOperation } from '../types.js';
import { getDepthBudget } from '../config.js';
import { PROMPT_VERSION, JSON_OUTPUT_RULES } from './shared.js';

export function buildRefinementPrompt(params: RefinementParams): string {
  const {
    basePackage,
    keepElements,
    regenerateElements,
    guidance,
    storyContext,
    depth,
    count,
    ideas,
    guidelines,
  } = params;
  const budget = getDepthBudget(depth);

  return `## Refinement Generator v${PROMPT_VERSION}

Generate ${count} variations of an existing package based on feedback.

## Base Package
**Title**: ${basePackage.title}
**Rationale**: ${basePackage.rationale}

### Current Changes
${formatPackageChanges(basePackage)}

## Instructions
- Keep: ${keepElements.length > 0 ? keepElements.join(', ') : 'None specified'}
- Regenerate: ${regenerateElements.length > 0 ? regenerateElements.join(', ') : 'All non-kept elements'}
- Guidance: "${guidance}"

## Story State
${storyContext}
${ideas ? `\n${ideas}` : ''}${guidelines ? `\n${guidelines}` : ''}

## Budget
Depth: ${depth} | Max nodes: ${budget.maxNodes} | Max ops: ${budget.maxOps}

## Output
${JSON_OUTPUT_RULES}

\`\`\`json
{"packages": [{
  "id": "pkg_refined_{ts}",
  "title": "Variation title",
  "rationale": "How this addresses the feedback",
  "confidence": 0.85,
  "parent_package_id": "${basePackage.id}",
  "refinement_prompt": "${escapeForJson(guidance.slice(0, 100))}...",
  "style_tags": ["..."],
  "changes": {...},
  "impact": {"fulfills_gaps": [], "creates_gaps": [], "conflicts": []}
}]}
\`\`\`

Rules:
1. Keep elements appear exactly as in base package
2. Apply guidance creatively but faithfully
3. Each variation interprets guidance differently
4. Include parent_package_id and refinement_prompt

Output JSON only.`;
}

function formatContextOperation(op: StoryContextChangeOperation): string {
  switch (op.type) {
    case 'setConstitutionField': return `[set ${op.field}]: "${op.value}"`;
    case 'addThematicPillar': return `[add pillar]: "${op.pillar}"`;
    case 'removeThematicPillar': return `[remove pillar ${op.index}]`;
    case 'setThematicPillars': return `[set pillars]: ${op.pillars.join(', ')}`;
    case 'addBanned': return `[add banned]: "${op.item}"`;
    case 'removeBanned': return `[remove banned ${op.index}]`;
    case 'setBanned': return `[set banned]: ${op.banned.join(', ')}`;
    case 'addHardRule': return `[add rule ${op.rule.id}]: "${op.rule.text}"`;
    case 'updateHardRule': return `[update rule ${op.id}]: "${op.text}"`;
    case 'removeHardRule': return `[remove rule ${op.id}]`;
    case 'addGuideline': return `[add guideline ${op.guideline.id}]: "${op.guideline.text}"`;
    case 'updateGuideline': return `[update guideline ${op.id}]`;
    case 'removeGuideline': return `[remove guideline ${op.id}]`;
    case 'setWorkingNotes': return `[set notes]: "${op.content.slice(0, 50)}..."`;
    default: return `[unknown op]`;
  }
}

function formatPackageChanges(pkg: NarrativePackage): string {
  const lines: string[] = [];

  if (pkg.changes.storyContext?.length) {
    lines.push('**Context:**');
    pkg.changes.storyContext.forEach((c) => lines.push(`- ${formatContextOperation(c.operation)}`));
  }

  if (pkg.changes.nodes.length) {
    lines.push('**Nodes:**');
    pkg.changes.nodes.forEach((n) => {
      const label = (n.data as Record<string, unknown>)?.name ?? (n.data as Record<string, unknown>)?.title ?? n.node_id;
      lines.push(`- [${n.operation}] ${n.node_type}: ${label}`);
    });
  }

  if (pkg.changes.edges.length) {
    lines.push('**Edges:**');
    pkg.changes.edges.forEach((e) => lines.push(`- [${e.operation}] ${e.from} → ${e.to}`));
  }

  return lines.join('\n') || '[No changes]';
}

function escapeForJson(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}
