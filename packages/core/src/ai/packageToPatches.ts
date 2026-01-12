/**
 * Package to Patch conversion.
 *
 * Converts NarrativePackage (AI output format) to Patch (graph mutation format).
 * Handles Story Context changes separately since they're metadata, not graph nodes.
 */

import type { Patch, PatchOp, KGNode } from '../types/patch.js';
import type { Edge } from '../types/edges.js';
import type { NarrativePackage, StoryContextChange } from './types.js';
import { defaultIdGenerator } from './idGenerator.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of converting a package to a patch.
 */
export interface ConversionResult {
  /** The patch to apply to the graph */
  patch: Patch;
  /** Story Context update if any changes were included */
  storyContextUpdate?: {
    /** New Story Context content */
    newContext: string;
    /** Changes that were applied */
    changes: StoryContextChange[];
  };
}

// =============================================================================
// Main Conversion Function
// =============================================================================

/**
 * Convert a NarrativePackage into a Patch for graph application.
 *
 * The patch contains node and edge operations that can be applied
 * to the graph using applyPatch(). Story Context changes are
 * returned separately since they update metadata, not the graph.
 *
 * @param pkg - The NarrativePackage to convert
 * @param baseVersionId - The version ID this patch is based on
 * @param currentStoryContext - Current Story Context content (for modifications)
 * @returns Conversion result with patch and optional Story Context update
 */
export function packageToPatch(
  pkg: NarrativePackage,
  baseVersionId: string,
  currentStoryContext?: string
): ConversionResult {
  const ops: PatchOp[] = [];

  // Convert node changes
  for (const change of pkg.changes.nodes) {
    if (change.operation === 'add') {
      // Build the node object with required fields
      // The LLM output validation ensures required fields are present
      // We cast to KGNode since the full node type can't be verified at compile time
      const node = {
        type: change.node_type,
        id: change.node_id,
        ...change.data,
      } as KGNode;

      ops.push({
        op: 'ADD_NODE',
        node,
      });
    } else if (change.operation === 'modify') {
      ops.push({
        op: 'UPDATE_NODE',
        id: change.node_id,
        set: change.data ?? {},
      });
    } else if (change.operation === 'delete') {
      ops.push({
        op: 'DELETE_NODE',
        id: change.node_id,
      });
    }
  }

  // Convert edge changes
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add') {
      const edgeData: Partial<Edge> = {
        id: defaultIdGenerator('edge'),
        type: edge.edge_type as Edge['type'],
        from: edge.from,
        to: edge.to,
        provenance: {
          source: 'extractor',
          patchId: pkg.id,
        },
      };

      if (edge.properties) {
        edgeData.properties = edge.properties as Edge['properties'];
      }

      ops.push({
        op: 'ADD_EDGE',
        edge: edgeData as Edge,
      });
    } else if (edge.operation === 'delete') {
      ops.push({
        op: 'DELETE_EDGE',
        edge: {
          type: edge.edge_type as Edge['type'],
          from: edge.from,
          to: edge.to,
        },
      });
    }
  }

  const patch: Patch = {
    type: 'Patch',
    id: `patch_${Date.now()}_${randomString(5)}`,
    base_story_version_id: baseVersionId,
    created_at: new Date().toISOString(),
    ops,
    metadata: {
      source: 'ai_generation',
      package_id: pkg.id,
      package_title: pkg.title,
      confidence: pkg.confidence,
    },
  };

  // Handle Story Context changes separately (not part of graph patch)
  if (pkg.changes.storyContext && pkg.changes.storyContext.length > 0) {
    return {
      patch,
      storyContextUpdate: {
        newContext: applyStoryContextChanges(
          currentStoryContext ?? '',
          pkg.changes.storyContext
        ),
        changes: pkg.changes.storyContext,
      },
    };
  }

  return { patch };
}

// =============================================================================
// Story Context Changes
// =============================================================================

/**
 * Apply Story Context changes to produce new markdown content.
 *
 * @param currentContext - Current Story Context markdown
 * @param changes - Changes to apply
 * @returns Updated Story Context markdown
 */
function applyStoryContextChanges(
  currentContext: string,
  changes: StoryContextChange[]
): string {
  let context = currentContext;

  for (const change of changes) {
    if (change.operation === 'add') {
      // Add to section or create new section
      context = addToSection(context, change.section, change.content);
    } else if (change.operation === 'modify') {
      // Replace content in section
      if (change.previous_content) {
        context = context.replace(change.previous_content, change.content);
      }
    } else if (change.operation === 'delete') {
      // Remove content from section
      context = context.replace(change.content, '').replace(/\n\n+/g, '\n\n');
    }
  }

  return context.trim();
}

/**
 * Add content to a section in Story Context markdown.
 *
 * If the section exists, appends the content.
 * If the section doesn't exist, creates it.
 *
 * @param context - Current Story Context markdown
 * @param section - Section name (e.g., 'Thematic Concerns')
 * @param content - Content to add
 * @returns Updated markdown
 */
function addToSection(
  context: string,
  section: string,
  content: string
): string {
  const sectionHeader = `## ${section}`;
  const sectionIndex = context.indexOf(sectionHeader);

  if (sectionIndex >= 0) {
    // Find end of section (next ## or end of string)
    const afterHeader = sectionIndex + sectionHeader.length;
    const nextSection = context.indexOf('\n## ', afterHeader);
    const insertPoint = nextSection >= 0 ? nextSection : context.length;

    // Insert content before next section
    const before = context.slice(0, insertPoint);
    const after = context.slice(insertPoint);
    return `${before.trimEnd()}\n- ${content}\n${after}`;
  } else {
    // Section doesn't exist, add it
    return `${context.trimEnd()}\n\n## ${section}\n- ${content}\n`;
  }
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a package before conversion.
 *
 * Checks that:
 * - Modify/delete operations reference existing nodes
 * - Edge delete operations reference existing nodes
 *
 * @param pkg - Package to validate
 * @param existingNodeIds - Set of existing node IDs
 * @returns Validation result
 */
export function validatePackageForConversion(
  pkg: NarrativePackage,
  existingNodeIds: Set<string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for modify/delete operations on non-existent nodes
  for (const change of pkg.changes.nodes) {
    if (change.operation !== 'add' && !existingNodeIds.has(change.node_id)) {
      errors.push(
        `Cannot ${change.operation} non-existent node: ${change.node_id}`
      );
    }
  }

  // Check edge delete operations
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'delete') {
      if (!existingNodeIds.has(edge.from) || !existingNodeIds.has(edge.to)) {
        errors.push(
          `Cannot delete edge between non-existent nodes: ${edge.from} -> ${edge.to}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Generate a random alphanumeric string.
 */
function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
