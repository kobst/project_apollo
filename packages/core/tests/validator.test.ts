import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePatch,
  validateGraph,
  isPatchValid,
} from '../src/core/validator.js';
import type { GraphState } from '../src/core/graph.js';
import {
  createGraphWith15Beats,
  createMinimalPatch,
} from './helpers/index.js';
import {
  createScene,
  createCharacter,
  createLocation,
  createConflict,
  createCharacterArc,
  createTheme,
  resetIdCounter,
} from './helpers/index.js';
import { edges } from './helpers/index.js';
import { fixtures } from './fixtures/index.js';

describe('Validator', () => {
  let graph: GraphState;

  beforeEach(() => {
    resetIdCounter();
    graph = createGraphWith15Beats();
  });

  describe('Valid patch commits successfully', () => {
    it('should validate patch that adds valid Scene', () => {
      const scene = createScene('beat_Catalyst');
      const patch = createMinimalPatch('sv0', [{ op: 'ADD_NODE', node: scene }]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate patch with Character and edges', () => {
      const char = createCharacter({ id: 'char_1' });
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: char },
        { op: 'ADD_NODE', node: scene },
        { op: 'ADD_EDGE', edge: edges.hasCharacter('scene_1', 'char_1') },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(true);
    });

    it('should validate golden fixture patch', () => {
      const emptyGraph = fixtures.emptyStory();
      const seedPatch = fixtures.seedPatch();

      const result = validatePatch(emptyGraph, seedPatch);

      expect(result.success).toBe(true);
    });
  });

  describe('Invalid edge endpoint types', () => {
    it('should reject HAS_CHARACTER edge with wrong source type', () => {
      const char = createCharacter({ id: 'char_1' });
      graph.nodes.set(char.id, char);

      const patch = createMinimalPatch('sv0', [
        {
          op: 'ADD_EDGE',
          edge: { type: 'HAS_CHARACTER', from: 'beat_Catalyst', to: 'char_1' },
        },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) => e.code === 'INVALID_EDGE_SOURCE')
      ).toBe(true);
    });

    it('should reject INVOLVES edge with wrong source (not Conflict)', () => {
      const char = createCharacter({ id: 'char_1' });
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(char.id, char);
      graph.nodes.set(scene.id, scene);

      const patch = createMinimalPatch('sv0', [
        {
          op: 'ADD_EDGE',
          edge: { type: 'INVOLVES', from: 'scene_1', to: 'char_1' },
        },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
    });

    it('should validate EXPRESSED_IN edge to Scene', () => {
      const theme = createTheme({ id: 'theme_1' });
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(theme.id, theme);
      graph.nodes.set(scene.id, scene);

      const patchToScene = createMinimalPatch('sv0', [
        {
          op: 'ADD_EDGE',
          edge: { type: 'EXPRESSED_IN', from: 'theme_1', to: 'scene_1' },
        },
      ]);
      expect(validatePatch(graph, patchToScene).success).toBe(true);
    });

    it('should validate EXPRESSED_IN edge to Beat', () => {
      const theme = createTheme({ id: 'theme_1' });
      graph.nodes.set(theme.id, theme);

      const patchToBeat = createMinimalPatch('sv0', [
        {
          op: 'ADD_EDGE',
          edge: { type: 'EXPRESSED_IN', from: 'theme_1', to: 'beat_Catalyst' },
        },
      ]);
      expect(validatePatch(graph, patchToBeat).success).toBe(true);
    });
  });

  describe('Missing required fields', () => {
    it('should reject Scene with scene_overview under 20 chars', () => {
      const shortOverviewScene = createScene('beat_Catalyst', {
        id: 'scene_short',
        scene_overview: 'Too short',
      });

      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: shortOverviewScene },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.code === 'CONSTRAINT_VIOLATION' && e.field === 'scene_overview'
        )
      ).toBe(true);
    });

    it('should reject Scene with order_index < 1', () => {
      const invalidOrderScene = createScene('beat_Catalyst', {
        id: 'scene_bad_order',
        order_index: 0,
      });

      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: invalidOrderScene },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.code === 'OUT_OF_RANGE')).toBe(true);
    });

    it('should reject Conflict with description under 20 chars', () => {
      const shortConflict = createConflict({
        id: 'conf_short',
        description: 'Too short',
      });

      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: shortConflict },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
    });

    it('should reject Theme with statement under 5 chars', () => {
      const tooShortTheme = createTheme({ id: 'theme_short', statement: 'Hi' });
      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: tooShortTheme },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
    });

    it('should reject Theme with statement over 240 chars', () => {
      const tooLongTheme = createTheme({
        id: 'theme_long',
        statement: 'A'.repeat(250),
      });
      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: tooLongTheme },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
    });
  });

  describe('FK integrity violations', () => {
    it('should reject Scene referencing non-existent Beat', () => {
      const scene = createScene('nonexistent_beat', { id: 'scene_orphan' });

      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: scene },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.code === 'FK_INTEGRITY')).toBe(true);
    });

    it('should reject CharacterArc referencing non-existent Character', () => {
      const arc = createCharacterArc('nonexistent_char', { id: 'arc_orphan' });

      const patch = createMinimalPatch('sv0', [{ op: 'ADD_NODE', node: arc }]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.code === 'FK_INTEGRITY' && e.field === 'character_id'
        )
      ).toBe(true);
    });

    it('should reject edge to non-existent node', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(scene.id, scene);

      const patch = createMinimalPatch('sv0', [
        {
          op: 'ADD_EDGE',
          edge: edges.hasCharacter('scene_1', 'nonexistent_char'),
        },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.code === 'FK_INTEGRITY')).toBe(true);
    });

    it('should reject Location with non-existent parent_location_id', () => {
      const childLoc = createLocation({
        id: 'loc_child',
        parent_location_id: 'nonexistent_parent',
      });

      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: childLoc },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.code === 'FK_INTEGRITY')).toBe(true);
    });

    it('should allow Location with valid parent_location_id', () => {
      const parentLoc = createLocation({ id: 'loc_parent' });
      const childLoc = createLocation({
        id: 'loc_child',
        parent_location_id: 'loc_parent',
      });

      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: parentLoc },
        { op: 'ADD_NODE', node: childLoc },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(true);
    });
  });

  describe('Delete node cascades edges', () => {
    it('DELETE_NODE should cascade edge deletion automatically', () => {
      const char = createCharacter({ id: 'char_to_delete' });
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(char.id, char);
      graph.nodes.set(scene.id, scene);
      graph.edges.push(edges.hasCharacter('scene_1', 'char_to_delete'));

      const patch = createMinimalPatch('sv0', [
        { op: 'DELETE_NODE', id: 'char_to_delete' },
      ]);

      const result = validatePatch(graph, patch);

      // Should succeed because applyPatch removes incident edges
      expect(result.success).toBe(true);
    });
  });

  describe('validateGraph (direct graph validation)', () => {
    it('should validate a properly constructed graph', () => {
      const result = validateGraph(graph);

      expect(result.success).toBe(true);
    });

    it('should validate empty_story fixture', () => {
      const emptyGraph = fixtures.emptyStory();

      const result = validateGraph(emptyGraph);

      expect(result.success).toBe(true);
    });

    it('should validate after_acceptance fixture', () => {
      const afterGraph = fixtures.afterAcceptance();

      const result = validateGraph(afterGraph);

      expect(result.success).toBe(true);
    });

    it('should detect invalid scene_overview in graph', () => {
      const badScene = createScene('beat_Catalyst', {
        id: 'scene_bad',
        scene_overview: 'Too short',
      });
      graph.nodes.set(badScene.id, badScene);

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) => e.field === 'scene_overview')
      ).toBe(true);
    });
  });

  describe('isPatchValid', () => {
    it('should return true for valid patch', () => {
      const scene = createScene('beat_Catalyst');
      const patch = createMinimalPatch('sv0', [{ op: 'ADD_NODE', node: scene }]);

      expect(isPatchValid(graph, patch)).toBe(true);
    });

    it('should return false for invalid patch', () => {
      const scene = createScene('nonexistent_beat');
      const patch = createMinimalPatch('sv0', [{ op: 'ADD_NODE', node: scene }]);

      expect(isPatchValid(graph, patch)).toBe(false);
    });
  });

  describe('Beat constraints', () => {
    it('should reject beat with act outside 1-5', () => {
      const badBeat = {
        type: 'Beat' as const,
        id: 'beat_extra',
        beat_type: 'Setup' as const,
        act: 6,
        position_index: 16,
        status: 'EMPTY' as const,
      };
      graph.nodes.set(badBeat.id, badBeat);

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) => e.code === 'OUT_OF_RANGE' && e.field === 'act')
      ).toBe(true);
    });

    it('should reject beat with position_index outside 1-15', () => {
      const badBeat = {
        type: 'Beat' as const,
        id: 'beat_extra',
        beat_type: 'Setup' as const,
        act: 1,
        position_index: 0,
        status: 'EMPTY' as const,
      };
      graph.nodes.set(badBeat.id, badBeat);

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.code === 'OUT_OF_RANGE' && e.field === 'position_index'
        )
      ).toBe(true);
    });
  });

});
