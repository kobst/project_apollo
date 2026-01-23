/**
 * Staging utilities for unified workspace.
 * Computes merged views and section change counts from staged packages.
 */

import type { NarrativePackage } from '../api/types';

// Section identifiers for change counts
export type StagingSection = 'premise' | 'structure' | 'elements' | 'storyContext';

// Change counts per section
export interface SectionChangeCounts {
  premise: { additions: number; modifications: number; deletions: number };
  structure: { additions: number; modifications: number; deletions: number };
  elements: { additions: number; modifications: number; deletions: number };
  storyContext: { additions: number; modifications: number; deletions: number };
}

// Node types that belong to each section
const PREMISE_NODE_TYPES = ['Logline', 'Setting', 'GenreTone'];
const STRUCTURE_NODE_TYPES = ['Beat', 'PlotPoint', 'Scene'];
const ELEMENT_NODE_TYPES = ['Character', 'Location', 'Object'];

// Merged node for display
export interface MergedNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
  _isProposed: boolean;
  _packageId?: string | undefined;
  _operation: 'add' | 'modify' | 'delete' | 'existing';
  _previousData?: Record<string, unknown> | undefined;
}

// Merged edge for display
export interface MergedEdge {
  id: string;
  type: string;
  from: string;
  to: string;
  fromName?: string | undefined;
  toName?: string | undefined;
  _isProposed: boolean;
  _packageId?: string | undefined;
  _operation: 'add' | 'delete' | 'existing';
}

// Merged story context change
export interface MergedStoryContextChange {
  section: string;
  content: string;
  _isProposed: boolean;
  _packageId?: string | undefined;
  _operation: 'add' | 'modify' | 'delete';
  _previousContent?: string | undefined;
}

// Complete merged view
export interface MergedGraphView {
  nodes: MergedNode[];
  edges: MergedEdge[];
  storyContextChanges: MergedStoryContextChange[];
}

/**
 * Get the section for a node type
 */
export function getSectionForNodeType(nodeType: string): StagingSection {
  if (PREMISE_NODE_TYPES.includes(nodeType)) return 'premise';
  if (STRUCTURE_NODE_TYPES.includes(nodeType)) return 'structure';
  if (ELEMENT_NODE_TYPES.includes(nodeType)) return 'elements';
  return 'structure'; // Default to structure for unknown types
}

/**
 * Compute section change counts from a package
 */
export function computeSectionChangeCounts(pkg: NarrativePackage | null): SectionChangeCounts {
  const counts: SectionChangeCounts = {
    premise: { additions: 0, modifications: 0, deletions: 0 },
    structure: { additions: 0, modifications: 0, deletions: 0 },
    elements: { additions: 0, modifications: 0, deletions: 0 },
    storyContext: { additions: 0, modifications: 0, deletions: 0 },
  };

  if (!pkg) return counts;

  // Count node changes
  for (const node of pkg.changes.nodes) {
    const section = getSectionForNodeType(node.node_type);
    if (node.operation === 'add') {
      counts[section].additions++;
    } else if (node.operation === 'modify') {
      counts[section].modifications++;
    } else if (node.operation === 'delete') {
      counts[section].deletions++;
    }
  }

  // Count story context changes
  for (const change of pkg.changes.storyContext ?? []) {
    if (change.operation === 'add') {
      counts.storyContext.additions++;
    } else if (change.operation === 'modify') {
      counts.storyContext.modifications++;
    } else if (change.operation === 'delete') {
      counts.storyContext.deletions++;
    }
  }

  return counts;
}

/**
 * Get total changes for a section
 */
export function getTotalChangesForSection(counts: SectionChangeCounts, section: StagingSection): number {
  const sectionCounts = counts[section];
  return sectionCounts.additions + sectionCounts.modifications + sectionCounts.deletions;
}

/**
 * Check if a section has any changes
 */
export function sectionHasChanges(counts: SectionChangeCounts, section: StagingSection): boolean {
  return getTotalChangesForSection(counts, section) > 0;
}

/**
 * Compute merged nodes from existing graph nodes and staged package
 */
export function computeMergedNodes(
  existingNodes: Array<{ id: string; type: string; label: string; data: Record<string, unknown> }>,
  stagedPackage: NarrativePackage | null,
  editedNodes: Map<string, Partial<Record<string, unknown>>>,
  removedNodeIds: Set<string>
): MergedNode[] {
  const mergedNodes: MergedNode[] = [];
  const processedIds = new Set<string>();

  // First, process all existing nodes
  for (const node of existingNodes) {
    // Skip if removed
    if (removedNodeIds.has(node.id)) continue;

    // Check if this node is modified by the package
    const packageChange = stagedPackage?.changes.nodes.find(
      (n) => n.node_id === node.id && (n.operation === 'modify' || n.operation === 'delete')
    );

    // Check if there are local edits
    const localEdits = editedNodes.get(node.id);

    if (packageChange?.operation === 'delete') {
      // Node is being deleted - show with delete indicator
      mergedNodes.push({
        id: node.id,
        type: node.type,
        label: node.label,
        data: node.data,
        _isProposed: true,
        _packageId: stagedPackage?.id,
        _operation: 'delete',
      });
    } else if (packageChange?.operation === 'modify' || localEdits) {
      // Node is being modified
      const mergedData = {
        ...node.data,
        ...(packageChange?.data ?? {}),
        ...(localEdits ?? {}),
      };
      mergedNodes.push({
        id: node.id,
        type: node.type,
        label: (mergedData.name as string) ?? (mergedData.title as string) ?? node.label,
        data: mergedData,
        _isProposed: true,
        _packageId: stagedPackage?.id,
        _operation: 'modify',
        _previousData: node.data,
      });
    } else {
      // Existing node unchanged
      mergedNodes.push({
        id: node.id,
        type: node.type,
        label: node.label,
        data: node.data,
        _isProposed: false,
        _operation: 'existing',
      });
    }

    processedIds.add(node.id);
  }

  // Then, add new nodes from the package
  if (stagedPackage) {
    for (const nodeChange of stagedPackage.changes.nodes) {
      if (nodeChange.operation === 'add' && !processedIds.has(nodeChange.node_id)) {
        // Skip if removed locally
        if (removedNodeIds.has(nodeChange.node_id)) continue;

        // Apply local edits if any
        const localEdits = editedNodes.get(nodeChange.node_id);
        const mergedData = { ...(nodeChange.data ?? {}), ...(localEdits ?? {}) };

        mergedNodes.push({
          id: nodeChange.node_id,
          type: nodeChange.node_type,
          label: (mergedData.name as string) ?? (mergedData.title as string) ?? nodeChange.node_type,
          data: mergedData,
          _isProposed: true,
          _packageId: stagedPackage.id,
          _operation: 'add',
        });
      }
    }
  }

  return mergedNodes;
}

/**
 * Compute merged edges from existing graph edges and staged package
 */
export function computeMergedEdges(
  existingEdges: Array<{ id: string; type: string; from: string; to: string }>,
  stagedPackage: NarrativePackage | null
): MergedEdge[] {
  const mergedEdges: MergedEdge[] = [];
  const processedKeys = new Set<string>();

  // Process existing edges
  for (const edge of existingEdges) {
    const edgeKey = `${edge.type}:${edge.from}:${edge.to}`;

    // Check if this edge is being deleted by the package
    const packageDelete = stagedPackage?.changes.edges.find(
      (e) => e.operation === 'delete' && e.edge_type === edge.type && e.from === edge.from && e.to === edge.to
    );

    if (packageDelete) {
      mergedEdges.push({
        id: edge.id,
        type: edge.type,
        from: edge.from,
        to: edge.to,
        _isProposed: true,
        _packageId: stagedPackage?.id,
        _operation: 'delete',
      });
    } else {
      mergedEdges.push({
        id: edge.id,
        type: edge.type,
        from: edge.from,
        to: edge.to,
        _isProposed: false,
        _operation: 'existing',
      });
    }

    processedKeys.add(edgeKey);
  }

  // Add new edges from package
  if (stagedPackage) {
    for (const edgeChange of stagedPackage.changes.edges) {
      if (edgeChange.operation === 'add') {
        const edgeKey = `${edgeChange.edge_type}:${edgeChange.from}:${edgeChange.to}`;
        if (!processedKeys.has(edgeKey)) {
          mergedEdges.push({
            id: `proposed-${edgeKey}`,
            type: edgeChange.edge_type,
            from: edgeChange.from,
            to: edgeChange.to,
            fromName: edgeChange.from_name,
            toName: edgeChange.to_name,
            _isProposed: true,
            _packageId: stagedPackage.id,
            _operation: 'add',
          });
        }
      }
    }
  }

  return mergedEdges;
}

/**
 * Compute merged story context changes
 */
export function computeMergedStoryContext(
  stagedPackage: NarrativePackage | null
): MergedStoryContextChange[] {
  if (!stagedPackage?.changes.storyContext) return [];

  return stagedPackage.changes.storyContext.map((change) => ({
    section: change.section,
    content: change.content,
    _isProposed: true,
    _packageId: stagedPackage.id,
    _operation: change.operation,
    _previousContent: change.previous_content,
  }));
}

/**
 * Get nodes by section from merged nodes
 */
export function getNodesBySection(
  mergedNodes: MergedNode[],
  section: StagingSection
): MergedNode[] {
  return mergedNodes.filter((node) => getSectionForNodeType(node.type) === section);
}

/**
 * Get proposed-only nodes from merged nodes
 */
export function getProposedNodes(mergedNodes: MergedNode[]): MergedNode[] {
  return mergedNodes.filter((node) => node._isProposed);
}

/**
 * Get proposed-only edges from merged edges
 */
export function getProposedEdges(mergedEdges: MergedEdge[]): MergedEdge[] {
  return mergedEdges.filter((edge) => edge._isProposed);
}
