/**
 * Tests for clarification pre-flight in interpretation phase.
 */
import { describe, it, expect } from 'vitest';
import { buildInterpretationPrompt } from '../../src/ai/prompts/interpretationPrompt.js';
import { parseInterpretationResponse } from '../../src/ai/outputParser.js';
import type { InterpretationParams, ClarificationRequest } from '../../src/ai/types.js';

// =============================================================================
// Prompt Tests
// =============================================================================

describe('clarification in interpretation prompt', () => {
  const baseParams: InterpretationParams = {
    userInput: 'test input',
    storyContext: 'A noir thriller.',
  };

  it('should include clarification schema in prompt', () => {
    const prompt = buildInterpretationPrompt(baseParams);
    expect(prompt).toContain('"clarification"');
    expect(prompt).toContain('"needed"');
    expect(prompt).toContain('"questions"');
  });

  it('should include clarification instructions', () => {
    const prompt = buildInterpretationPrompt(baseParams);
    expect(prompt).toContain('ambiguous');
    expect(prompt).toContain('2-4 targeted questions');
    expect(prompt).toContain('skips clarification');
  });
});

// =============================================================================
// Parser Tests
// =============================================================================

describe('clarification parsing', () => {
  it('should parse response with clarification needed', () => {
    const response = JSON.stringify({
      interpretation: { summary: 'User wants to improve Act 2', confidence: 0.4 },
      clarification: {
        needed: true,
        questions: [
          { question: 'What aspect of Act 2 needs work?', options: ['Pacing', 'Character depth', 'Plot escalation', 'Tone'] },
          { question: 'Should we focus on existing scenes or add new ones?', options: ['Improve existing', 'Add new', 'Both'] },
        ],
        reason: 'The input "make Act 2 better" is too vague to generate specific proposals.',
      },
      proposals: [
        { type: 'node', operation: 'add', target_type: 'PlotPoint', data: { title: 'Best guess PP' }, rationale: 'Default if skipped' },
      ],
      alternatives: [],
    });

    const result = parseInterpretationResponse(response);

    expect(result.clarification).toBeDefined();
    expect(result.clarification!.needed).toBe(true);
    expect(result.clarification!.questions).toHaveLength(2);
    expect(result.clarification!.questions[0]!.options).toHaveLength(4);
    expect(result.clarification!.reason).toContain('too vague');
    // Should still have proposals (best-guess)
    expect(result.proposals).toHaveLength(1);
  });

  it('should parse response without clarification (field absent)', () => {
    const response = JSON.stringify({
      interpretation: { summary: 'Clear request', confidence: 0.95 },
      proposals: [
        { type: 'node', operation: 'add', target_type: 'Scene', data: { heading: 'INT. LAB' }, rationale: 'Direct' },
      ],
    });

    const result = parseInterpretationResponse(response);

    expect(result.clarification).toBeUndefined();
    expect(result.proposals).toHaveLength(1);
  });

  it('should parse response with clarification not needed', () => {
    const response = JSON.stringify({
      interpretation: { summary: 'Clear request', confidence: 0.9 },
      clarification: { needed: false, questions: [], reason: '' },
      proposals: [
        { type: 'node', operation: 'add', target_type: 'Character', data: { name: 'Max' }, rationale: 'Named' },
      ],
    });

    const result = parseInterpretationResponse(response);

    expect(result.clarification).toBeDefined();
    expect(result.clarification!.needed).toBe(false);
    expect(result.clarification!.questions).toHaveLength(0);
  });
});
