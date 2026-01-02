import { describe, it, expect, beforeEach } from 'vitest';
import { validateGraph, validatePatch } from '../src/core/validator.js';
import { createEmptyGraph } from '../src/core/graph.js';
import type { GraphState } from '../src/core/graph.js';
import type { Beat, BeatType } from '../src/types/nodes.js';
import { BEAT_ACT_MAP, BEAT_POSITION_MAP } from '../src/types/nodes.js';
import {
  createGraphWith15Beats,
  createMinimalPatch,
  createAll15Beats,
} from './helpers/index.js';
import { createScene, resetIdCounter } from './helpers/index.js';
import { fixtures } from './fixtures/index.js';

describe('Structural Invariants', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('Exactly 15 beats requirement', () => {
    it('should validate graph with exactly 15 beats', () => {
      const graph = createGraphWith15Beats();

      const result = validateGraph(graph);

      expect(result.success).toBe(true);
    });

    it('should reject graph with fewer than 15 beats', () => {
      const graph = createEmptyGraph();
      const beats = createAll15Beats().slice(0, 10); // Only 10 beats
      for (const beat of beats) {
        graph.nodes.set(beat.id, beat);
      }

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.code === 'CONSTRAINT_VIOLATION' && e.message.includes('15 beats')
        )
      ).toBe(true);
    });

    it('should reject graph with more than 15 beats', () => {
      const graph = createGraphWith15Beats();
      // Add a 16th beat
      const extraBeat: Beat = {
        type: 'Beat',
        id: 'beat_Extra',
        beat_type: 'Setup', // Duplicate type will also be caught
        act: 1,
        position_index: 16, // Outside valid range
        status: 'EMPTY',
      };
      graph.nodes.set(extraBeat.id, extraBeat);

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
    });

    it('should reject patch that would delete a beat (leaving 14)', () => {
      const graph = createGraphWith15Beats();

      const patch = createMinimalPatch('sv0', [
        { op: 'DELETE_NODE', id: 'beat_Catalyst' },
      ]);

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes('15 beats'))).toBe(
        true
      );
    });
  });

  describe('beat_type + position_index uniqueness', () => {
    it('should reject duplicate beat_type', () => {
      const graph = createEmptyGraph();
      const beats = createAll15Beats();

      // Modify one beat to have duplicate beat_type
      beats[1]!.beat_type = beats[0]!.beat_type; // Two OpeningImage beats

      for (const beat of beats) {
        graph.nodes.set(beat.id, beat);
      }

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.code === 'CONSTRAINT_VIOLATION' &&
            e.message.includes('Duplicate beat_type')
        )
      ).toBe(true);
    });

    it('should reject duplicate position_index', () => {
      const graph = createEmptyGraph();
      const beats = createAll15Beats();

      // Modify one beat to have duplicate position_index
      beats[1]!.position_index = beats[0]!.position_index; // Two position 1

      for (const beat of beats) {
        graph.nodes.set(beat.id, beat);
      }

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.code === 'CONSTRAINT_VIOLATION' &&
            e.message.includes('Duplicate beat position_index')
        )
      ).toBe(true);
    });

    it('should validate all beats have correct act mapping', () => {
      const graph = createGraphWith15Beats();

      // Verify each beat has correct act
      const beatTypes = Object.keys(BEAT_ACT_MAP) as BeatType[];
      for (const beatType of beatTypes) {
        const beat = graph.nodes.get(`beat_${beatType}`) as Beat;
        expect(beat).toBeDefined();
        expect(beat.act).toBe(BEAT_ACT_MAP[beatType]);
        expect(beat.position_index).toBe(BEAT_POSITION_MAP[beatType]);
      }
    });

    it('should reject beat with invalid act (not 1-5)', () => {
      const graph = createEmptyGraph();
      const beats = createAll15Beats();
      beats[0]!.act = 6 as unknown as 1 | 2 | 3 | 4 | 5; // Invalid act

      for (const beat of beats) {
        graph.nodes.set(beat.id, beat);
      }

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.code === 'OUT_OF_RANGE')).toBe(true);
    });

    it('should reject beat with position_index outside 1-15', () => {
      const graph = createEmptyGraph();
      const beats = createAll15Beats();
      beats[0]!.position_index = 0; // Invalid

      for (const beat of beats) {
        graph.nodes.set(beat.id, beat);
      }

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.code === 'OUT_OF_RANGE' && e.message.includes('position_index')
        )
      ).toBe(true);
    });
  });

  describe('Scene must have exactly one beat assignment', () => {
    it('should validate scene with valid beat_id', () => {
      const graph = createGraphWith15Beats();
      const scene = createScene('beat_Catalyst', { id: 'scene_test' });
      graph.nodes.set(scene.id, scene);

      const result = validateGraph(graph);

      expect(result.success).toBe(true);
    });

    it('should reject scene with non-existent beat_id', () => {
      const graph = createGraphWith15Beats();
      const scene = createScene('beat_NonExistent', { id: 'scene_orphan' });
      graph.nodes.set(scene.id, scene);

      const result = validateGraph(graph);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.code === 'FK_INTEGRITY' && e.field === 'beat_id'
        )
      ).toBe(true);
    });

    it('should allow multiple scenes per beat (order_index differentiates)', () => {
      const graph = createGraphWith15Beats();
      const scene1 = createScene('beat_Catalyst', { id: 'scene_1', order_index: 1 });
      const scene2 = createScene('beat_Catalyst', { id: 'scene_2', order_index: 2 });
      graph.nodes.set(scene1.id, scene1);
      graph.nodes.set(scene2.id, scene2);

      const result = validateGraph(graph);

      expect(result.success).toBe(true);
    });
  });

  describe('Golden fixture structural validation', () => {
    it('empty_story_sv0 should have exactly 15 beats', () => {
      const graph = fixtures.emptyStory();
      const beats = Array.from(graph.nodes.values()).filter(
        (n) => n.type === 'Beat'
      );

      expect(beats.length).toBe(15);
    });

    it('after_acceptance_sv1 should maintain 15 beats', () => {
      const graph = fixtures.afterAcceptance();
      const beats = Array.from(graph.nodes.values()).filter(
        (n) => n.type === 'Beat'
      );

      expect(beats.length).toBe(15);
      expect(validateGraph(graph).success).toBe(true);
    });

    it('empty_story should have all unique beat_types', () => {
      const graph = fixtures.emptyStory();
      const beats = Array.from(graph.nodes.values()).filter(
        (n) => n.type === 'Beat'
      ) as Beat[];

      const beatTypes = new Set(beats.map((b) => b.beat_type));
      expect(beatTypes.size).toBe(15);
    });

    it('empty_story should have all unique position_indices 1-15', () => {
      const graph = fixtures.emptyStory();
      const beats = Array.from(graph.nodes.values()).filter(
        (n) => n.type === 'Beat'
      ) as Beat[];

      const positions = new Set(beats.map((b) => b.position_index));
      expect(positions.size).toBe(15);
      for (let i = 1; i <= 15; i++) {
        expect(positions.has(i)).toBe(true);
      }
    });
  });

  describe('Beat status validation', () => {
    it('should allow valid beat statuses', () => {
      const graph = createGraphWith15Beats();

      // Update a beat to REALIZED
      const catalystBeat = graph.nodes.get('beat_Catalyst') as Beat;
      catalystBeat.status = 'REALIZED';
      graph.nodes.set(catalystBeat.id, catalystBeat);

      const result = validateGraph(graph);

      expect(result.success).toBe(true);
    });
  });

  describe('Act-beat mapping consistency', () => {
    it('Act 1 beats should have position_index 1-5', () => {
      const act1Beats: BeatType[] = [
        'OpeningImage',
        'ThemeStated',
        'Setup',
        'Catalyst',
        'Debate',
      ];

      for (const beatType of act1Beats) {
        expect(BEAT_ACT_MAP[beatType]).toBe(1);
        expect(BEAT_POSITION_MAP[beatType]).toBeGreaterThanOrEqual(1);
        expect(BEAT_POSITION_MAP[beatType]).toBeLessThanOrEqual(5);
      }
    });

    it('Act 2 beats should have position_index 6-8', () => {
      const act2Beats: BeatType[] = ['BreakIntoTwo', 'BStory', 'FunAndGames'];

      for (const beatType of act2Beats) {
        expect(BEAT_ACT_MAP[beatType]).toBe(2);
        expect(BEAT_POSITION_MAP[beatType]).toBeGreaterThanOrEqual(6);
        expect(BEAT_POSITION_MAP[beatType]).toBeLessThanOrEqual(8);
      }
    });

    it('Act 3 beats should have position_index 9-10', () => {
      const act3Beats: BeatType[] = ['Midpoint', 'BadGuysCloseIn'];

      for (const beatType of act3Beats) {
        expect(BEAT_ACT_MAP[beatType]).toBe(3);
        expect(BEAT_POSITION_MAP[beatType]).toBeGreaterThanOrEqual(9);
        expect(BEAT_POSITION_MAP[beatType]).toBeLessThanOrEqual(10);
      }
    });

    it('Act 4 beats should have position_index 11-12', () => {
      const act4Beats: BeatType[] = ['AllIsLost', 'DarkNightOfSoul'];

      for (const beatType of act4Beats) {
        expect(BEAT_ACT_MAP[beatType]).toBe(4);
        expect(BEAT_POSITION_MAP[beatType]).toBeGreaterThanOrEqual(11);
        expect(BEAT_POSITION_MAP[beatType]).toBeLessThanOrEqual(12);
      }
    });

    it('Act 5 beats should have position_index 13-15', () => {
      const act5Beats: BeatType[] = ['BreakIntoThree', 'Finale', 'FinalImage'];

      for (const beatType of act5Beats) {
        expect(BEAT_ACT_MAP[beatType]).toBe(5);
        expect(BEAT_POSITION_MAP[beatType]).toBeGreaterThanOrEqual(13);
        expect(BEAT_POSITION_MAP[beatType]).toBeLessThanOrEqual(15);
      }
    });
  });
});
