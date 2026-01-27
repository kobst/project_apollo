/**
 * Refinement prompt builder.
 *
 * Generates variations of a selected package based on user constraints.
 */

import type { RefinementParams, NarrativePackage } from '../types.js';
import { getDepthBudget } from '../config.js';

/**
 * Build the refinement prompt for the LLM.
 *
 * The refinement phase:
 * 1. Understands the base package being refined
 * 2. Preserves elements marked as "keep"
 * 3. Regenerates elements following user guidance
 * 4. Maintains coherence between kept and new elements
 * 5. Generates N meaningfully distinct variations
 *
 * @param params - Refinement parameters
 * @returns Complete prompt string
 */
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

  // Build ideas section if provided
  const ideasSection = ideas ? `\n${ideas}\n` : '';
  // Build guidelines section if provided
  const guidelinesSection = guidelines ? `\n${guidelines}\n` : '';

  return `You are an AI assistant helping to develop a screenplay. Your task is to generate ${count} variations of an existing narrative package based on user feedback.

## Your Role

1. Understand the base package being refined
2. Preserve elements marked as "keep"
3. Regenerate elements marked for change, following user guidance
4. Maintain coherence between kept and new elements
5. Generate ${count} meaningfully distinct variations

## Base Package

**Title**: ${basePackage.title}
**Rationale**: ${basePackage.rationale}

### Current Changes

${formatPackageChanges(basePackage)}

## Refinement Instructions

### Elements to Keep Unchanged
${keepElements.length > 0 ? keepElements.map((id) => `- ${id}`).join('\n') : 'None specified'}

### Elements to Regenerate
${regenerateElements.length > 0 ? regenerateElements.map((id) => `- ${id}`).join('\n') : 'All non-kept elements'}

### User Guidance
"${guidance}"

## Current Story State

${storyContext}
${ideasSection}
${guidelinesSection}
## Budget

- **Depth**: ${depth}
- Maximum new nodes per variation: ${budget.maxNodes}
- Maximum total operations per variation: ${budget.maxOps}

## Output Format

Respond with a JSON object matching this schema:

\`\`\`json
{
  "packages": [
    {
      "id": "pkg_refined_12345",
      "title": "Variation title",
      "rationale": "How this variation addresses the feedback",
      "confidence": 0.85,
      "parent_package_id": "${basePackage.id}",
      "refinement_prompt": "${escapeForJson(guidance.slice(0, 100))}...",
      "style_tags": [...],
      "changes": { ... },
      "impact": { ... }
    }
  ]
}
\`\`\`

## Guidelines

1. **Preserve**: Keep elements must appear exactly as in the base package
2. **Interpret**: Apply the user guidance creatively but faithfully
3. **Variety**: Each variation should interpret the guidance differently
4. **Coherence**: New elements must work with kept elements
5. **Lineage**: Include parent_package_id and refinement_prompt

Respond with only the JSON object.`;
}

/**
 * Format a story context operation for display.
 */
function formatContextOperation(op: import('../types.js').StoryContextChangeOperation): string {
  switch (op.type) {
    case 'setConstitutionField':
      return `[set ${op.field}]: "${op.value}"`;
    case 'addThematicPillar':
      return `[add pillar]: "${op.pillar}"`;
    case 'removeThematicPillar':
      return `[remove pillar at index ${op.index}]`;
    case 'setThematicPillars':
      return `[set pillars]: ${op.pillars.join(', ')}`;
    case 'addBanned':
      return `[add banned]: "${op.item}"`;
    case 'removeBanned':
      return `[remove banned at index ${op.index}]`;
    case 'setBanned':
      return `[set banned]: ${op.banned.join(', ')}`;
    case 'addHardRule':
      return `[add rule ${op.rule.id}]: "${op.rule.text}"`;
    case 'updateHardRule':
      return `[update rule ${op.id}]: "${op.text}"`;
    case 'removeHardRule':
      return `[remove rule ${op.id}]`;
    case 'addGuideline':
      return `[add guideline ${op.guideline.id}]: [${op.guideline.tags.join(',')}] "${op.guideline.text}"`;
    case 'updateGuideline':
      return `[update guideline ${op.id}]: ${JSON.stringify(op.changes)}`;
    case 'removeGuideline':
      return `[remove guideline ${op.id}]`;
    case 'setWorkingNotes':
      return `[set working notes]: "${op.content.slice(0, 50)}..."`;
    default:
      return `[unknown operation]`;
  }
}

/**
 * Format package changes for display in the prompt.
 */
function formatPackageChanges(pkg: NarrativePackage): string {
  const lines: string[] = [];

  if (pkg.changes.storyContext?.length) {
    lines.push('**Story Context Changes:**');
    for (const change of pkg.changes.storyContext) {
      lines.push(`- ${formatContextOperation(change.operation)}`);
    }
  }

  if (pkg.changes.nodes.length) {
    lines.push('\n**Node Changes:**');
    for (const change of pkg.changes.nodes) {
      const data = change.data as Record<string, unknown> | undefined;
      const label = data?.name ?? data?.title ?? change.node_id;
      lines.push(
        `- [${change.operation}] ${change.node_type}: ${label} (${change.node_id})`
      );
    }
  }

  if (pkg.changes.edges.length) {
    lines.push('\n**Edge Changes:**');
    for (const edge of pkg.changes.edges) {
      lines.push(
        `- [${edge.operation}] ${edge.from} -[${edge.edge_type}]-> ${edge.to}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Escape a string for safe inclusion in JSON.
 */
function escapeForJson(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
