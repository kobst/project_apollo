import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/storage.js', () => ({
  loadGraphById: vi.fn().mockResolvedValue({ nodes: new Map(), edges: [] }),
}));

vi.mock('@apollo/core', () => ({
  ai: {
    validatePackages: (pkgs: any) => pkgs,
    computeImpact: () => ({ fulfills_gaps: [], creates_gaps: [], conflicts: [] }),
  },
  computeCoverage: () => ({ gaps: [], summary: [] }),
}));

vi.mock('../../src/ai/storyBeatOrchestrator.js', () => ({
  proposeStoryBeats: vi.fn().mockResolvedValue({ sessionId: 's1', packages: [{ id: 'p1' }] }),
}));
vi.mock('../../src/ai/characterOrchestrator.js', () => ({
  proposeCharacters: vi.fn().mockResolvedValue({ sessionId: 's2', packages: [{ id: 'p2' }] }),
}));
vi.mock('../../src/ai/sceneOrchestrator.js', () => ({
  proposeScenes: vi.fn().mockResolvedValue({ sessionId: 's3', packages: [{ id: 'p3' }] }),
}));
vi.mock('../../src/ai/expandOrchestrator.js', () => ({
  proposeExpand: vi.fn().mockResolvedValue({ sessionId: 's4', packages: [{ id: 'p4' }] }),
}));
vi.mock('../../src/ai/generateOrchestrator.js', () => ({
  generatePackages: vi.fn().mockResolvedValue({ sessionId: 's5', packages: [{ id: 'p5' }] }),
}));

import { orchestrate } from '../../src/ai/unifiedOrchestrator.js';
import { proposeStoryBeats } from '../../src/ai/storyBeatOrchestrator.js';
import { proposeCharacters } from '../../src/ai/characterOrchestrator.js';
import { proposeScenes } from '../../src/ai/sceneOrchestrator.js';
import { proposeExpand } from '../../src/ai/expandOrchestrator.js';
import { generatePackages } from '../../src/ai/generateOrchestrator.js';

describe('unifiedOrchestrator', () => {
  const ctx = { storiesDir: '/mock' } as any;
  const llm = { complete: vi.fn(), stream: vi.fn() } as any;

  beforeEach(() => vi.clearAllMocks());

  it('routes to storyBeats when intent.mode = storyBeats', async () => {
    const res = await orchestrate({ storyId: 's', intent: { mode: 'storyBeats', focus: ['beat_1'] } }, ctx, llm);
    expect(proposeStoryBeats).toHaveBeenCalledOnce();
    expect(res.sessionId).toBe('s1');
    expect(res.packages[0].id).toBe('p1');
  });

  it('routes to characters when intent.mode = characters', async () => {
    const res = await orchestrate({ storyId: 's', intent: { mode: 'characters' } }, ctx, llm);
    expect(proposeCharacters).toHaveBeenCalledOnce();
    expect(res.sessionId).toBe('s2');
    expect(res.packages[0].id).toBe('p2');
  });

  it('routes to scenes when intent.mode = scenes', async () => {
    const res = await orchestrate({ storyId: 's', intent: { mode: 'scenes', focus: ['sb_1'] } }, ctx, llm);
    expect(proposeScenes).toHaveBeenCalledOnce();
    expect(res.sessionId).toBe('s3');
  });

  it('routes to expand when intent.mode = expand', async () => {
    const res = await orchestrate({ storyId: 's', intent: { mode: 'expand', focus: ['node_1'] } }, ctx, llm);
    expect(proposeExpand).toHaveBeenCalledOnce();
    expect(res.sessionId).toBe('s4');
  });

  it('falls back to interpret/generate when mode = interpret', async () => {
    const res = await orchestrate({ storyId: 's', intent: undefined, direction: 'something vague' }, ctx, llm);
    expect(generatePackages).toHaveBeenCalledOnce();
    expect(res.sessionId).toBe('s5');
  });
});

