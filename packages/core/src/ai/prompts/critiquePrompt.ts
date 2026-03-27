/**
 * Critique prompt builder.
 *
 * Generates a prompt that asks the LLM to evaluate narrative packages
 * against story context, thematic pillars, and structural fit.
 * The critique helps the human make faster, better-informed decisions
 * about which package to accept.
 */

import { PROMPT_VERSION, JSON_OUTPUT_RULES } from './shared.js';
import type { ImpactDiff } from '../../coverage/impactDiff.js';

// =============================================================================
// Types
// =============================================================================

export interface CritiquePackageSummary {
  id: string;
  title: string;
  rationale: string;
  /** Serialized summary of nodes in this package */
  nodesSummary: string;
  /** Impact diff from Stage 1 (if available) */
  impactDiff?: ImpactDiff;
}

export interface CritiqueParams {
  /** Packages to critique */
  packages: CritiquePackageSummary[];
  /** Serialized story context (constitution + operational) */
  storyContext: string;
  /** Current coverage summary (human-readable) */
  coverageSummary: string;
}

// =============================================================================
// Prompt Builder
// =============================================================================

export function buildCritiquePrompt(params: CritiqueParams): string {
  const { packages, storyContext, coverageSummary } = params;

  const packagesSection = packages.map((pkg, i) => {
    let section = `### Package ${i + 1}: "${pkg.title}" (${pkg.id})
Rationale: ${pkg.rationale}

Content:
${pkg.nodesSummary}`;

    if (pkg.impactDiff) {
      const discharged = pkg.impactDiff.dischargedGaps.length;
      const introduced = pkg.impactDiff.introducedGaps.length;
      const tierChanges = pkg.impactDiff.tierChanges
        .filter(t => t.delta !== 0)
        .map(t => `${t.label}: ${t.before.toFixed(0)}% → ${t.after.toFixed(0)}%`)
        .join(', ');

      section += `\n\nImpact: Resolves ${discharged} gap(s), introduces ${introduced} new gap(s).`;
      if (tierChanges) {
        section += ` Coverage changes: ${tierChanges}.`;
      }
      if (pkg.impactDiff.dischargedGaps.length > 0) {
        section += `\nResolves: ${pkg.impactDiff.dischargedGaps.map(g => g.title).join(', ')}`;
      }
      if (pkg.impactDiff.introducedGaps.length > 0) {
        section += `\nIntroduces: ${pkg.impactDiff.introducedGaps.map(g => g.title).join(', ')}`;
      }
    }

    return section;
  }).join('\n\n---\n\n');

  return `## Package Critic v${PROMPT_VERSION}

Evaluate the following narrative packages. For each package, assess:
1. **Strengths** — what it does well narratively, structurally, thematically
2. **Weaknesses** — potential problems, missed opportunities, risks
3. **Thematic fit** — how well it aligns with the story's thematic pillars and tone
4. **Structural risks** — continuity issues, pacing problems, dependency gaps, unresolved setups
5. **Tradeoff profile** — a single sentence summarizing the core tradeoff of choosing this package

Be specific and concrete. Reference actual elements from the packages and story context.
Do NOT restate what the package contains — the human can read that. Instead, surface insights they might miss.

## Story Context
${storyContext}

## Current Coverage
${coverageSummary}

## Packages to Evaluate

${packagesSection}

## Output
${JSON_OUTPUT_RULES}

\`\`\`json
[{
  "packageId": "pkg_xxx",
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1"],
  "thematicFit": "strong" | "moderate" | "weak",
  "structuralRisks": ["specific risk 1"],
  "tradeoffProfile": "One sentence summarizing the core tradeoff."
}]
\`\`\`

Output a JSON array with one critique object per package. Match packages by ID.
Output JSON only. No markdown blocks or explanation.`;
}
