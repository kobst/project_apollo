/**
 * OpenAI GPT LLM Client
 *
 * Implementation of ILLMClient for OpenAI's GPT models.
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import type {
  ILLMClient,
  LLMClientConfig,
  LLMResponse,
  StreamCallbacks,
  CacheEntry,
} from '../types.js';

// =============================================================================
// OpenAI Client Implementation
// =============================================================================

export class OpenAIClient implements ILLMClient {
  private client: OpenAI;
  private config: LLMClientConfig;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(config: LLMClientConfig) {
    this.config = config;

    if (!this.config.apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.client = new OpenAI({
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
      const messages: OpenAI.ChatCompletionMessageParam[] = [];

      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages,
        stream: true,
      });

      let fullContent = '';
      let finishReason = 'unknown';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          onToken?.(delta);
        }
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }

      // OpenAI streaming doesn't provide token usage in stream
      // We estimate based on content length (rough approximation)
      const estimatedInputTokens = Math.ceil((systemPrompt?.length ?? 0 + prompt.length) / 4);
      const estimatedOutputTokens = Math.ceil(fullContent.length / 4);

      const response: LLMResponse = {
        content: fullContent,
        usage: {
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
        },
        stopReason: finishReason,
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
      hitRate: 0,
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
        const messages: OpenAI.ChatCompletionMessageParam[] = [];

        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const completion = await this.client.chat.completions.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages,
        });

        const content = completion.choices[0]?.message?.content ?? '';

        return {
          content,
          usage: {
            inputTokens: completion.usage?.prompt_tokens ?? 0,
            outputTokens: completion.usage?.completion_tokens ?? 0,
          },
          stopReason: completion.choices[0]?.finish_reason ?? 'unknown',
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if retryable
        if (this.isRetryableError(error)) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(
            `[OpenAI] Request failed (attempt ${attempt + 1}/${this.config.maxRetries}), ` +
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
    if (error instanceof OpenAI.RateLimitError) {
      return true;
    }
    if (error instanceof OpenAI.InternalServerError) {
      return true;
    }
    if (error instanceof OpenAI.APIConnectionError) {
      return true;
    }
    // Also retry on 5xx status codes
    if (error instanceof OpenAI.APIError && error.status && error.status >= 500) {
      return true;
    }
    return false;
  }

  private getCacheKey(prompt: string, systemPrompt?: string): string {
    const content = `openai:${this.config.model}:${systemPrompt ?? ''}:${prompt}`;
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
