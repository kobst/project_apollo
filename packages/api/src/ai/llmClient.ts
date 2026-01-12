/**
 * LLM Client - Anthropic API wrapper with streaming support.
 *
 * Features:
 * - Streaming responses for real-time UI updates
 * - Non-streaming for simpler use cases
 * - Exponential backoff retry on rate limits
 * - Response caching for identical requests
 */

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface LLMClientConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  maxRetries: number;
  retryDelayMs: number;
  enableCache: boolean;
  cacheTTLMs: number;
}

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

interface CacheEntry {
  response: LLMResponse;
  expiresAt: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: LLMClientConfig = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableCache: true,
  cacheTTLMs: 15 * 60 * 1000, // 15 minutes
};

// =============================================================================
// LLM Client Class
// =============================================================================

export class LLMClient {
  private client: Anthropic;
  private config: LLMClientConfig;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(config: Partial<LLMClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.config.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
    });
  }

  /**
   * Send a prompt and get a complete response.
   * Uses caching if enabled and request matches a cached entry.
   */
  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const cacheKey = this.getCacheKey(prompt, systemPrompt);

    // Check cache
    if (this.config.enableCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // Make request with retries
    const response = await this.makeRequestWithRetry(prompt, systemPrompt);

    // Store in cache
    if (this.config.enableCache) {
      this.setCache(cacheKey, response);
    }

    return { ...response, cached: false };
  }

  /**
   * Send a prompt and stream the response.
   * Streaming responses are NOT cached.
   */
  async stream(
    prompt: string,
    systemPrompt: string | undefined,
    callbacks: StreamCallbacks
  ): Promise<LLMResponse> {
    const { onToken, onComplete, onError } = callbacks;

    try {
      const streamParams: Anthropic.MessageCreateParams = {
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [{ role: 'user', content: prompt }],
      };
      if (systemPrompt) {
        streamParams.system = systemPrompt;
      }
      const stream = this.client.messages.stream(streamParams);

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      stream.on('text', (text) => {
        fullContent += text;
        onToken?.(text);
      });

      const finalMessage = await stream.finalMessage();

      inputTokens = finalMessage.usage.input_tokens;
      outputTokens = finalMessage.usage.output_tokens;

      const response: LLMResponse = {
        content: fullContent,
        usage: { inputTokens, outputTokens },
        stopReason: finalMessage.stop_reason ?? 'unknown',
        cached: false,
      };

      onComplete?.(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }

  /**
   * Clear the response cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for this
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async makeRequestWithRetry(
    prompt: string,
    systemPrompt?: string
  ): Promise<Omit<LLMResponse, 'cached'>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const createParams: Anthropic.MessageCreateParams = {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [{ role: 'user', content: prompt }],
        };
        if (systemPrompt) {
          createParams.system = systemPrompt;
        }
        const message = await this.client.messages.create(createParams);

        // Extract text content
        const textContent = message.content.find((block) => block.type === 'text');
        const content = textContent?.type === 'text' ? textContent.text : '';

        return {
          content,
          usage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
          },
          stopReason: message.stop_reason ?? 'unknown',
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if retryable (rate limit or server error)
        if (this.isRetryableError(error)) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(
            `LLM request failed (attempt ${attempt + 1}/${this.config.maxRetries}), ` +
              `retrying in ${delay}ms: ${lastError.message}`
          );
          await this.sleep(delay);
          continue;
        }

        // Non-retryable error
        throw lastError;
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Anthropic.RateLimitError) {
      return true;
    }
    if (error instanceof Anthropic.InternalServerError) {
      return true;
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return true;
    }
    return false;
  }

  private getCacheKey(prompt: string, systemPrompt?: string): string {
    const content = `${this.config.model}:${systemPrompt ?? ''}:${prompt}`;
    return createHash('sha256').update(content).digest('hex');
  }

  private getFromCache(key: string): LLMResponse | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  private setCache(key: string, response: Omit<LLMResponse, 'cached'>): void {
    // Clean up expired entries periodically
    if (this.cache.size > 100) {
      this.cleanExpiredCache();
    }

    this.cache.set(key, {
      response: { ...response, cached: true },
      expiresAt: Date.now() + this.config.cacheTTLMs,
    });
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an LLM client with configuration from environment variables.
 */
export function createLLMClient(config?: Partial<LLMClientConfig>): LLMClient {
  return new LLMClient({
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.APOLLO_AI_MODEL ?? DEFAULT_CONFIG.model,
    maxTokens: parseInt(process.env.APOLLO_AI_MAX_TOKENS ?? String(DEFAULT_CONFIG.maxTokens)),
    temperature: parseFloat(process.env.APOLLO_AI_TEMPERATURE ?? String(DEFAULT_CONFIG.temperature)),
    maxRetries: parseInt(process.env.APOLLO_AI_MAX_RETRIES ?? String(DEFAULT_CONFIG.maxRetries)),
    ...config,
  });
}

/**
 * Check if LLM is configured (API key present).
 */
export function isLLMConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
