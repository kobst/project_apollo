/**
 * Critique Report — Manual review artifact.
 *
 * Builds a critique prompt for 3 mock packages against neon-noir,
 * prints the full prompt, and parses the fixture response.
 * If an LLM API key is available, calls the LLM for live critique.
 *
 * Run: npx tsx packages/core/tests/ai/critique.report.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { buildCritiquePrompt } from '../../src/ai/prompts/critiquePrompt.js';
import { parseCritiqueResponse } from '../../src/ai/critiqueParser.js';
import { computeCoverage } from '../../src/coverage/compute.js';
import type { GraphState } from '../../src/core/graph.js';
import type { Edge } from '../../src/types/edges.js';
import { normalizeEdge } from '../../src/types/edges.js';
import type { CritiqueParams, CritiquePackageSummary } from '../../src/ai/prompts/critiquePrompt.js';
import type { PackageCritique } from '../../src/ai/types.js';

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
  for (const n of raw.nodes) nodes.set(n.id, n);
  const edgesList: Edge[] = (raw.edges || []).map((e: any) => normalizeEdge(e));
  return { nodes, edges: edgesList };
}

// =============================================================================
// Mock Packages
// =============================================================================

function getMockPackages(): CritiquePackageSummary[] {
  return [
    {
      id: 'pkg_catalyst_test',
      title: 'Catalyst: Discovery of the Hidden Signal',
      rationale: 'Creates a compelling inciting incident that connects the missing informants to an AI entity, establishing the central mystery.',
      nodesSummary: `PlotPoint: "Discovery of the hidden signal" (aligned to Catalyst beat, Act 1)
Scene: "INT. UNDERGROUND DATA CENTER - NIGHT" — Max hacks into an abandoned server farm, discovering encrypted transmissions linking three missing informants to a single AI entity. The data suggests they volunteered to be digitized.
Character: Ghost — A rogue AI fragment communicating through corrupted data packets.
Edges: REALIZED_BY (PlotPoint→Scene), HAS_CHARACTER (Scene→Ghost)`,
    },
    {
      id: 'pkg_debate_bare',
      title: 'Debate: Empty Rooftop Contemplation',
      rationale: 'Provides a character-driven moment of hesitation before the protagonist commits to the dangerous path.',
      nodesSummary: `PlotPoint: "Protagonist weighs the cost of pursuing the truth" (aligned to Debate beat, Act 1)
Scene: "EXT. ROOFTOP - DAWN" — The protagonist stands alone on a rain-slicked rooftop, weighing whether to pursue the dangerous truth or walk away.
No characters assigned. No location node.
Edges: REALIZED_BY (PlotPoint→Scene)`,
    },
    {
      id: 'pkg_bstory_romance',
      title: 'B-Story: The Informant\'s Partner',
      rationale: 'Introduces a romantic/emotional subplot that humanizes the investigation and provides contrast to the tech-noir procedural.',
      nodesSummary: `PlotPoint: "Max encounters the partner of a missing informant" (aligned to BStory beat, Act 2)
Scene: "INT. APARTMENT - EVENING" — Max visits the apartment of a missing informant and meets their partner, who reveals personal details that reframe the case from corporate espionage to something deeply human.
Character: Lena Kovac — Partner of the first missing informant, a musician who noticed changes in her partner's behavior months before they disappeared.
Edges: REALIZED_BY (PlotPoint→Scene), HAS_CHARACTER (Scene→existing char Max), HAS_CHARACTER (Scene→Lena Kovac)`,
    },
  ];
}

// =============================================================================
// Report Formatting
// =============================================================================

function printCritique(critique: PackageCritique) {
  console.log(`  Package: ${critique.packageId}`);
  console.log(`  Thematic fit: ${critique.thematicFit}`);
  console.log(`  Tradeoff: ${critique.tradeoffProfile}`);
  console.log(`  Strengths:`);
  for (const s of critique.strengths) console.log(`    + ${s}`);
  console.log(`  Weaknesses:`);
  for (const w of critique.weaknesses) console.log(`    - ${w}`);
  if (critique.structuralRisks.length > 0) {
    console.log(`  Structural Risks:`);
    for (const r of critique.structuralRisks) console.log(`    ! ${r}`);
  }
}

// =============================================================================
// Main
// =============================================================================

function main() {
  console.log('Critique Report');
  console.log('===============\n');

  // Load graph and compute coverage
  const graph = loadNeonNoir();
  const coverage = computeCoverage(graph);
  const coverageSummary = coverage.summary
    .map(t => `${t.label}: ${t.covered}/${t.total} (${t.percent.toFixed(0)}%)`)
    .join('\n');

  // Build prompt
  const params: CritiqueParams = {
    packages: getMockPackages(),
    storyContext: 'Neo-noir cyberpunk thriller. A private investigator traces missing corporate informants through a city where digital consciousness and human identity blur. Thematic pillars: identity, surveillance, free will, the price of truth.',
    coverageSummary,
  };

  const prompt = buildCritiquePrompt(params);

  console.log('='.repeat(70));
  console.log('  CRITIQUE PROMPT');
  console.log('='.repeat(70));
  console.log(prompt);
  console.log('\n' + '='.repeat(70));

  // Parse fixture response
  console.log('\n' + '='.repeat(70));
  console.log('  CRITIQUE RESPONSE (from fixture)');
  console.log('='.repeat(70) + '\n');

  const fixturePath = path.resolve(
    import.meta.dirname ?? __dirname,
    '../fixtures/ai/valid_critique_response.json'
  );
  const fixtureRaw = fs.readFileSync(fixturePath, 'utf-8');
  const critiques = parseCritiqueResponse(fixtureRaw);

  for (const critique of critiques) {
    printCritique(critique);
    console.log('-'.repeat(50));
  }

  console.log('\n' + '='.repeat(70));
  console.log('  Report complete.');
  console.log('='.repeat(70));
}

main();
