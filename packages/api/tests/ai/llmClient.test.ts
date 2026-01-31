/**
 * Tests for LLM Client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLLMClient, isLLMConfigured, getMissingKeyError } from '../../src/ai/llmClient.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
        stream: vi.fn(),
      },
    })),
    RateLimitError: class RateLimitError extends Error {
      constructor(message = 'Rate limited') {
        super(message);
        this.name = 'RateLimitError';
      }
    },
    InternalServerError: class InternalServerError extends Error {
      constructor(message = 'Internal server error') {
        super(message);
        this.name = 'InternalServerError';
      }
    },
    APIConnectionError: class APIConnectionError extends Error {
      constructor(message = 'Connection error') {
        super(message);
        this.name = 'APIConnectionError';
      }
    },
  };
});

describe('LLMClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createLLMClient', () => {
    it('should throw if API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => createLLMClient({ apiKey: '' })).toThrow('ANTHROPIC_API_KEY is required');
    });

    it('should create client with valid API key', () => {
      const client = createLLMClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
      expect(typeof client.complete).toBe('function');
      expect(typeof client.stream).toBe('function');
    });

    it('should merge config with defaults', () => {
      const client = createLLMClient({
        apiKey: 'test-key',
        maxTokens: 2000,
      });
      expect(client).toBeDefined();
      expect(typeof client.complete).toBe('function');
    });
  });

  describe('complete', () => {
    it('should return response content', async () => {
      // Get the mock instance
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        usage: { input_tokens: 50, output_tokens: 100 },
        stop_reason: 'end_turn',
      });

      (Anthropic as unknown as vi.Mock).mockImplementation(() => ({
        messages: {
          create: mockCreate,
          stream: vi.fn(),
        },
      }));

      const client = createLLMClient({ apiKey: 'test-key', enableCache: false });
      const response = await client.complete('Test prompt');

      expect(response.content).toBe('Test response');
      expect(response.usage.inputTokens).toBe(50);
      expect(response.usage.outputTokens).toBe(100);
      expect(response.cached).toBe(false);
    });

    it('should include system prompt when provided', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 50, output_tokens: 100 },
        stop_reason: 'end_turn',
      });

      (Anthropic as unknown as vi.Mock).mockImplementation(() => ({
        messages: {
          create: mockCreate,
          stream: vi.fn(),
        },
      }));

      const client = createLLMClient({ apiKey: 'test-key', enableCache: false });
      await client.complete('User prompt', 'System prompt');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'System prompt',
        })
      );
    });
  });

  describe('caching', () => {
    it('should cache responses when enabled', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Cached response' }],
        usage: { input_tokens: 50, output_tokens: 100 },
        stop_reason: 'end_turn',
      });

      (Anthropic as unknown as vi.Mock).mockImplementation(() => ({
        messages: {
          create: mockCreate,
          stream: vi.fn(),
        },
      }));

      const client = createLLMClient({ apiKey: 'test-key', enableCache: true });

      // First call
      const response1 = await client.complete('Test prompt');
      expect(response1.cached).toBe(false);
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Second call - should be cached
      const response2 = await client.complete('Test prompt');
      expect(response2.cached).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should not cache when disabled', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 50, output_tokens: 100 },
        stop_reason: 'end_turn',
      });

      (Anthropic as unknown as vi.Mock).mockImplementation(() => ({
        messages: {
          create: mockCreate,
          stream: vi.fn(),
        },
      }));

      const client = createLLMClient({ apiKey: 'test-key', enableCache: false });

      await client.complete('Test prompt');
      await client.complete('Test prompt');

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should clear cache', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 50, output_tokens: 100 },
        stop_reason: 'end_turn',
      });

      (Anthropic as unknown as vi.Mock).mockImplementation(() => ({
        messages: {
          create: mockCreate,
          stream: vi.fn(),
        },
      }));

      const client = createLLMClient({ apiKey: 'test-key', enableCache: true });

      await client.complete('Test prompt');
      client.clearCache();
      await client.complete('Test prompt');

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const client = createLLMClient({ apiKey: 'test-key' });
      const stats = client.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(typeof stats.size).toBe('number');
    });
  });

  describe('stream', () => {
    it('should call onToken callback for each chunk', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;

      const mockStream = {
        on: vi.fn((event: string, callback: (data: string) => void) => {
          if (event === 'text') {
            callback('Hello ');
            callback('World');
          }
        }),
        finalMessage: vi.fn().mockResolvedValue({
          usage: { input_tokens: 10, output_tokens: 20 },
          stop_reason: 'end_turn',
        }),
      };

      (Anthropic as unknown as vi.Mock).mockImplementation(() => ({
        messages: {
          create: vi.fn(),
          stream: vi.fn().mockReturnValue(mockStream),
        },
      }));

      const client = createLLMClient({ apiKey: 'test-key' });
      const tokens: string[] = [];

      await client.stream('Test', undefined, {
        onToken: (token) => tokens.push(token),
      });

      expect(tokens).toEqual(['Hello ', 'World']);
    });

    it('should call onComplete callback with final response', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;

      const mockStream = {
        on: vi.fn(),
        finalMessage: vi.fn().mockResolvedValue({
          usage: { input_tokens: 10, output_tokens: 20 },
          stop_reason: 'end_turn',
        }),
      };

      (Anthropic as unknown as vi.Mock).mockImplementation(() => ({
        messages: {
          create: vi.fn(),
          stream: vi.fn().mockReturnValue(mockStream),
        },
      }));

      const client = createLLMClient({ apiKey: 'test-key' });
      let completedResponse: unknown = null;

      await client.stream('Test', undefined, {
        onComplete: (response) => {
          completedResponse = response;
        },
      });

      expect(completedResponse).toMatchObject({
        usage: { inputTokens: 10, outputTokens: 20 },
        stopReason: 'end_turn',
        cached: false,
      });
    });

    it('should call onError callback on error', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;

      const mockStream = {
        on: vi.fn(),
        finalMessage: vi.fn().mockRejectedValue(new Error('Stream error')),
      };

      (Anthropic as unknown as vi.Mock).mockImplementation(() => ({
        messages: {
          create: vi.fn(),
          stream: vi.fn().mockReturnValue(mockStream),
        },
      }));

      const client = createLLMClient({ apiKey: 'test-key' });
      let errorReceived: Error | null = null;

      await expect(
        client.stream('Test', undefined, {
          onError: (error) => {
            errorReceived = error;
          },
        })
      ).rejects.toThrow('Stream error');

      expect(errorReceived).toBeInstanceOf(Error);
      expect(errorReceived!.message).toBe('Stream error');
    });
  });
});

describe('createLLMClient factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create client from environment variables', () => {
    process.env.ANTHROPIC_API_KEY = 'env-api-key';

    const client = createLLMClient();

    expect(client).toBeDefined();
    expect(typeof client.complete).toBe('function');
  });

  it('should override config with provided values', () => {
    process.env.ANTHROPIC_API_KEY = 'env-api-key';

    const client = createLLMClient({ maxTokens: 2000 });

    expect(client).toBeDefined();
    expect(typeof client.complete).toBe('function');
  });

  it('should throw if API key not in environment', () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => createLLMClient()).toThrow('ANTHROPIC_API_KEY is required');
  });
});

describe('isLLMConfigured', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return true when API key is set', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    expect(isLLMConfigured()).toBe(true);
  });

  it('should return false when API key is not set', () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(isLLMConfigured()).toBe(false);
  });

  it('should return false when API key is empty string', () => {
    process.env.ANTHROPIC_API_KEY = '';

    expect(isLLMConfigured()).toBe(false);
  });
});
