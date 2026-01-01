/**
 * OpenQuestion derivation from graph state.
 * Derives OpenQuestions based on schema rules and current phase.
 */

import type { GraphState } from './graph.js';
import { getNodesByType } from './graph.js';
import type {
  OpenQuestion,
  OQPhase,
} from '../types/openQuestion.js';
import type {
  Beat,
  Scene,
  Character,
  CharacterArc,
  Conflict,
  Theme,
  Motif,
} from '../types/nodes.js';

// =============================================================================
// Main Derivation Function
// =============================================================================

/**
 * Derive all OpenQuestions from the current graph state.
 *
 * @param graph - The current graph state
 * @param phase - The current phase (OUTLINE, DRAFT, REVISION)
 * @returns Array of derived OpenQuestions
 */
export function deriveOpenQuestions(
  graph: GraphState,
  phase: OQPhase = 'OUTLINE'
): OpenQuestion[] {
  const questions: OpenQuestion[] = [];

  // STRUCTURE domain (always active)
  questions.push(...deriveBeatUnrealized(graph));
  questions.push(...deriveActImbalance(graph));

  // SCENE domain (DRAFT and REVISION)
  if (phase === 'DRAFT' || phase === 'REVISION') {
    questions.push(...deriveSceneQuality(graph));
  }

  // CHARACTER domain
  questions.push(...deriveCharacterQuestions(graph, phase));

  // CONFLICT domain (DRAFT and REVISION)
  if (phase === 'DRAFT' || phase === 'REVISION') {
    questions.push(...deriveConflictQuestions(graph));
  }

  // THEME_MOTIF domain (REVISION only)
  if (phase === 'REVISION') {
    questions.push(...deriveThemeMotifQuestions(graph));
  }

  return questions;
}

// =============================================================================
// STRUCTURE Domain
// =============================================================================

/**
 * Derive BeatUnrealized questions.
 * Triggered when a Beat has no Scenes assigned to it.
 */
function deriveBeatUnrealized(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const scenes = getNodesByType<Scene>(graph, 'Scene');

  for (const beat of beats) {
    const scenesForBeat = scenes.filter((s) => s.beat_id === beat.id);
    if (scenesForBeat.length === 0) {
      questions.push({
        id: `oq_beat_${beat.id}`,
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: `STRUCTURE:BEAT:${beat.beat_type}`,
        target_node_id: beat.id,
        message: `Beat "${beat.beat_type}" has no scenes assigned`,
      });
    }
  }

  return questions;
}

/**
 * Derive ActImbalance questions.
 * Triggered when an act has no scenes while neighboring acts have content.
 */
function deriveActImbalance(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const scenes = getNodesByType<Scene>(graph, 'Scene');
  const beats = getNodesByType<Beat>(graph, 'Beat');

  // Count scenes per act
  const scenesPerAct: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const scene of scenes) {
    const beat = beats.find((b) => b.id === scene.beat_id);
    if (beat) {
      scenesPerAct[beat.act] = (scenesPerAct[beat.act] ?? 0) + 1;
    }
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
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
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
        severity: 'IMPORTANT',
        phase: 'DRAFT',
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
        severity: 'IMPORTANT',
        phase: 'DRAFT',
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
function deriveCharacterQuestions(
  graph: GraphState,
  phase: OQPhase
): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const characters = getNodesByType<Character>(graph, 'Character');

  for (const char of characters) {
    // Count scene appearances
    const appearances = graph.edges.filter(
      (e) => e.type === 'HAS_CHARACTER' && e.to === char.id
    ).length;

    // CharacterUnderspecified (OUTLINE phase)
    if (!char.description && appearances >= 2) {
      questions.push({
        id: `oq_char_desc_${char.id}`,
        type: 'CharacterUnderspecified',
        domain: 'CHARACTER',
        severity: 'SOFT',
        phase: 'OUTLINE',
        group_key: `CHARACTER:DETAIL:${char.id}`,
        target_node_id: char.id,
        message: `Character "${char.name}" appears in ${appearances} scenes but has no description`,
      });
    }

    // MissingCharacterArc (DRAFT and REVISION)
    if (phase === 'DRAFT' || phase === 'REVISION') {
      const hasArc = graph.edges.some(
        (e) => e.type === 'HAS_ARC' && e.from === char.id
      );
      if (!hasArc && appearances >= 3) {
        questions.push({
          id: `oq_char_arc_${char.id}`,
          type: 'MissingCharacterArc',
          domain: 'CHARACTER',
          severity: 'IMPORTANT',
          phase: 'DRAFT',
          group_key: `CHARACTER:ARC:${char.id}`,
          target_node_id: char.id,
          message: `Character "${char.name}" appears in ${appearances} scenes but has no arc defined`,
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
        questions.push({
          id: `oq_arc_ungrounded_${arc.id}`,
          type: 'ArcUngrounded',
          domain: 'CHARACTER',
          severity: 'SOFT',
          phase: 'REVISION',
          group_key: `CHARACTER:ARC:${arc.character_id}`,
          target_node_id: arc.id,
          message: `CharacterArc for "${charName}" has no turn references`,
        });
      }
    }
  }

  return questions;
}

// =============================================================================
// CONFLICT Domain
// =============================================================================

/**
 * Derive conflict-related questions.
 */
function deriveConflictQuestions(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const conflicts = getNodesByType<Conflict>(graph, 'Conflict');

  for (const conflict of conflicts) {
    // ConflictNeedsParties
    const involvesEdges = graph.edges.filter(
      (e) => e.type === 'INVOLVES' && e.from === conflict.id
    );
    if (involvesEdges.length === 0) {
      questions.push({
        id: `oq_conf_parties_${conflict.id}`,
        type: 'ConflictNeedsParties',
        domain: 'CONFLICT',
        severity: 'IMPORTANT',
        phase: 'DRAFT',
        group_key: `CONFLICT:SETUP:${conflict.id}`,
        target_node_id: conflict.id,
        message: `Conflict "${conflict.name}" has no characters involved`,
      });
    }

    // ConflictNeedsManifestation
    const manifestsEdges = graph.edges.filter(
      (e) => e.type === 'MANIFESTS_IN' && e.from === conflict.id
    );
    if (manifestsEdges.length === 0) {
      questions.push({
        id: `oq_conf_manifest_${conflict.id}`,
        type: 'ConflictNeedsManifestation',
        domain: 'CONFLICT',
        severity: 'IMPORTANT',
        phase: 'DRAFT',
        group_key: `CONFLICT:SHOW:${conflict.id}`,
        target_node_id: conflict.id,
        message: `Conflict "${conflict.name}" doesn't manifest in any scene`,
      });
    }
  }

  return questions;
}

// =============================================================================
// THEME_MOTIF Domain
// =============================================================================

/**
 * Derive theme and motif grounding questions.
 */
function deriveThemeMotifQuestions(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];

  // ThemeUngrounded
  const themes = getNodesByType<Theme>(graph, 'Theme');
  for (const theme of themes) {
    if (theme.status === 'FLOATING') {
      const expressedEdges = graph.edges.filter(
        (e) => e.type === 'EXPRESSED_IN' && e.from === theme.id
      );
      if (expressedEdges.length === 0) {
        questions.push({
          id: `oq_theme_${theme.id}`,
          type: 'ThemeUngrounded',
          domain: 'THEME_MOTIF',
          severity: 'SOFT',
          phase: 'REVISION',
          group_key: `THEME:GROUND:${theme.id}`,
          target_node_id: theme.id,
          message: `Theme "${theme.statement}" is floating and not expressed in any scene`,
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
        questions.push({
          id: `oq_motif_${motif.id}`,
          type: 'MotifUngrounded',
          domain: 'THEME_MOTIF',
          severity: 'SOFT',
          phase: 'REVISION',
          group_key: `MOTIF:GROUND:${motif.id}`,
          target_node_id: motif.id,
          message: `Motif "${motif.name}" is floating and doesn't appear in any scene`,
        });
      }
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
 * Filter OpenQuestions by severity.
 */
export function filterBySeverity(
  questions: OpenQuestion[],
  severity: OpenQuestion['severity']
): OpenQuestion[] {
  return questions.filter((q) => q.severity === severity);
}

/**
 * Filter OpenQuestions by phase.
 */
export function filterByPhase(
  questions: OpenQuestion[],
  phase: OQPhase
): OpenQuestion[] {
  return questions.filter((q) => q.phase === phase);
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

/**
 * Get blocking questions (must resolve before commit).
 */
export function getBlockingQuestions(
  questions: OpenQuestion[]
): OpenQuestion[] {
  return filterBySeverity(questions, 'BLOCKING');
}

/**
 * Check if there are any blocking questions.
 */
export function hasBlockingQuestions(questions: OpenQuestion[]): boolean {
  return questions.some((q) => q.severity === 'BLOCKING');
}
