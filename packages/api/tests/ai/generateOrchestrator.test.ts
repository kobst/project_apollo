/**
 * Tests for Generation Orchestrator.
 *
 * Note: Full integration tests for generatePackages would require extensive
 * mocking of storage, session, coverage, and AI modules. These tests focus
 * on the getEntryPointData helper function and type definitions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEntryPointData } from '../../src/ai/generateOrchestrator.js';
import {
  createMockGraph,
  createMockStorageContext,
} from '../helpers/mocks.js';
import {
  createMockEntryPoint,
} from '../helpers/fixtures.js';

// Mock storage functions
vi.mock('../../src/storage.js', () => ({
  loadGraphById: vi.fn(),
  loadVersionedStateById: vi.fn(),
}));

import { loadGraphById } from '../../src/storage.js';

describe('generateOrchestrator', () => {
  const ctx = createMockStorageContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntryPointData', () => {
    it('should return null if no targetId', async () => {
      const entryPoint = createMockEntryPoint('naked');
      entryPoint.targetId = undefined;

      const result = await getEntryPointData('story_001', entryPoint, ctx);

      expect(result).toBeNull();
      expect(loadGraphById).not.toHaveBeenCalled();
    });

    it('should return null if graph not found', async () => {
      (loadGraphById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const entryPoint = createMockEntryPoint('beat', 'beat_Midpoint');
      const result = await getEntryPointData('story_001', entryPoint, ctx);

      expect(result).toBeNull();
    });

    it('should return null if node not found', async () => {
      const graph = createMockGraph([]);
      (loadGraphById as ReturnType<typeof vi.fn>).mockResolvedValue(graph);

      const entryPoint = createMockEntryPoint('beat', 'beat_nonexistent');
      const result = await getEntryPointData('story_001', entryPoint, ctx);

      expect(result).toBeNull();
    });

    it('should return node data when found', async () => {
      const graph = createMockGraph([
        {
          id: 'beat_Midpoint',
          type: 'Beat',
          name: 'Midpoint',
          act: 2,
          order: 8,
        },
      ]);
      (loadGraphById as ReturnType<typeof vi.fn>).mockResolvedValue(graph);

      const entryPoint = createMockEntryPoint('beat', 'beat_Midpoint');
      const result = await getEntryPointData('story_001', entryPoint, ctx);

      expect(result).toMatchObject({
        id: 'beat_Midpoint',
        type: 'Beat',
        name: 'Midpoint',
        act: 2,
        order: 8,
      });
    });

    it('should return character data', async () => {
      const graph = createMockGraph([
        {
          id: 'character_mike_001',
          type: 'Character',
          name: 'Detective Mike',
          description: 'A seasoned investigator',
          archetype: 'protagonist',
        },
      ]);
      (loadGraphById as ReturnType<typeof vi.fn>).mockResolvedValue(graph);

      const entryPoint = createMockEntryPoint('character', 'character_mike_001');
      const result = await getEntryPointData('story_001', entryPoint, ctx);

      expect(result).toMatchObject({
        id: 'character_mike_001',
        type: 'Character',
        name: 'Detective Mike',
        archetype: 'protagonist',
      });
    });
  });

  describe('GenerateRequest type', () => {
    it('should accept valid entry point types', () => {
      // Type tests - these verify the type definitions work correctly
      const beatEntry = createMockEntryPoint('beat', 'beat_001');
      expect(beatEntry.type).toBe('beat');

      const plotPointEntry = createMockEntryPoint('plotPoint', 'pp_001');
      expect(plotPointEntry.type).toBe('plotPoint');

      const characterEntry = createMockEntryPoint('character', 'char_001');
      expect(characterEntry.type).toBe('character');

      const gapEntry = createMockEntryPoint('gap', 'gap_001');
      expect(gapEntry.type).toBe('gap');

      const ideaEntry = createMockEntryPoint('idea', 'idea_001');
      expect(ideaEntry.type).toBe('idea');

      const nakedEntry = createMockEntryPoint('naked');
      expect(nakedEntry.type).toBe('naked');
    });
  });
});
