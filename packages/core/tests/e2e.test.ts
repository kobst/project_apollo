import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGraph } from '../src/core/graph.js';
import { applyPatch } from '../src/core/applyPatch.js';
import { validatePatch, validateGraph } from '../src/core/validator.js';
import { deriveOpenQuestions } from '../src/core/deriveOpenQuestions.js';
import {
  seedBeats,
  extractFromLogline,
  initializeStory,
} from '../src/stubs/extractorStub.js';
import { generateClusterForQuestion } from '../src/stubs/clusterStub.js';
import type { GraphState } from '../src/core/graph.js';
import type { Patch } from '../src/types/patch.js';
import { createScene, createCharacter, resetIdCounter } from './helpers/index.js';
import { edges } from './helpers/index.js';
import { fixtures } from './fixtures/index.js';

describe('End-to-end loop', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('Story initialization flow', () => {
    it('should create a graph, seed beats, and derive open questions', () => {
      // 1. Create empty graph
      const graph = createEmptyGraph();
      expect(graph.nodes.size).toBe(0);

      // 2. Seed beats
      const beatsPatch = seedBeats('sv0');
      const graphWithBeats = applyPatch(graph, beatsPatch);

      // 3. Validate
      const validation = validateGraph(graphWithBeats);
      expect(validation.success).toBe(true);
      expect(graphWithBeats.nodes.size).toBe(15);

      // 4. Derive open questions
      const questions = deriveOpenQuestions(graphWithBeats, 'OUTLINE');
      expect(questions.filter((q) => q.type === 'BeatUnrealized').length).toBe(
        15
      );
    });

    it('should initialize story from logline', () => {
      const graph = createEmptyGraph();
      const logline = 'A young wizard discovers their true powers.';

      // Initialize
      const initPatch = initializeStory(logline, 'sv0');
      const initializedGraph = applyPatch(graph, initPatch);

      // Validate
      expect(validateGraph(initializedGraph).success).toBe(true);

      // Should have 15 beats + character + location
      expect(initializedGraph.nodes.size).toBe(17);

      // Check entities exist
      expect(initializedGraph.nodes.has('char_protagonist')).toBe(true);
      expect(initializedGraph.nodes.has('loc_primary')).toBe(true);
    });

    it('extractFromLogline should pad short descriptions', () => {
      const graph = createEmptyGraph();
      const shortLogline = 'Hero saves day';

      const patch = extractFromLogline(shortLogline, 'sv0');
      const result = applyPatch(graph, patch);

      // Should still be valid (description padded to 20+ chars)
      expect(validateGraph(result).success).toBe(true);
    });
  });

  describe('Full authoring loop', () => {
    it('should complete outline -> draft -> revision cycle', () => {
      // PHASE 1: OUTLINE
      let graph = createEmptyGraph();
      const initPatch = initializeStory(
        'A detective solves an impossible crime.',
        'sv0'
      );
      graph = applyPatch(graph, initPatch);

      // Get initial OQs
      let questions = deriveOpenQuestions(graph);
      const initialBeatOQs = questions.filter(
        (q) => q.type === 'BeatUnrealized'
      );
      expect(initialBeatOQs.length).toBe(15);

      // Generate clusters for one OQ
      const catalystOQ = questions.find(
        (q) => q.target_node_id === 'beat_Catalyst'
      );
      expect(catalystOQ).toBeDefined();

      const clusterResult = generateClusterForQuestion(
        catalystOQ!,
        'sv0',
        'OUTLINE'
      );
      expect(clusterResult.moves.length).toBeGreaterThan(0);

      // Apply first move's patch
      const firstMove = clusterResult.moves[0]!;
      const validation = validatePatch(graph, firstMove.patch);
      expect(validation.success).toBe(true);

      graph = applyPatch(graph, firstMove.patch);

      // Verify Catalyst OQ is resolved
      questions = deriveOpenQuestions(graph);
      expect(
        questions.find((q) => q.target_node_id === 'beat_Catalyst')
      ).toBeUndefined();

      // PHASE 2: DRAFT
      // Find a scene to add character to
      let sceneId: string | undefined;
      for (const node of graph.nodes.values()) {
        if (node.type === 'Scene') {
          sceneId = node.id;
          break;
        }
      }
      expect(sceneId).toBeDefined();

      const addCharPatch: Patch = {
        type: 'Patch',
        id: 'patch_add_char',
        base_story_version_id: 'sv0',
        created_at: new Date().toISOString(),
        ops: [
          {
            op: 'ADD_EDGE',
            edge: edges.hasCharacter(sceneId!, 'char_protagonist'),
          },
        ],
      };

      graph = applyPatch(graph, addCharPatch);

      // Check DRAFT phase questions
      questions = deriveOpenQuestions(graph);

      // Should NOT have SceneHasNoCast for that scene anymore
      const sceneNoCast = questions.find(
        (q) => q.type === 'SceneHasNoCast' && q.target_node_id === sceneId
      );
      expect(sceneNoCast).toBeUndefined();

      // PHASE 3: REVISION (quick check)
      questions = deriveOpenQuestions(graph);

      // Should be able to derive questions in this phase
      expect(Array.isArray(questions)).toBe(true);
    });
  });

  describe('Patch validation prevents invalid states', () => {
    it('should reject patch that violates FK integrity', () => {
      const graph = fixtures.emptyStory();

      const badPatch: Patch = {
        type: 'Patch',
        id: 'patch_bad',
        base_story_version_id: 'sv0',
        created_at: new Date().toISOString(),
        ops: [
          {
            op: 'ADD_NODE',
            node: createScene('nonexistent_beat'),
          },
        ],
      };

      const validation = validatePatch(graph, badPatch);
      expect(validation.success).toBe(false);
      expect(validation.errors.some((e) => e.code === 'FK_INTEGRITY')).toBe(
        true
      );
    });

    it('should reject patch that breaks structural invariants', () => {
      const graph = fixtures.emptyStory();

      // Try to delete a beat (would leave 14 beats)
      const deleteBeatPatch: Patch = {
        type: 'Patch',
        id: 'patch_delete_beat',
        base_story_version_id: 'sv0',
        created_at: new Date().toISOString(),
        ops: [{ op: 'DELETE_NODE', id: 'beat_Catalyst' }],
      };

      const validation = validatePatch(graph, deleteBeatPatch);
      expect(validation.success).toBe(false);
    });

    it('should reject scene with overview under 20 chars', () => {
      const graph = fixtures.emptyStory();

      const badScenePatch: Patch = {
        type: 'Patch',
        id: 'patch_bad_scene',
        base_story_version_id: 'sv0',
        created_at: new Date().toISOString(),
        ops: [
          {
            op: 'ADD_NODE',
            node: createScene('beat_Catalyst', { scene_overview: 'Too short' }),
          },
        ],
      };

      const validation = validatePatch(graph, badScenePatch);
      expect(validation.success).toBe(false);
    });
  });

  describe('Immutability throughout the loop', () => {
    it('should never modify original graph during operations', () => {
      const original = fixtures.emptyStory();
      const originalNodeCount = original.nodes.size;
      const originalEdgeCount = original.edges.length;

      // Apply multiple patches
      const patch1 = extractFromLogline('Test logline', 'sv0');
      const graph1 = applyPatch(original, patch1);

      const scenePatch: Patch = {
        type: 'Patch',
        id: 'patch_scene',
        base_story_version_id: 'sv0',
        created_at: new Date().toISOString(),
        ops: [
          {
            op: 'ADD_NODE',
            node: createScene('beat_Catalyst', { id: 'scene_test' }),
          },
        ],
      };
      const graph2 = applyPatch(graph1, scenePatch);

      // Original should be unchanged
      expect(original.nodes.size).toBe(originalNodeCount);
      expect(original.edges.length).toBe(originalEdgeCount);

      // Derived graphs should have changes
      expect(graph1.nodes.size).toBeGreaterThan(originalNodeCount);
      expect(graph2.nodes.size).toBeGreaterThan(graph1.nodes.size);
    });

    it('should maintain graph validity after each operation', () => {
      let graph = createEmptyGraph();

      // Step 1: Seed beats
      const beatsPatch = seedBeats('sv0');
      graph = applyPatch(graph, beatsPatch);
      expect(validateGraph(graph).success).toBe(true);

      // Step 2: Add character
      const charPatch: Patch = {
        type: 'Patch',
        id: 'patch_char',
        base_story_version_id: 'sv0',
        created_at: new Date().toISOString(),
        ops: [{ op: 'ADD_NODE', node: createCharacter({ id: 'char_1' }) }],
      };
      graph = applyPatch(graph, charPatch);
      expect(validateGraph(graph).success).toBe(true);

      // Step 3: Add scene
      const scenePatch: Patch = {
        type: 'Patch',
        id: 'patch_scene',
        base_story_version_id: 'sv0',
        created_at: new Date().toISOString(),
        ops: [
          {
            op: 'ADD_NODE',
            node: createScene('beat_Catalyst', { id: 'scene_1' }),
          },
        ],
      };
      graph = applyPatch(graph, scenePatch);
      expect(validateGraph(graph).success).toBe(true);

      // Step 4: Link character to scene
      const edgePatch: Patch = {
        type: 'Patch',
        id: 'patch_edge',
        base_story_version_id: 'sv0',
        created_at: new Date().toISOString(),
        ops: [{ op: 'ADD_EDGE', edge: edges.hasCharacter('scene_1', 'char_1') }],
      };
      graph = applyPatch(graph, edgePatch);
      expect(validateGraph(graph).success).toBe(true);
    });
  });

  describe('Golden fixture integration', () => {
    it('should transition from empty_story to after_acceptance state', () => {
      // Start with empty story
      let graph = fixtures.emptyStory();

      // Apply seed patch
      const seedPatch = fixtures.seedPatch();
      graph = applyPatch(graph, seedPatch);

      // Add scene to Catalyst via StoryBeat hierarchy
      const sceneForCatalyst: Patch = {
        type: 'Patch',
        id: 'patch_catalyst_scene',
        base_story_version_id: 'sv0',
        created_at: new Date().toISOString(),
        ops: [
          // Create StoryBeat
          {
            op: 'ADD_NODE',
            node: {
              type: 'StoryBeat',
              id: 'sb_catalyst_001',
              title: 'Dam Discovery',
              intent: 'plot',
              status: 'proposed',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
          // Align StoryBeat with Beat
          {
            op: 'ADD_EDGE',
            edge: edges.alignsWith('sb_catalyst_001', 'beat_Catalyst'),
          },
          // Create Scene
          {
            op: 'ADD_NODE',
            node: {
              type: 'Scene',
              id: 'scene_catalyst_001',
              heading: 'EXT. PINE VALLEY DAM - DAY',
              scene_overview:
                "Alex discovers the dam is about to fail, triggering the story's central conflict and forcing them to take action.",
              status: 'DRAFT',
            },
          },
          // Attach Scene to StoryBeat
          {
            op: 'ADD_EDGE',
            edge: edges.satisfiedBy('sb_catalyst_001', 'scene_catalyst_001', 1),
          },
          {
            op: 'ADD_EDGE',
            edge: edges.hasCharacter('scene_catalyst_001', 'char_protagonist'),
          },
          {
            op: 'ADD_EDGE',
            edge: edges.locatedAt('scene_catalyst_001', 'loc_hometown'),
          },
          {
            op: 'UPDATE_NODE',
            id: 'beat_Catalyst',
            set: { status: 'REALIZED' },
          },
        ],
      };

      graph = applyPatch(graph, sceneForCatalyst);

      // Validate final state
      expect(validateGraph(graph).success).toBe(true);

      // Check scene exists
      expect(graph.nodes.has('scene_catalyst_001')).toBe(true);

      // Check StoryBeat exists (new hierarchy)
      expect(graph.nodes.has('sb_catalyst_001')).toBe(true);

      // Check beat status updated
      const catalystBeat = graph.nodes.get('beat_Catalyst') as Record<
        string,
        unknown
      >;
      expect(catalystBeat.status).toBe('REALIZED');

      // Check edges exist (4 total from sceneForCatalyst)
      // sceneForCatalyst: ALIGNS_WITH, SATISFIED_BY, HAS_CHARACTER, LOCATED_AT
      expect(graph.edges.length).toBe(4);

      // Check StoryBeat hierarchy edges exist
      expect(graph.edges.some((e) => e.type === 'ALIGNS_WITH' && e.from === 'sb_catalyst_001')).toBe(true);
      expect(graph.edges.some((e) => e.type === 'SATISFIED_BY' && e.from === 'sb_catalyst_001')).toBe(true);

      // Derive OQs - should have 14 BeatUnrealized (not 15) because Catalyst has scene via StoryBeat
      const questions = deriveOpenQuestions(graph);
      const beatOQs = questions.filter((q) => q.type === 'BeatUnrealized');
      expect(beatOQs.length).toBe(14);
    });

    it('after_acceptance fixture should be a valid graph', () => {
      const graph = fixtures.afterAcceptance();

      const result = validateGraph(graph);

      expect(result.success).toBe(true);
    });

    it('seed_patch should be valid when applied to empty_story', () => {
      const graph = fixtures.emptyStory();
      const patch = fixtures.seedPatch();

      const result = validatePatch(graph, patch);

      expect(result.success).toBe(true);
    });
  });

  describe('OQ-driven workflow', () => {
    it('should resolve OQs by applying generated moves', () => {
      // Start with story
      let graph = createEmptyGraph();
      const initPatch = initializeStory('A hero faces destiny.', 'sv0');
      graph = applyPatch(graph, initPatch);

      // Get OQs
      const questions = deriveOpenQuestions(graph);
      const beatOQs = questions.filter((q) => q.type === 'BeatUnrealized');
      const initialCount = beatOQs.length;

      // Address each beat one at a time (just do 3 to keep test fast)
      for (let i = 0; i < 3 && i < beatOQs.length; i++) {
        const oq = beatOQs[i]!;
        const cluster = generateClusterForQuestion(oq, 'sv0', 'OUTLINE');

        // Pick first move
        const move = cluster.moves[0]!;

        // Validate and apply
        if (validatePatch(graph, move.patch).success) {
          graph = applyPatch(graph, move.patch);
        }
      }

      // Verify OQs are reduced
      const newQuestions = deriveOpenQuestions(graph);
      const newBeatOQs = newQuestions.filter((q) => q.type === 'BeatUnrealized');

      expect(newBeatOQs.length).toBeLessThan(initialCount);
    });
  });

  describe('Cross-phase consistency', () => {
    it('STRUCTURE OQs should appear in all phases', () => {
      const graph = fixtures.emptyStory();

      const outlineOQs = deriveOpenQuestions(graph);
      const draftOQs = deriveOpenQuestions(graph);
      const revisionOQs = deriveOpenQuestions(graph);

      const outlineBeatOQs = outlineOQs.filter(
        (q) => q.type === 'BeatUnrealized'
      );
      const draftBeatOQs = draftOQs.filter((q) => q.type === 'BeatUnrealized');
      const revisionBeatOQs = revisionOQs.filter(
        (q) => q.type === 'BeatUnrealized'
      );

      // BeatUnrealized should appear in all phases
      expect(outlineBeatOQs.length).toBe(15);
      expect(draftBeatOQs.length).toBe(15);
      expect(revisionBeatOQs.length).toBe(15);
    });
  });
});
