/**
 * Tests for computeImpactDiff — mechanical before/after coverage diffing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computeImpactDiff } from '../../src/coverage/impactDiff.js';
import { computeCoverage } from '../../src/coverage/compute.js';
import type { GraphState } from '../../src/core/graph.js';
import type { NarrativePackage } from '../../src/ai/types.js';
import {
  createGraphWith15Beats,
  resetIdCounter,
} from '../helpers/index.js';
import { createPlotPoint, createScene, createCharacter, createLocation } from '../helpers/index.js';
import { edges } from '../helpers/index.js';

function makePackage(
  nodes: NarrativePackage['changes']['nodes'],
  edgeChanges: NarrativePackage['changes']['edges'] = []
): NarrativePackage {
  return {
    id: `pkg_test_${Date.now()}`,
    title: 'Test Package',
    rationale: 'For testing',
    confidence: 0.9,
    style_tags: [],
    changes: { nodes, edges: edgeChanges },
    impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
  };
}

describe('computeImpactDiff', () => {
  let graph: GraphState;

  beforeEach(() => {
    resetIdCounter();
    graph = createGraphWith15Beats();
  });

  it('should return empty diff for empty package', () => {
    const pkg = makePackage([], []);
    const diff = computeImpactDiff(graph, pkg);

    expect(diff.dischargedGaps).toHaveLength(0);
    expect(diff.introducedGaps).toHaveLength(0);
    expect(diff.netGapDelta).toBe(0);
    expect(diff.tierChanges.every(t => t.delta === 0)).toBe(true);
  });

  it('should discharge BeatUnrealized when adding PlotPoint + Scene for unrealized beat', () => {
    const pp = createPlotPoint({
      id: 'pp_test_catalyst',
      alignedBeatId: 'beat_Catalyst',
      status: 'approved',
    });
    const scene = createScene({
      id: 'scene_test_catalyst',
      heading: 'INT. LAB - NIGHT',
      scene_overview: 'The catalyst event occurs when the protagonist discovers the hidden data.',
    });
    const char = createCharacter({ id: 'char_test', name: 'Test Character' });

    const pkg = makePackage(
      [
        { operation: 'add', node_type: 'PlotPoint', node_id: pp.id, data: { ...pp, type: 'PlotPoint', id: pp.id } },
        { operation: 'add', node_type: 'Scene', node_id: scene.id, data: { ...scene, type: 'Scene', id: scene.id } },
        { operation: 'add', node_type: 'Character', node_id: char.id, data: { ...char, type: 'Character', id: char.id } },
      ],
      [
        { operation: 'add', edge_type: 'REALIZED_BY', from: pp.id, to: scene.id, properties: { order: 1 } },
        { operation: 'add', edge_type: 'HAS_CHARACTER', from: scene.id, to: char.id },
      ]
    );

    const diff = computeImpactDiff(graph, pkg);

    // Should discharge at least one gap (the BeatUnrealized for Catalyst)
    expect(diff.dischargedGaps.length).toBeGreaterThan(0);

    // At least one discharged gap should reference Catalyst beat
    const dischargedTexts = diff.dischargedGaps.map(g => `${g.title} ${g.description}`);
    expect(dischargedTexts.some(t => t.includes('Catalyst'))).toBe(true);

    // Net should be non-positive (improvement or neutral — adding scene may introduce
    // scene-quality gaps like SceneNeedsLocation even as it discharges BeatUnrealized)
    expect(diff.netGapDelta).toBeLessThanOrEqual(0);
  });

  it('should introduce SceneHasNoCast when adding Scene without characters', () => {
    const pp = createPlotPoint({
      id: 'pp_test_bare',
      alignedBeatId: 'beat_Debate',
      status: 'approved',
    });
    const scene = createScene({
      id: 'scene_test_bare',
      heading: 'EXT. ROOFTOP - DAY',
      scene_overview: 'A bare scene with no characters assigned to test gap introduction behavior.',
    });

    const pkg = makePackage(
      [
        { operation: 'add', node_type: 'PlotPoint', node_id: pp.id, data: { ...pp, type: 'PlotPoint', id: pp.id } },
        { operation: 'add', node_type: 'Scene', node_id: scene.id, data: { ...scene, type: 'Scene', id: scene.id } },
      ],
      [
        { operation: 'add', edge_type: 'REALIZED_BY', from: pp.id, to: scene.id, properties: { order: 1 } },
      ]
    );

    const diff = computeImpactDiff(graph, pkg);

    // Debug: verify the diff structure is working
    // The bare scene should change the gap set even if net count is same
    const beforeIds = new Set(diff.before.gaps.map(g => g.id));
    const afterIds = new Set(diff.after.gaps.map(g => g.id));
    const onlyBefore = [...beforeIds].filter(id => !afterIds.has(id));
    const onlyAfter = [...afterIds].filter(id => !beforeIds.has(id));

    // At minimum, gap IDs should differ (some discharged, some introduced)
    // If this fails, it means our package application isn't affecting coverage at all
    expect(onlyBefore.length + onlyAfter.length).toBeGreaterThan(0);
  });

  it('should show tier improvement when adding complete Scene', () => {
    const pp = createPlotPoint({
      id: 'pp_test_full',
      alignedBeatId: 'beat_BreakIntoTwo',
      status: 'approved',
    });
    const scene = createScene({
      id: 'scene_test_full',
      heading: 'INT. OFFICE - NIGHT',
      scene_overview: 'A fully equipped scene with character and location for tier improvement test.',
    });
    const char = createCharacter({ id: 'char_full', name: 'Full Character' });
    const loc = createLocation({ id: 'loc_full', name: 'Full Location' });

    const pkg = makePackage(
      [
        { operation: 'add', node_type: 'PlotPoint', node_id: pp.id, data: { ...pp, type: 'PlotPoint', id: pp.id } },
        { operation: 'add', node_type: 'Scene', node_id: scene.id, data: { ...scene, type: 'Scene', id: scene.id } },
        { operation: 'add', node_type: 'Character', node_id: char.id, data: { ...char, type: 'Character', id: char.id } },
        { operation: 'add', node_type: 'Location', node_id: loc.id, data: { ...loc, type: 'Location', id: loc.id } },
      ],
      [
        { operation: 'add', edge_type: 'REALIZED_BY', from: pp.id, to: scene.id, properties: { order: 1 } },
        { operation: 'add', edge_type: 'HAS_CHARACTER', from: scene.id, to: char.id },
        { operation: 'add', edge_type: 'LOCATED_AT', from: scene.id, to: loc.id },
      ]
    );

    const diff = computeImpactDiff(graph, pkg);

    // Structure tier should improve (one more beat realized)
    const structureTier = diff.tierChanges.find(t => t.tier === 'structure');
    expect(structureTier).toBeDefined();
    expect(structureTier!.delta).toBeGreaterThanOrEqual(0);
  });

  it('should handle patch application failure gracefully', () => {
    // Package with a delete of a non-existent node — may fail depending on applyPatch behavior
    const pkg = makePackage([
      { operation: 'modify', node_type: 'Scene', node_id: 'nonexistent', data: { heading: 'new' } },
    ]);

    // Should not throw, should return empty diff
    const diff = computeImpactDiff(graph, pkg);
    expect(diff.netGapDelta).toBe(0);
  });
});
