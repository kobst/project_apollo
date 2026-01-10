/**
 * OpenQuestion derivation from graph state.
 * Derives OpenQuestions based on schema rules.
 *
 * @deprecated This module is deprecated. Use `computeCoverage()` from the
 * `coverage` module instead, which provides a unified Gap model that includes
 * both structural gaps (from rule violations) and narrative gaps (from this module).
 *
 * Migration path:
 * - Replace `deriveOpenQuestions(graph)` with `computeCoverage(graph).gaps`
 * - Filter by `gap.type === 'narrative'` to get equivalent narrative gaps
 * - The unified Gap model has additional fields like `domain`, `groupKey`
 *
 * This module will be removed in a future version.
 */

import type { GraphState } from './graph.js';
import { getNodesByType } from './graph.js';
import type { OpenQuestion } from '../types/openQuestion.js';
import type {
  Beat,
  Scene,
  Character,
  CharacterArc,
} from '../types/nodes.js';

// =============================================================================
// Main Derivation Function
// =============================================================================

/**
 * Derive all OpenQuestions from the current graph state.
 *
 * @deprecated Use `computeCoverage(graph).gaps.filter(g => g.type === 'narrative')`
 * from the coverage module instead.
 *
 * @param graph - The current graph state
 * @returns Array of derived OpenQuestions
 */
export function deriveOpenQuestions(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];

  // STRUCTURE domain
  questions.push(...deriveBeatUnrealized(graph));
  questions.push(...deriveActImbalance(graph));

  // SCENE domain
  questions.push(...deriveSceneQuality(graph));

  // CHARACTER domain
  questions.push(...deriveCharacterQuestions(graph));

  return questions;
}

// =============================================================================
// STRUCTURE Domain
// =============================================================================

/**
 * Derive BeatUnrealized questions.
 * Triggered when a Beat has no Scenes reachable through PlotPoints.
 *
 * New hierarchy: Beat ← ALIGNS_WITH ← PlotPoint ← SATISFIED_BY ← Scene
 * A Beat is "realized" when it has at least one Scene attached through this chain.
 */
function deriveBeatUnrealized(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const beats = getNodesByType<Beat>(graph, 'Beat');

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
      const message = hasPlotPoints
        ? `Beat "${beat.beat_type}" has PlotPoints but no Scenes attached`
        : `Beat "${beat.beat_type}" has no PlotPoints or Scenes`;

      questions.push({
        id: `oq_beat_${beat.id}`,
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        group_key: `STRUCTURE:BEAT:${beat.beat_type}`,
        target_node_id: beat.id,
        message,
      });
    }
  }

  return questions;
}

/**
 * Derive ActImbalance questions.
 * Triggered when an act has no scenes while neighboring acts have content.
 *
 * Uses new hierarchy: Beat ← ALIGNS_WITH ← PlotPoint ← SATISFIED_BY ← Scene
 */
function deriveActImbalance(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const beats = getNodesByType<Beat>(graph, 'Beat');

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
      questions.push({
        id: `oq_act_${act}`,
        type: 'ActImbalance',
        domain: 'STRUCTURE',
        group_key: `STRUCTURE:ACT:${act}`,
        message: `Act ${act} has no scenes while neighboring acts have content`,
      });
    }
  }

  return questions;
}

// =============================================================================
// SCENE Domain
// =============================================================================

/**
 * Derive scene quality questions (SceneHasNoCast, SceneNeedsLocation).
 */
function deriveSceneQuality(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const scenes = getNodesByType<Scene>(graph, 'Scene');

  for (const scene of scenes) {
    // Check for missing characters
    const characterEdges = graph.edges.filter(
      (e) => e.type === 'HAS_CHARACTER' && e.from === scene.id
    );
    if (characterEdges.length === 0) {
      questions.push({
        id: `oq_scene_cast_${scene.id}`,
        type: 'SceneHasNoCast',
        domain: 'SCENE',
        group_key: `SCENE:QUALITY:${scene.id}`,
        target_node_id: scene.id,
        message: `Scene "${scene.heading}" has no characters assigned`,
      });
    }

    // Check for missing location
    const locationEdges = graph.edges.filter(
      (e) => e.type === 'LOCATED_AT' && e.from === scene.id
    );
    if (locationEdges.length === 0) {
      questions.push({
        id: `oq_scene_loc_${scene.id}`,
        type: 'SceneNeedsLocation',
        domain: 'SCENE',
        group_key: `SCENE:QUALITY:${scene.id}`,
        target_node_id: scene.id,
        message: `Scene "${scene.heading}" has no location assigned`,
      });
    }
  }

  return questions;
}

// =============================================================================
// CHARACTER Domain
// =============================================================================

/**
 * Derive character-related questions.
 */
function deriveCharacterQuestions(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const characters = getNodesByType<Character>(graph, 'Character');

  for (const char of characters) {
    // Count scene appearances
    const appearances = graph.edges.filter(
      (e) => e.type === 'HAS_CHARACTER' && e.to === char.id
    ).length;

    // CharacterUnderspecified
    if (!char.description && appearances >= 2) {
      questions.push({
        id: `oq_char_desc_${char.id}`,
        type: 'CharacterUnderspecified',
        domain: 'CHARACTER',
        group_key: `CHARACTER:DETAIL:${char.id}`,
        target_node_id: char.id,
        message: `Character "${char.name}" appears in ${appearances} scenes but has no description`,
      });
    }

    // MissingCharacterArc
    const hasArc = graph.edges.some(
      (e) => e.type === 'HAS_ARC' && e.from === char.id
    );
    if (!hasArc && appearances >= 3) {
      questions.push({
        id: `oq_char_arc_${char.id}`,
        type: 'MissingCharacterArc',
        domain: 'CHARACTER',
        group_key: `CHARACTER:ARC:${char.id}`,
        target_node_id: char.id,
        message: `Character "${char.name}" appears in ${appearances} scenes but has no arc defined`,
      });
    }
  }

  // ArcUngrounded
  const arcs = getNodesByType<CharacterArc>(graph, 'CharacterArc');
  for (const arc of arcs) {
    if (!arc.turn_refs || arc.turn_refs.length === 0) {
      const char = characters.find((c) => c.id === arc.character_id);
      const charName = char?.name ?? arc.character_id;
      questions.push({
        id: `oq_arc_ungrounded_${arc.id}`,
        type: 'ArcUngrounded',
        domain: 'CHARACTER',
        group_key: `CHARACTER:ARC:${arc.character_id}`,
        target_node_id: arc.id,
        message: `CharacterArc for "${charName}" has no turn references`,
      });
    }
  }

  return questions;
}


// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Filter OpenQuestions by domain.
 */
export function filterByDomain(
  questions: OpenQuestion[],
  domain: OpenQuestion['domain']
): OpenQuestion[] {
  return questions.filter((q) => q.domain === domain);
}

/**
 * Group OpenQuestions by group_key.
 */
export function groupByKey(
  questions: OpenQuestion[]
): Map<string, OpenQuestion[]> {
  const groups = new Map<string, OpenQuestion[]>();
  for (const q of questions) {
    const existing = groups.get(q.group_key);
    if (existing) {
      existing.push(q);
    } else {
      groups.set(q.group_key, [q]);
    }
  }
  return groups;
}

