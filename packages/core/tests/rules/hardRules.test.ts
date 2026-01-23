/**
 * Unit tests for hard lint rules
 *
 * Tests cover:
 * - Violation detection (positive cases)
 * - No false positives (negative cases)
 * - Fix generation and correctness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphState } from '../../src/core/graph.js';
import type { Beat, Scene, StoryBeat } from '../../src/types/nodes.js';
import { BEAT_ACT_MAP, BEAT_POSITION_MAP } from '../../src/types/nodes.js';
import {
  SCENE_ACT_BOUNDARY,
  STC_BEAT_ORDERING,
  EDGE_ORDER_UNIQUE,
  SB_DAG_NO_CYCLES,
  SB_ACT_ALIGNMENT,
} from '../../src/rules/hardRules.js';
import { applyPatch } from '../../src/core/applyPatch.js';
import {
  createGraphWith15Beats,
  createScene,
  createCharacter,
  createStoryBeat,
  resetIdCounter,
  createEdge,
  edges,
} from '../helpers/index.js';

describe('Hard Rules', () => {
  let graph: GraphState;

  beforeEach(() => {
    resetIdCounter();
    graph = createGraphWith15Beats();
  });

  // ===========================================================================
  // SCENE_ACT_BOUNDARY
  // ===========================================================================

  describe('SCENE_ACT_BOUNDARY', () => {
    it('should detect scene linked to beat with wrong act', () => {
      // Corrupt the Catalyst beat's act (should be Act 1, set to Act 3)
      const catalystBeat = graph.nodes.get('beat_Catalyst') as Beat;
      const corruptedBeat = { ...catalystBeat, act: 3 as const };
      graph.nodes.set('beat_Catalyst', corruptedBeat);

      // Add a scene to this beat
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(scene.id, scene);

      const violations = SCENE_ACT_BOUNDARY.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('SCENE_ACT_BOUNDARY');
      expect(violations[0].severity).toBe('hard');
      expect(violations[0].message).toContain('Act 3');
      expect(violations[0].message).toContain('Act 1'); // expected act
    });

    it('should not flag scene when beat has correct act', () => {
      // beat_Catalyst should have act 1 by default
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(scene.id, scene);

      const violations = SCENE_ACT_BOUNDARY.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should generate a fix that corrects the beat act', () => {
      // Corrupt the Midpoint beat's act (should be Act 3, set to Act 1)
      const midpointBeat = graph.nodes.get('beat_Midpoint') as Beat;
      const expectedAct = BEAT_ACT_MAP['Midpoint']; // Should be 3
      const corruptedBeat = { ...midpointBeat, act: 1 as const };
      graph.nodes.set('beat_Midpoint', corruptedBeat);

      // Add a scene to this beat
      const scene = createScene('beat_Midpoint', { id: 'scene_1' });
      graph.nodes.set(scene.id, scene);

      const violations = SCENE_ACT_BOUNDARY.evaluate(graph, { mode: 'full' });
      expect(violations).toHaveLength(1);

      const fix = SCENE_ACT_BOUNDARY.suggestFix!(graph, violations[0]);
      expect(fix).not.toBeNull();
      expect(fix!.label).toContain('Midpoint');
      expect(fix!.label).toContain(`Act ${expectedAct}`);

      // Apply the fix
      const newGraph = applyPatch(graph, fix!.patch);

      // Verify beat now has correct act
      const updatedBeat = newGraph.nodes.get('beat_Midpoint') as Beat;
      expect(updatedBeat.act).toBe(expectedAct);

      // Verify no more violations
      const newViolations = SCENE_ACT_BOUNDARY.evaluate(newGraph, { mode: 'full' });
      expect(newViolations).toHaveLength(0);
    });
  });

  // ===========================================================================
  // STC_BEAT_ORDERING
  // ===========================================================================

  describe('STC_BEAT_ORDERING', () => {
    it('should detect beat with wrong position_index', () => {
      // Corrupt the Catalyst beat's position (should be 4, set to 10)
      const catalystBeat = graph.nodes.get('beat_Catalyst') as Beat;
      const corruptedBeat = { ...catalystBeat, position_index: 10 };
      graph.nodes.set('beat_Catalyst', corruptedBeat);

      const violations = STC_BEAT_ORDERING.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('STC_BEAT_ORDERING');
      expect(violations[0].severity).toBe('hard');
      expect(violations[0].message).toContain('position_index 10');
      expect(violations[0].message).toContain('should be 4');
    });

    it('should not flag beats with correct position_index', () => {
      // Default graph should have all correct positions
      const violations = STC_BEAT_ORDERING.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should detect multiple beats with wrong positions', () => {
      // Corrupt multiple beats
      const catalyst = graph.nodes.get('beat_Catalyst') as Beat;
      const midpoint = graph.nodes.get('beat_Midpoint') as Beat;
      graph.nodes.set('beat_Catalyst', { ...catalyst, position_index: 99 });
      graph.nodes.set('beat_Midpoint', { ...midpoint, position_index: 99 });

      const violations = STC_BEAT_ORDERING.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(2);
    });

    it('should generate a fix that corrects the position_index', () => {
      // Corrupt the FinalImage beat's position (should be 15, set to 1)
      const finalImageBeat = graph.nodes.get('beat_FinalImage') as Beat;
      const expectedPosition = BEAT_POSITION_MAP['FinalImage']; // Should be 15
      const corruptedBeat = { ...finalImageBeat, position_index: 1 };
      graph.nodes.set('beat_FinalImage', corruptedBeat);

      const violations = STC_BEAT_ORDERING.evaluate(graph, { mode: 'full' });
      expect(violations).toHaveLength(1);

      const fix = STC_BEAT_ORDERING.suggestFix!(graph, violations[0]);
      expect(fix).not.toBeNull();
      expect(fix!.label).toContain('FinalImage');
      expect(fix!.label).toContain(`position ${expectedPosition}`);

      // Apply the fix
      const newGraph = applyPatch(graph, fix!.patch);

      // Verify beat now has correct position
      const updatedBeat = newGraph.nodes.get('beat_FinalImage') as Beat;
      expect(updatedBeat.position_index).toBe(expectedPosition);

      // Verify no more violations
      const newViolations = STC_BEAT_ORDERING.evaluate(newGraph, { mode: 'full' });
      expect(newViolations).toHaveLength(0);
    });
  });

  // ===========================================================================
  // EDGE_ORDER_UNIQUE
  // ===========================================================================

  describe('EDGE_ORDER_UNIQUE', () => {
    it('should detect duplicate order on edges of same type from same parent', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      const char1 = createCharacter({ id: 'char_1' });
      const char2 = createCharacter({ id: 'char_2' });
      graph.nodes.set(scene.id, scene);
      graph.nodes.set(char1.id, char1);
      graph.nodes.set(char2.id, char2);

      // Add two HAS_CHARACTER edges with same order
      graph.edges.push(
        createEdge('HAS_CHARACTER', scene.id, char1.id, {
          id: 'edge_1',
          properties: { order: 1 },
        })
      );
      graph.edges.push(
        createEdge('HAS_CHARACTER', scene.id, char2.id, {
          id: 'edge_2',
          properties: { order: 1 },
        })
      );

      const violations = EDGE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('EDGE_ORDER_UNIQUE');
      expect(violations[0].severity).toBe('hard');
      expect(violations[0].message).toContain('HAS_CHARACTER');
      expect(violations[0].message).toContain('order 1');
    });

    it('should not flag edges with unique order values', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      const char1 = createCharacter({ id: 'char_1' });
      const char2 = createCharacter({ id: 'char_2' });
      graph.nodes.set(scene.id, scene);
      graph.nodes.set(char1.id, char1);
      graph.nodes.set(char2.id, char2);

      graph.edges.push(
        createEdge('HAS_CHARACTER', scene.id, char1.id, {
          id: 'edge_1',
          properties: { order: 1 },
        })
      );
      graph.edges.push(
        createEdge('HAS_CHARACTER', scene.id, char2.id, {
          id: 'edge_2',
          properties: { order: 2 },
        })
      );

      const violations = EDGE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should not flag edges with same order from different parents', () => {
      const scene1 = createScene('beat_Catalyst', { id: 'scene_1' });
      const scene2 = createScene('beat_Midpoint', { id: 'scene_2' });
      const char1 = createCharacter({ id: 'char_1' });
      const char2 = createCharacter({ id: 'char_2' });
      graph.nodes.set(scene1.id, scene1);
      graph.nodes.set(scene2.id, scene2);
      graph.nodes.set(char1.id, char1);
      graph.nodes.set(char2.id, char2);

      // Same order but different parent scenes
      graph.edges.push(
        createEdge('HAS_CHARACTER', scene1.id, char1.id, {
          id: 'edge_1',
          properties: { order: 1 },
        })
      );
      graph.edges.push(
        createEdge('HAS_CHARACTER', scene2.id, char2.id, {
          id: 'edge_2',
          properties: { order: 1 },
        })
      );

      const violations = EDGE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should not flag edges without order property', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      const char1 = createCharacter({ id: 'char_1' });
      const char2 = createCharacter({ id: 'char_2' });
      graph.nodes.set(scene.id, scene);
      graph.nodes.set(char1.id, char1);
      graph.nodes.set(char2.id, char2);

      // Edges without order property
      graph.edges.push(createEdge('HAS_CHARACTER', scene.id, char1.id, { id: 'edge_1' }));
      graph.edges.push(createEdge('HAS_CHARACTER', scene.id, char2.id, { id: 'edge_2' }));

      const violations = EDGE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should generate fix that reindexes edges sequentially', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      const char1 = createCharacter({ id: 'char_1' });
      const char2 = createCharacter({ id: 'char_2' });
      const char3 = createCharacter({ id: 'char_3' });
      graph.nodes.set(scene.id, scene);
      graph.nodes.set(char1.id, char1);
      graph.nodes.set(char2.id, char2);
      graph.nodes.set(char3.id, char3);

      // All edges with same order
      graph.edges.push(
        createEdge('HAS_CHARACTER', scene.id, char1.id, {
          id: 'edge_1',
          properties: { order: 1 },
        })
      );
      graph.edges.push(
        createEdge('HAS_CHARACTER', scene.id, char2.id, {
          id: 'edge_2',
          properties: { order: 1 },
        })
      );
      graph.edges.push(
        createEdge('HAS_CHARACTER', scene.id, char3.id, {
          id: 'edge_3',
          properties: { order: 1 },
        })
      );

      const violations = EDGE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });
      expect(violations).toHaveLength(1);

      const fix = EDGE_ORDER_UNIQUE.suggestFix!(graph, violations[0]);
      expect(fix).not.toBeNull();
      expect(fix!.label).toContain('Re-index');
      expect(fix!.label).toContain('3');
      expect(fix!.affectedNodeIds).toHaveLength(3);

      // Apply the fix
      const newGraph = applyPatch(graph, fix!.patch);

      // Verify edges now have sequential order values
      const updatedEdges = newGraph.edges
        .filter((e) => e.type === 'HAS_CHARACTER')
        .sort((a, b) => (a.properties?.order ?? 0) - (b.properties?.order ?? 0));

      const orderValues = updatedEdges.map((e) => e.properties?.order);
      expect(orderValues).toEqual([1, 2, 3]);

      // Verify no more violations
      const newViolations = EDGE_ORDER_UNIQUE.evaluate(newGraph, { mode: 'full' });
      expect(newViolations).toHaveLength(0);
    });
  });

  // ===========================================================================
  // SB_DAG_NO_CYCLES
  // ===========================================================================

  describe('SB_DAG_NO_CYCLES', () => {
    it('should detect simple cycle in PRECEDES edges', () => {
      // Create A -> B -> C -> A cycle
      const sbA = createStoryBeat({ id: 'sb_a', title: 'Story Beat A' });
      const sbB = createStoryBeat({ id: 'sb_b', title: 'Story Beat B' });
      const sbC = createStoryBeat({ id: 'sb_c', title: 'Story Beat C' });
      graph.nodes.set(sbA.id, sbA);
      graph.nodes.set(sbB.id, sbB);
      graph.nodes.set(sbC.id, sbC);

      graph.edges.push(edges.precedes('sb_a', 'sb_b', 'edge_ab'));
      graph.edges.push(edges.precedes('sb_b', 'sb_c', 'edge_bc'));
      graph.edges.push(edges.precedes('sb_c', 'sb_a', 'edge_ca')); // Creates cycle

      const violations = SB_DAG_NO_CYCLES.evaluate(graph, { mode: 'full' });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe('SB_DAG_NO_CYCLES');
      expect(violations[0].severity).toBe('hard');
      expect(violations[0].message).toContain('cycle');
    });

    it('should detect self-referential cycle', () => {
      const sb = createStoryBeat({ id: 'sb_self', title: 'Self-referencing SB' });
      graph.nodes.set(sb.id, sb);

      graph.edges.push(edges.precedes('sb_self', 'sb_self', 'edge_self'));

      const violations = SB_DAG_NO_CYCLES.evaluate(graph, { mode: 'full' });

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe('SB_DAG_NO_CYCLES');
    });

    it('should not flag valid DAG (no cycles)', () => {
      // Create A -> B -> C (linear, no cycle)
      const sbA = createStoryBeat({ id: 'sb_a', title: 'Story Beat A' });
      const sbB = createStoryBeat({ id: 'sb_b', title: 'Story Beat B' });
      const sbC = createStoryBeat({ id: 'sb_c', title: 'Story Beat C' });
      graph.nodes.set(sbA.id, sbA);
      graph.nodes.set(sbB.id, sbB);
      graph.nodes.set(sbC.id, sbC);

      graph.edges.push(edges.precedes('sb_a', 'sb_b', 'edge_ab'));
      graph.edges.push(edges.precedes('sb_b', 'sb_c', 'edge_bc'));

      const violations = SB_DAG_NO_CYCLES.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should not flag diamond DAG (convergent paths)', () => {
      // Create diamond: A -> B, A -> C, B -> D, C -> D
      const sbA = createStoryBeat({ id: 'sb_a', title: 'Story Beat A' });
      const sbB = createStoryBeat({ id: 'sb_b', title: 'Story Beat B' });
      const sbC = createStoryBeat({ id: 'sb_c', title: 'Story Beat C' });
      const sbD = createStoryBeat({ id: 'sb_d', title: 'Story Beat D' });
      graph.nodes.set(sbA.id, sbA);
      graph.nodes.set(sbB.id, sbB);
      graph.nodes.set(sbC.id, sbC);
      graph.nodes.set(sbD.id, sbD);

      graph.edges.push(edges.precedes('sb_a', 'sb_b', 'edge_ab'));
      graph.edges.push(edges.precedes('sb_a', 'sb_c', 'edge_ac'));
      graph.edges.push(edges.precedes('sb_b', 'sb_d', 'edge_bd'));
      graph.edges.push(edges.precedes('sb_c', 'sb_d', 'edge_cd'));

      const violations = SB_DAG_NO_CYCLES.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should not provide auto-fix (user must decide)', () => {
      const sbA = createStoryBeat({ id: 'sb_a', title: 'Story Beat A' });
      const sbB = createStoryBeat({ id: 'sb_b', title: 'Story Beat B' });
      graph.nodes.set(sbA.id, sbA);
      graph.nodes.set(sbB.id, sbB);

      graph.edges.push(edges.precedes('sb_a', 'sb_b', 'edge_ab'));
      graph.edges.push(edges.precedes('sb_b', 'sb_a', 'edge_ba'));

      const violations = SB_DAG_NO_CYCLES.evaluate(graph, { mode: 'full' });
      expect(violations.length).toBeGreaterThan(0);

      const fix = SB_DAG_NO_CYCLES.suggestFix!(graph, violations[0]);
      expect(fix).toBeNull(); // No auto-fix for cycles
    });
  });

  // ===========================================================================
  // SB_ACT_ALIGNMENT
  // ===========================================================================

  describe('SB_ACT_ALIGNMENT', () => {
    it('should detect StoryBeat act mismatch with aligned Beat', () => {
      // Create a StoryBeat with act=1 aligned to a beat in act=3 (Midpoint)
      const sb = createStoryBeat({
        id: 'sb_1',
        title: 'Midpoint Revelation',
        act: 1, // Wrong - should match beat's act (3)
      });
      graph.nodes.set(sb.id, sb);

      // Align to Midpoint beat (which is in Act 3)
      graph.edges.push(edges.alignsWith('sb_1', 'beat_Midpoint', 'edge_align'));

      const violations = SB_ACT_ALIGNMENT.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('SB_ACT_ALIGNMENT');
      expect(violations[0].severity).toBe('hard');
      expect(violations[0].message).toContain('Act 1');
      expect(violations[0].message).toContain('Act 3');
    });

    it('should not flag StoryBeat with matching act', () => {
      // Create a StoryBeat with act=3 aligned to Midpoint (also act 3)
      const sb = createStoryBeat({
        id: 'sb_1',
        title: 'Midpoint Revelation',
        act: 3,
      });
      graph.nodes.set(sb.id, sb);

      graph.edges.push(edges.alignsWith('sb_1', 'beat_Midpoint', 'edge_align'));

      const violations = SB_ACT_ALIGNMENT.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should not flag StoryBeat without act set', () => {
      // StoryBeat without act field shouldn't trigger the rule
      const sb = createStoryBeat({
        id: 'sb_1',
        title: 'Unassigned SB',
        // No act set
      });
      graph.nodes.set(sb.id, sb);

      graph.edges.push(edges.alignsWith('sb_1', 'beat_Midpoint', 'edge_align'));

      const violations = SB_ACT_ALIGNMENT.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should not flag StoryBeat without ALIGNS_WITH edge', () => {
      // StoryBeat with act but no alignment shouldn't trigger the rule
      const sb = createStoryBeat({
        id: 'sb_1',
        title: 'Unaligned SB',
        act: 2,
      });
      graph.nodes.set(sb.id, sb);

      // No ALIGNS_WITH edge

      const violations = SB_ACT_ALIGNMENT.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should generate fix that updates StoryBeat act to match Beat', () => {
      const sb = createStoryBeat({
        id: 'sb_1',
        title: 'Catalyst Event',
        act: 5, // Wrong - Catalyst is in Act 1
      });
      graph.nodes.set(sb.id, sb);

      graph.edges.push(edges.alignsWith('sb_1', 'beat_Catalyst', 'edge_align'));

      const violations = SB_ACT_ALIGNMENT.evaluate(graph, { mode: 'full' });
      expect(violations).toHaveLength(1);

      const fix = SB_ACT_ALIGNMENT.suggestFix!(graph, violations[0]);
      expect(fix).not.toBeNull();
      expect(fix!.label).toContain('Act 1');
      expect(fix!.affectedNodeIds).toContain('sb_1');

      // Apply the fix
      const newGraph = applyPatch(graph, fix!.patch);

      // Verify StoryBeat now has correct act
      const updatedSB = newGraph.nodes.get('sb_1') as StoryBeat;
      expect(updatedSB.act).toBe(1);

      // Verify no more violations
      const newViolations = SB_ACT_ALIGNMENT.evaluate(newGraph, { mode: 'full' });
      expect(newViolations).toHaveLength(0);
    });
  });
});
