/**
 * Structured Story Context Types
 *
 * StoryContext is split into two parts:
 * 1. Constitution - stable creative direction (cached in system prompt)
 * 2. Operational - dynamic guidelines filtered per-task
 *
 * This separation enables Anthropic prompt caching for constitution
 * while allowing operational guidelines to be filtered based on task type.
 */

// =============================================================================
// Tag Types
// =============================================================================

/**
 * Tags for categorizing soft guidelines.
 * Used to filter guidelines based on task type.
 */
export type GuidelineTag =
  | 'character'
  | 'dialogue'
  | 'scene'
  | 'action'
  | 'pacing'
  | 'plot'
  | 'worldbuilding'
  | 'general';

// =============================================================================
// Constitution Types (Stable, Cached)
// =============================================================================

/**
 * A hard rule that the AI must not violate.
 * These are non-negotiable constraints.
 */
export interface HardRule {
  /** Unique identifier for the rule */
  id: string;
  /** The rule text */
  text: string;
}

/**
 * Story constitution - stable creative direction.
 * This is cached in the system prompt for efficiency.
 *
 * Changes to constitution invalidate the prompt cache.
 */
export interface StoryContextConstitution {
  /** One-sentence story summary (may duplicate metadata logline) */
  logline: string;
  /** Extended premise - the core concept and what makes it unique */
  premise: string;
  /** Core thematic pillars the story explores */
  thematicPillars: string[];
  /** Rules the AI must never violate */
  hardRules: HardRule[];
  /** The essential tone and voice of the story */
  toneEssence: string;
  /** Elements explicitly banned from the story */
  banned: string[];
  /** Version identifier for tracking constitution changes */
  version: string;
}

// =============================================================================
// Operational Types (Dynamic, Filtered)
// =============================================================================

/**
 * A soft guideline that applies when relevant.
 * These are filtered based on task type and included in user prompts.
 */
export interface SoftGuideline {
  /** Unique identifier for the guideline */
  id: string;
  /** Tags indicating which task types this applies to */
  tags: GuidelineTag[];
  /** The guideline text */
  text: string;
}

/**
 * Operational story context - dynamic content filtered per-task.
 * Not cached in system prompt, included in user prompts as needed.
 */
export interface StoryContextOperational {
  /** Guidelines applied when relevant based on task type */
  softGuidelines: SoftGuideline[];
  /** Freeform working notes (scratch space) */
  workingNotes?: string;
}

// =============================================================================
// Combined Type
// =============================================================================

/**
 * Complete structured Story Context.
 * Replaces the previous freeform markdown string.
 */
export interface StoryContext {
  /** Stable creative direction (cached in system prompt) */
  constitution: StoryContextConstitution;
  /** Dynamic guidelines (filtered per-task in user prompt) */
  operational: StoryContextOperational;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Generate a unique ID for a new rule or guideline.
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Create a default empty StoryContext.
 *
 * Used when:
 * - Creating a new story
 * - Migrating from string-based context (clean cutover)
 *
 * @returns Empty structured StoryContext
 */
export function createDefaultStoryContext(): StoryContext {
  return {
    constitution: {
      logline: '',
      premise: '',
      thematicPillars: [],
      hardRules: [],
      toneEssence: '',
      banned: [],
      version: '1.0.0',
    },
    operational: {
      softGuidelines: [],
    },
  };
}

/**
 * Create a new hard rule with a generated ID.
 *
 * @param text - The rule text
 * @returns Hard rule with generated ID
 */
export function createHardRule(text: string): HardRule {
  return {
    id: generateId('hr'),
    text,
  };
}

/**
 * Create a new soft guideline with a generated ID.
 *
 * @param text - The guideline text
 * @param tags - Tags for filtering (default: ['general'])
 * @returns Soft guideline with generated ID
 */
export function createSoftGuideline(
  text: string,
  tags: GuidelineTag[] = ['general']
): SoftGuideline {
  return {
    id: generateId('sg'),
    tags,
    text,
  };
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Valid guideline tags for validation.
 */
const VALID_GUIDELINE_TAGS: Set<string> = new Set([
  'character',
  'dialogue',
  'scene',
  'action',
  'pacing',
  'plot',
  'worldbuilding',
  'general',
]);

/**
 * Type guard to check if a value is a valid GuidelineTag.
 */
function isGuidelineTag(value: unknown): value is GuidelineTag {
  return typeof value === 'string' && VALID_GUIDELINE_TAGS.has(value);
}

/**
 * Type guard to check if a value is a valid HardRule.
 */
function isHardRule(value: unknown): value is HardRule {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.text === 'string'
  );
}

/**
 * Type guard to check if a value is a valid SoftGuideline.
 */
function isSoftGuideline(value: unknown): value is SoftGuideline {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.text !== 'string') return false;
  if (!Array.isArray(obj.tags)) return false;
  return obj.tags.every(isGuidelineTag);
}

/**
 * Type guard to check if a value is a valid StoryContextConstitution.
 */
function isConstitution(value: unknown): value is StoryContextConstitution {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  // Check required string fields
  if (typeof obj.logline !== 'string') return false;
  if (typeof obj.premise !== 'string') return false;
  if (typeof obj.toneEssence !== 'string') return false;
  if (typeof obj.version !== 'string') return false;

  // Check arrays
  if (!Array.isArray(obj.thematicPillars)) return false;
  if (!obj.thematicPillars.every((p) => typeof p === 'string')) return false;

  if (!Array.isArray(obj.hardRules)) return false;
  if (!obj.hardRules.every(isHardRule)) return false;

  if (!Array.isArray(obj.banned)) return false;
  if (!obj.banned.every((b) => typeof b === 'string')) return false;

  return true;
}

/**
 * Type guard to check if a value is a valid StoryContextOperational.
 */
function isOperational(value: unknown): value is StoryContextOperational {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  // Check soft guidelines array
  if (!Array.isArray(obj.softGuidelines)) return false;
  if (!obj.softGuidelines.every(isSoftGuideline)) return false;

  // workingNotes is optional, but if present must be string
  if (obj.workingNotes !== undefined && typeof obj.workingNotes !== 'string') {
    return false;
  }

  return true;
}

/**
 * Type guard to validate if a value is a valid StoryContext.
 *
 * Use this to validate API input before processing.
 *
 * @param value - The value to validate
 * @returns True if value is a valid StoryContext
 */
export function isValidStoryContext(value: unknown): value is StoryContext {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return isConstitution(obj.constitution) && isOperational(obj.operational);
}

/**
 * Check if a StoryContext has any meaningful content.
 *
 * Used to determine if the constitution should be included in system prompt.
 *
 * @param context - The StoryContext to check
 * @returns True if there is meaningful content
 */
export function hasStoryContextContent(context: StoryContext | undefined): boolean {
  if (!context) return false;

  const { constitution, operational } = context;

  // Check constitution fields
  const hasConstitution = Boolean(
    constitution.logline.trim() ||
    constitution.premise.trim() ||
    constitution.thematicPillars.length > 0 ||
    constitution.hardRules.length > 0 ||
    constitution.toneEssence.trim() ||
    constitution.banned.length > 0
  );

  // Check operational fields
  const hasOperational = Boolean(
    operational.softGuidelines.length > 0 ||
    (operational.workingNotes && operational.workingNotes.trim())
  );

  return hasConstitution || hasOperational;
}
