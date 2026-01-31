/**
 * Prompt template exports.
 */

// Shared utilities
export {
  PROMPT_VERSION,
  JSON_OUTPUT_RULES,
  PACKAGE_SCHEMA_DOCS,
  NODE_ID_FORMATS,
  getPackageSchemaExample,
  getIdFormatDocs,
  formatNodesCompact,
  getCreativityLabel,
  getValidationRules,
  getEdgeTypeDocs,
  getPromptHeader,
} from './shared.js';

// Prompt builders
export { buildInterpretationPrompt } from './interpretationPrompt.js';
export { buildGenerationPrompt } from './generationPrompt.js';
export { buildRefinementPrompt } from './refinementPrompt.js';
export { buildStoryBeatPrompt } from './storyBeatPrompt.js';
export type { StoryBeatPromptParams } from './storyBeatPrompt.js';
export { buildCharacterPrompt } from './characterPrompt.js';
export type { CharacterPromptParams } from './characterPrompt.js';
export { buildScenePrompt } from './scenePrompt.js';
export type { ScenePromptParams } from './scenePrompt.js';
export { buildExpandPrompt } from './expandPrompt.js';
export type { ExpandPromptParams } from './expandPrompt.js';
