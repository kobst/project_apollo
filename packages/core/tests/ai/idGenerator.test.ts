/**
 * Tests for AI ID generation utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  defaultIdGenerator,
  createDeterministicIdGenerator,
  isValidNodeId,
  isProductionId,
  isTestId,
  extractTypeFromId,
} from '../../src/ai/idGenerator.js';

describe('idGenerator', () => {
  describe('defaultIdGenerator', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should generate ID in format {type}_{timestamp}_{random5}', () => {
      const id = defaultIdGenerator('Character');
      expect(id).toMatch(/^character_\d+_[a-z0-9]{5}$/);
    });

    it('should lowercase the node type', () => {
      const id = defaultIdGenerator('StoryBeat');
      expect(id.startsWith('storybeat_')).toBe(true);
    });

    it('should include timestamp in ID', () => {
      const id = defaultIdGenerator('Scene');
      const timestamp = Date.now().toString();
      expect(id).toContain(`_${timestamp}_`);
    });

    it('should generate unique IDs on successive calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(defaultIdGenerator('Character'));
      }
      // With random component, all should be unique
      expect(ids.size).toBe(100);
    });

    it('should handle various node types', () => {
      const types = ['Character', 'Scene', 'StoryBeat', 'Location', 'Object', 'Idea'];
      for (const type of types) {
        const id = defaultIdGenerator(type);
        expect(id.startsWith(`${type.toLowerCase()}_`)).toBe(true);
        expect(isValidNodeId(id)).toBe(true);
      }
    });
  });

  describe('createDeterministicIdGenerator', () => {
    it('should generate predictable IDs in format {type}_test_{counter}', () => {
      const gen = createDeterministicIdGenerator();
      expect(gen('Character')).toBe('character_test_001');
      expect(gen('Character')).toBe('character_test_002');
      expect(gen('Character')).toBe('character_test_003');
    });

    it('should maintain separate counters per type', () => {
      const gen = createDeterministicIdGenerator();
      expect(gen('Character')).toBe('character_test_001');
      expect(gen('Scene')).toBe('scene_test_001');
      expect(gen('Character')).toBe('character_test_002');
      expect(gen('Scene')).toBe('scene_test_002');
    });

    it('should lowercase the node type', () => {
      const gen = createDeterministicIdGenerator();
      expect(gen('StoryBeat')).toBe('storybeat_test_001');
    });

    it('should be truly deterministic across instances', () => {
      const gen1 = createDeterministicIdGenerator();
      const gen2 = createDeterministicIdGenerator();

      expect(gen1('Character')).toBe('character_test_001');
      expect(gen2('Character')).toBe('character_test_001');
    });

    it('should pad counter to 3 digits', () => {
      const gen = createDeterministicIdGenerator();
      expect(gen('Character')).toBe('character_test_001');
      // Generate up to 10
      for (let i = 0; i < 9; i++) {
        gen('Character');
      }
      expect(gen('Character')).toBe('character_test_011');
    });
  });

  describe('isValidNodeId', () => {
    it('should accept production format IDs', () => {
      expect(isValidNodeId('character_1736500000000_abc12')).toBe(true);
      expect(isValidNodeId('scene_1736500000001_x7k2m')).toBe(true);
      expect(isValidNodeId('storybeat_9999999999999_zzzzz')).toBe(true);
    });

    it('should accept test format IDs', () => {
      expect(isValidNodeId('character_test_001')).toBe(true);
      expect(isValidNodeId('scene_test_999')).toBe(true);
      expect(isValidNodeId('storybeat_test_123')).toBe(true);
    });

    it('should accept legacy format IDs', () => {
      expect(isValidNodeId('character_mike_001')).toBe(true);
      expect(isValidNodeId('beat_catalyst')).toBe(true); // Legacy IDs are lowercase
      expect(isValidNodeId('scene_opening_001')).toBe(true);
    });

    it('should reject invalid IDs', () => {
      expect(isValidNodeId('')).toBe(false);
      expect(isValidNodeId('Character')).toBe(false);
      expect(isValidNodeId('123_character')).toBe(false);
      expect(isValidNodeId('CHAR_test_001')).toBe(false);
    });

    it('should reject IDs with special characters', () => {
      expect(isValidNodeId('character-test-001')).toBe(false);
      expect(isValidNodeId('character.test.001')).toBe(false);
      expect(isValidNodeId('character test 001')).toBe(false);
    });
  });

  describe('isProductionId', () => {
    it('should return true for production format', () => {
      expect(isProductionId('character_1736500000000_abc12')).toBe(true);
      expect(isProductionId('scene_1736500000001_x7k2m')).toBe(true);
    });

    it('should return false for test format', () => {
      expect(isProductionId('character_test_001')).toBe(false);
    });

    it('should return false for legacy format', () => {
      expect(isProductionId('character_mike_001')).toBe(false);
      expect(isProductionId('beat_Catalyst')).toBe(false);
    });
  });

  describe('isTestId', () => {
    it('should return true for test format', () => {
      expect(isTestId('character_test_001')).toBe(true);
      expect(isTestId('scene_test_999')).toBe(true);
    });

    it('should return false for production format', () => {
      expect(isTestId('character_1736500000000_abc12')).toBe(false);
    });

    it('should return false for legacy format', () => {
      expect(isTestId('character_mike_001')).toBe(false);
    });
  });

  describe('extractTypeFromId', () => {
    it('should extract type from production IDs', () => {
      expect(extractTypeFromId('character_1736500000000_abc12')).toBe('character');
      expect(extractTypeFromId('scene_1736500000001_x7k2m')).toBe('scene');
      expect(extractTypeFromId('storybeat_9999999999999_zzzzz')).toBe('storybeat');
    });

    it('should extract type from test IDs', () => {
      expect(extractTypeFromId('character_test_001')).toBe('character');
      expect(extractTypeFromId('scene_test_999')).toBe('scene');
    });

    it('should extract type from legacy IDs', () => {
      expect(extractTypeFromId('character_mike_001')).toBe('character');
      expect(extractTypeFromId('beat_Catalyst')).toBe('beat');
    });

    it('should return null for invalid IDs', () => {
      expect(extractTypeFromId('')).toBe(null);
      expect(extractTypeFromId('_underscore_start')).toBe(null);
      expect(extractTypeFromId('123_numeric_start')).toBe(null);
    });

    it('should handle single-part types', () => {
      expect(extractTypeFromId('idea_123')).toBe('idea');
    });
  });
});
