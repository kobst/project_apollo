/**
 * Output parsing for AI responses.
 *
 * Handles:
 * - JSON extraction from markdown code blocks
 * - Robust JSON repair for malformed LLM outputs
 * - Schema validation
 * - Normalization of package data
 * - ID validation and regeneration
 */

import { jsonrepair } from 'jsonrepair';
import type {
  InterpretationResult,
  GenerationResult,
  NarrativePackage,
  NodeChange,
  EdgeChange,
  StoryContextChange,
  ConflictInfo,
  ValidationResult,
  ValidationError,
} from './types.js';
import { isValidNodeId, defaultIdGenerator, type IdGenerator } from './idGenerator.js';

// =============================================================================
// Error Class
// =============================================================================

/**
 * Error thrown when parsing fails.
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public rawData: unknown
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

// =============================================================================
// Main Parsers
// =============================================================================

/**
 * Parse interpretation response from LLM.
 *
 * @param raw - Raw LLM response string
 * @returns Parsed interpretation result
 * @throws ParseError if parsing fails
 */
export function parseInterpretationResponse(raw: string): InterpretationResult {
  const json = extractJson(raw);
  const parsed = safeJsonParse(json);

  validateInterpretationSchema(parsed);

  return parsed as InterpretationResult;
}

/**
 * Parse generation response from LLM.
 *
 * @param raw - Raw LLM response string
 * @returns Parsed generation result with normalized packages
 * @throws ParseError if parsing fails
 */
export function parseGenerationResponse(raw: string): GenerationResult {
  const json = extractJson(raw);
  const parsed = safeJsonParse(json);

  validateGenerationSchema(parsed);

  // Normalize packages
  const packages = ((parsed as Record<string, unknown>).packages as unknown[] ?? []).map(
    (pkg) => normalizePackage(pkg as Record<string, unknown>)
  );

  return { packages };
}

// =============================================================================
// JSON Extraction & Parsing
// =============================================================================

/**
 * Extract JSON from markdown code blocks or raw text.
 *
 * Handles:
 * - ```json ... ``` blocks
 * - ``` ... ``` blocks
 * - Raw JSON objects
 *
 * @param raw - Raw string that may contain JSON
 * @returns Cleaned JSON string
 * @throws ParseError if no JSON found
 */
function extractJson(raw: string): string {
  // Try to extract from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return cleanJson(codeBlockMatch[1]);
  }

  // Try to find JSON object directly
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return cleanJson(jsonMatch[0]);
  }

  throw new ParseError('No JSON found in response', raw);
}

/**
 * Safely parse JSON with automatic repair for malformed LLM outputs.
 *
 * Strategy:
 * 1. Try standard JSON.parse first (fastest path for valid JSON)
 * 2. If that fails, use jsonrepair to fix common LLM errors
 * 3. Log when repairs are needed for monitoring
 *
 * @param jsonStr - JSON string to parse
 * @returns Parsed JavaScript object
 * @throws ParseError if JSON cannot be repaired
 */
function safeJsonParse(jsonStr: string): unknown {
  // First, try standard parsing (most responses are valid)
  try {
    return JSON.parse(jsonStr);
  } catch (initialError) {
    // JSON.parse failed, try to repair
    console.warn(
      '[outputParser] JSON.parse failed, attempting repair:',
      initialError instanceof Error ? initialError.message : String(initialError)
    );

    try {
      const repaired = jsonrepair(jsonStr);
      const result = JSON.parse(repaired);
      console.log('[outputParser] JSON successfully repaired');
      return result;
    } catch (repairError) {
      // Log both errors for debugging
      console.error('[outputParser] JSON repair also failed:', repairError);
      console.error('[outputParser] Original JSON (first 1000 chars):', jsonStr.slice(0, 1000));
      throw new ParseError(
        `Failed to parse JSON: ${initialError instanceof Error ? initialError.message : String(initialError)}`,
        jsonStr
      );
    }
  }
}

/**
 * Fix newlines inside JSON strings.
 *
 * LLMs often produce JSON with literal newlines inside string values.
 * This function replaces them with spaces while preserving newlines
 * outside of strings (for formatting).
 */
function fixNewlinesInStrings(json: string): string {
  const result: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < json.length; i++) {
    const char = json.charAt(i);

    if (escaped) {
      result.push(char);
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result.push(char);
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result.push(char);
      continue;
    }

    // Replace newlines inside strings with spaces
    if (inString && (char === '\n' || char === '\r')) {
      result.push(' ');
      continue;
    }

    result.push(char);
  }

  return result.join('');
}

/**
 * Clean common JSON formatting issues.
 *
 * Handles:
 * - Newlines inside strings (replaced with spaces)
 * - Trailing commas
 * - Missing commas between array elements or object properties
 *
 * @param json - Raw JSON string
 * @returns Cleaned JSON string
 */
function cleanJson(json: string): string {
  let cleaned = json.trim();

  // First, fix newlines inside strings (most common LLM error)
  cleaned = fixNewlinesInStrings(cleaned);

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Add missing commas between } and { (objects in array)
  cleaned = cleaned.replace(/\}(\s*)\{/g, '},$1{');

  // Add missing commas between ] and { (end of array, start of object)
  cleaned = cleaned.replace(/\](\s*)\{/g, '],$1{');

  // Add missing commas between } and [ (end of object, start of array)
  cleaned = cleaned.replace(/\}(\s*)\[/g, '},$1[');

  // Add missing commas between ] and [ (arrays)
  cleaned = cleaned.replace(/\](\s*)\[/g, '],$1[');

  // Add missing commas between string/number/boolean and { or [
  cleaned = cleaned.replace(/(["'\d]|true|false|null)(\s*)\{/g, '$1,$2{');
  cleaned = cleaned.replace(/(["'\d]|true|false|null)(\s*)\[/g, '$1,$2[');

  // Add missing commas between } or ] and string start
  cleaned = cleaned.replace(/([}\]])(\s*)"(?![:,}\]])/g, '$1,$2"');

  return cleaned;
}

// =============================================================================
// Schema Validation
// =============================================================================

/**
 * Validate interpretation response schema.
 */
function validateInterpretationSchema(data: unknown): void {
  if (typeof data !== 'object' || data === null) {
    throw new ParseError('Response must be an object', data);
  }

  const obj = data as Record<string, unknown>;

  if (!obj.interpretation || typeof obj.interpretation !== 'object') {
    throw new ParseError('Missing or invalid interpretation field', data);
  }

  if (!Array.isArray(obj.proposals)) {
    throw new ParseError('Missing or invalid proposals array', data);
  }
}

/**
 * Validate generation response schema.
 */
function validateGenerationSchema(data: unknown): void {
  if (typeof data !== 'object' || data === null) {
    throw new ParseError('Response must be an object', data);
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.packages)) {
    throw new ParseError('Missing or invalid packages array', data);
  }

  for (let i = 0; i < obj.packages.length; i++) {
    validatePackageSchema(obj.packages[i], i);
  }
}

/**
 * Validate a single package schema.
 *
 * Expected format:
 * { summary, primary: { nodes, edges }, supporting?, suggestions?, impact? }
 */
function validatePackageSchema(pkg: unknown, index: number): void {
  if (typeof pkg !== 'object' || pkg === null) {
    throw new ParseError(`Package ${index} must be an object`, pkg);
  }

  const p = pkg as Record<string, unknown>;

  // Required fields
  if (typeof p.id !== 'string') {
    throw new ParseError(`Package ${index} missing id`, pkg);
  }
  if (typeof p.title !== 'string') {
    throw new ParseError(`Package ${index} missing title`, pkg);
  }
  if (typeof p.summary !== 'string') {
    throw new ParseError(`Package ${index} missing summary`, pkg);
  }

  // Primary structure required
  if (!p.primary || typeof p.primary !== 'object') {
    throw new ParseError(`Package ${index} missing primary`, pkg);
  }
}

// =============================================================================
// Normalization
// =============================================================================

/**
 * Normalize a package from raw LLM output.
 *
 * Expected format: { summary, primary, supporting?, suggestions?, impact? }
 */
function normalizePackage(pkg: Record<string, unknown>): NarrativePackage {
  const impact = pkg.impact as Record<string, unknown> | undefined;
  const primary = pkg.primary as Record<string, unknown> | undefined;
  const supporting = pkg.supporting as Record<string, unknown> | undefined;
  const suggestions = pkg.suggestions as Record<string, unknown> | undefined;

  // Merge primary + supporting into changes
  const changes = normalizePrimarySupporting(primary, supporting, suggestions);

  const result: NarrativePackage = {
    id: String(pkg.id),
    title: String(pkg.title),
    rationale: String(pkg.summary), // Use 'summary' field as rationale
    confidence: normalizeConfidence(pkg.confidence),
    style_tags: normalizeStringArray(pkg.style_tags),
    changes,
    impact: normalizeImpact(impact),
  };

  // Only set optional properties if they have values
  if (typeof pkg.parent_package_id === 'string') {
    result.parent_package_id = pkg.parent_package_id;
  }
  if (typeof pkg.refinement_prompt === 'string') {
    result.refinement_prompt = pkg.refinement_prompt;
  }

  return result;
}

/**
 * Normalize primary + supporting sections into unified changes structure.
 */
function normalizePrimarySupporting(
  primary: Record<string, unknown> | undefined,
  supporting: Record<string, unknown> | undefined,
  suggestions: Record<string, unknown> | undefined
): {
  storyContext?: StoryContextChange[];
  nodes: NodeChange[];
  edges: EdgeChange[];
} {
  const nodes: NodeChange[] = [];
  const edges: EdgeChange[] = [];

  // Add primary nodes/edges
  if (primary) {
    if (Array.isArray(primary.nodes)) {
      nodes.push(...(primary.nodes as NodeChange[]));
    }
    if (Array.isArray(primary.edges)) {
      edges.push(...(primary.edges as EdgeChange[]));
    }
  }

  // Add supporting nodes/edges
  if (supporting) {
    if (Array.isArray(supporting.nodes)) {
      nodes.push(...(supporting.nodes as NodeChange[]));
    }
    if (Array.isArray(supporting.edges)) {
      edges.push(...(supporting.edges as EdgeChange[]));
    }
  }

  const result: {
    storyContext?: StoryContextChange[];
    nodes: NodeChange[];
    edges: EdgeChange[];
  } = { nodes, edges };

  // Handle suggestions.contextAdditions -> storyContext
  if (suggestions && Array.isArray(suggestions.contextAdditions)) {
    result.storyContext = (suggestions.contextAdditions as Array<Record<string, unknown>>).map(
      (ctx) => ({
        operation: (ctx.action as string) === 'append' ? 'add' : (ctx.action as string) ?? 'add',
        section: ctx.section as string,
        content: ctx.content as string,
      } as StoryContextChange)
    );
  }

  return result;
}

/**
 * Normalize confidence to 0-1 range.
 */
function normalizeConfidence(value: unknown): number {
  if (typeof value === 'number') {
    return Math.max(0, Math.min(1, value));
  }
  return 0.5; // default
}

/**
 * Normalize an array of strings.
 */
function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === 'string');
  }
  return [];
}

/**
 * Normalize impact object.
 */
function normalizeImpact(impact: Record<string, unknown> | undefined): {
  fulfills_gaps: string[];
  creates_gaps: string[];
  conflicts: ConflictInfo[];
} {
  if (!impact) {
    return { fulfills_gaps: [], creates_gaps: [], conflicts: [] };
  }

  return {
    fulfills_gaps: normalizeStringArray(impact.fulfills_gaps),
    creates_gaps: normalizeStringArray(impact.creates_gaps),
    conflicts: Array.isArray(impact.conflicts)
      ? (impact.conflicts as ConflictInfo[])
      : [],
  };
}

// =============================================================================
// ID Validation
// =============================================================================

/**
 * Validate that generated node IDs don't conflict with existing IDs.
 *
 * Checks for:
 * - Duplicates with existing graph IDs
 * - Duplicates within package
 * - Invalid ID formats
 *
 * @param result - Generation result to validate
 * @param existingIds - Set of existing node IDs
 * @returns Validation result
 */
export function validateGeneratedIds(
  result: GenerationResult,
  existingIds: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();

  for (const pkg of result.packages) {
    for (const change of pkg.changes.nodes) {
      if (change.operation === 'add') {
        // Check for duplicate with existing
        if (existingIds.has(change.node_id)) {
          errors.push({
            code: 'DUPLICATE_ID',
            message: `Node ID ${change.node_id} already exists in graph`,
            nodeId: change.node_id,
          });
        }

        // Check for duplicate within packages
        if (seenIds.has(change.node_id)) {
          errors.push({
            code: 'DUPLICATE_ID_IN_PACKAGE',
            message: `Node ID ${change.node_id} used multiple times in packages`,
            nodeId: change.node_id,
          });
        }

        seenIds.add(change.node_id);

        // Validate ID format
        if (!isValidNodeId(change.node_id)) {
          errors.push({
            code: 'INVALID_ID_FORMAT',
            message: `Node ID ${change.node_id} has invalid format`,
            nodeId: change.node_id,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Validate that edge references point to valid nodes.
 *
 * Checks that from/to IDs exist in either:
 * - Existing graph nodes
 * - New nodes being added in the same package
 *
 * @param result - Generation result to validate
 * @param existingNodeIds - Set of existing node IDs
 * @returns Validation result
 */
export function validateEdgeReferences(
  result: GenerationResult,
  existingNodeIds: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const pkg of result.packages) {
    // Collect all new node IDs from this package
    const newNodeIds = new Set<string>();
    for (const change of pkg.changes.nodes) {
      if (change.operation === 'add') {
        newNodeIds.add(change.node_id);
      }
    }

    // Validate edges
    for (const edge of pkg.changes.edges) {
      if (edge.operation === 'add') {
        const fromExists =
          existingNodeIds.has(edge.from) || newNodeIds.has(edge.from);
        const toExists =
          existingNodeIds.has(edge.to) || newNodeIds.has(edge.to);

        if (!fromExists) {
          errors.push({
            code: 'INVALID_EDGE_FROM',
            message: `Edge references non-existent node: ${edge.from}`,
            nodeId: edge.from,
          });
        }

        if (!toExists) {
          errors.push({
            code: 'INVALID_EDGE_TO',
            message: `Edge references non-existent node: ${edge.to}`,
            nodeId: edge.to,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

// =============================================================================
// ID Regeneration
// =============================================================================

/**
 * Regenerate IDs that are duplicates or have invalid formats.
 *
 * Also updates edge references to point to the new IDs.
 *
 * @param result - Generation result with potentially invalid IDs
 * @param existingIds - Set of existing node IDs
 * @param idGenerator - ID generator function (default: production generator)
 * @returns New generation result with valid IDs
 */
export function regenerateInvalidIds(
  result: GenerationResult,
  existingIds: Set<string>,
  idGenerator: IdGenerator = defaultIdGenerator
): GenerationResult {
  const idMapping = new Map<string, string>();

  const newPackages = result.packages.map((pkg) => {
    // Regenerate node IDs
    const newNodes = pkg.changes.nodes.map((change) => {
      if (change.operation === 'add') {
        const needsNewId =
          existingIds.has(change.node_id) ||
          idMapping.has(change.node_id) ||
          !isValidNodeId(change.node_id);

        if (needsNewId) {
          const newId = idGenerator(change.node_type);
          idMapping.set(change.node_id, newId);
          return { ...change, node_id: newId };
        }
      }
      return change;
    });

    // Update edge references
    const newEdges = pkg.changes.edges.map((edge) => {
      const newFrom = idMapping.get(edge.from) ?? edge.from;
      const newTo = idMapping.get(edge.to) ?? edge.to;
      return { ...edge, from: newFrom, to: newTo };
    });

    return {
      ...pkg,
      changes: { ...pkg.changes, nodes: newNodes, edges: newEdges },
    };
  });

  return { packages: newPackages };
}
