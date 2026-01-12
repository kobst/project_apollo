/**
 * ID generation utilities for AI-generated content.
 *
 * Provides:
 * - Default random ID generator for production
 * - Deterministic ID generator for testing
 * - ID format validation
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Function type for generating node IDs.
 */
export type IdGenerator = (nodeType: string) => string;

// =============================================================================
// Random String Utility
// =============================================================================

/**
 * Generate a random alphanumeric string.
 *
 * @param length - Length of the string to generate
 * @returns Random string
 */
function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// =============================================================================
// Default ID Generator
// =============================================================================

/**
 * Default ID generator for production use.
 * Format: {type}_{timestamp}_{random5}
 *
 * @example
 * defaultIdGenerator('Character') // 'character_1736500000000_x7k2m'
 * defaultIdGenerator('Scene')     // 'scene_1736500000001_a9b3c'
 */
export const defaultIdGenerator: IdGenerator = (nodeType: string): string => {
  const type = nodeType.toLowerCase();
  return `${type}_${Date.now()}_${randomString(5)}`;
};

// =============================================================================
// Deterministic ID Generator
// =============================================================================

/**
 * Create a deterministic ID generator for testing.
 * Generates predictable IDs based on type and counter.
 * Format: {type}_test_{counter}
 *
 * @example
 * const gen = createDeterministicIdGenerator();
 * gen('Character') // 'character_test_001'
 * gen('Character') // 'character_test_002'
 * gen('Scene')     // 'scene_test_001'
 *
 * @returns Deterministic ID generator function
 */
export function createDeterministicIdGenerator(): IdGenerator {
  const counters = new Map<string, number>();

  return (nodeType: string): string => {
    const type = nodeType.toLowerCase();
    const count = (counters.get(type) ?? 0) + 1;
    counters.set(type, count);
    return `${type}_test_${count.toString().padStart(3, '0')}`;
  };
}

// =============================================================================
// ID Validation
// =============================================================================

/**
 * Valid ID format patterns.
 * - Production: {type}_{timestamp}_{random5}
 * - Test: {type}_test_{counter}
 * - Legacy: various formats from existing data
 */
const ID_PATTERNS = {
  /** Production format: type_timestamp_random */
  production: /^[a-z]+_\d+_[a-z0-9]{5}$/,
  /** Test format: type_test_counter */
  test: /^[a-z]+_test_\d{3}$/,
  /** Legacy formats that should be accepted */
  legacy: /^[a-z]+_[a-z0-9_]+$/,
};

/**
 * Check if an ID has a valid format.
 * Accepts production, test, and legacy formats.
 *
 * @param id - The ID to validate
 * @returns Whether the ID has a valid format
 */
export function isValidNodeId(id: string): boolean {
  return (
    ID_PATTERNS.production.test(id) ||
    ID_PATTERNS.test.test(id) ||
    ID_PATTERNS.legacy.test(id)
  );
}

/**
 * Check if an ID is in production format.
 *
 * @param id - The ID to check
 * @returns Whether the ID is in production format
 */
export function isProductionId(id: string): boolean {
  return ID_PATTERNS.production.test(id);
}

/**
 * Check if an ID is in test format.
 *
 * @param id - The ID to check
 * @returns Whether the ID is in test format
 */
export function isTestId(id: string): boolean {
  return ID_PATTERNS.test.test(id);
}

/**
 * Extract the node type from an ID.
 *
 * @param id - The ID to extract from
 * @returns The node type, or null if not extractable
 */
export function extractTypeFromId(id: string): string | null {
  const match = id.match(/^([a-z]+)_/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}
