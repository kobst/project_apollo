/**
 * Shared types for LLM client implementations.
 *
 * Defines provider-agnostic interfaces that all LLM clients must implement.
 */

// =============================================================================
// Provider Type
// =============================================================================

export type LLMProvider = 'anthropic' | 'openai';

// =============================================================================
// Configuration
// =============================================================================

export interface LLMClientConfig {
  provider?: LLMProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  maxRetries: number;
  retryDelayMs: number;
  enableCache: boolean;
  cacheTTLMs: number;
}

// =============================================================================
// Response Types
// =============================================================================

export interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: string;
  cached: boolean;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (response: LLMResponse) => void;
  onError?: (error: Error) => void;
}

// =============================================================================
// Client Interface
// =============================================================================

/**
 * Provider-agnostic LLM client interface.
 * All provider implementations must implement this interface.
 */
export interface ILLMClient {
  /**
   * Send a prompt and get a complete response.
   * May use caching if enabled.
   */
  complete(prompt: string, systemPrompt?: string): Promise<LLMResponse>;

  /**
   * Send a prompt and stream the response.
   * Streaming responses are typically NOT cached.
   */
  stream(
    prompt: string,
    systemPrompt: string | undefined,
    callbacks: StreamCallbacks
  ): Promise<LLMResponse>;

  /**
   * Clear the response cache.
   */
  clearCache(): void;

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; hitRate: number };
}

// =============================================================================
// Internal Types
// =============================================================================

export interface CacheEntry {
  response: LLMResponse;
  expiresAt: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
export const DEFAULT_OPENAI_MODEL = 'gpt-5-nano';

export const DEFAULT_CONFIG: Omit<LLMClientConfig, 'apiKey'> = {
  provider: 'anthropic',
  model: DEFAULT_ANTHROPIC_MODEL,
  maxTokens: 4096,
  temperature: 0.7,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableCache: true,
  cacheTTLMs: 15 * 60 * 1000, // 15 minutes
};
