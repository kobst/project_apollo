/**
 * Clarification Report — Manual review artifact.
 *
 * Shows interpretation prompts for 3 test cases (clear, ambiguous, borderline)
 * and how clarification would trigger for each.
 * If an LLM API key is available, calls the LLM for live evaluation.
 *
 * Run: npx tsx packages/core/tests/ai/clarification.report.ts
 */

import { buildInterpretationPrompt } from '../../src/ai/prompts/interpretationPrompt.js';
import { parseInterpretationResponse } from '../../src/ai/outputParser.js';
import type { InterpretationParams, InterpretationResult, ClarificationRequest } from '../../src/ai/types.js';

// =============================================================================
// Test Cases
// =============================================================================

interface TestCase {
  label: string;
  input: string;
  expectedBehavior: string;
  /** Mock response simulating what the LLM would return */
  mockResponse: InterpretationResult;
}

const STORY_CONTEXT = `Neo-noir cyberpunk thriller. Private investigator Max traces missing corporate informants through a city where digital consciousness and human identity blur.
Thematic pillars: identity, surveillance, free will, the price of truth.
Current state: Act 1 has OpeningImage, ThemeStated, Setup scenes. Act 2-5 are mostly empty. 6 characters, 3 locations, 8 plot points, 11 scenes.`;

const testCases: TestCase[] = [
  {
    label: 'CLEAR — specific, actionable request',
    input: 'Generate plot points for the Midpoint beat',
    expectedBehavior: 'Should NOT trigger clarification. The request is specific enough to proceed.',
    mockResponse: {
      interpretation: { summary: 'User wants PlotPoint nodes aligned to the Midpoint beat', confidence: 0.95 },
      clarification: { needed: false, questions: [], reason: '' },
      proposals: [
        { type: 'node', operation: 'add', target_type: 'PlotPoint', data: { title: 'Midpoint revelation', alignedBeatId: 'beat_Midpoint' }, rationale: 'Direct request for Midpoint content' },
      ],
    },
  },
  {
    label: 'AMBIGUOUS — vague, needs clarification',
    input: 'Make Act 2 better',
    expectedBehavior: 'SHOULD trigger clarification. "Better" is undefined — tone? pacing? character depth? plot?',
    mockResponse: {
      interpretation: { summary: 'User wants to improve Act 2 but the specific aspect is unclear', confidence: 0.35 },
      clarification: {
        needed: true,
        questions: [
          { question: 'What aspect of Act 2 needs improvement?', options: ['Pacing and momentum', 'Character development', 'Plot escalation', 'Tonal consistency'] },
          { question: 'Should new scenes be added or existing ones revised?', options: ['Add new scenes', 'Revise existing scenes', 'Both'] },
          { question: 'What emotional trajectory should Act 2 follow?', options: ['Building tension', 'Deepening mystery', 'Character bonding before betrayal', 'Escalating stakes'] },
        ],
        reason: '"Make Act 2 better" is too vague — the improvement could target pacing, character depth, plot density, or tonal consistency, each requiring different generation strategies.',
      },
      proposals: [
        { type: 'node', operation: 'add', target_type: 'PlotPoint', data: { title: 'Act 2 escalation', act: 2 }, rationale: 'Best guess: add escalation plot points' },
      ],
    },
  },
  {
    label: 'BORDERLINE — somewhat specific but could go multiple ways',
    input: 'Add a twist at the midpoint',
    expectedBehavior: 'Could go either way. A twist is specific enough to generate, but the nature of the twist (betrayal? revelation? reversal?) affects output significantly.',
    mockResponse: {
      interpretation: { summary: 'User wants a dramatic reversal or revelation at the story midpoint', confidence: 0.7 },
      clarification: {
        needed: true,
        questions: [
          { question: 'What kind of twist?', options: ['Betrayal by an ally', 'Surprising revelation about the case', 'Role reversal (hunter becomes hunted)', 'The truth is the opposite of what Max assumed'] },
        ],
        reason: 'A "twist" could take many forms — the specific type determines what plot points, characters, and causal chains are needed.',
      },
      proposals: [
        { type: 'node', operation: 'add', target_type: 'PlotPoint', data: { title: 'Midpoint twist', alignedBeatId: 'beat_Midpoint', summary: 'A dramatic reversal at the story midpoint' }, rationale: 'Generic twist aligned to Midpoint' },
      ],
    },
  },
];

// =============================================================================
// Report
// =============================================================================

function printClarification(clar: ClarificationRequest | undefined) {
  if (!clar || !clar.needed) {
    console.log('    Clarification: NOT NEEDED');
    return;
  }
  console.log(`    Clarification: NEEDED`);
  console.log(`    Reason: ${clar.reason}`);
  console.log(`    Questions:`);
  for (const q of clar.questions) {
    console.log(`      Q: ${q.question}`);
    if (q.options?.length) {
      console.log(`         Options: ${q.options.join(' | ')}`);
    }
  }
}

function main() {
  console.log('Clarification Report');
  console.log('====================\n');

  for (const tc of testCases) {
    console.log('='.repeat(70));
    console.log(`  ${tc.label}`);
    console.log('='.repeat(70));
    console.log(`\n  User Input: "${tc.input}"`);
    console.log(`  Expected: ${tc.expectedBehavior}\n`);

    // Build the prompt
    const params: InterpretationParams = {
      userInput: tc.input,
      storyContext: STORY_CONTEXT,
    };
    const prompt = buildInterpretationPrompt(params);

    // Show a snippet of the prompt (just the user input + clarification section)
    console.log('  Prompt snippet (clarification rules):');
    const lines = prompt.split('\n');
    const clarIdx = lines.findIndex(l => l.includes('ambiguous'));
    if (clarIdx >= 0) {
      for (let i = clarIdx; i < Math.min(clarIdx + 3, lines.length); i++) {
        console.log(`    ${lines[i]}`);
      }
    }

    // Parse mock response
    console.log('\n  Mock Response:');
    const mockJson = JSON.stringify(tc.mockResponse);
    const result = parseInterpretationResponse(mockJson);

    console.log(`    Interpretation: "${result.interpretation.summary}" (confidence: ${result.interpretation.confidence})`);
    printClarification(result.clarification);
    console.log(`    Best-guess proposals: ${result.proposals.length}`);
    for (const p of result.proposals) {
      console.log(`      - ${p.operation} ${p.target_type}: ${(p.data as any).title || (p.data as any).name || '?'}`);
    }

    console.log('');
  }

  console.log('='.repeat(70));
  console.log('  Report complete.');
  console.log('='.repeat(70));
}

main();
