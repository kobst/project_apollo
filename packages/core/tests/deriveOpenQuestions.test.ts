import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveOpenQuestions,
  filterByDomain,
} from '../src/core/deriveOpenQuestions.js';
import type { GraphState } from '../src/core/graph.js';
import { createGraphWith15Beats } from './helpers/index.js';
import {
  createScene,
  createCharacter,
  createCharacterArc,
  createStoryBeat,
  resetIdCounter,
} from './helpers/index.js';
import { edges } from './helpers/index.js';

/**
 * Helper to connect a scene to a beat through the StoryBeat hierarchy.
 * Creates StoryBeat → ALIGNS_WITH → Beat and StoryBeat → SATISFIED_BY → Scene
 */
function attachSceneToBeat(
  graph: GraphState,
  sceneId: string,
  beatId: string,
  storyBeatId?: string
): void {
  const sbId = storyBeatId ?? `sb_for_${sceneId}`;
  const sb = createStoryBeat({ id: sbId, title: `SB for ${sceneId}` });
  graph.nodes.set(sb.id, sb);
  graph.edges.push(edges.alignsWith(sbId, beatId));
  graph.edges.push(edges.satisfiedBy(sbId, sceneId, 1));
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
      const questions = deriveOpenQuestions(graph);

      const beatUnrealized = questions.filter((q) => q.type === 'BeatUnrealized');
      expect(beatUnrealized.length).toBe(15);
    });

    it('should include BeatUnrealized for Catalyst when no scenes', () => {
      const questions = deriveOpenQuestions(graph);

      const catalystOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_Catalyst'
      );
      expect(catalystOQ).toBeDefined();
      expect(catalystOQ?.domain).toBe('STRUCTURE');
    });

    it('BeatUnrealized should have correct group_key format', () => {
      const questions = deriveOpenQuestions(graph);

      const catalystOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_Catalyst'
      );
      expect(catalystOQ?.group_key).toBe('STRUCTURE:BEAT:Catalyst');
    });
  });

  describe('After adding Catalyst scene (via StoryBeat)', () => {
    it('should remove BeatUnrealized for Catalyst after scene added via StoryBeat', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_catalyst' });
      graph.nodes.set(scene.id, scene);
      // Connect scene to beat through StoryBeat hierarchy
      attachSceneToBeat(graph, 'scene_catalyst', 'beat_Catalyst');

      const questions = deriveOpenQuestions(graph);

      const catalystOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_Catalyst'
      );
      expect(catalystOQ).toBeUndefined();
    });

    it('should still have BeatUnrealized for Debate and BreakIntoTwo', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_catalyst' });
      graph.nodes.set(scene.id, scene);
      attachSceneToBeat(graph, 'scene_catalyst', 'beat_Catalyst');

      const questions = deriveOpenQuestions(graph);

      const debateOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_Debate'
      );
      const breakIntoTwoOQ = questions.find(
        (q) => q.type === 'BeatUnrealized' && q.target_node_id === 'beat_BreakIntoTwo'
      );

      expect(debateOQ).toBeDefined();
      expect(breakIntoTwoOQ).toBeDefined();
    });

    it('should have 14 BeatUnrealized after adding one scene via StoryBeat', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_catalyst' });
      graph.nodes.set(scene.id, scene);
      attachSceneToBeat(graph, 'scene_catalyst', 'beat_Catalyst');

      const questions = deriveOpenQuestions(graph);
      const beatUnrealized = questions.filter((q) => q.type === 'BeatUnrealized');

      expect(beatUnrealized.length).toBe(14);
    });
  });

  describe('ActImbalance', () => {
    it('should detect act imbalance when one act is empty while neighbors have content', () => {
      // Add scenes to Act 1 beats (positions 1-5) via StoryBeats
      const scene1 = createScene('beat_OpeningImage', { id: 'scene_1' });
      const scene2 = createScene('beat_Setup', { id: 'scene_2' });
      // Skip Act 2 entirely (positions 6-8)
      // Add scenes to Act 3 (positions 9-10) via StoryBeats
      const scene3 = createScene('beat_Midpoint', { id: 'scene_3' });
      const scene4 = createScene('beat_BadGuysCloseIn', { id: 'scene_4' });

      graph.nodes.set(scene1.id, scene1);
      graph.nodes.set(scene2.id, scene2);
      graph.nodes.set(scene3.id, scene3);
      graph.nodes.set(scene4.id, scene4);

      // Connect scenes to beats through StoryBeats
      attachSceneToBeat(graph, 'scene_1', 'beat_OpeningImage');
      attachSceneToBeat(graph, 'scene_2', 'beat_Setup');
      attachSceneToBeat(graph, 'scene_3', 'beat_Midpoint');
      attachSceneToBeat(graph, 'scene_4', 'beat_BadGuysCloseIn');

      const questions = deriveOpenQuestions(graph);

      const actImbalance = questions.filter((q) => q.type === 'ActImbalance');
      expect(actImbalance.length).toBeGreaterThan(0);
    });
  });

  describe('SceneHasNoCast', () => {
    it('should derive SceneHasNoCast when scene has no HAS_CHARACTER edges', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_nocast' });
      graph.nodes.set(scene.id, scene);

      const questions = deriveOpenQuestions(graph);

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

      const questions = deriveOpenQuestions(graph);

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

      const questions = deriveOpenQuestions(graph);

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

      const questions = deriveOpenQuestions(graph);

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

      const questions = deriveOpenQuestions(graph);

      const missingArc = questions.find(
        (q) =>
          q.type === 'MissingCharacterArc' && q.target_node_id === 'char_few'
      );
      expect(missingArc).toBeUndefined();
    });
  });

  describe('Helper functions', () => {
    it('filterByDomain should filter correctly', () => {
      const questions = deriveOpenQuestions(graph);

      const structureOnly = filterByDomain(questions, 'STRUCTURE');
      expect(structureOnly.every((q) => q.domain === 'STRUCTURE')).toBe(true);
    });
  });

  describe('Golden fixture OQ derivation', () => {
    it('empty_story should have 15 BeatUnrealized questions', () => {
      const emptyGraph = fixtures.emptyStory();

      const questions = deriveOpenQuestions(emptyGraph);
      const beatUnrealized = questions.filter((q) => q.type === 'BeatUnrealized');

      expect(beatUnrealized.length).toBe(15);
    });

    it('after_acceptance should have 14 BeatUnrealized (Catalyst has scene)', () => {
      const afterGraph = fixtures.afterAcceptance();

      const questions = deriveOpenQuestions(afterGraph);
      const beatUnrealized = questions.filter((q) => q.type === 'BeatUnrealized');

      expect(beatUnrealized.length).toBe(14);
      expect(
        beatUnrealized.find((q) => q.target_node_id === 'beat_Catalyst')
      ).toBeUndefined();
    });
  });
});
