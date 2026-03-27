/**
 * Workflow handler integration tests.
 * Tests the composed pipeline: interpret → clarify → generate → impact diff → critique
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('../src/storage.js', () => ({
  loadGraphById: vi.fn(),
  loadVersionedStateById: vi.fn(),
  deserializeGraph: vi.fn(),
  updateGraphById: vi.fn(),
  updateVersionMeta: vi.fn(),
}));

vi.mock('../src/ai/llmClient.js', () => ({
  createLLMClient: vi.fn(() => ({
    complete: vi.fn(async () => ({ content: '{}', usage: {} })),
  })),
  isLLMConfigured: vi.fn(() => true),
  getMissingKeyError: vi.fn(),
}));

vi.mock('../src/ai/interpretOrchestrator.js', () => ({
  interpretUserInput: vi.fn(),
}));

vi.mock('../src/ai/unifiedOrchestrator.js', () => ({
  orchestrate: vi.fn(),
}));

import { createWorkflowHandler } from '../src/handlers/workflow.js';
import { loadGraphById } from '../src/storage.js';
import { interpretUserInput } from '../src/ai/interpretOrchestrator.js';
import { orchestrate } from '../src/ai/unifiedOrchestrator.js';
import type { Request, Response, NextFunction } from 'express';

// Helper to create mock request/response
function mockReqRes(body: Record<string, unknown> = {}, params: Record<string, string> = { id: 'story1' }) {
  const req = {
    params,
    body,
    headers: {},
  } as unknown as Request;

  const resData: { json?: unknown } = {};
  const res = {
    json: vi.fn((data: unknown) => { resData.json = data; }),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next, resData };
}

describe('Workflow Handler', () => {
  const handler = createWorkflowHandler({} as any);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: graph exists
    (loadGraphById as any).mockResolvedValue({
      nodes: new Map(),
      edges: [],
    });
  });

  it('should return packages_ready for a basic generate workflow', async () => {
    const mockPackages = [{
      id: 'pkg_001',
      title: 'Test Package',
      rationale: 'Test',
      confidence: 0.9,
      style_tags: [],
      changes: { nodes: [], edges: [] },
      impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
    }];

    (orchestrate as any).mockResolvedValue({
      sessionId: 'sess1',
      packages: mockPackages,
      orchestration: { stateAnalysis: {} },
    });

    const { req, res, next } = mockReqRes({
      type: 'generate',
      skipCritique: true,
      skipClarification: true,
    });

    await handler(req as any, res as any, next);

    expect(res.json).toHaveBeenCalledOnce();
    const response = (res.json as any).mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data.status).toBe('packages_ready');
    expect(response.data.packages).toHaveLength(1);
  });

  it('should return needs_clarification when interpretation triggers it', async () => {
    (interpretUserInput as any).mockResolvedValue({
      interpretation: { summary: 'Ambiguous', confidence: 0.3 },
      proposals: [],
      clarification: {
        needed: true,
        questions: [{ question: 'What aspect?', options: ['Pacing', 'Plot'] }],
        reason: 'Too vague',
      },
    });

    const { req, res, next } = mockReqRes({
      type: 'generate',
      direction: 'Make it better',
    });

    await handler(req as any, res as any, next);

    expect(res.json).toHaveBeenCalledOnce();
    const response = (res.json as any).mock.calls[0][0];
    expect(response.data.status).toBe('needs_clarification');
    expect(response.data.clarification.needed).toBe(true);
    expect(response.data.clarification.questions).toHaveLength(1);
    // Should NOT have called orchestrate
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it('should skip clarification when skipClarification is true', async () => {
    (orchestrate as any).mockResolvedValue({
      sessionId: 'sess1',
      packages: [],
      orchestration: { stateAnalysis: {} },
    });

    const { req, res, next } = mockReqRes({
      type: 'generate',
      direction: 'Make it better',
      skipClarification: true,
      skipCritique: true,
    });

    await handler(req as any, res as any, next);

    expect(interpretUserInput).not.toHaveBeenCalled();
    expect(orchestrate).toHaveBeenCalledOnce();
  });

  it('should include clarification answers in direction when re-submitting', async () => {
    (orchestrate as any).mockResolvedValue({
      sessionId: 'sess1',
      packages: [],
      orchestration: { stateAnalysis: {} },
    });

    const { req, res, next } = mockReqRes({
      type: 'generate',
      direction: 'Make it better',
      clarificationAnswers: { 'What aspect?': 'Pacing' },
      skipCritique: true,
    });

    await handler(req as any, res as any, next);

    // Should have called orchestrate with answers appended to direction
    expect(orchestrate).toHaveBeenCalledOnce();
    const orchCall = (orchestrate as any).mock.calls[0][0];
    expect(orchCall.direction).toContain('Pacing');
  });

  it('should call next with error for unknown workflow type', async () => {
    const { req, res, next } = mockReqRes({ type: 'unknown' });

    await handler(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
