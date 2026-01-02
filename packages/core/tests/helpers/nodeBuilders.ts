/**
 * Factory functions for creating test nodes
 */

import type {
  Scene,
  Character,
  Location,
  StoryObject,
  Theme,
  Motif,
  CharacterArc,
  Conflict,
} from '../../src/types/nodes.js';

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

/**
 * Reset ID counter (call in beforeEach for deterministic tests)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Create a valid Scene node
 */
export function createScene(
  beatId: string,
  overrides: Partial<Scene> = {}
): Scene {
  return {
    type: 'Scene',
    id: overrides.id ?? nextId('scene'),
    heading: overrides.heading ?? 'INT. TEST LOCATION - DAY',
    scene_overview:
      overrides.scene_overview ??
      'This is a scene overview that meets the minimum 20 character requirement for validation.',
    beat_id: beatId,
    order_index: overrides.order_index ?? 1,
    status: 'DRAFT',
    ...overrides,
  };
}

/**
 * Create an invalid Scene (for negative tests)
 */
export function createInvalidScene(
  beatId: string,
  issue: 'short_overview' | 'invalid_order' | 'missing_beat'
): Partial<Scene> {
  const base: Partial<Scene> = {
    type: 'Scene',
    id: nextId('scene'),
    heading: 'INT. TEST - DAY',
  };

  switch (issue) {
    case 'short_overview':
      return {
        ...base,
        scene_overview: 'Too short',
        beat_id: beatId,
        order_index: 1,
      };
    case 'invalid_order':
      return {
        ...base,
        scene_overview: 'Valid overview text here with enough characters.',
        beat_id: beatId,
        order_index: 0,
      };
    case 'missing_beat':
      return {
        ...base,
        scene_overview: 'Valid overview text here with enough characters.',
        beat_id: 'nonexistent_beat',
        order_index: 1,
      };
  }
}

/**
 * Create a valid Character node
 */
export function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    type: 'Character',
    id: overrides.id ?? nextId('char'),
    name: overrides.name ?? 'Test Character',
    description: overrides.description ?? 'A test character for unit tests.',
    status: 'ACTIVE',
    ...overrides,
  };
}

/**
 * Create a valid Location node
 */
export function createLocation(overrides: Partial<Location> = {}): Location {
  return {
    type: 'Location',
    id: overrides.id ?? nextId('loc'),
    name: overrides.name ?? 'Test Location',
    ...overrides,
  };
}

/**
 * Create a valid StoryObject node
 */
export function createStoryObject(
  overrides: Partial<StoryObject> = {}
): StoryObject {
  return {
    type: 'Object',
    id: overrides.id ?? nextId('obj'),
    name: overrides.name ?? 'Test Object',
    ...overrides,
  };
}

/**
 * Create a valid Conflict node
 */
export function createConflict(overrides: Partial<Conflict> = {}): Conflict {
  return {
    type: 'Conflict',
    id: overrides.id ?? nextId('conf'),
    name: overrides.name ?? 'Test Conflict',
    conflict_type: overrides.conflict_type ?? 'interpersonal',
    description:
      overrides.description ??
      'A test conflict with sufficient description length for validation.',
    status: 'ACTIVE',
    ...overrides,
  };
}

/**
 * Create a valid Theme node
 */
export function createTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    type: 'Theme',
    id: overrides.id ?? nextId('theme'),
    statement: overrides.statement ?? 'Love conquers all',
    status: 'FLOATING',
    ...overrides,
  };
}

/**
 * Create a valid Motif node
 */
export function createMotif(overrides: Partial<Motif> = {}): Motif {
  return {
    type: 'Motif',
    id: overrides.id ?? nextId('motif'),
    name: overrides.name ?? 'Water imagery',
    motif_type: 'SYMBOL',
    status: 'FLOATING',
    ...overrides,
  };
}

/**
 * Create a valid CharacterArc node
 */
export function createCharacterArc(
  characterId: string,
  overrides: Partial<CharacterArc> = {}
): CharacterArc {
  return {
    type: 'CharacterArc',
    id: overrides.id ?? nextId('arc'),
    character_id: characterId,
    arc_type: 'transformation',
    start_state: 'Fearful',
    end_state: 'Courageous',
    status: 'FLOATING',
    ...overrides,
  };
}
