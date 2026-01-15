/**
 * LLM Client - Multi-provider LLM abstraction with streaming support.
 *
 * Supports:
 * - Anthropic Claude models
 * - OpenAI GPT models
 *
 * Features:
 * - Streaming responses for real-time UI updates
 * - Non-streaming for simpler use cases
 * - Exponential backoff retry on rate limits
 * - Response caching for identical requests
 * - Provider selection via environment variable
 */

import {
  createClient,
  buildConfig,
  isProviderConfigured,
  getApiKeyEnvVar,
} from './clients/index.js';
import type { ILLMClient, LLMClientConfig, LLMProvider } from './types.js';

// =============================================================================
// Re-exports for backwards compatibility
// =============================================================================

export type { ILLMClient, LLMClientConfig, LLMResponse, StreamCallbacks } from './types.js';
export type { LLMProvider } from './types.js';

// Legacy export - alias ILLMClient as LLMClient for backwards compat
export type LLMClient = ILLMClient;

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an LLM client with configuration from environment variables.
 *
 * Provider selection:
 * - Set APOLLO_AI_PROVIDER=anthropic (default) or APOLLO_AI_PROVIDER=openai
 * - Requires corresponding API key: ANTHROPIC_API_KEY or OPENAI_API_KEY
 *
 * Configuration:
 * - APOLLO_AI_MODEL: Model name (defaults to provider-specific model)
 * - APOLLO_AI_MAX_TOKENS: Max response tokens (default: 4096)
 * - APOLLO_AI_TEMPERATURE: Sampling temperature (default: 0.7)
 * - APOLLO_AI_MAX_RETRIES: Retry attempts (default: 3)
 */
export function createLLMClient(config?: Partial<LLMClientConfig>): ILLMClient {
  const fullConfig = buildConfig(config);
  return createClient(fullConfig);
}

/**
 * Check if the current provider is configured (has API key).
 */
export function isLLMConfigured(): boolean {
  const provider: LLMProvider =
    (process.env.APOLLO_AI_PROVIDER as LLMProvider) ?? 'anthropic';
  return isProviderConfigured(provider);
}

/**
 * Get the current provider from environment.
 */
export function getCurrentProvider(): LLMProvider {
  return (process.env.APOLLO_AI_PROVIDER as LLMProvider) ?? 'anthropic';
}

/**
 * Get a user-friendly error message for missing API key.
 */
export function getMissingKeyError(): { message: string; suggestion: string } {
  const provider = getCurrentProvider();
  const envVar = getApiKeyEnvVar(provider);

  return {
    message: `${envVar} not configured`,
    suggestion: `Set the ${envVar} environment variable`,
  };
}
