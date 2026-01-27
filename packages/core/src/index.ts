// Project Apollo Core
// Screenplay knowledge graph schema, validation, and logic

export * from './types/index.js';
export * from './core/index.js';
export * from './stubs/index.js';
export * from './rules/index.js';
export * from './coverage/index.js';

// AI module exported as namespace to avoid conflicts
export * as ai from './ai/index.js';

// Re-export StoryContext types directly for convenience
export {
  createDefaultStoryContext,
  createHardRule,
  createSoftGuideline,
  isValidStoryContext,
  hasStoryContextContent,
} from './ai/storyContextTypes.js';
export type {
  GuidelineTag,
  HardRule,
  SoftGuideline,
  StoryContextConstitution,
  StoryContextOperational,
  StoryContext,
} from './ai/storyContextTypes.js';
