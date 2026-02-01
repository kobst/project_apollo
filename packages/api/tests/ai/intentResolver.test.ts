import { describe, it, expect } from 'vitest';
import { resolveIntent } from '../../src/ai/intentResolver.js';

describe('intentResolver', () => {
  const baseState = {
    gaps: [],
    coverage: { gaps: [], summary: [] } as any,
  };

  it('uses structured intent when provided', () => {
    const result = resolveIntent({
      structured: { mode: 'characters', focus: ['char_1'] },
      freeform: 'add a new villain',
      storyState: baseState,
    });
    expect(result.mode).toBe('characters');
    expect(result.targets).toEqual(['char_1']);
    expect(result.direction).toBe('add a new villain');
    expect(result.confidence).toBe(1.0);
  });

  it('interprets character keywords from freeform', () => {
    const result = resolveIntent({
      freeform: 'create a compelling antagonist',
      storyState: baseState,
    });
    expect(result.mode).toBe('characters');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('interprets scene keywords from freeform', () => {
    const result = resolveIntent({
      freeform: 'write an opening scene (INT. LAB - NIGHT)',
      storyState: baseState,
    });
    expect(result.mode).toBe('scenes');
  });

  it('interprets structure keywords from freeform', () => {
    const result = resolveIntent({
      freeform: 'fill the Catalyst beat in Act 1',
      storyState: baseState,
    });
    expect(result.mode).toBe('storyBeats');
  });

  it('suggests from state when no inputs', () => {
    const result = resolveIntent({
      storyState: {
        gaps: [{ id: 'g1', beatId: 'beat_Catalyst', beatType: 'Catalyst', priority: 10 } as any],
        coverage: { gaps: [], summary: [] } as any,
      },
    });
    expect(result.mode).toBe('storyBeats');
    expect(result.targets).toEqual(['beat_Catalyst']);
  });
});

