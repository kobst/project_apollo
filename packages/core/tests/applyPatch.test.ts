import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyPatch,
  applyPatches,
  tryApplyPatch,
  PatchApplicationError,
} from '../src/core/applyPatch.js';
import type { GraphState } from '../src/core/graph.js';
import type { Patch } from '../src/types/patch.js';
import {
  createGraphWith15Beats,
  createMinimalPatch,
  deepFreeze,
} from './helpers/index.js';
import {
  createScene,
  createCharacter,
  createLocation,
  resetIdCounter,
} from './helpers/index.js';
import { edges } from './helpers/index.js';
import { fixtures } from './fixtures/index.js';

describe('applyPatch', () => {
  let graph: GraphState;

  beforeEach(() => {
    resetIdCounter();
    graph = createGraphWith15Beats();
  });

  describe('ADD_NODE operations', () => {
    it('should add a new Scene node', () => {
      const scene = createScene('beat_Catalyst');
      const patch = createMinimalPatch('sv0', [{ op: 'ADD_NODE', node: scene }]);

      const result = applyPatch(graph, patch);

      expect(result.nodes.get(scene.id)).toEqual(scene);
      expect(result.nodes.size).toBe(graph.nodes.size + 1);
    });

    it('should add multiple nodes in sequence', () => {
      const char = createCharacter();
      const loc = createLocation();
      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: char },
        { op: 'ADD_NODE', node: loc },
      ]);

      const result = applyPatch(graph, patch);

      expect(result.nodes.has(char.id)).toBe(true);
      expect(result.nodes.has(loc.id)).toBe(true);
    });

    it('should fail on duplicate node ID', () => {
      const scene = createScene('beat_Catalyst', { id: 'beat_Catalyst' });
      const patch = createMinimalPatch('sv0', [{ op: 'ADD_NODE', node: scene }]);

      expect(() => applyPatch(graph, patch)).toThrow(PatchApplicationError);
    });
  });

  describe('UPDATE_NODE operations', () => {
    it('should update existing node fields', () => {
      const patch = createMinimalPatch('sv0', [
        {
          op: 'UPDATE_NODE',
          id: 'beat_Catalyst',
          set: { status: 'REALIZED', notes: 'Updated via patch' },
        },
      ]);

      const result = applyPatch(graph, patch);
      const updated = result.nodes.get('beat_Catalyst');

      expect(updated).toBeDefined();
      expect((updated as Record<string, unknown>).status).toBe('REALIZED');
      expect((updated as Record<string, unknown>).notes).toBe('Updated via patch');
    });

    it('should unset optional fields', () => {
      const char = createCharacter({ description: 'To be removed' });
      graph.nodes.set(char.id, char);

      const patch = createMinimalPatch('sv0', [
        { op: 'UPDATE_NODE', id: char.id, set: {}, unset: ['description'] },
      ]);

      const result = applyPatch(graph, patch);
      const updated = result.nodes.get(char.id);

      expect((updated as Record<string, unknown>).description).toBeUndefined();
    });

    it('should fail when updating id field', () => {
      const patch = createMinimalPatch('sv0', [
        { op: 'UPDATE_NODE', id: 'beat_Catalyst', set: { id: 'new_id' } },
      ]);

      expect(() => applyPatch(graph, patch)).toThrow('Cannot update node ID');
    });

    it('should fail when updating type field', () => {
      const patch = createMinimalPatch('sv0', [
        { op: 'UPDATE_NODE', id: 'beat_Catalyst', set: { type: 'Scene' } },
      ]);

      expect(() => applyPatch(graph, patch)).toThrow('Cannot update node type');
    });

    it('should fail when unsetting required fields', () => {
      const patch = createMinimalPatch('sv0', [
        { op: 'UPDATE_NODE', id: 'beat_Catalyst', set: {}, unset: ['type'] },
      ]);

      expect(() => applyPatch(graph, patch)).toThrow('Cannot unset required field');
    });

    it('should fail on non-existent node', () => {
      const patch = createMinimalPatch('sv0', [
        { op: 'UPDATE_NODE', id: 'nonexistent', set: { status: 'EMPTY' } },
      ]);

      expect(() => applyPatch(graph, patch)).toThrow('not found');
    });
  });

  describe('DELETE_NODE operations', () => {
    it('should delete existing node', () => {
      const char = createCharacter();
      graph.nodes.set(char.id, char);

      const patch = createMinimalPatch('sv0', [{ op: 'DELETE_NODE', id: char.id }]);

      const result = applyPatch(graph, patch);

      expect(result.nodes.has(char.id)).toBe(false);
    });

    it('should remove incident edges when deleting node', () => {
      const char = createCharacter({ id: 'char_test' });
      const scene = createScene('beat_Catalyst', { id: 'scene_test' });
      graph.nodes.set(char.id, char);
      graph.nodes.set(scene.id, scene);
      graph.edges.push(edges.hasCharacter('scene_test', 'char_test'));

      const patch = createMinimalPatch('sv0', [
        { op: 'DELETE_NODE', id: 'char_test' },
      ]);

      const result = applyPatch(graph, patch);

      expect(result.edges.length).toBe(0);
    });

    it('should fail on non-existent node', () => {
      const patch = createMinimalPatch('sv0', [
        { op: 'DELETE_NODE', id: 'nonexistent' },
      ]);

      expect(() => applyPatch(graph, patch)).toThrow('not found');
    });
  });

  describe('ADD_EDGE operations', () => {
    it('should add a new edge', () => {
      const char = createCharacter({ id: 'char_test' });
      const scene = createScene('beat_Catalyst', { id: 'scene_test' });
      graph.nodes.set(char.id, char);
      graph.nodes.set(scene.id, scene);

      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_EDGE', edge: edges.hasCharacter('scene_test', 'char_test') },
      ]);

      const result = applyPatch(graph, patch);

      expect(result.edges.length).toBe(1);
      expect(result.edges[0]).toEqual(
        edges.hasCharacter('scene_test', 'char_test')
      );
    });

    it('should fail on duplicate edge', () => {
      const char = createCharacter({ id: 'char_test' });
      const scene = createScene('beat_Catalyst', { id: 'scene_test' });
      graph.nodes.set(char.id, char);
      graph.nodes.set(scene.id, scene);
      graph.edges.push(edges.hasCharacter('scene_test', 'char_test'));

      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_EDGE', edge: edges.hasCharacter('scene_test', 'char_test') },
      ]);

      expect(() => applyPatch(graph, patch)).toThrow('already exists');
    });
  });

  describe('DELETE_EDGE operations', () => {
    it('should delete existing edge', () => {
      const char = createCharacter({ id: 'char_test' });
      const scene = createScene('beat_Catalyst', { id: 'scene_test' });
      graph.nodes.set(char.id, char);
      graph.nodes.set(scene.id, scene);
      graph.edges.push(edges.hasCharacter('scene_test', 'char_test'));

      const patch = createMinimalPatch('sv0', [
        {
          op: 'DELETE_EDGE',
          edge: edges.hasCharacter('scene_test', 'char_test'),
        },
      ]);

      const result = applyPatch(graph, patch);

      expect(result.edges.length).toBe(0);
    });

    it('should fail on non-existent edge', () => {
      const patch = createMinimalPatch('sv0', [
        {
          op: 'DELETE_EDGE',
          edge: edges.hasCharacter('nonexistent', 'also_nonexistent'),
        },
      ]);

      expect(() => applyPatch(graph, patch)).toThrow('not found');
    });
  });

  describe('Immutability', () => {
    it('should not modify the original graph', () => {
      const originalNodeCount = graph.nodes.size;
      const originalEdgeCount = graph.edges.length;

      const scene = createScene('beat_Catalyst');
      const patch = createMinimalPatch('sv0', [{ op: 'ADD_NODE', node: scene }]);

      const result = applyPatch(graph, patch);

      // Original unchanged
      expect(graph.nodes.size).toBe(originalNodeCount);
      expect(graph.edges.length).toBe(originalEdgeCount);
      // New graph has changes
      expect(result.nodes.size).toBe(originalNodeCount + 1);
      expect(result).not.toBe(graph);
    });

    it('should not modify frozen graph', () => {
      const frozenGraph = deepFreeze(createGraphWith15Beats());
      const scene = createScene('beat_Catalyst');
      const patch = createMinimalPatch('sv0', [{ op: 'ADD_NODE', node: scene }]);

      // Should not throw due to frozen object
      const result = applyPatch(frozenGraph, patch);

      expect(result.nodes.has(scene.id)).toBe(true);
      expect(result).not.toBe(frozenGraph);
    });
  });

  describe('applyPatches (multiple patches)', () => {
    it('should apply patches in sequence', () => {
      const patch1 = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: createCharacter({ id: 'char_1' }) },
      ]);
      const patch2 = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: createCharacter({ id: 'char_2' }) },
      ]);

      const result = applyPatches(graph, [patch1, patch2]);

      expect(result.nodes.has('char_1')).toBe(true);
      expect(result.nodes.has('char_2')).toBe(true);
    });

    it('should allow later patches to reference nodes from earlier patches', () => {
      const patch1 = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: createCharacter({ id: 'char_1' }) },
        { op: 'ADD_NODE', node: createScene('beat_Catalyst', { id: 'scene_1' }) },
      ]);
      const patch2 = createMinimalPatch('sv0', [
        { op: 'ADD_EDGE', edge: edges.hasCharacter('scene_1', 'char_1') },
      ]);

      const result = applyPatches(graph, [patch1, patch2]);

      expect(result.edges.length).toBe(1);
    });
  });

  describe('tryApplyPatch', () => {
    it('should return graph on success', () => {
      const scene = createScene('beat_Catalyst');
      const patch = createMinimalPatch('sv0', [{ op: 'ADD_NODE', node: scene }]);

      const result = tryApplyPatch(graph, patch);

      expect(result).not.toBeNull();
      expect(result?.nodes.has(scene.id)).toBe(true);
    });

    it('should return null on failure', () => {
      const patch = createMinimalPatch('sv0', [
        { op: 'DELETE_NODE', id: 'nonexistent' },
      ]);

      const result = tryApplyPatch(graph, patch);

      expect(result).toBeNull();
    });
  });

  describe('PatchApplicationError', () => {
    it('should include operation index and op', () => {
      const patch = createMinimalPatch('sv0', [
        { op: 'ADD_NODE', node: createCharacter({ id: 'char_1' }) },
        { op: 'DELETE_NODE', id: 'nonexistent' },
      ]);

      try {
        applyPatch(graph, patch);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PatchApplicationError);
        const error = e as PatchApplicationError;
        expect(error.opIndex).toBe(1);
        expect(error.op.op).toBe('DELETE_NODE');
      }
    });
  });

  describe('Golden fixture patches', () => {
    it('should apply seed_from_input_patch successfully', () => {
      const emptyGraph = fixtures.emptyStory();
      const seedPatch = fixtures.seedPatch();

      const result = applyPatch(emptyGraph, seedPatch);

      expect(result.nodes.has('char_protagonist')).toBe(true);
      expect(result.nodes.has('conf_central')).toBe(true);
      expect(result.nodes.has('loc_hometown')).toBe(true);
      expect(result.edges.length).toBe(1);
    });
  });
});
