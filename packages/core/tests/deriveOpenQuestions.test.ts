import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveOpenQuestions,
  filterByDomain,
  filterBySeverity,
  filterByPhase,
  hasBlockingQuestions,
} from '../src/core/deriveOpenQuestions.js';
import type { GraphState } from '../src/core/graph.js';
import type { OpenQuestion } from '../src/types/openQuestion.js';
import { createGraphWith15Beats } from './helpers/index.js';
import {
  createScene,
  createCharacter,
  createConflict,
  createTheme,
  createMotif,
  createCharacterArc,
  createPlotPoint,
  resetIdCounter,
} from './helpers/index.js';
import { edges } from './helpers/index.js';

/**
 * Helper to connect a scene to a beat through the PlotPoint hierarchy.
 * Creates PlotPoint → ALIGNS_WITH → Beat and PlotPoint → SATISFIED_BY → Scene
 */
function attachSceneToBeat(
  graph: GraphState,
  sceneId: string,
  beatId: string,
  plotPointId?: string
): void {
  const ppId = plotPointId ?? `pp_for_${sceneId}`;
  const pp = createPlotPoint({ id: ppId, title: `PP for ${sceneId}` });
  graph.nodes.set(pp.id, pp);
  graph.edges.push(edges.alignsWith(ppId, beatId));
  graph.edges.push(edges.satisfiedBy(ppId, sceneId, 1));
}
import { fixtures } from './fixtures/index.js';

describe('deriveOpenQuestions', () => {
  let graph: GraphState;

  beforeEach(() => {
    resetIdCounter();
    graph = createGraphWith15Beats();
  });

  describe('With 0 scenes - BeatUnrealized', () => {
    it('should derive BeatUnrealized for all 15 beats when no scenes exist', () => {
      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      const beatUnrealized = questions.filter((q) => q.type === 'BeatUnrealized');
      expect(beatUnrealized.length).toBe(15);
    });

    it('should include BeatUnrealized for Catalyst when no scenes', () => {
      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      const catalystOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_Catalyst'
      );
      expect(catalystOQ).toBeDefined();
      expect(catalystOQ?.domain).toBe('STRUCTURE');
      expect(catalystOQ?.severity).toBe('IMPORTANT');
      expect(catalystOQ?.phase).toBe('OUTLINE');
    });

    it('BeatUnrealized should have correct group_key format', () => {
      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      const catalystOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_Catalyst'
      );
      expect(catalystOQ?.group_key).toBe('STRUCTURE:BEAT:Catalyst');
    });
  });

  describe('After adding Catalyst scene (via PlotPoint)', () => {
    it('should remove BeatUnrealized for Catalyst after scene added via PlotPoint', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_catalyst' });
      graph.nodes.set(scene.id, scene);
      // Connect scene to beat through PlotPoint hierarchy
      attachSceneToBeat(graph, 'scene_catalyst', 'beat_Catalyst');

      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      const catalystOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_Catalyst'
      );
      expect(catalystOQ).toBeUndefined();
    });

    it('should still have BeatUnrealized for Debate and BreakIntoTwo', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_catalyst' });
      graph.nodes.set(scene.id, scene);
      attachSceneToBeat(graph, 'scene_catalyst', 'beat_Catalyst');

      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      const debateOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_Debate'
      );
      const breakIntoTwoOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_BreakIntoTwo'
      );

      expect(debateOQ).toBeDefined();
      expect(breakIntoTwoOQ).toBeDefined();
    });

    it('should have 14 BeatUnrealized after adding one scene via PlotPoint', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_catalyst' });
      graph.nodes.set(scene.id, scene);
      attachSceneToBeat(graph, 'scene_catalyst', 'beat_Catalyst');

      const questions = deriveOpenQuestions(graph, 'OUTLINE');
      const beatUnrealized = questions.filter((q) => q.type === 'BeatUnrealized');

      expect(beatUnrealized.length).toBe(14);
    });
  });

  describe('Phase gating', () => {
    it('ThemeUngrounded should only appear in REVISION phase', () => {
      const theme = createTheme({ id: 'theme_1', status: 'FLOATING' });
      graph.nodes.set(theme.id, theme);

      // OUTLINE phase - should NOT have ThemeUngrounded
      const outlineQuestions = deriveOpenQuestions(graph, 'OUTLINE');
      expect(
        outlineQuestions.some((q) => q.type === 'ThemeUngrounded')
      ).toBe(false);

      // DRAFT phase - should NOT have ThemeUngrounded
      const draftQuestions = deriveOpenQuestions(graph, 'DRAFT');
      expect(draftQuestions.some((q) => q.type === 'ThemeUngrounded')).toBe(
        false
      );

      // REVISION phase - SHOULD have ThemeUngrounded
      const revisionQuestions = deriveOpenQuestions(graph, 'REVISION');
      expect(
        revisionQuestions.some((q) => q.type === 'ThemeUngrounded')
      ).toBe(true);
    });

    it('MotifUngrounded should only appear in REVISION phase', () => {
      const motif = createMotif({ id: 'motif_1', status: 'FLOATING' });
      graph.nodes.set(motif.id, motif);

      expect(
        deriveOpenQuestions(graph, 'OUTLINE').some(
          (q) => q.type === 'MotifUngrounded'
        )
      ).toBe(false);
      expect(
        deriveOpenQuestions(graph, 'DRAFT').some(
          (q) => q.type === 'MotifUngrounded'
        )
      ).toBe(false);
      expect(
        deriveOpenQuestions(graph, 'REVISION').some(
          (q) => q.type === 'MotifUngrounded'
        )
      ).toBe(true);
    });

    it('ArcUngrounded should only appear in REVISION phase', () => {
      const char = createCharacter({ id: 'char_1' });
      const arc = createCharacterArc('char_1', { id: 'arc_1', turn_refs: [] });
      graph.nodes.set(char.id, char);
      graph.nodes.set(arc.id, arc);
      graph.edges.push(edges.hasArc('char_1', 'arc_1'));

      expect(
        deriveOpenQuestions(graph, 'OUTLINE').some(
          (q) => q.type === 'ArcUngrounded'
        )
      ).toBe(false);
      expect(
        deriveOpenQuestions(graph, 'DRAFT').some((q) => q.type === 'ArcUngrounded')
      ).toBe(false);
      expect(
        deriveOpenQuestions(graph, 'REVISION').some(
          (q) => q.type === 'ArcUngrounded'
        )
      ).toBe(true);
    });

    it('SceneHasNoCast should appear in DRAFT and REVISION', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(scene.id, scene);

      expect(
        deriveOpenQuestions(graph, 'OUTLINE').some(
          (q) => q.type === 'SceneHasNoCast'
        )
      ).toBe(false);
      expect(
        deriveOpenQuestions(graph, 'DRAFT').some(
          (q) => q.type === 'SceneHasNoCast'
        )
      ).toBe(true);
      expect(
        deriveOpenQuestions(graph, 'REVISION').some(
          (q) => q.type === 'SceneHasNoCast'
        )
      ).toBe(true);
    });

    it('ConflictNeedsParties should appear in DRAFT and REVISION', () => {
      const conflict = createConflict({ id: 'conf_1' });
      graph.nodes.set(conflict.id, conflict);

      expect(
        deriveOpenQuestions(graph, 'OUTLINE').some(
          (q) => q.type === 'ConflictNeedsParties'
        )
      ).toBe(false);
      expect(
        deriveOpenQuestions(graph, 'DRAFT').some(
          (q) => q.type === 'ConflictNeedsParties'
        )
      ).toBe(true);
      expect(
        deriveOpenQuestions(graph, 'REVISION').some(
          (q) => q.type === 'ConflictNeedsParties'
        )
      ).toBe(true);
    });

    it('MissingCharacterArc should appear in DRAFT and REVISION (for chars in 3+ scenes)', () => {
      const char = createCharacter({ id: 'char_1' });
      graph.nodes.set(char.id, char);

      // Add character to 3 scenes
      for (let i = 1; i <= 3; i++) {
        const scene = createScene('beat_Catalyst', {
          id: `scene_${i}`,
          order_index: i,
        });
        graph.nodes.set(scene.id, scene);
        graph.edges.push(edges.hasCharacter(`scene_${i}`, 'char_1'));
      }

      expect(
        deriveOpenQuestions(graph, 'OUTLINE').some(
          (q) => q.type === 'MissingCharacterArc'
        )
      ).toBe(false);
      expect(
        deriveOpenQuestions(graph, 'DRAFT').some(
          (q) => q.type === 'MissingCharacterArc'
        )
      ).toBe(true);
    });
  });

  describe('ActImbalance', () => {
    it('should detect act imbalance when one act is empty while neighbors have content', () => {
      // Add scenes to Act 1 beats (positions 1-5) via PlotPoints
      const scene1 = createScene('beat_OpeningImage', { id: 'scene_1' });
      const scene2 = createScene('beat_Setup', { id: 'scene_2' });
      // Skip Act 2 entirely (positions 6-8)
      // Add scenes to Act 3 (positions 9-10) via PlotPoints
      const scene3 = createScene('beat_Midpoint', { id: 'scene_3' });
      const scene4 = createScene('beat_BadGuysCloseIn', { id: 'scene_4' });

      graph.nodes.set(scene1.id, scene1);
      graph.nodes.set(scene2.id, scene2);
      graph.nodes.set(scene3.id, scene3);
      graph.nodes.set(scene4.id, scene4);

      // Connect scenes to beats through PlotPoints
      attachSceneToBeat(graph, 'scene_1', 'beat_OpeningImage');
      attachSceneToBeat(graph, 'scene_2', 'beat_Setup');
      attachSceneToBeat(graph, 'scene_3', 'beat_Midpoint');
      attachSceneToBeat(graph, 'scene_4', 'beat_BadGuysCloseIn');

      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      const actImbalance = questions.filter((q) => q.type === 'ActImbalance');
      expect(actImbalance.length).toBeGreaterThan(0);
    });
  });

  describe('SceneHasNoCast', () => {
    it('should derive SceneHasNoCast when scene has no HAS_CHARACTER edges', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_nocast' });
      graph.nodes.set(scene.id, scene);

      const questions = deriveOpenQuestions(graph, 'DRAFT');

      const sceneNoCast = questions.find(
        (q) => q.type === 'SceneHasNoCast' && q.target_node_id === 'scene_nocast'
      );
      expect(sceneNoCast).toBeDefined();
    });

    it('should NOT derive SceneHasNoCast when scene has characters', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_withcast' });
      const char = createCharacter({ id: 'char_1' });
      graph.nodes.set(scene.id, scene);
      graph.nodes.set(char.id, char);
      graph.edges.push(edges.hasCharacter('scene_withcast', 'char_1'));

      const questions = deriveOpenQuestions(graph, 'DRAFT');

      const sceneNoCast = questions.find(
        (q) =>
          q.type === 'SceneHasNoCast' && q.target_node_id === 'scene_withcast'
      );
      expect(sceneNoCast).toBeUndefined();
    });
  });

  describe('SceneNeedsLocation', () => {
    it('should derive SceneNeedsLocation when scene has no LOCATED_AT edge', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_noloc' });
      graph.nodes.set(scene.id, scene);

      const questions = deriveOpenQuestions(graph, 'DRAFT');

      const needsLoc = questions.find(
        (q) =>
          q.type === 'SceneNeedsLocation' && q.target_node_id === 'scene_noloc'
      );
      expect(needsLoc).toBeDefined();
    });
  });

  describe('MissingCharacterArc', () => {
    it('should derive MissingCharacterArc when character in 3+ scenes has no arc', () => {
      const char = createCharacter({ id: 'char_noarc' });
      graph.nodes.set(char.id, char);

      // Add to 3 scenes
      for (let i = 1; i <= 3; i++) {
        const scene = createScene('beat_Catalyst', {
          id: `scene_${i}`,
          order_index: i,
        });
        graph.nodes.set(scene.id, scene);
        graph.edges.push(edges.hasCharacter(`scene_${i}`, 'char_noarc'));
      }

      const questions = deriveOpenQuestions(graph, 'DRAFT');

      const missingArc = questions.find(
        (q) =>
          q.type === 'MissingCharacterArc' && q.target_node_id === 'char_noarc'
      );
      expect(missingArc).toBeDefined();
      expect(missingArc?.message).toContain('3 scenes');
    });

    it('should NOT derive MissingCharacterArc for character in < 3 scenes', () => {
      const char = createCharacter({ id: 'char_few' });
      graph.nodes.set(char.id, char);

      // Only 2 scenes
      for (let i = 1; i <= 2; i++) {
        const scene = createScene('beat_Catalyst', {
          id: `scene_${i}`,
          order_index: i,
        });
        graph.nodes.set(scene.id, scene);
        graph.edges.push(edges.hasCharacter(`scene_${i}`, 'char_few'));
      }

      const questions = deriveOpenQuestions(graph, 'DRAFT');

      const missingArc = questions.find(
        (q) =>
          q.type === 'MissingCharacterArc' && q.target_node_id === 'char_few'
      );
      expect(missingArc).toBeUndefined();
    });
  });

  describe('ConflictNeedsParties and ConflictNeedsManifestation', () => {
    it('should derive both when conflict has no edges', () => {
      const conflict = createConflict({ id: 'conf_lonely' });
      graph.nodes.set(conflict.id, conflict);

      const questions = deriveOpenQuestions(graph, 'DRAFT');

      expect(
        questions.find(
          (q) =>
            q.type === 'ConflictNeedsParties' &&
            q.target_node_id === 'conf_lonely'
        )
      ).toBeDefined();
      expect(
        questions.find(
          (q) =>
            q.type === 'ConflictNeedsManifestation' &&
            q.target_node_id === 'conf_lonely'
        )
      ).toBeDefined();
    });

    it('should NOT derive ConflictNeedsParties when conflict has INVOLVES edge', () => {
      const conflict = createConflict({ id: 'conf_1' });
      const char = createCharacter({ id: 'char_1' });
      graph.nodes.set(conflict.id, conflict);
      graph.nodes.set(char.id, char);
      graph.edges.push(edges.involves('conf_1', 'char_1'));

      const questions = deriveOpenQuestions(graph, 'DRAFT');

      expect(
        questions.find(
          (q) =>
            q.type === 'ConflictNeedsParties' && q.target_node_id === 'conf_1'
        )
      ).toBeUndefined();
    });
  });

  describe('Helper functions', () => {
    it('filterByDomain should filter correctly', () => {
      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      const structureOnly = filterByDomain(questions, 'STRUCTURE');
      expect(structureOnly.every((q) => q.domain === 'STRUCTURE')).toBe(true);
    });

    it('filterBySeverity should filter correctly', () => {
      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      const importantOnly = filterBySeverity(questions, 'IMPORTANT');
      expect(importantOnly.every((q) => q.severity === 'IMPORTANT')).toBe(true);
    });

    it('filterByPhase should filter correctly', () => {
      // Add entities that generate questions in different phases
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      const theme = createTheme({ id: 'theme_1', status: 'FLOATING' });
      graph.nodes.set(scene.id, scene);
      graph.nodes.set(theme.id, theme);

      const questions = deriveOpenQuestions(graph, 'REVISION');

      const outlinePhase = filterByPhase(questions, 'OUTLINE');
      expect(outlinePhase.every((q) => q.phase === 'OUTLINE')).toBe(true);
    });

    it('hasBlockingQuestions should return true when BLOCKING questions exist', () => {
      const questions: OpenQuestion[] = [
        {
          id: 'oq_test',
          type: 'SceneUnplaced',
          domain: 'STRUCTURE',
          severity: 'BLOCKING',
          phase: 'OUTLINE',
          group_key: 'TEST',
          message: 'Test blocking',
        },
      ];

      expect(hasBlockingQuestions(questions)).toBe(true);
    });

    it('hasBlockingQuestions should return false when no BLOCKING questions', () => {
      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      // BeatUnrealized is IMPORTANT, not BLOCKING
      expect(hasBlockingQuestions(questions)).toBe(false);
    });
  });

  describe('Golden fixture OQ derivation', () => {
    it('empty_story should have 15 BeatUnrealized questions', () => {
      const emptyGraph = fixtures.emptyStory();

      const questions = deriveOpenQuestions(emptyGraph, 'OUTLINE');
      const beatUnrealized = questions.filter((q) => q.type === 'BeatUnrealized');

      expect(beatUnrealized.length).toBe(15);
    });

    it('after_acceptance should have 14 BeatUnrealized (Catalyst has scene)', () => {
      const afterGraph = fixtures.afterAcceptance();

      const questions = deriveOpenQuestions(afterGraph, 'OUTLINE');
      const beatUnrealized = questions.filter((q) => q.type === 'BeatUnrealized');

      expect(beatUnrealized.length).toBe(14);
      expect(
        beatUnrealized.find((q) => q.target_node_id === 'beat_Catalyst')
      ).toBeUndefined();
    });
  });
});
