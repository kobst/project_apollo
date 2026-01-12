/**
 * AI Orchestration Layer
 *
 * Connects the prompt engineering infrastructure (@apollo/core/ai)
 * to actual LLM calls and exposes orchestrators for each AI phase.
 */

// LLM Client
export {
  LLMClient,
  createLLMClient,
  isLLMConfigured,
  type LLMClientConfig,
  type LLMResponse,
  type StreamCallbacks,
} from './llmClient.js';

// Interpretation Phase
export {
  interpretUserInput,
  proposalToPackage,
  type InterpretRequest,
  type InterpretResponse,
} from './interpretOrchestrator.js';

// Generation Phase
export {
  generatePackages,
  regenerateAll,
  getEntryPointData,
  type GenerateRequest,
  type GenerateResponse,
} from './generateOrchestrator.js';

// Refinement Phase
export {
  refinePackage,
  getRefinableElements,
  type RefineRequest,
  type RefineResponse,
} from './refineOrchestrator.js';
