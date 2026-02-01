/**
 * Critic Orchestrator
 *
 * Provides LLM-based narrative enrichment of deterministic impact results.
 * This is an on-demand enrichment layer — called after packages are generated
 * and their deterministic impact has been computed.
 */

import {
  ai,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadGraphById,
  loadVersionedStateById,
} from '../storage.js';
import {
  findPackageInSession,
  updatePackageInSession,
} from '../session.js';
import type { LLMClient } from './llmClient.js';

// =============================================================================
// Types
// =============================================================================

export interface EnrichImpactResponse {
  enrichment: ai.ImpactEnrichment;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Enrich a package's deterministic impact with LLM-generated narrative analysis.
 */
export async function enrichPackageImpact(
  storyId: string,
  packageId: string,
  ctx: StorageContext,
  llmClient: LLMClient,
): Promise<EnrichImpactResponse> {
  // 1. Load graph and package
  const graph = await loadGraphById(storyId, ctx);
  if (!graph) {
    throw new Error(`Story "${storyId}" not found`);
  }

  const pkg = await findPackageInSession(storyId, packageId, ctx);
  if (!pkg) {
    throw new Error(`Package "${packageId}" not found in session for story "${storyId}"`);
  }

  // 2. Serialize story context
  const state = await loadVersionedStateById(storyId, ctx);
  const metadata: ai.StoryMetadata = {};
  if (state?.metadata?.name) metadata.name = state.metadata.name;
  const storyContext = ai.serializeStoryState(graph, metadata);

  // 3. Build package summary for prompt
  const packageSummary = serializePackageSummary(pkg);

  // 4. Get deterministic impact descriptions
  const fulfillsDescriptions = pkg.impact.fulfills_gaps;
  const createsDescriptions = pkg.impact.creates_gaps;

  // 5. Build critic prompt
  const prompt = ai.buildCriticPrompt({
    storyContext,
    packageSummary,
    fulfillsDescriptions,
    createsDescriptions,
  });

  // 6. Call LLM (non-streaming)
  const response = await llmClient.complete(prompt);

  // 7. Parse JSON response
  const enrichment = parseEnrichmentResponse(response.content, fulfillsDescriptions, createsDescriptions);

  // 8. Persist enrichment on the package in the session
  const updatedPkg: ai.NarrativePackage = { ...pkg, enrichment };
  await updatePackageInSession(storyId, packageId, updatedPkg, ctx);

  return { enrichment };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Serialize a package into a compact summary for the critic prompt.
 */
function serializePackageSummary(pkg: ai.NarrativePackage): string {
  const lines: string[] = [];
  lines.push(`Title: ${pkg.title}`);
  lines.push(`Rationale: ${pkg.rationale}`);
  lines.push(`Confidence: ${pkg.confidence}`);
  if (pkg.style_tags.length > 0) {
    lines.push(`Tags: ${pkg.style_tags.join(', ')}`);
  }

  lines.push('');
  lines.push('Nodes:');
  for (const node of pkg.changes.nodes) {
    const data = (node.data ?? {}) as Record<string, unknown>;
    const name = data.name ?? data.title ?? data.heading ?? node.node_id;
    lines.push(`  ${node.operation} ${node.node_type}: ${name}`);
  }

  lines.push('');
  lines.push('Edges:');
  for (const edge of pkg.changes.edges) {
    lines.push(`  ${edge.operation} ${edge.edge_type}: ${edge.from} → ${edge.to}`);
  }

  return lines.join('\n');
}

/**
 * Parse the LLM's enrichment response JSON.
 */
function parseEnrichmentResponse(
  content: string,
  fulfillsDescriptions: string[],
  createsDescriptions: string[],
): ai.ImpactEnrichment {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr) as {
      fulfills?: Array<{ description: string; narrative: string }>;
      creates?: Array<{ description: string; narrative: string }>;
      thematic_analysis?: string;
    };

    // Ensure arrays match the deterministic descriptions
    const fulfills = (parsed.fulfills ?? []).slice(0, fulfillsDescriptions.length);
    const creates = (parsed.creates ?? []).slice(0, createsDescriptions.length);

    return {
      fulfills,
      creates,
      thematic_analysis: parsed.thematic_analysis ?? '',
    };
  } catch {
    // Fallback: return empty enrichment if parsing fails
    return {
      fulfills: fulfillsDescriptions.map(d => ({ description: d, narrative: '' })),
      creates: createsDescriptions.map(d => ({ description: d, narrative: '' })),
      thematic_analysis: '',
    };
  }
}
