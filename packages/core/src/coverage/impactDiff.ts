/**
 * Impact Diffing — Mechanical before/after coverage comparison.
 *
 * Given a graph and a proposed package, computes exactly which gaps
 * would be discharged, which would be introduced, and how tier
 * coverage percentages would change.
 *
 * This replaces heuristic impact analysis with deterministic diffing:
 * apply the package speculatively, run coverage on both states, compare.
 */

import type { GraphState } from '../core/graph.js';
import { cloneGraph } from '../core/graph.js';
import { applyPatch } from '../core/applyPatch.js';
import { packageToPatch } from '../core/packageToPatch.js';
import { computeCoverage } from './compute.js';
import type { Gap, GapTier, CoverageResponse } from './types.js';
import type { NarrativePackage } from '../ai/types.js';
import type { Patch } from '../types/patch.js';

// =============================================================================
// Types
// =============================================================================

export interface TierChange {
  tier: GapTier;
  label: string;
  before: number;   // percent (0-100)
  after: number;
  delta: number;    // positive = improvement
}

export interface ImpactDiff {
  /** Gaps present before but absent after — problems this package solves */
  dischargedGaps: Gap[];
  /** Gaps absent before but present after — new problems this package creates */
  introducedGaps: Gap[];
  /** Per-tier coverage changes */
  tierChanges: TierChange[];
  /** Net change in gap count (negative = improvement) */
  netGapDelta: number;
  /** Coverage snapshots for detailed inspection */
  before: CoverageResponse;
  after: CoverageResponse;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Compute the impact diff of applying a package to a graph.
 *
 * 1. Compute coverage on the original graph
 * 2. Convert the package to a patch
 * 3. Apply the patch to a cloned graph
 * 4. Compute coverage on the modified graph
 * 5. Diff the gap sets and tier summaries
 *
 * @param graph - The current graph state
 * @param pkg - The narrative package to evaluate
 * @returns Impact diff with discharged/introduced gaps and tier changes
 */
export function computeImpactDiff(
  graph: GraphState,
  pkg: NarrativePackage
): ImpactDiff {
  // Step 1: Baseline coverage
  const before = computeCoverage(graph);
  const beforeGapMap = new Map(before.gaps.map(g => [g.id, g]));

  // Step 2: Convert package to patch and apply speculatively
  const patch = packageToPatch(pkg);
  let modifiedGraph: GraphState;
  try {
    modifiedGraph = applyPatch(cloneGraph(graph), patch);
  } catch {
    // If the patch fails to apply, return empty diff
    return {
      dischargedGaps: [],
      introducedGaps: [],
      tierChanges: before.summary.map(s => ({
        tier: s.tier,
        label: s.label,
        before: s.percent,
        after: s.percent,
        delta: 0,
      })),
      netGapDelta: 0,
      before,
      after: before,
    };
  }

  // Step 3: Coverage on modified graph
  const after = computeCoverage(modifiedGraph);
  const afterGapMap = new Map(after.gaps.map(g => [g.id, g]));

  // Step 4: Diff gaps
  const dischargedGaps: Gap[] = [];
  for (const [id, gap] of beforeGapMap) {
    if (!afterGapMap.has(id)) {
      dischargedGaps.push(gap);
    }
  }

  const introducedGaps: Gap[] = [];
  for (const [id, gap] of afterGapMap) {
    if (!beforeGapMap.has(id)) {
      introducedGaps.push(gap);
    }
  }

  // Step 5: Diff tier summaries
  const tierChanges: TierChange[] = before.summary.map((beforeTier, i) => {
    const afterTier = after.summary[i]!;
    return {
      tier: beforeTier.tier,
      label: beforeTier.label,
      before: beforeTier.percent,
      after: afterTier.percent,
      delta: afterTier.percent - beforeTier.percent,
    };
  });

  const netGapDelta = after.gaps.length - before.gaps.length;

  return {
    dischargedGaps,
    introducedGaps,
    tierChanges,
    netGapDelta,
    before,
    after,
  };
}

/**
 * Compute impact diff from a pre-built Patch (instead of a NarrativePackage).
 */
export function computeImpactDiffFromPatch(
  graph: GraphState,
  patch: Patch
): ImpactDiff {
  const before = computeCoverage(graph);
  const beforeGapMap = new Map(before.gaps.map(g => [g.id, g]));

  let modifiedGraph: GraphState;
  try {
    modifiedGraph = applyPatch(cloneGraph(graph), patch);
  } catch {
    return {
      dischargedGaps: [],
      introducedGaps: [],
      tierChanges: before.summary.map(s => ({
        tier: s.tier,
        label: s.label,
        before: s.percent,
        after: s.percent,
        delta: 0,
      })),
      netGapDelta: 0,
      before,
      after: before,
    };
  }

  const after = computeCoverage(modifiedGraph);
  const afterGapMap = new Map(after.gaps.map(g => [g.id, g]));

  const dischargedGaps: Gap[] = [];
  for (const [id, gap] of beforeGapMap) {
    if (!afterGapMap.has(id)) {
      dischargedGaps.push(gap);
    }
  }

  const introducedGaps: Gap[] = [];
  for (const [id, gap] of afterGapMap) {
    if (!beforeGapMap.has(id)) {
      introducedGaps.push(gap);
    }
  }

  const tierChanges: TierChange[] = before.summary.map((beforeTier, i) => {
    const afterTier = after.summary[i]!;
    return {
      tier: beforeTier.tier,
      label: beforeTier.label,
      before: beforeTier.percent,
      after: afterTier.percent,
      delta: afterTier.percent - beforeTier.percent,
    };
  });

  return {
    dischargedGaps,
    introducedGaps,
    tierChanges,
    netGapDelta: after.gaps.length - before.gaps.length,
    before,
    after,
  };
}
