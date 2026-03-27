/**
 * Tests for problem statement injection into prompts and gap-to-statement conversion.
 */
import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt } from '../../src/ai/prompts/generationPrompt.js';
import { buildPlotPointPrompt } from '../../src/ai/prompts/storyBeatPrompt.js';
import { buildScenePrompt } from '../../src/ai/prompts/scenePrompt.js';
import { buildExpandPrompt } from '../../src/ai/prompts/expandPrompt.js';
import { gapToStatement, gapsToStatement } from '../../src/coverage/gapToStatement.js';
import type { Gap } from '../../src/coverage/types.js';
import type { GenerationParams } from '../../src/ai/types.js';

// =============================================================================
// Prompt Injection Tests
// =============================================================================

describe('problemStatement in prompts', () => {
  const baseGenerationParams: GenerationParams = {
    entryPoint: { type: 'naked' },
    storyContext: 'Test story context',
    gaps: 'Test gaps',
    depth: 'medium',
    count: 3,
  };

  it('should include Narrative Problem section when problemStatement is provided', () => {
    const params = {
      ...baseGenerationParams,
      problemStatement: 'Act 2 has no escalation after the midpoint',
    };
    const prompt = buildGenerationPrompt(params);

    expect(prompt).toContain('## Narrative Problem');
    expect(prompt).toContain('Act 2 has no escalation after the midpoint');
    expect(prompt).toContain('Your packages should directly address this problem.');
  });

  it('should NOT include Narrative Problem section when problemStatement is absent', () => {
    const prompt = buildGenerationPrompt(baseGenerationParams);
    expect(prompt).not.toContain('## Narrative Problem');
    expect(prompt).not.toContain('directly address this problem');
  });

  it('should include problemStatement in PlotPoint prompt', () => {
    const prompt = buildPlotPointPrompt({
      storyContext: 'Test',
      existingPlotPoints: '',
      characters: '',
      missingBeats: [],
      priorityBeats: [],
      packageCount: 3,
      maxPlotPointsPerPackage: 5,
      creativity: 0.5,
      problemStatement: 'The B-story has no payoff',
    });
    expect(prompt).toContain('## Narrative Problem');
    expect(prompt).toContain('The B-story has no payoff');
  });

  it('should include problemStatement in Scene prompt', () => {
    const prompt = buildScenePrompt({
      storyContext: 'Test',
      validatedBeats: [],
      existingCharacters: '',
      existingLocations: '',
      existingScenes: '',
      scenesPerBeat: 1,
      packageCount: 3,
      maxScenesPerPackage: 5,
      creativity: 0.5,
      problemStatement: 'The midpoint needs a dramatic reversal',
    });
    expect(prompt).toContain('## Narrative Problem');
    expect(prompt).toContain('The midpoint needs a dramatic reversal');
  });

  it('should include problemStatement in Expand prompt', () => {
    const prompt = buildExpandPrompt({
      storyContext: 'Test',
      target: { type: 'node', nodeId: 'test_id' },
      depth: 'surface',
      packageCount: 3,
      maxNodesPerPackage: 5,
      creativity: 0.5,
      problemStatement: 'This character needs more depth',
    });
    expect(prompt).toContain('## Narrative Problem');
    expect(prompt).toContain('This character needs more depth');
  });
});

// =============================================================================
// gapToStatement Tests
// =============================================================================

describe('gapToStatement', () => {
  function makeGap(overrides: Partial<Gap>): Gap {
    return {
      id: 'test_gap',
      type: 'narrative',
      tier: 'structure',
      title: 'Test Gap',
      description: 'Test description',
      scopeRefs: {},
      source: 'derived',
      status: 'open',
      ...overrides,
    };
  }

  it('should convert BeatUnrealized gap', () => {
    const gap = makeGap({
      title: 'Beat Unrealized: Midpoint',
      description: 'Beat "Midpoint" has no PlotPoints or Scenes',
    });
    const stmt = gapToStatement(gap);
    expect(stmt).toContain('Midpoint');
    expect(stmt).toContain('story moment is undefined');
  });

  it('should convert SceneHasNoCast gap', () => {
    const gap = makeGap({
      title: 'Scene Without Character',
      description: 'Scene "INT. LAB - NIGHT" has no characters assigned',
      tier: 'scenes',
    });
    const stmt = gapToStatement(gap);
    expect(stmt).toContain('INT. LAB - NIGHT');
    expect(stmt).toContain('character');
  });

  it('should convert SceneNeedsLocation gap', () => {
    const gap = makeGap({
      title: 'Scene Needs Location',
      description: 'Scene "INT. LAB - NIGHT" has no location assigned',
      tier: 'scenes',
    });
    const stmt = gapToStatement(gap);
    expect(stmt).toContain('INT. LAB - NIGHT');
    expect(stmt).toContain('location');
  });

  it('should handle unknown gap type with fallback', () => {
    const gap = makeGap({
      title: 'UnknownGapType',
      description: 'Something unusual is missing',
    });
    const stmt = gapToStatement(gap);
    expect(stmt).toContain('Something unusual is missing');
  });

  it('should combine multiple gaps', () => {
    const gaps = [
      makeGap({ title: 'Beat Unrealized: Catalyst', description: 'Beat "Catalyst" has no PlotPoints or Scenes' }),
      makeGap({ title: 'Scene Without Character', description: 'Scene "INT. LAB" has no characters assigned', tier: 'scenes' }),
    ];
    const stmt = gapsToStatement(gaps);
    expect(stmt).toContain('Multiple narrative problems');
    expect(stmt).toContain('Catalyst');
    expect(stmt).toContain('INT. LAB');
  });

  it('should return empty string for empty gaps array', () => {
    expect(gapsToStatement([])).toBe('');
  });
});
