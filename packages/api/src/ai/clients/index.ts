/**
 * LLM Client Factory
 *
 * Provides factory functions for creating provider-specific LLM clients.
 */

import type { ILLMClient, LLMClientConfig, LLMProvider } from '../types.js';
import {
  DEFAULT_CONFIG,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_MODEL,
} from '../types.js';
import { AnthropicClient } from './anthropic.js';
import { OpenAIClient } from './openai.js';

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an LLM client for the specified provider.
 */
export function createClient(config: LLMClientConfig): ILLMClient {
  const provider = config.provider ?? 'anthropic';

  switch (provider) {
    case 'openai':
      return new OpenAIClient(config);
    case 'anthropic':
    default:
      return new AnthropicClient(config);
  }
}

/**
 * Get the default model for a provider.
 */
export function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return DEFAULT_OPENAI_MODEL;
    case 'anthropic':
    default:
      return DEFAULT_ANTHROPIC_MODEL;
  }
}

/**
 * Get the API key environment variable name for a provider.
 */
export function getApiKeyEnvVar(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'anthropic':
    default:
      return 'ANTHROPIC_API_KEY';
  }
}

/**
 * Get the API key for a provider from environment variables.
 */
export function getApiKey(provider: LLMProvider): string {
  const envVar = getApiKeyEnvVar(provider);
  return process.env[envVar] ?? '';
}

/**
 * Check if a provider is configured (has API key).
 */
export function isProviderConfigured(provider: LLMProvider): boolean {
  return Boolean(getApiKey(provider));
}

/**
 * Build a complete configuration from partial config and environment.
 */
export function buildConfig(config?: Partial<LLMClientConfig>): LLMClientConfig {
  const provider: LLMProvider =
    config?.provider ??
    (process.env.APOLLO_AI_PROVIDER as LLMProvider) ??
    'anthropic';

  const apiKey = config?.apiKey ?? getApiKey(provider);
  const model =
    config?.model ??
    process.env.APOLLO_AI_MODEL ??
    getDefaultModel(provider);

  return {
    ...DEFAULT_CONFIG,
    provider,
    apiKey,
    model,
    maxTokens: config?.maxTokens ??
      parseInt(process.env.APOLLO_AI_MAX_TOKENS ?? String(DEFAULT_CONFIG.maxTokens)),
    temperature: config?.temperature ??
      parseFloat(process.env.APOLLO_AI_TEMPERATURE ?? String(DEFAULT_CONFIG.temperature)),
    maxRetries: config?.maxRetries ??
      parseInt(process.env.APOLLO_AI_MAX_RETRIES ?? String(DEFAULT_CONFIG.maxRetries)),
    retryDelayMs: config?.retryDelayMs ?? DEFAULT_CONFIG.retryDelayMs,
    enableCache: config?.enableCache ?? DEFAULT_CONFIG.enableCache,
    cacheTTLMs: config?.cacheTTLMs ?? DEFAULT_CONFIG.cacheTTLMs,
  };
}

// =============================================================================
// Re-exports
// =============================================================================

export { AnthropicClient } from './anthropic.js';
export { OpenAIClient } from './openai.js';
