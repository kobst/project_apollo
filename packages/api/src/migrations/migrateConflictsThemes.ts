/**
 * Migration utility for Conflict, Theme, and Motif nodes.
 *
 * Converts these nodes to markdown sections in Story Context,
 * then returns IDs for deletion. These node types are no longer
 * supported as formal graph nodes - they are now stored as prose
 * in Story Context.
 */

import type { GraphState } from '@apollo/core';

// =============================================================================
// Legacy Node Types (for migration only)
// =============================================================================

interface LegacyConflict {
  type: 'Conflict';
  id: string;
  name: string;
  description?: string;
  conflict_type?: string;
  status?: string;
}

interface LegacyTheme {
  type: 'Theme';
  id: string;
  statement: string;
  priority?: string;
}

interface LegacyMotif {
  type: 'Motif';
  id: string;
  name: string;
  description?: string;
  motif_type?: string;
}

type LegacyNode = LegacyConflict | LegacyTheme | LegacyMotif;

// =============================================================================
// Migration Result
// =============================================================================

export interface MigrationResult {
  /** New Story Context content (appended with migrated data) */
  newContext: string;
  /** Node IDs to delete */
  nodesToDelete: string[];
  /** Edge IDs to delete */
  edgesToDelete: string[];
  /** Whether any migration occurred */
  migrated: boolean;
  /** Summary of what was migrated */
  summary: {
    conflicts: number;
    themes: number;
    motifs: number;
  };
}

// =============================================================================
// Type Guards
// =============================================================================

function isLegacyConflict(node: unknown): node is LegacyConflict {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'Conflict' &&
    'id' in node &&
    'name' in node
  );
}

function isLegacyTheme(node: unknown): node is LegacyTheme {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'Theme' &&
    'id' in node &&
    'statement' in node
  );
}

function isLegacyMotif(node: unknown): node is LegacyMotif {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: unknown }).type === 'Motif' &&
    'id' in node &&
    'name' in node
  );
}

function isLegacyNode(node: unknown): node is LegacyNode {
  return isLegacyConflict(node) || isLegacyTheme(node) || isLegacyMotif(node);
}

// =============================================================================
// Migration Function
// =============================================================================

/**
 * Migrate Conflict, Theme, and Motif nodes to Story Context.
 *
 * @param graph - The current graph state
 * @param existingContext - Existing Story Context content (if any)
 * @returns Migration result with new context and IDs to delete
 */
export function migrateConflictsThemesToContext(
  graph: GraphState,
  existingContext: string | undefined
): MigrationResult {
  // Find legacy nodes from the Map (cast to unknown for runtime checks)
  const allNodes = Array.from(graph.nodes.values()) as unknown[];
  const conflicts = allNodes.filter(isLegacyConflict);
  const themes = allNodes.filter(isLegacyTheme);
  const motifs = allNodes.filter(isLegacyMotif);

  // If no legacy nodes, return early
  if (conflicts.length === 0 && themes.length === 0 && motifs.length === 0) {
    return {
      newContext: existingContext ?? '',
      nodesToDelete: [],
      edgesToDelete: [],
      migrated: false,
      summary: { conflicts: 0, themes: 0, motifs: 0 },
    };
  }

  // Collect node IDs to delete
  const nodesToDelete = [
    ...conflicts.map((c) => c.id),
    ...themes.map((t) => t.id),
    ...motifs.map((m) => m.id),
  ];

  // Find edges to delete (edges involving these nodes)
  const edgesToDelete = graph.edges
    .filter((e) => nodesToDelete.includes(e.from) || nodesToDelete.includes(e.to))
    .map((e) => e.id);

  // Build markdown sections
  const sections: string[] = [];

  if (themes.length > 0) {
    sections.push('## Thematic Concerns\n');
    for (const theme of themes) {
      const priority = theme.priority ? ` (${theme.priority})` : '';
      sections.push(`- ${theme.statement}${priority}`);
    }
    sections.push('');
  }

  if (conflicts.length > 0) {
    sections.push('## Central Conflicts\n');
    for (const conflict of conflicts) {
      const type = conflict.conflict_type ? ` (${conflict.conflict_type})` : '';
      const desc = conflict.description ? `: ${conflict.description}` : '';
      sections.push(`- **${conflict.name}**${type}${desc}`);
    }
    sections.push('');
  }

  if (motifs.length > 0) {
    sections.push('## Recurring Motifs\n');
    for (const motif of motifs) {
      const type = motif.motif_type ? ` (${motif.motif_type})` : '';
      const desc = motif.description ? `: ${motif.description}` : '';
      sections.push(`- **${motif.name}**${type}${desc}`);
    }
    sections.push('');
  }

  // Combine with existing context
  const migratedContent = sections.join('\n');
  const separator = existingContext ? '\n\n---\n\n' : '';
  const migrationNote =
    '<!-- Migrated from legacy Conflict/Theme/Motif nodes -->\n\n';
  const newContext =
    (existingContext ?? '') + separator + migrationNote + migratedContent;

  return {
    newContext: newContext.trim(),
    nodesToDelete,
    edgesToDelete,
    migrated: true,
    summary: {
      conflicts: conflicts.length,
      themes: themes.length,
      motifs: motifs.length,
    },
  };
}

/**
 * Check if a graph has any legacy Conflict/Theme/Motif nodes.
 */
export function hasLegacyNodes(graph: GraphState): boolean {
  const allNodes = Array.from(graph.nodes.values()) as unknown[];
  return allNodes.some(isLegacyNode);
}
