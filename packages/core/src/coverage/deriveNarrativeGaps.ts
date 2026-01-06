/**
 * Narrative gap derivation from graph state.
 *
 * Derives narrative gaps based on schema rules and current phase.
 * This replaces the OpenQuestion derivation with unified Gap output.
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType } from '../core/graph.js';
import type {
  Beat,
  Scene,
  Character,
  CharacterArc,
  Conflict,
  Theme,
  Motif,
} from '../types/nodes.js';
import type { Gap, GapPhase } from './types.js';
import { NARRATIVE_GAP_CONFIG } from './types.js';

// =============================================================================
// Main Derivation Function
// =============================================================================

/**
 * Derive all narrative gaps from the current graph state.
 *
 * @param graph - The current graph state
 * @param phase - The current phase (OUTLINE, DRAFT, REVISION)
 * @returns Array of derived Gaps (type: 'narrative')
 */
export function deriveNarrativeGaps(
  graph: GraphState,
  phase: GapPhase = 'OUTLINE'
): Gap[] {
  const gaps: Gap[] = [];

  // STRUCTURE domain (always active)
  gaps.push(...deriveBeatUnrealizedGaps(graph));
  gaps.push(...deriveActImbalanceGaps(graph));

  // SCENE domain (DRAFT and REVISION)
  if (phase === 'DRAFT' || phase === 'REVISION') {
    gaps.push(...deriveSceneQualityGaps(graph));
  }

  // CHARACTER domain
  gaps.push(...deriveCharacterGaps(graph, phase));

  // CONFLICT domain (DRAFT and REVISION)
  if (phase === 'DRAFT' || phase === 'REVISION') {
    gaps.push(...deriveConflictGaps(graph));
  }

  // THEME_MOTIF domain (REVISION only)
  if (phase === 'REVISION') {
    gaps.push(...deriveThemeMotifGaps(graph));
  }

  return gaps;
}

// =============================================================================
// STRUCTURE Domain
// =============================================================================

/**
 * Derive BeatUnrealized gaps.
 * Triggered when a Beat has no Scenes reachable through PlotPoints.
 *
 * Hierarchy: Beat ← ALIGNS_WITH ← PlotPoint ← SATISFIED_BY ← Scene
 * A Beat is "realized" when it has at least one Scene attached through this chain.
 */
function deriveBeatUnrealizedGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const config = NARRATIVE_GAP_CONFIG.BeatUnrealized;

  // Get all ALIGNS_WITH edges (PlotPoint → Beat)
  const alignsWithEdges = graph.edges.filter((e) => e.type === 'ALIGNS_WITH');
  // Get all SATISFIED_BY edges (PlotPoint → Scene)
  const satisfiedByEdges = graph.edges.filter((e) => e.type === 'SATISFIED_BY');

  for (const beat of beats) {
    // Find PlotPoints aligned to this Beat
    const plotPointIds = alignsWithEdges
      .filter((e) => e.to === beat.id)
      .map((e) => e.from);

    // Find Scenes attached to those PlotPoints
    const sceneCount = satisfiedByEdges.filter((e) =>
      plotPointIds.includes(e.from)
    ).length;

    if (sceneCount === 0) {
      // Check if there are PlotPoints but no Scenes (different message)
      const hasPlotPoints = plotPointIds.length > 0;
      const description = hasPlotPoints
        ? `Beat "${beat.beat_type}" has PlotPoints but no Scenes attached`
        : `Beat "${beat.beat_type}" has no PlotPoints or Scenes`;

      gaps.push({
        id: `gap_beat_${beat.id}`,
        type: config.type,
        tier: config.tier,
        title: `Beat Unrealized: ${beat.beat_type}`,
        description,
        scopeRefs: { nodeIds: [beat.id] },
        severity: config.defaultSeverity,
        source: 'derived',
        status: 'open',
        phase: config.phase,
        domain: config.domain,
        groupKey: `STRUCTURE:BEAT:${beat.beat_type}`,
      });
    }
  }

  return gaps;
}

/**
 * Derive ActImbalance gaps.
 * Triggered when an act has no scenes while neighboring acts have content.
 *
 * Uses hierarchy: Beat ← ALIGNS_WITH ← PlotPoint ← SATISFIED_BY ← Scene
 */
function deriveActImbalanceGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const config = NARRATIVE_GAP_CONFIG.ActImbalance;

  // Get all ALIGNS_WITH edges (PlotPoint → Beat)
  const alignsWithEdges = graph.edges.filter((e) => e.type === 'ALIGNS_WITH');
  // Get all SATISFIED_BY edges (PlotPoint → Scene)
  const satisfiedByEdges = graph.edges.filter((e) => e.type === 'SATISFIED_BY');

  // Count scenes per act by traversing Beat → PlotPoint → Scene
  const scenesPerAct: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const beat of beats) {
    // Find PlotPoints aligned to this Beat
    const plotPointIds = alignsWithEdges
      .filter((e) => e.to === beat.id)
      .map((e) => e.from);

    // Count Scenes attached to those PlotPoints
    const sceneCount = satisfiedByEdges.filter((e) =>
      plotPointIds.includes(e.from)
    ).length;

    scenesPerAct[beat.act] = (scenesPerAct[beat.act] ?? 0) + sceneCount;
  }

  // Check for imbalance
  for (let act = 1; act <= 5; act++) {
    const prevAct = act > 1 ? (scenesPerAct[act - 1] ?? 0) : 0;
    const currentAct = scenesPerAct[act] ?? 0;
    const nextAct = act < 5 ? (scenesPerAct[act + 1] ?? 0) : 0;

    if (currentAct === 0 && (prevAct >= 2 || nextAct >= 2)) {
      gaps.push({
        id: `gap_act_${act}`,
        type: config.type,
        tier: config.tier,
        title: `Act Imbalance: Act ${act}`,
        description: `Act ${act} has no scenes while neighboring acts have content`,
        scopeRefs: {},
        severity: config.defaultSeverity,
        source: 'derived',
        status: 'open',
        phase: config.phase,
        domain: config.domain,
        groupKey: `STRUCTURE:ACT:${act}`,
      });
    }
  }

  return gaps;
}

// =============================================================================
// SCENE Domain
// =============================================================================

/**
 * Derive scene quality gaps (SceneHasNoCast, SceneNeedsLocation).
 */
function deriveSceneQualityGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];
  const scenes = getNodesByType<Scene>(graph, 'Scene');

  for (const scene of scenes) {
    // Check for missing characters
    const characterEdges = graph.edges.filter(
      (e) => e.type === 'HAS_CHARACTER' && e.from === scene.id
    );
    if (characterEdges.length === 0) {
      const config = NARRATIVE_GAP_CONFIG.SceneHasNoCast;
      gaps.push({
        id: `gap_scene_cast_${scene.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Scene Has No Cast',
        description: `Scene "${scene.heading}" has no characters assigned`,
        scopeRefs: { nodeIds: [scene.id] },
        severity: config.defaultSeverity,
        source: 'derived',
        status: 'open',
        phase: config.phase,
        domain: config.domain,
        groupKey: `SCENE:QUALITY:${scene.id}`,
      });
    }

    // Check for missing location
    const locationEdges = graph.edges.filter(
      (e) => e.type === 'LOCATED_AT' && e.from === scene.id
    );
    if (locationEdges.length === 0) {
      const config = NARRATIVE_GAP_CONFIG.SceneNeedsLocation;
      gaps.push({
        id: `gap_scene_loc_${scene.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Scene Needs Location',
        description: `Scene "${scene.heading}" has no location assigned`,
        scopeRefs: { nodeIds: [scene.id] },
        severity: config.defaultSeverity,
        source: 'derived',
        status: 'open',
        phase: config.phase,
        domain: config.domain,
        groupKey: `SCENE:QUALITY:${scene.id}`,
      });
    }
  }

  return gaps;
}

// =============================================================================
// CHARACTER Domain
// =============================================================================

/**
 * Derive character-related gaps.
 */
function deriveCharacterGaps(graph: GraphState, phase: GapPhase): Gap[] {
  const gaps: Gap[] = [];
  const characters = getNodesByType<Character>(graph, 'Character');

  for (const char of characters) {
    // Count scene appearances
    const appearances = graph.edges.filter(
      (e) => e.type === 'HAS_CHARACTER' && e.to === char.id
    ).length;

    // CharacterUnderspecified (OUTLINE phase)
    if (!char.description && appearances >= 2) {
      const config = NARRATIVE_GAP_CONFIG.CharacterUnderspecified;
      gaps.push({
        id: `gap_char_desc_${char.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Character Underspecified',
        description: `Character "${char.name}" appears in ${appearances} scenes but has no description`,
        scopeRefs: { nodeIds: [char.id] },
        severity: config.defaultSeverity,
        source: 'derived',
        status: 'open',
        phase: config.phase,
        domain: config.domain,
        groupKey: `CHARACTER:DETAIL:${char.id}`,
      });
    }

    // MissingCharacterArc (DRAFT and REVISION)
    if (phase === 'DRAFT' || phase === 'REVISION') {
      const hasArc = graph.edges.some(
        (e) => e.type === 'HAS_ARC' && e.from === char.id
      );
      if (!hasArc && appearances >= 3) {
        const config = NARRATIVE_GAP_CONFIG.MissingCharacterArc;
        gaps.push({
          id: `gap_char_arc_${char.id}`,
          type: config.type,
          tier: config.tier,
          title: 'Missing Character Arc',
          description: `Character "${char.name}" appears in ${appearances} scenes but has no arc defined`,
          scopeRefs: { nodeIds: [char.id] },
          severity: config.defaultSeverity,
          source: 'derived',
          status: 'open',
          phase: config.phase,
          domain: config.domain,
          groupKey: `CHARACTER:ARC:${char.id}`,
        });
      }
    }
  }

  // ArcUngrounded (REVISION only)
  if (phase === 'REVISION') {
    const arcs = getNodesByType<CharacterArc>(graph, 'CharacterArc');
    for (const arc of arcs) {
      if (!arc.turn_refs || arc.turn_refs.length === 0) {
        const char = characters.find((c) => c.id === arc.character_id);
        const charName = char?.name ?? arc.character_id;
        const config = NARRATIVE_GAP_CONFIG.ArcUngrounded;
        gaps.push({
          id: `gap_arc_ungrounded_${arc.id}`,
          type: config.type,
          tier: config.tier,
          title: 'Arc Ungrounded',
          description: `CharacterArc for "${charName}" has no turn references`,
          scopeRefs: { nodeIds: [arc.id] },
          severity: config.defaultSeverity,
          source: 'derived',
          status: 'open',
          phase: config.phase,
          domain: config.domain,
          groupKey: `CHARACTER:ARC:${arc.character_id}`,
        });
      }
    }
  }

  return gaps;
}

// =============================================================================
// CONFLICT Domain
// =============================================================================

/**
 * Derive conflict-related gaps.
 */
function deriveConflictGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];
  const conflicts = getNodesByType<Conflict>(graph, 'Conflict');

  for (const conflict of conflicts) {
    // ConflictNeedsParties
    const involvesEdges = graph.edges.filter(
      (e) => e.type === 'INVOLVES' && e.from === conflict.id
    );
    if (involvesEdges.length === 0) {
      const config = NARRATIVE_GAP_CONFIG.ConflictNeedsParties;
      gaps.push({
        id: `gap_conf_parties_${conflict.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Conflict Needs Parties',
        description: `Conflict "${conflict.name}" has no characters involved`,
        scopeRefs: { nodeIds: [conflict.id] },
        severity: config.defaultSeverity,
        source: 'derived',
        status: 'open',
        phase: config.phase,
        domain: config.domain,
        groupKey: `CONFLICT:SETUP:${conflict.id}`,
      });
    }

    // ConflictNeedsManifestation
    const manifestsEdges = graph.edges.filter(
      (e) => e.type === 'MANIFESTS_IN' && e.from === conflict.id
    );
    if (manifestsEdges.length === 0) {
      const config = NARRATIVE_GAP_CONFIG.ConflictNeedsManifestation;
      gaps.push({
        id: `gap_conf_manifest_${conflict.id}`,
        type: config.type,
        tier: config.tier,
        title: 'Conflict Needs Manifestation',
        description: `Conflict "${conflict.name}" doesn't manifest in any scene`,
        scopeRefs: { nodeIds: [conflict.id] },
        severity: config.defaultSeverity,
        source: 'derived',
        status: 'open',
        phase: config.phase,
        domain: config.domain,
        groupKey: `CONFLICT:SHOW:${conflict.id}`,
      });
    }
  }

  return gaps;
}

// =============================================================================
// THEME_MOTIF Domain
// =============================================================================

/**
 * Derive theme and motif grounding gaps.
 */
function deriveThemeMotifGaps(graph: GraphState): Gap[] {
  const gaps: Gap[] = [];

  // ThemeUngrounded
  const themes = getNodesByType<Theme>(graph, 'Theme');
  for (const theme of themes) {
    if (theme.status === 'FLOATING') {
      const expressedEdges = graph.edges.filter(
        (e) => e.type === 'EXPRESSED_IN' && e.from === theme.id
      );
      if (expressedEdges.length === 0) {
        const config = NARRATIVE_GAP_CONFIG.ThemeUngrounded;
        gaps.push({
          id: `gap_theme_${theme.id}`,
          type: config.type,
          tier: config.tier,
          title: 'Theme Ungrounded',
          description: `Theme "${theme.statement}" is floating and not expressed in any scene`,
          scopeRefs: { nodeIds: [theme.id] },
          severity: config.defaultSeverity,
          source: 'derived',
          status: 'open',
          phase: config.phase,
          domain: config.domain,
          groupKey: `THEME:GROUND:${theme.id}`,
        });
      }
    }
  }

  // MotifUngrounded
  const motifs = getNodesByType<Motif>(graph, 'Motif');
  for (const motif of motifs) {
    if (motif.status === 'FLOATING') {
      const appearsEdges = graph.edges.filter(
        (e) => e.type === 'APPEARS_IN' && e.from === motif.id
      );
      if (appearsEdges.length === 0) {
        const config = NARRATIVE_GAP_CONFIG.MotifUngrounded;
        gaps.push({
          id: `gap_motif_${motif.id}`,
          type: config.type,
          tier: config.tier,
          title: 'Motif Ungrounded',
          description: `Motif "${motif.name}" is floating and doesn't appear in any scene`,
          scopeRefs: { nodeIds: [motif.id] },
          severity: config.defaultSeverity,
          source: 'derived',
          status: 'open',
          phase: config.phase,
          domain: config.domain,
          groupKey: `MOTIF:GROUND:${motif.id}`,
        });
      }
    }
  }

  return gaps;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Filter gaps by domain.
 */
export function filterGapsByDomain(gaps: Gap[], domain: Gap['domain']): Gap[] {
  return gaps.filter((g) => g.domain === domain);
}

/**
 * Filter gaps by severity.
 */
export function filterGapsBySeverity(
  gaps: Gap[],
  severity: Gap['severity']
): Gap[] {
  return gaps.filter((g) => g.severity === severity);
}

/**
 * Filter gaps by phase.
 */
export function filterGapsByPhase(gaps: Gap[], phase: GapPhase): Gap[] {
  return gaps.filter((g) => g.phase === phase);
}

/**
 * Filter gaps by type.
 */
export function filterGapsByType(gaps: Gap[], type: Gap['type']): Gap[] {
  return gaps.filter((g) => g.type === type);
}

/**
 * Group gaps by groupKey.
 */
export function groupGapsByKey(gaps: Gap[]): Map<string, Gap[]> {
  const groups = new Map<string, Gap[]>();
  for (const gap of gaps) {
    if (gap.groupKey) {
      const existing = groups.get(gap.groupKey);
      if (existing) {
        existing.push(gap);
      } else {
        groups.set(gap.groupKey, [gap]);
      }
    }
  }
  return groups;
}

/**
 * Get blocking gaps (must resolve before commit).
 */
export function getBlockingGaps(gaps: Gap[]): Gap[] {
  return filterGapsBySeverity(gaps, 'blocker');
}

/**
 * Check if there are any blocking gaps.
 */
export function hasBlockingGaps(gaps: Gap[]): boolean {
  return gaps.some((g) => g.severity === 'blocker');
}
