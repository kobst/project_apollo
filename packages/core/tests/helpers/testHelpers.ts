/**
 * Test utility functions for Project Apollo tests
 */

import { createEmptyGraph } from '../../src/core/graph.js';
import type { GraphState } from '../../src/core/graph.js';
import type { Patch, PatchOp } from '../../src/types/patch.js';
import type { Beat, BeatType } from '../../src/types/nodes.js';
import { BEAT_ACT_MAP, BEAT_POSITION_MAP } from '../../src/types/nodes.js';

/**
 * Create a graph with 15 beats pre-seeded (the baseline empty story)
 */
export function createGraphWith15Beats(): GraphState {
  const graph = createEmptyGraph();
  const beats = createAll15Beats();
  for (const beat of beats) {
    graph.nodes.set(beat.id, beat);
  }
  return graph;
}

/**
 * Create all 15 Beat nodes following the schema
 */
export function createAll15Beats(): Beat[] {
  const beatTypes: BeatType[] = [
    'OpeningImage',
    'ThemeStated',
    'Setup',
    'Catalyst',
    'Debate',
    'BreakIntoTwo',
    'BStory',
    'FunAndGames',
    'Midpoint',
    'BadGuysCloseIn',
    'AllIsLost',
    'DarkNightOfSoul',
    'BreakIntoThree',
    'Finale',
    'FinalImage',
  ];

  return beatTypes.map((beatType) => ({
    type: 'Beat' as const,
    id: `beat_${beatType}`,
    beat_type: beatType,
    act: BEAT_ACT_MAP[beatType],
    position_index: BEAT_POSITION_MAP[beatType],
    guidance: `Guidance for ${beatType}`,
    status: 'EMPTY' as const,
  }));
}

/**
 * Create a minimal valid Patch
 */
export function createMinimalPatch(
  baseVersionId: string,
  ops: PatchOp[] = []
): Patch {
  return {
    type: 'Patch',
    id: `patch_test_${Date.now()}`,
    base_story_version_id: baseVersionId,
    created_at: new Date().toISOString(),
    ops,
  };
}

/**
 * Deep freeze an object for immutability testing
 */
export function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as Record<string, unknown>)[prop];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  });
  return obj;
}

/**
 * Create a StoryVersion node
 */
export function createStoryVersion(
  id: string = 'sv0',
  parentId: string | null = null
): {
  type: 'StoryVersion';
  id: string;
  parent_story_version_id: string | null;
  created_at: string;
  label: string;
} {
  return {
    type: 'StoryVersion',
    id,
    parent_story_version_id: parentId,
    created_at: new Date().toISOString(),
    label: 'Test Story',
  };
}
