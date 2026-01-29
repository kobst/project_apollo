/**
 * Test mocks for API tests.
 */

import { vi } from 'vitest';
import type { GraphState } from '@apollo/core';
import type { StorageContext } from '../../src/config.js';

// =============================================================================
// Anthropic SDK Mock
// =============================================================================

/**
 * Create a mock Anthropic client.
 */
export function createMockAnthropicClient() {
  return {
    messages: {
      create: vi.fn(),
      stream: vi.fn(),
    },
  };
}

/**
 * Create a mock message response.
 */
export function createMockMessageResponse(content: string) {
  return {
    content: [{ type: 'text', text: content }],
    usage: { input_tokens: 100, output_tokens: 200 },
    stop_reason: 'end_turn',
  };
}

/**
 * Create a mock stream response.
 */
export function createMockStreamResponse(content: string) {
  const chunks = content.split(' ');
  let index = 0;
  const handlers: Record<string, (data: unknown) => void> = {};

  return {
    on: vi.fn((event: string, handler: (data: unknown) => void) => {
      handlers[event] = handler;
      // Simulate text events for streaming
      if (event === 'text') {
        for (const chunk of chunks) {
          handler(chunk + ' ');
        }
      }
    }),
    finalMessage: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: content }],
      usage: { input_tokens: 100, output_tokens: 200 },
      stop_reason: 'end_turn',
    }),
  };
}

// =============================================================================
// Storage Mocks
// =============================================================================

/**
 * Create a mock StorageContext.
 */
export function createMockStorageContext(): StorageContext {
  return {
    storiesDir: '/mock/stories',
  };
}

/**
 * Create a mock GraphState.
 */
export function createMockGraph(nodes: Array<{ id: string; type: string; [key: string]: unknown }> = []): GraphState {
  const nodeMap = new Map<string, { id: string; type: string; [key: string]: unknown }>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }
  return {
    nodes: nodeMap,
    edges: [],
  } as unknown as GraphState;
}

/**
 * Create mock storage functions.
 */
export function createMockStorageFunctions() {
  return {
    loadGraphById: vi.fn(),
    loadVersionedStateById: vi.fn(),
    updateGraphById: vi.fn(),
  };
}

// =============================================================================
// Session Mocks
// =============================================================================

/**
 * Create a mock session.
 */
export function createMockSession(overrides: Partial<{
  generationSession: unknown;
}> = {}) {
  return {
    generationSession: overrides.generationSession ?? null,
  };
}

/**
 * Create mock session functions.
 */
export function createMockSessionFunctions() {
  return {
    loadSessionById: vi.fn(),
    loadGenerationSession: vi.fn(),
    createGenerationSession: vi.fn(),
    updateGenerationSession: vi.fn(),
    addPackagesToSession: vi.fn(),
    markSessionAccepted: vi.fn(),
    markSessionAbandoned: vi.fn(),
    deleteGenerationSession: vi.fn(),
    findPackageInSession: vi.fn(),
  };
}

// =============================================================================
// Coverage Mocks
// =============================================================================

/**
 * Create mock coverage result.
 */
export function createMockCoverageResult(gaps: Array<{
  id: string;
  tier: string;
  type: string;
  title: string;
  description: string;
}> = []) {
  return {
    gaps,
    metrics: {},
  };
}

// =============================================================================
// LLM Client Mocks
// =============================================================================

/**
 * Create a mock LLM client.
 */
export function createMockLLMClient() {
  return {
    complete: vi.fn(),
    stream: vi.fn(),
    clearCache: vi.fn(),
    getCacheStats: vi.fn().mockReturnValue({ size: 0, hitRate: 0 }),
  };
}

/**
 * Create a mock LLM response.
 */
export function createMockLLMResponse(content: string) {
  return {
    content,
    usage: { inputTokens: 100, outputTokens: 200 },
    stopReason: 'end_turn',
    cached: false,
  };
}
