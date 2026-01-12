/**
 * Context serialization for AI prompts.
 *
 * Converts story state (GraphState, metadata, gaps) into structured
 * markdown that LLMs can understand and reference naturally.
 */

import type { GraphState } from '../core/graph.js';
import type { KGNode } from '../types/patch.js';
import type { Edge } from '../types/edges.js';
import type { Gap, GapTier } from '../coverage/types.js';
import {
  getNodesByType,
  getEdgesFrom,
  getEdgesTo,
  getNode,
} from '../core/graph.js';
import { defaultConfig } from './config.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Story metadata for serialization.
 */
export interface StoryMetadata {
  /** Story name */
  name?: string;
  /** One-sentence story summary */
  logline?: string;
  /** Story Context markdown (themes, conflicts, constraints) */
  storyContext?: string;
}

/**
 * Options for context serialization.
 */
export interface SerializationOptions {
  /** Maximum nodes to include (default: config.maxContextNodes) */
  maxNodes?: number;
  /** Include edge relationships (default: false) */
  includeEdges?: boolean;
  /** Include gaps (default: false) */
  includeGaps?: boolean;
  /** Focus on a specific node */
  focusNodeId?: string;
  /** Depth for focused serialization (default: 2) */
  focusDepth?: number;
}

// =============================================================================
// Main Serializers
// =============================================================================

/**
 * Serialize full story context for generation prompts.
 *
 * Produces structured markdown with:
 * - Story header (name, logline)
 * - Story Context (user's creative direction)
 * - State summary (node counts)
 * - Nodes organized by type
 * - Optionally: edges, gaps
 *
 * @param graph - The story graph
 * @param metadata - Story metadata
 * @param options - Serialization options
 * @returns Structured markdown string
 */
export function serializeStoryContext(
  graph: GraphState,
  metadata: StoryMetadata,
  options: SerializationOptions = {}
): string {
  const maxNodes = options.maxNodes ?? defaultConfig.maxContextNodes;
  const sections: string[] = [];

  // Header
  sections.push(`# Story: ${metadata.name ?? 'Untitled'}`);
  if (metadata.logline) {
    sections.push(`Logline: "${metadata.logline}"`);
  }
  sections.push('');

  // Story Context (user's creative direction)
  if (metadata.storyContext) {
    sections.push('## Story Context (Creative Direction)');
    sections.push('');
    sections.push(metadata.storyContext);
    sections.push('');
  }

  // Current State Summary
  sections.push('## Current State Summary');
  sections.push('');
  sections.push(serializeStateSummary(graph));
  sections.push('');

  // Nodes by type
  sections.push('## Nodes');
  sections.push('');
  sections.push(serializeNodesByType(graph, maxNodes));

  // Edges (optional)
  if (options.includeEdges) {
    sections.push('');
    sections.push('## Relationships');
    sections.push('');
    sections.push(serializeEdges(graph));
  }

  return sections.join('\n');
}

/**
 * Serialize a focused subset around a specific node.
 *
 * Useful for character-focused or location-focused generation.
 *
 * @param graph - The story graph
 * @param nodeId - Node to focus on
 * @param depth - How many edge hops to include (default: 2)
 * @returns Structured markdown string
 */
export function serializeNodeContext(
  graph: GraphState,
  nodeId: string,
  depth: number = 2
): string {
  const focusNode = getNode(graph, nodeId);
  if (!focusNode) {
    return `[Node ${nodeId} not found]`;
  }

  const sections: string[] = [];

  // Focus node header
  sections.push(`## Focus: ${focusNode.type} "${getNodeLabel(focusNode)}"`);
  sections.push('');
  sections.push(serializeNode(focusNode));
  sections.push('');

  // Get connected nodes up to depth
  const connectedNodes = getConnectedNodes(graph, nodeId, depth);

  if (connectedNodes.size > 0) {
    sections.push('### Connected Nodes');
    sections.push('');
    for (const connected of connectedNodes) {
      sections.push(serializeNodeBrief(connected));
    }
    sections.push('');
  }

  // Get edges involving this node
  const incomingEdges = getEdgesTo(graph, nodeId);
  const outgoingEdges = getEdgesFrom(graph, nodeId);

  if (incomingEdges.length > 0 || outgoingEdges.length > 0) {
    sections.push('### Relationships');
    sections.push('');
    for (const edge of [...incomingEdges, ...outgoingEdges]) {
      sections.push(serializeEdge(edge, graph));
    }
  }

  return sections.join('\n');
}

/**
 * Serialize gaps for generation prompts.
 *
 * Groups gaps by tier and provides context for AI generation.
 *
 * @param gaps - Array of gaps to serialize
 * @returns Structured markdown string
 */
export function serializeGaps(gaps: Gap[]): string {
  if (gaps.length === 0) {
    return 'No open gaps.';
  }

  const sections: string[] = [];
  sections.push('## Gaps (Generation Opportunities)');
  sections.push('');

  // Group by tier
  const byTier = groupBy(gaps, (g) => g.tier);
  const tierOrder: GapTier[] = [
    'premise',
    'foundations',
    'structure',
    'plotPoints',
    'scenes',
  ];

  for (const tier of tierOrder) {
    const tierGaps = byTier.get(tier);
    if (!tierGaps || tierGaps.length === 0) continue;

    sections.push(`### ${capitalize(tier)} Tier`);
    sections.push('');
    for (const gap of tierGaps) {
      sections.push(`- **${gap.title}** (${gap.type})`);
      sections.push(`  ${gap.description}`);
      if (gap.scopeRefs.nodeIds?.length) {
        sections.push(`  Target: ${gap.scopeRefs.nodeIds.join(', ')}`);
      }
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Serialize Story Context markdown (pass-through with fallback).
 *
 * @param storyContext - Story Context content
 * @returns Story Context or placeholder
 */
export function serializeStoryContextMd(
  storyContext: string | undefined
): string {
  if (!storyContext) {
    return '[No Story Context defined]';
  }
  return storyContext;
}

// =============================================================================
// Helper Serializers
// =============================================================================

/**
 * Serialize a state summary with node counts.
 */
function serializeStateSummary(graph: GraphState): string {
  const nodeCounts = new Map<string, number>();
  for (const node of graph.nodes.values()) {
    nodeCounts.set(node.type, (nodeCounts.get(node.type) ?? 0) + 1);
  }

  const lines: string[] = [];
  const displayOrder = [
    'Character',
    'Location',
    'Object',
    'Setting',
    'Beat',
    'PlotPoint',
    'Scene',
    'CharacterArc',
    'Idea',
  ];

  for (const type of displayOrder) {
    const count = nodeCounts.get(type);
    if (count) {
      lines.push(`- ${type}s: ${count}`);
    }
  }

  lines.push(`- Total Edges: ${graph.edges.length}`);

  return lines.join('\n');
}

/**
 * Serialize nodes organized by type with truncation.
 */
function serializeNodesByType(graph: GraphState, maxNodes: number): string {
  const sections: string[] = [];

  // Define serialization order and groupings
  const typeGroups: { header: string; types: string[] }[] = [
    { header: 'Characters', types: ['Character'] },
    { header: 'Locations & Settings', types: ['Location', 'Setting'] },
    { header: 'Objects', types: ['Object'] },
    { header: 'Structure (Beats)', types: ['Beat'] },
    { header: 'Plot Points', types: ['PlotPoint'] },
    { header: 'Scenes', types: ['Scene'] },
    { header: 'Character Arcs', types: ['CharacterArc'] },
    { header: 'Ideas (Unassigned)', types: ['Idea'] },
  ];

  let totalSerialized = 0;

  for (const group of typeGroups) {
    const nodes: KGNode[] = [];
    for (const type of group.types) {
      nodes.push(...getNodesByType(graph, type));
    }

    if (nodes.length === 0) continue;

    sections.push(`### ${group.header}`);
    sections.push('');

    const remaining = maxNodes - totalSerialized;
    const toSerialize = Math.min(nodes.length, remaining);

    for (let i = 0; i < toSerialize; i++) {
      const node = nodes[i];
      if (node) {
        sections.push(serializeNodeBrief(node));
      }
    }

    if (nodes.length > toSerialize) {
      sections.push(
        `[${nodes.length - toSerialize} more ${group.header.toLowerCase()}...]`
      );
    }

    totalSerialized += toSerialize;
    sections.push('');

    if (totalSerialized >= maxNodes) {
      sections.push('[Context truncated due to size limits]');
      break;
    }
  }

  return sections.join('\n');
}

/**
 * Serialize a single node with all its fields.
 */
function serializeNode(node: KGNode): string {
  const lines: string[] = [];
  lines.push(`- **ID:** ${node.id}`);
  lines.push(`- **Type:** ${node.type}`);

  // Type-specific fields
  const data = node as unknown as Record<string, unknown>;
  const skipFields = ['id', 'type', 'createdAt', 'updatedAt'];

  for (const [key, value] of Object.entries(data)) {
    if (skipFields.includes(key) || value === undefined || value === null)
      continue;

    if (typeof value === 'string') {
      lines.push(`- **${capitalize(key)}:** "${truncate(value, 100)}"`);
    } else if (Array.isArray(value)) {
      const preview = value.slice(0, 5).join(', ');
      const suffix = value.length > 5 ? '...' : '';
      lines.push(`- **${capitalize(key)}:** [${preview}${suffix}]`);
    } else if (typeof value === 'object') {
      lines.push(`- **${capitalize(key)}:** (object)`);
    } else {
      lines.push(`- **${capitalize(key)}:** ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Serialize a node in brief format (one line).
 */
function serializeNodeBrief(node: KGNode): string {
  const label = getNodeLabel(node);
  const data = node as unknown as Record<string, unknown>;

  let detail = '';
  if (data.description) {
    detail = `: "${truncate(String(data.description), 60)}"`;
  } else if (data.summary) {
    detail = `: "${truncate(String(data.summary), 60)}"`;
  } else if (data.scene_overview) {
    detail = `: "${truncate(String(data.scene_overview), 60)}"`;
  }

  return `- **${node.id}** (${node.type}): ${label}${detail}`;
}

/**
 * Serialize all edges in the graph.
 */
function serializeEdges(graph: GraphState): string {
  const lines: string[] = [];

  for (const edge of graph.edges) {
    lines.push(serializeEdge(edge, graph));
  }

  return lines.join('\n');
}

/**
 * Serialize a single edge.
 */
function serializeEdge(edge: Edge, graph: GraphState): string {
  const fromNode = getNode(graph, edge.from);
  const toNode = getNode(graph, edge.to);

  const fromLabel = fromNode !== undefined ? getNodeLabel(fromNode) : edge.from;
  const toLabel = toNode !== undefined ? getNodeLabel(toNode) : edge.to;

  return `- ${fromLabel} -[${edge.type}]-> ${toLabel}`;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get a human-readable label for a node.
 */
function getNodeLabel(node: KGNode): string {
  const data = node as unknown as Record<string, unknown>;
  return String(data.name ?? data.title ?? data.heading ?? node.id);
}

/**
 * Get all nodes connected to a node within a given depth.
 */
function getConnectedNodes(
  graph: GraphState,
  nodeId: string,
  depth: number
): Set<KGNode> {
  const visited = new Set<string>([nodeId]);
  const result = new Set<KGNode>();
  let frontier = [nodeId];

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const nextFrontier: string[] = [];

    for (const id of frontier) {
      const outgoing = getEdgesFrom(graph, id);
      const incoming = getEdgesTo(graph, id);

      for (const edge of [...outgoing, ...incoming]) {
        const otherId = edge.from === id ? edge.to : edge.from;
        if (!visited.has(otherId)) {
          visited.add(otherId);
          const node = getNode(graph, otherId);
          if (node) {
            result.add(node);
            nextFrontier.push(otherId);
          }
        }
      }
    }

    frontier = nextFrontier;
  }

  return result;
}

/**
 * Group items by a key function.
 */
function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Truncate a string to a maximum length.
 */
function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}
