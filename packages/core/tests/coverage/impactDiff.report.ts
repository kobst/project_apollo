/**
 * Impact Diff Report — Manual review artifact.
 *
 * Loads neon-noir-graph.json, creates a realistic mock package that adds
 * a PlotPoint + Scene for an unrealized beat, runs computeImpactDiff(),
 * and prints a formatted report for human review.
 *
 * Run: npx tsx packages/core/tests/coverage/impactDiff.report.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { computeImpactDiff } from '../../src/coverage/impactDiff.js';
import { computeCoverage } from '../../src/coverage/compute.js';
import type { GraphState } from '../../src/core/graph.js';
import type { NarrativePackage } from '../../src/ai/types.js';
import type { Edge } from '../../src/types/edges.js';
import { normalizeEdge } from '../../src/types/edges.js';
import type { ImpactDiff } from '../../src/coverage/impactDiff.js';

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
// Mock Packages
// =============================================================================

function makePackage(
  id: string,
  title: string,
  nodes: NarrativePackage['changes']['nodes'],
  edges: NarrativePackage['changes']['edges'] = []
): NarrativePackage {
  return {
    id,
    title,
    rationale: 'Test package for impact diffing',
    confidence: 0.85,
    style_tags: ['test'],
    changes: { nodes, edges },
    impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
  };
}

// Package 1: Add PlotPoint + Scene for Catalyst beat (unrealized)
function createCatalystPackage(): NarrativePackage {
  return makePackage(
    'pkg_catalyst_test',
    'Catalyst: Discovery of the Hidden Signal',
    [
      {
        operation: 'add',
        node_type: 'PlotPoint',
        node_id: 'pp_catalyst_reveal',
        data: {
          title: 'Discovery of the hidden signal',
          summary: 'Max stumbles onto encrypted data streams that reveal a pattern connecting the missing informants.',
          alignedBeatId: 'beat_Catalyst',
          status: 'approved',
          intent: 'plot',
          act: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      {
        operation: 'add',
        node_type: 'Scene',
        node_id: 'scene_catalyst_lab',
        data: {
          heading: 'INT. UNDERGROUND DATA CENTER - NIGHT',
          scene_overview: 'Max hacks into an abandoned server farm beneath Chinatown, discovering encrypted transmissions that connect three missing corporate informants to a single AI entity. The data suggests the informants were not kidnapped — they volunteered to be digitized.',
          mood: 'tense, revelatory',
          key_actions: ['Max decrypts data streams', 'Discovers pattern linking missing persons', 'Realizes informants went willingly'],
        },
      },
      {
        operation: 'add',
        node_type: 'Character',
        node_id: 'char_ghost',
        data: {
          name: 'Ghost',
          description: 'A rogue AI fragment that communicates through corrupted data packets. Neither fully sentient nor fully programmed.',
        },
      },
    ],
    [
      { operation: 'add', edge_type: 'REALIZED_BY', from: 'pp_catalyst_reveal', to: 'scene_catalyst_lab', properties: { order: 1 } },
      { operation: 'add', edge_type: 'HAS_CHARACTER', from: 'scene_catalyst_lab', to: 'char_ghost' },
    ]
  );
}

// Package 2: Add bare Scene with no characters (should introduce gaps)
function createBareScenePackage(): NarrativePackage {
  return makePackage(
    'pkg_bare_scene',
    'Debate: Empty Rooftop Contemplation',
    [
      {
        operation: 'add',
        node_type: 'PlotPoint',
        node_id: 'pp_debate_empty',
        data: {
          title: 'Protagonist weighs the cost of pursuing the truth',
          summary: 'A moment of hesitation as the stakes become clear.',
          alignedBeatId: 'beat_Debate',
          status: 'approved',
          intent: 'character',
          act: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      {
        operation: 'add',
        node_type: 'Scene',
        node_id: 'scene_debate_roof',
        data: {
          heading: 'EXT. ROOFTOP - DAWN',
          scene_overview: 'The protagonist stands alone on a rain-slicked rooftop, looking out over the neon-lit city, weighing whether to pursue the dangerous truth or walk away.',
        },
      },
    ],
    [
      { operation: 'add', edge_type: 'REALIZED_BY', from: 'pp_debate_empty', to: 'scene_debate_roof', properties: { order: 1 } },
      // No HAS_CHARACTER or LOCATED_AT — intentionally bare
    ]
  );
}

// Package 3: Empty package (no changes)
function createEmptyPackage(): NarrativePackage {
  return makePackage('pkg_empty', 'Empty Package (control)', [], []);
}

// =============================================================================
// Report Formatting
// =============================================================================

function printDiff(label: string, diff: ImpactDiff) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('='.repeat(60));

  console.log(`\n  Discharged Gaps (${diff.dischargedGaps.length}):`);
  if (diff.dischargedGaps.length === 0) {
    console.log('    (none)');
  }
  for (const gap of diff.dischargedGaps) {
    console.log(`    - [${gap.tier}] ${gap.title}`);
    console.log(`      ${gap.description}`);
  }

  console.log(`\n  Introduced Gaps (${diff.introducedGaps.length}):`);
  if (diff.introducedGaps.length === 0) {
    console.log('    (none)');
  }
  for (const gap of diff.introducedGaps) {
    console.log(`    - [${gap.tier}] ${gap.title}`);
    console.log(`      ${gap.description}`);
  }

  console.log('\n  Tier Changes:');
  for (const tc of diff.tierChanges) {
    const arrow = tc.delta > 0 ? '↑' : tc.delta < 0 ? '↓' : '=';
    const deltaStr = tc.delta !== 0 ? ` (${tc.delta > 0 ? '+' : ''}${tc.delta.toFixed(0)}%)` : '';
    console.log(`    ${tc.label.padEnd(14)} ${tc.before.toFixed(0)}% → ${tc.after.toFixed(0)}% ${arrow}${deltaStr}`);
  }

  console.log(`\n  Net gap delta: ${diff.netGapDelta} (${diff.netGapDelta < 0 ? 'improvement' : diff.netGapDelta > 0 ? 'regression' : 'neutral'})`);
  console.log(`  Gaps before: ${diff.before.gaps.length}, after: ${diff.after.gaps.length}`);
}

// =============================================================================
// Main
// =============================================================================

function main() {
  console.log('Impact Diff Report');
  console.log('==================');
  console.log('Loading neon-noir-graph.json...');

  const graph = loadNeonNoir();
  console.log(`Graph loaded: ${graph.nodes.size} nodes, ${graph.edges.length} edges`);

  // Baseline coverage
  const baseline = computeCoverage(graph);
  console.log(`\nBaseline Coverage:`);
  for (const tier of baseline.summary) {
    console.log(`  ${tier.label.padEnd(14)} ${tier.covered}/${tier.total} (${tier.percent.toFixed(0)}%)`);
  }
  console.log(`  Total gaps: ${baseline.gaps.length}`);

  // Run 3 packages
  const packages = [
    { label: 'Package 1: Catalyst Scene (complete)', pkg: createCatalystPackage() },
    { label: 'Package 2: Debate Scene (bare, no characters)', pkg: createBareScenePackage() },
    { label: 'Package 3: Empty Package (control)', pkg: createEmptyPackage() },
  ];

  for (const { label, pkg } of packages) {
    const diff = computeImpactDiff(graph, pkg);
    printDiff(label, diff);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Report complete.');
  console.log('='.repeat(60));
}

main();
