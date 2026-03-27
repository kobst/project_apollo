/**
 * Utility functions for the mentions system.
 */

import type { GraphState } from '../core/graph.js';
import type { Beat, PlotPoint } from '../types/nodes.js';
import { getNodesByType, getEdgesByType, getNode } from '../core/graph.js';

/**
 * Fields to extract entity mentions from, by node type.
 */
export const EXTRACTABLE_FIELDS: Record<string, string[]> = {
  PlotPoint: ['title', 'summary'],
  Scene: ['heading', 'scene_overview', 'key_actions'],
  Character: ['description'],
  Location: ['description'],
  CharacterArc: ['start_state', 'end_state', 'key_moments'],
};

/**
 * Map of beat ID to its position in the story structure.
 */
export type BeatOrder = Map<string, number>;

/**
 * Get the ordering of beats in the story structure.
 * Returns a map of beat ID to position (1-15 for Save the Cat).
 */
export function getBeatOrder(graph: GraphState): BeatOrder {
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const order = new Map<string, number>();
  
  for (const beat of beats) {
    order.set(beat.id, beat.position_index);
  }
  
  return order;
}

/**
 * Get the beat that a PlotPoint is aligned to via its alignedBeatId property.
 */
export function getAlignedBeat(graph: GraphState, plotPointId: string): string | undefined {
  const node = getNode(graph, plotPointId);
  if (!node || node.type !== 'PlotPoint') return undefined;
  return (node as PlotPoint).alignedBeatId;
}

/**
 * Get the beat that a Scene is aligned to (via PlotPoint).
 */
export function getSceneAlignedBeat(graph: GraphState, sceneId: string): string | undefined {
  // Scene -> PlotPoint via REALIZED_BY (inverse: PlotPoint realized by Scene)
  const realizedByEdges = getEdgesByType(graph, 'REALIZED_BY');
  const plotPointEdge = realizedByEdges.find(e => e.to === sceneId);

  if (!plotPointEdge) return undefined;

  // PlotPoint -> Beat via alignedBeatId property
  return getAlignedBeat(graph, plotPointEdge.from);
}

/**
 * Escape a string for use in a regular expression.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Truncate a string to a maximum length.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
