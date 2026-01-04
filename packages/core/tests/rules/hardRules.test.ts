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
import type { Beat, Scene } from '../../src/types/nodes.js';
import { BEAT_ACT_MAP, BEAT_POSITION_MAP } from '../../src/types/nodes.js';
import {
  SCENE_ORDER_UNIQUE,
  SCENE_ACT_BOUNDARY,
  STC_BEAT_ORDERING,
} from '../../src/rules/hardRules.js';
import { applyPatch } from '../../src/core/applyPatch.js';
import {
  createGraphWith15Beats,
  createScene,
  resetIdCounter,
} from '../helpers/index.js';

describe('Hard Rules', () => {
  let graph: GraphState;

  beforeEach(() => {
    resetIdCounter();
    graph = createGraphWith15Beats();
  });

  // ===========================================================================
  // SCENE_ORDER_UNIQUE
  // ===========================================================================

  describe('SCENE_ORDER_UNIQUE', () => {
    it('should detect duplicate order_index on scenes in same beat', () => {
      // Add two scenes with same order_index to the same beat
      const scene1 = createScene('beat_Catalyst', { id: 'scene_1', order_index: 1 });
      const scene2 = createScene('beat_Catalyst', { id: 'scene_2', order_index: 1 });
      graph.nodes.set(scene1.id, scene1);
      graph.nodes.set(scene2.id, scene2);

      const violations = SCENE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('SCENE_ORDER_UNIQUE');
      expect(violations[0].severity).toBe('hard');
      expect(violations[0].message).toContain('Catalyst');
      expect(violations[0].message).toContain('2 scenes');
      expect(violations[0].message).toContain('order_index 1');
    });

    it('should not flag scenes with unique order_index in same beat', () => {
      const scene1 = createScene('beat_Catalyst', { id: 'scene_1', order_index: 1 });
      const scene2 = createScene('beat_Catalyst', { id: 'scene_2', order_index: 2 });
      graph.nodes.set(scene1.id, scene1);
      graph.nodes.set(scene2.id, scene2);

      const violations = SCENE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should not flag scenes with same order_index in different beats', () => {
      const scene1 = createScene('beat_Catalyst', { id: 'scene_1', order_index: 1 });
      const scene2 = createScene('beat_Midpoint', { id: 'scene_2', order_index: 1 });
      graph.nodes.set(scene1.id, scene1);
      graph.nodes.set(scene2.id, scene2);

      const violations = SCENE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should detect multiple groups of duplicates', () => {
      // Two duplicates in Catalyst
      graph.nodes.set('s1', createScene('beat_Catalyst', { id: 's1', order_index: 1 }));
      graph.nodes.set('s2', createScene('beat_Catalyst', { id: 's2', order_index: 1 }));
      // Two duplicates in Midpoint
      graph.nodes.set('s3', createScene('beat_Midpoint', { id: 's3', order_index: 2 }));
      graph.nodes.set('s4', createScene('beat_Midpoint', { id: 's4', order_index: 2 }));

      const violations = SCENE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(2);
    });

    it('should generate a fix that reindexes scenes sequentially', () => {
      const scene1 = createScene('beat_Catalyst', { id: 'scene_1', order_index: 1 });
      const scene2 = createScene('beat_Catalyst', { id: 'scene_2', order_index: 1 });
      const scene3 = createScene('beat_Catalyst', { id: 'scene_3', order_index: 1 });
      graph.nodes.set(scene1.id, scene1);
      graph.nodes.set(scene2.id, scene2);
      graph.nodes.set(scene3.id, scene3);

      const violations = SCENE_ORDER_UNIQUE.evaluate(graph, { mode: 'full' });
      expect(violations).toHaveLength(1);

      const fix = SCENE_ORDER_UNIQUE.suggestFix!(graph, violations[0]);
      expect(fix).not.toBeNull();
      expect(fix!.label).toContain('Re-index');
      expect(fix!.label).toContain('3 scenes');
      expect(fix!.affectedNodeIds).toHaveLength(3);

      // Apply the fix
      const newGraph = applyPatch(graph, fix!.patch);

      // Verify scenes now have sequential order_index
      const updatedScenes = Array.from(newGraph.nodes.values())
        .filter((n): n is Scene => n.type === 'Scene')
        .sort((a, b) => a.order_index - b.order_index);

      const orderIndices = updatedScenes.map((s) => s.order_index);
      expect(orderIndices).toEqual([1, 2, 3]);

      // Verify no more violations
      const newViolations = SCENE_ORDER_UNIQUE.evaluate(newGraph, { mode: 'full' });
      expect(newViolations).toHaveLength(0);
    });
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
  // Scoped lint tests
  // ===========================================================================

  describe('Scoped linting', () => {
    it('should only check nodes in scope for SCENE_ORDER_UNIQUE', () => {
      // Add duplicates in Catalyst (in scope)
      graph.nodes.set('s1', createScene('beat_Catalyst', { id: 's1', order_index: 1 }));
      graph.nodes.set('s2', createScene('beat_Catalyst', { id: 's2', order_index: 1 }));
      // Add duplicates in Midpoint (out of scope)
      graph.nodes.set('s3', createScene('beat_Midpoint', { id: 's3', order_index: 1 }));
      graph.nodes.set('s4', createScene('beat_Midpoint', { id: 's4', order_index: 1 }));

      // Only scope to Catalyst beat
      const violations = SCENE_ORDER_UNIQUE.evaluate(graph, {
        mode: 'touched',
        touchedNodeIds: ['beat_Catalyst'],
        expandedNodeIds: ['beat_Catalyst', 's1', 's2'],
      });

      // Should only find the Catalyst violation, not Midpoint
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('Catalyst');
    });
  });
});
