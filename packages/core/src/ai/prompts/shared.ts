/**
 * Shared Prompt Building Utilities
 *
 * Provides consistent formatting and structure for all AI prompts.
 * Reduces redundancy and ensures schema consistency across orchestrators.
 */

// =============================================================================
// Constants
// =============================================================================

export const PROMPT_VERSION = '1.1.0';

// =============================================================================
// Output Rules
// =============================================================================

/**
 * Standard JSON output rules for all prompts.
 */
export const JSON_OUTPUT_RULES = `**JSON Output Rules:**
- NO newlines inside strings (use spaces or \\n escape sequences)
- Escape special characters: \\" for quotes, \\\\ for backslashes
- NO trailing commas
- Output ONLY valid JSON, no markdown blocks or explanation`;

// =============================================================================
// Package Schema
// =============================================================================

/**
 * Standard package schema documentation.
 * All prompts should use this canonical structure.
 */
export const PACKAGE_SCHEMA_DOCS = `## Package Schema

Each package MUST have:
- **id**: Unique identifier (format: \`pkg_{timestamp}_{5chars}\`)
- **title**: Short descriptive title
- **rationale**: Why this package makes sense for the story
- **confidence**: Score 0.0-1.0
- **style_tags**: Array of style/thematic tags
- **changes**: Object containing nodes, edges, and optionally storyContext`;

/**
 * Compact package schema example.
 */
export function getPackageSchemaExample(options: {
  primaryNodeType?: string;
  includeSupporting?: boolean;
  includeStoryContext?: boolean;
}): string {
  const { primaryNodeType = 'Character', includeSupporting = true, includeStoryContext = false } = options;

  const supportingSection = includeSupporting
    ? `
      "supporting": {
        "nodes": [...],
        "edges": [...]
      },`
    : '';

  const storyContextSection = includeStoryContext
    ? `
        "storyContext": [...],`
    : '';

  return `{
  "packages": [{
    "id": "pkg_{timestamp}_{5chars}",
    "title": "Descriptive title",
    "rationale": "Why this makes sense",
    "confidence": 0.85,
    "style_tags": ["tag1", "tag2"],
    "primary": {
      "type": "${primaryNodeType}",
      "nodes": [
        {"operation": "add", "node_type": "${primaryNodeType}", "node_id": "...", "data": {...}}
      ],
      "edges": [...]
    },${supportingSection}
    "changes": {${storyContextSection}
      "nodes": [...],
      "edges": [...]
    }
  }]
}`;
}

// =============================================================================
// Node ID Formats
// =============================================================================

/**
 * Standard ID format documentation for each node type.
 */
export const NODE_ID_FORMATS: Record<string, string> = {
  Character: 'char_{timestamp}_{5chars}',
  Location: 'loc_{timestamp}_{5chars}',
  Scene: 'scene_{timestamp}_{5chars}',
  StoryBeat: 'storybeat_{timestamp}_{5chars}',
  CharacterArc: 'arc_{timestamp}_{5chars}',
  Object: 'obj_{timestamp}_{5chars}',
};

/**
 * Get ID format documentation for specified node types.
 */
export function getIdFormatDocs(nodeTypes: string[]): string {
  const lines = nodeTypes.map((type) => `- ${type}: \`${NODE_ID_FORMATS[type] || `${type.toLowerCase()}_{timestamp}_{5chars}`}\``);
  return `**ID Formats:**\n${lines.join('\n')}`;
}

// =============================================================================
// Context Formatting
// =============================================================================

/**
 * Format nodes compactly for prompt context.
 * Uses pipe-delimited format to reduce token count.
 *
 * @example
 * formatNodesCompact([{id: 'char_1', name: 'Cain', archetype: 'PROTAGONIST'}])
 * // Returns: "char_1: Cain | PROTAGONIST"
 */
export function formatNodesCompact(
  nodes: Array<{ id: string; name?: string; title?: string; archetype?: string; description?: string }>
): string {
  if (nodes.length === 0) return '[none]';

  return nodes
    .map((n) => {
      const label = n.name || n.title || n.id;
      const archetype = n.archetype ? ` | ${n.archetype}` : '';
      const desc = n.description ? ` | ${n.description.slice(0, 50)}...` : '';
      return `${n.id}: ${label}${archetype}${desc}`;
    })
    .join('\n');
}

/**
 * Format creativity level label.
 */
export function getCreativityLabel(creativity: number): string {
  if (creativity < 0.3) return 'conservative';
  if (creativity > 0.7) return 'creative';
  return 'balanced';
}

// =============================================================================
// Validation Rules
// =============================================================================

/**
 * Standard validation rules for prompts.
 */
export function getValidationRules(options: {
  packageCount: number;
  requiredEdgeType?: string;
}): string {
  const { packageCount, requiredEdgeType } = options;

  const rules = [
    `Package count: exactly ${packageCount}`,
    'All node IDs follow the format specified above',
    'All edge from/to reference valid existing or proposed node IDs',
  ];

  if (requiredEdgeType) {
    rules.push(`Each primary node has required ${requiredEdgeType} edge`);
  }

  return `## Validation (output rejected if these fail)
${rules.map((r) => `- ${r}`).join('\n')}`;
}

// =============================================================================
// Edge Type Documentation
// =============================================================================

/**
 * Document valid edge types for a generation mode.
 */
export function getEdgeTypeDocs(options: {
  primary: Array<{ type: string; from: string; to: string; required?: boolean }>;
  supporting?: Array<{ type: string; from: string; to: string }>;
}): string {
  const { primary, supporting } = options;

  const primaryDocs = primary
    .map((e) => `- ${e.type} (${e.from} → ${e.to})${e.required ? ' [REQUIRED]' : ''}`)
    .join('\n');

  const supportingDocs = supporting?.length
    ? `\n**Supporting:**\n${supporting.map((e) => `- ${e.type} (${e.from} → ${e.to})`).join('\n')}`
    : '';

  return `## Valid Edge Types
**Primary:**
${primaryDocs}${supportingDocs}`;
}

// =============================================================================
// Prompt Header
// =============================================================================

/**
 * Generate a standard prompt header with version.
 */
export function getPromptHeader(taskDescription: string): string {
  return `## Prompt v${PROMPT_VERSION}

${taskDescription}`;
}
