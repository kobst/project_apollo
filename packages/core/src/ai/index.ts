/**
 * AI Prompt Engineering Layer
 *
 * This module provides the infrastructure for AI-assisted story generation:
 *
 * - **Context Serialization**: Convert story state to LLM-readable format
 * - **Prompts**: Build structured prompts for interpretation, generation, refinement
 * - **Output Parsing**: Validate and normalize LLM responses
 * - **Package Conversion**: Transform AI packages to graph patches
 *
 * @example
 * ```typescript
 * import {
 *   serializeStoryContext,
 *   serializeGaps,
 *   buildGenerationPrompt,
 *   parseGenerationResponse,
 *   validateGeneratedIds,
 *   regenerateInvalidIds,
 *   packageToPatch,
 * } from '@apollo/core/ai';
 *
 * // 1. Serialize context for LLM
 * const context = serializeStoryContext(graphState, metadata);
 * const gapsText = serializeGaps(gaps);
 *
 * // 2. Build prompt
 * const prompt = buildGenerationPrompt({
 *   entryPoint: { type: 'beat', targetId: 'beat_Midpoint' },
 *   storyContext: context,
 *   gaps: gapsText,
 *   direction: "Focus on betrayal themes",
 *   depth: 'medium',
 *   count: 5,
 * });
 *
 * // 3. Call LLM (external)
 * const response = await callLLM(prompt);
 *
 * // 4. Parse response
 * let result = parseGenerationResponse(response);
 *
 * // 5. Validate IDs
 * const validation = validateGeneratedIds(result, existingNodeIds);
 * if (!validation.valid) {
 *   result = regenerateInvalidIds(result, existingNodeIds);
 * }
 *
 * // 6. Convert selected package to patch
 * const { patch, storyContextUpdate } = packageToPatch(
 *   result.packages[0],
 *   currentVersionId,
 *   currentStoryContext
 * );
 * ```
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Interpretation types
  InterpretationResult,
  InterpretationProposal,
  // Generation types
  GenerationResult,
  NarrativePackage,
  NodeChange,
  EdgeChange,
  StoryContextChange,
  ConflictInfo,
  // Parameter types
  GenerationDepth,
  GenerationCount,
  GenerationEntryPoint,
  GenerationParams,
  RefinementParams,
  InterpretationParams,
  // Validation types
  ValidationResult,
  ValidationError,
  ValidationWarning,
  // Unified Propose types
  ProposalMode,
  ProposeIntent,
  ProposeEntryPointType,
  ProposeScope,
  ProposeInput,
  StructureRespect,
  ProposeConstraints,
  ProposeOptions,
  ProposeRequest,
  ProposeResponse,
} from './types.js';

// =============================================================================
// Config
// =============================================================================

export {
  defaultConfig,
  getPackageCount,
  getDepthBudget,
  exceedsBudget,
  formatTruncation,
  DEFAULT_STORY_CONTEXT,
  // Creativity config
  CREATIVITY_PRESETS,
  getCreativityConfig,
  getCreativityLabel,
  getTemperatureForCreativity,
} from './config.js';
export type { AIConfig, DepthBudget, CreativityConfig } from './config.js';

// =============================================================================
// Mode Defaults
// =============================================================================

export {
  MODE_DEFAULTS,
  SYSTEM_DEFAULTS,
} from './modeDefaults.js';
export type {
  ResolvedConstraints,
  ResolvedOptions,
  ModeConfig,
} from './modeDefaults.js';

// =============================================================================
// ID Generation
// =============================================================================

export {
  defaultIdGenerator,
  createDeterministicIdGenerator,
  isValidNodeId,
  isProductionId,
  isTestId,
  extractTypeFromId,
} from './idGenerator.js';
export type { IdGenerator } from './idGenerator.js';

// =============================================================================
// Context Serialization
// =============================================================================

export {
  serializeStoryContext,
  serializeNodeContext,
  serializeGaps,
  serializeStoryContextMd,
} from './contextSerializer.js';
export type { StoryMetadata, SerializationOptions } from './contextSerializer.js';

// =============================================================================
// Output Parsing
// =============================================================================

export {
  parseInterpretationResponse,
  parseGenerationResponse,
  validateGeneratedIds,
  validateEdgeReferences,
  regenerateInvalidIds,
  ParseError,
} from './outputParser.js';

// =============================================================================
// Package Conversion
// =============================================================================

export {
  packageToPatch,
  validatePackageForConversion,
} from './packageToPatches.js';
export type { ConversionResult } from './packageToPatches.js';

// =============================================================================
// Prompts
// =============================================================================

export {
  buildInterpretationPrompt,
  buildGenerationPrompt,
  buildRefinementPrompt,
} from './prompts/index.js';

// =============================================================================
// Text Similarity
// =============================================================================

export {
  normalizeText,
  levenshteinDistance,
  calculateSimilarity,
  isSimilar,
  findSimilarStrings,
  findMentions,
} from './textSimilarity.js';
export type { SimilarityType, SimilarityResult, ComparisonResult } from './textSimilarity.js';

// =============================================================================
// Proposal Validation
// =============================================================================

export {
  validateProposal,
  findSimilarNodes,
  checkGapFulfillment,
  suggestConnections,
  generateWarnings,
} from './proposalValidator.js';
export type {
  ProposalValidation,
  SimilarityMatch,
  GapMatch,
  ConnectionSuggestion,
  ProposalWarning,
} from './proposalValidator.js';
