/**
 * Problem Statement Report — Manual review artifact.
 *
 * Loads neon-noir-graph.json, finds gaps via computeCoverage(),
 * converts each to a problem statement, and shows how it would
 * appear in a generation prompt.
 *
 * Run: npx tsx packages/core/tests/ai/problemStatement.report.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { computeCoverage } from '../../src/coverage/compute.js';
import { gapToStatement } from '../../src/coverage/gapToStatement.js';
import { getProblemStatementSection } from '../../src/ai/prompts/shared.js';
import type { GraphState } from '../../src/core/graph.js';
import type { Edge } from '../../src/types/edges.js';
import { normalizeEdge } from '../../src/types/edges.js';
import type { Gap } from '../../src/coverage/types.js';

// =============================================================================
// Load Graph
// =============================================================================

function loadNeonNoir(): GraphState {
  const filePath = path.resolve(
    import.meta.dirname ?? __dirname,
    '../../../../neon-noir-graph.json'
  );
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const nodes = new Map<string, any>();
  for (const n of raw.nodes) {
    nodes.set(n.id, n);
  }
  const edgesList: Edge[] = (raw.edges || []).map((e: any) => normalizeEdge(e));
  return { nodes, edges: edgesList };
}

// =============================================================================
// Main
// =============================================================================

function main() {
  console.log('Problem Statement Report');
  console.log('========================\n');

  const graph = loadNeonNoir();
  console.log(`Graph: ${graph.nodes.size} nodes, ${graph.edges.length} edges\n`);

  const coverage = computeCoverage(graph);
  console.log(`Coverage gaps: ${coverage.gaps.length} total\n`);

  // Group gaps by tier for readability
  const byTier = new Map<string, Gap[]>();
  for (const gap of coverage.gaps) {
    const existing = byTier.get(gap.tier) || [];
    existing.push(gap);
    byTier.set(gap.tier, existing);
  }

  // Show one representative gap per tier
  const shown = new Set<string>();
  const representative: Gap[] = [];

  for (const [tier, gaps] of byTier) {
    // Pick the first gap of each unique title pattern
    for (const gap of gaps) {
      const key = `${tier}:${gap.title.replace(/[^a-zA-Z]/g, '')}`;
      if (!shown.has(key)) {
        shown.add(key);
        representative.push(gap);
      }
    }
  }

  console.log(`Showing ${representative.length} unique gap types:\n`);
  console.log('='.repeat(70));

  for (const gap of representative) {
    const statement = gapToStatement(gap);
    const promptSection = getProblemStatementSection(statement);

    console.log(`\n  Gap: ${gap.title}`);
    console.log(`  Tier: ${gap.tier} | Type: ${gap.type}`);
    console.log(`  Description: ${gap.description}`);
    console.log(`\n  Problem Statement:`);
    console.log(`  "${statement}"`);
    console.log(`\n  Prompt Section:`);
    // Indent the prompt section for readability
    const indented = promptSection.split('\n').map(l => `    ${l}`).join('\n');
    console.log(indented);
    console.log('-'.repeat(70));
  }

  console.log('\n' + '='.repeat(70));
  console.log('  Report complete.');
  console.log('='.repeat(70));
}

main();
