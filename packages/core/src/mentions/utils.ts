/**
 * Utility functions for the mentions system.
 */

import type { GraphState } from '../core/graph.js';
import type { Beat } from '../types/nodes.js';
import { getNodesByType, getEdgesByType } from '../core/graph.js';

/**
 * Fields to extract entity mentions from, by node type.
 */
export const EXTRACTABLE_FIELDS: Record<string, string[]> = {
  StoryBeat: ['title', 'summary'],
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
 * Get the beat that a StoryBeat is aligned to.
 */
export function getAlignedBeat(graph: GraphState, storyBeatId: string): string | undefined {
  const alignsWithEdges = getEdgesByType(graph, 'ALIGNS_WITH');
  const edge = alignsWithEdges.find(e => e.from === storyBeatId);
  return edge?.to;
}

/**
 * Get the beat that a Scene is aligned to (via StoryBeat).
 */
export function getSceneAlignedBeat(graph: GraphState, sceneId: string): string | undefined {
  // Scene -> StoryBeat via SATISFIED_BY (inverse: StoryBeat satisfied by Scene)
  const satisfiedByEdges = getEdgesByType(graph, 'SATISFIED_BY');
  const storyBeatEdge = satisfiedByEdges.find(e => e.to === sceneId);
  
  if (!storyBeatEdge) return undefined;
  
  // StoryBeat -> Beat via ALIGNS_WITH
  return getAlignedBeat(graph, storyBeatEdge.from);
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
