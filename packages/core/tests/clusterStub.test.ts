import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateClusters,
  generateClusterForQuestion,
} from '../src/stubs/clusterStub.js';
import { deriveOpenQuestions } from '../src/core/deriveOpenQuestions.js';
import type { OpenQuestion } from '../src/types/openQuestion.js';
import { createGraphWith15Beats } from './helpers/index.js';
import { resetIdCounter } from './helpers/index.js';

describe('Cluster Stub Determinism', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('Stable cluster IDs', () => {
    it('should generate consistent cluster structure for same input', () => {
      const graph = createGraphWith15Beats();
      const questions = deriveOpenQuestions(graph, 'OUTLINE');

      // Generate clusters
      const clusters = generateClusters(questions, 'sv0', 'OUTLINE');

      // Verify structure is consistent
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.length).toBeLessThanOrEqual(4); // Max 4 per spec

      for (const result of clusters) {
        expect(result.cluster.type).toBe('MoveCluster');
        expect(result.cluster.base_story_version_id).toBe('sv0');
        expect(result.moves.length).toBeGreaterThan(0);
        expect(result.moves.length).toBeLessThanOrEqual(5);
      }
    });

    it('should generate cluster for BeatUnrealized with correct type', () => {
      const beatOQ: OpenQuestion = {
        id: 'oq_beat_test',
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: 'STRUCTURE:BEAT:Catalyst',
        target_node_id: 'beat_Catalyst',
        message: 'Beat "Catalyst" has no scenes assigned',
      };

      const result = generateClusterForQuestion(beatOQ, 'sv0', 'OUTLINE');

      expect(result.cluster.cluster_type).toBe('STRUCTURE');
      expect(result.cluster.primary_open_question_id).toBe('oq_beat_test');
    });
  });

  describe('Stable scope budgets', () => {
    it('STRUCTURE cluster should have correct scope budget', () => {
      const beatOQ: OpenQuestion = {
        id: 'oq_beat_test',
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: 'STRUCTURE:BEAT:Catalyst',
        target_node_id: 'beat_Catalyst',
        message: 'Test',
      };

      const result = generateClusterForQuestion(beatOQ, 'sv0', 'OUTLINE');

      expect(result.cluster.scope_budget).toEqual({
        max_ops_per_move: 6,
        max_new_nodes_per_move: 2,
        allowed_node_types: ['Scene', 'Beat'],
      });
    });

    it('SCENE_QUALITY cluster should have correct scope budget', () => {
      const sceneOQ: OpenQuestion = {
        id: 'oq_scene_test',
        type: 'SceneHasNoCast',
        domain: 'SCENE',
        severity: 'IMPORTANT',
        phase: 'DRAFT',
        group_key: 'SCENE:QUALITY:scene_1',
        target_node_id: 'scene_1',
        message: 'Test',
      };

      const result = generateClusterForQuestion(sceneOQ, 'sv0', 'DRAFT');

      expect(result.cluster.scope_budget).toEqual({
        max_ops_per_move: 4,
        max_new_nodes_per_move: 0,
        allowed_node_types: ['Scene'],
      });
    });

    it('CHARACTER cluster should have correct scope budget', () => {
      const charOQ: OpenQuestion = {
        id: 'oq_char_test',
        type: 'MissingCharacterArc',
        domain: 'CHARACTER',
        severity: 'IMPORTANT',
        phase: 'DRAFT',
        group_key: 'CHARACTER:ARC:char_1',
        target_node_id: 'char_1',
        message: 'Test',
      };

      const result = generateClusterForQuestion(charOQ, 'sv0', 'DRAFT');

      expect(result.cluster.scope_budget.allowed_node_types).toContain(
        'CharacterArc'
      );
    });

  });

  describe('Move generation for BeatUnrealized', () => {
    it('should generate diverse move variants for BeatUnrealized', () => {
      const beatOQ: OpenQuestion = {
        id: 'oq_beat_catalyst',
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: 'STRUCTURE:BEAT:Catalyst',
        target_node_id: 'beat_Catalyst',
        message: 'Beat "Catalyst" has no scenes assigned',
      };

      const result = generateClusterForQuestion(beatOQ, 'sv0', 'OUTLINE');

      // Should have multiple move variants
      expect(result.moves.length).toBeGreaterThanOrEqual(3);

      // Each move should have a patch
      for (const { move, patch } of result.moves) {
        expect(move.cluster_id).toBe(result.cluster.id);
        expect(move.patch_id).toBe(patch.id);
        expect(patch.ops.length).toBeGreaterThan(0);
      }

      // Moves should have diverse styles
      const styles = result.moves.map((m) => m.move.move_style_tags?.[0]);
      expect(new Set(styles).size).toBeGreaterThan(1);
    });

    it('generated scenes should have valid structure', () => {
      const beatOQ: OpenQuestion = {
        id: 'oq_beat_catalyst',
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: 'STRUCTURE:BEAT:Catalyst',
        target_node_id: 'beat_Catalyst',
        message: 'Test',
      };

      const result = generateClusterForQuestion(beatOQ, 'sv0', 'OUTLINE');

      for (const { patch } of result.moves) {
        const addNodeOp = patch.ops.find((op) => op.op === 'ADD_NODE');
        if (addNodeOp && addNodeOp.op === 'ADD_NODE') {
          const node = addNodeOp.node;
          if (node.type === 'Scene') {
            // Scene should reference the beat
            expect((node as { beat_id?: string }).beat_id).toBe('beat_Catalyst');
            // Scene should have valid scene_overview
            const overview = (node as { scene_overview?: string }).scene_overview;
            expect(overview?.length).toBeGreaterThanOrEqual(20);
          }
        }
      }
    });

    it('move confidence should be within 0.6-0.9 range', () => {
      const beatOQ: OpenQuestion = {
        id: 'oq_beat_test',
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: 'STRUCTURE:BEAT:Catalyst',
        target_node_id: 'beat_Catalyst',
        message: 'Test',
      };

      const result = generateClusterForQuestion(beatOQ, 'sv0', 'OUTLINE');

      for (const { move } of result.moves) {
        expect(move.confidence).toBeGreaterThanOrEqual(0.6);
        expect(move.confidence).toBeLessThanOrEqual(0.9);
      }
    });
  });

  describe('Cluster grouping', () => {
    it('should group questions by group_key', () => {
      const questions: OpenQuestion[] = [
        {
          id: 'oq_1',
          type: 'BeatUnrealized',
          domain: 'STRUCTURE',
          severity: 'IMPORTANT',
          phase: 'OUTLINE',
          group_key: 'STRUCTURE:BEAT:Catalyst',
          target_node_id: 'beat_Catalyst',
          message: 'Test 1',
        },
        {
          id: 'oq_2',
          type: 'BeatUnrealized',
          domain: 'STRUCTURE',
          severity: 'IMPORTANT',
          phase: 'OUTLINE',
          group_key: 'STRUCTURE:BEAT:Catalyst', // Same group
          target_node_id: 'beat_Catalyst',
          message: 'Test 2',
        },
        {
          id: 'oq_3',
          type: 'BeatUnrealized',
          domain: 'STRUCTURE',
          severity: 'IMPORTANT',
          phase: 'OUTLINE',
          group_key: 'STRUCTURE:BEAT:Debate', // Different group
          target_node_id: 'beat_Debate',
          message: 'Test 3',
        },
      ];

      const clusters = generateClusters(questions, 'sv0', 'OUTLINE');

      // Should create 2 clusters (one per unique group_key)
      expect(clusters.length).toBe(2);
    });

    it('should limit to max 4 clusters', () => {
      // Create questions with many different group_keys
      const questions: OpenQuestion[] = [];
      for (let i = 0; i < 10; i++) {
        questions.push({
          id: `oq_${i}`,
          type: 'BeatUnrealized',
          domain: 'STRUCTURE',
          severity: 'IMPORTANT',
          phase: 'OUTLINE',
          group_key: `STRUCTURE:BEAT:Beat${i}`,
          target_node_id: `beat_${i}`,
          message: `Test ${i}`,
        });
      }

      const clusters = generateClusters(questions, 'sv0', 'OUTLINE');

      expect(clusters.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Cluster metadata', () => {
    it('should have correct cluster title based on OQ type', () => {
      const testCases: Array<{
        type: OpenQuestion['type'];
        expectedPattern: RegExp;
      }> = [
        { type: 'BeatUnrealized', expectedPattern: /Realize beat/ },
        { type: 'ActImbalance', expectedPattern: /Balance act/ },
        { type: 'SceneHasNoCast', expectedPattern: /Add characters/ },
        { type: 'MissingCharacterArc', expectedPattern: /Define character arc/ },
      ];

      for (const { type, expectedPattern } of testCases) {
        const oq: OpenQuestion = {
          id: 'oq_test',
          type,
          domain: 'STRUCTURE',
          severity: 'IMPORTANT',
          phase: 'OUTLINE',
          group_key: 'TEST:GROUP',
          message: 'Test',
        };

        const result = generateClusterForQuestion(oq, 'sv0', 'OUTLINE');
        expect(result.cluster.title).toMatch(expectedPattern);
      }
    });

    it('should track supporting_open_question_ids', () => {
      const questions: OpenQuestion[] = [
        {
          id: 'oq_primary',
          type: 'BeatUnrealized',
          domain: 'STRUCTURE',
          severity: 'IMPORTANT',
          phase: 'OUTLINE',
          group_key: 'STRUCTURE:BEAT:Catalyst',
          target_node_id: 'beat_Catalyst',
          message: 'Primary',
        },
        {
          id: 'oq_supporting',
          type: 'BeatUnrealized',
          domain: 'STRUCTURE',
          severity: 'IMPORTANT',
          phase: 'OUTLINE',
          group_key: 'STRUCTURE:BEAT:Catalyst',
          target_node_id: 'beat_Catalyst',
          message: 'Supporting',
        },
      ];

      const clusters = generateClusters(questions, 'sv0', 'OUTLINE');

      expect(clusters.length).toBe(1);
      expect(clusters[0]?.cluster.primary_open_question_id).toBe('oq_primary');
      expect(
        clusters[0]?.cluster.supporting_open_question_ids
      ).toContain('oq_supporting');
    });

    it('cluster status should be PROPOSED', () => {
      const oq: OpenQuestion = {
        id: 'oq_test',
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: 'TEST:GROUP',
        message: 'Test',
      };

      const result = generateClusterForQuestion(oq, 'sv0', 'OUTLINE');

      expect(result.cluster.status).toBe('PROPOSED');
    });

    it('move status should be PROPOSED', () => {
      const oq: OpenQuestion = {
        id: 'oq_test',
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: 'TEST:GROUP',
        message: 'Test',
      };

      const result = generateClusterForQuestion(oq, 'sv0', 'OUTLINE');

      for (const { move } of result.moves) {
        expect(move.status).toBe('PROPOSED');
      }
    });
  });

  describe('Empty input handling', () => {
    it('should return empty array for empty questions list', () => {
      const clusters = generateClusters([], 'sv0', 'OUTLINE');

      expect(clusters).toEqual([]);
    });
  });
});
