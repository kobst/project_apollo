/**
 * Tests for AI configuration and defaults.
 */

import { describe, it, expect } from 'vitest';
import {
  defaultConfig,
  getPackageCount,
  getDepthBudget,
  exceedsBudget,
  formatTruncation,
  DEFAULT_STORY_CONTEXT,
  type AIConfig,
} from '../../src/ai/config.js';

describe('config', () => {
  describe('defaultConfig', () => {
    it('should have valid model settings', () => {
      expect(defaultConfig.model).toBe('claude-sonnet-4-20250514');
      expect(defaultConfig.maxTokens).toBe(4096);
      expect(defaultConfig.temperature).toBe(0.7);
    });

    it('should have depth budgets in increasing order', () => {
      const { narrow, medium, wide } = defaultConfig.depthBudgets;

      // maxNodes should increase
      expect(narrow.maxNodes).toBeLessThan(medium.maxNodes);
      expect(medium.maxNodes).toBeLessThan(wide.maxNodes);

      // maxOps should increase
      expect(narrow.maxOps).toBeLessThan(medium.maxOps);
      expect(medium.maxOps).toBeLessThan(wide.maxOps);
    });

    it('should have count limits in increasing order', () => {
      const { few, standard, many } = defaultConfig.countLimits;

      expect(few).toBeLessThan(standard);
      expect(standard).toBeLessThan(many);
    });

    it('should have reasonable context limits', () => {
      expect(defaultConfig.maxContextNodes).toBeGreaterThan(0);
      expect(defaultConfig.maxStoryContextLength).toBeGreaterThan(0);
    });

    it('should have truncation patterns with placeholders', () => {
      expect(defaultConfig.truncationPatterns.nodeList).toContain('{count}');
      expect(defaultConfig.truncationPatterns.nodeList).toContain('{type}');
      expect(defaultConfig.truncationPatterns.edgeList).toContain('{count}');
      expect(defaultConfig.truncationPatterns.gapList).toContain('{count}');
    });
  });

  describe('getPackageCount', () => {
    it('should return correct count for each setting', () => {
      expect(getPackageCount('few')).toBe(3);
      expect(getPackageCount('standard')).toBe(5);
      expect(getPackageCount('many')).toBe(8);
    });

    it('should use custom config when provided', () => {
      const customConfig: AIConfig = {
        ...defaultConfig,
        countLimits: { few: 1, standard: 2, many: 4 },
      };

      expect(getPackageCount('few', customConfig)).toBe(1);
      expect(getPackageCount('standard', customConfig)).toBe(2);
      expect(getPackageCount('many', customConfig)).toBe(4);
    });
  });

  describe('getDepthBudget', () => {
    it('should return correct budget for each depth', () => {
      expect(getDepthBudget('narrow')).toEqual({ maxNodes: 2, maxOps: 4 });
      expect(getDepthBudget('medium')).toEqual({ maxNodes: 5, maxOps: 10 });
      expect(getDepthBudget('wide')).toEqual({ maxNodes: 10, maxOps: 20 });
    });

    it('should use custom config when provided', () => {
      const customConfig: AIConfig = {
        ...defaultConfig,
        depthBudgets: {
          narrow: { maxNodes: 1, maxOps: 2 },
          medium: { maxNodes: 3, maxOps: 6 },
          wide: { maxNodes: 5, maxOps: 10 },
        },
      };

      expect(getDepthBudget('narrow', customConfig)).toEqual({ maxNodes: 1, maxOps: 2 });
      expect(getDepthBudget('medium', customConfig)).toEqual({ maxNodes: 3, maxOps: 6 });
      expect(getDepthBudget('wide', customConfig)).toEqual({ maxNodes: 5, maxOps: 10 });
    });
  });

  describe('exceedsBudget', () => {
    it('should return false when within budget', () => {
      // narrow: maxNodes=2, maxOps=4
      expect(exceedsBudget(1, 2, 'narrow')).toBe(false);
      expect(exceedsBudget(2, 4, 'narrow')).toBe(false);

      // medium: maxNodes=5, maxOps=10
      expect(exceedsBudget(3, 6, 'medium')).toBe(false);
      expect(exceedsBudget(5, 10, 'medium')).toBe(false);
    });

    it('should return true when exceeding node limit', () => {
      expect(exceedsBudget(3, 2, 'narrow')).toBe(true); // 3 > 2
      expect(exceedsBudget(6, 8, 'medium')).toBe(true); // 6 > 5
      expect(exceedsBudget(11, 15, 'wide')).toBe(true); // 11 > 10
    });

    it('should return true when exceeding ops limit', () => {
      expect(exceedsBudget(1, 5, 'narrow')).toBe(true); // 5 > 4
      expect(exceedsBudget(3, 11, 'medium')).toBe(true); // 11 > 10
      expect(exceedsBudget(8, 21, 'wide')).toBe(true); // 21 > 20
    });

    it('should return true when exceeding both limits', () => {
      expect(exceedsBudget(10, 100, 'narrow')).toBe(true);
    });

    it('should handle zero values', () => {
      expect(exceedsBudget(0, 0, 'narrow')).toBe(false);
      expect(exceedsBudget(0, 0, 'wide')).toBe(false);
    });

    it('should use custom config when provided', () => {
      const customConfig: AIConfig = {
        ...defaultConfig,
        depthBudgets: {
          narrow: { maxNodes: 1, maxOps: 1 },
          medium: { maxNodes: 2, maxOps: 2 },
          wide: { maxNodes: 3, maxOps: 3 },
        },
      };

      expect(exceedsBudget(1, 1, 'narrow', customConfig)).toBe(false);
      expect(exceedsBudget(2, 1, 'narrow', customConfig)).toBe(true);
    });
  });

  describe('formatTruncation', () => {
    it('should replace {count} placeholder', () => {
      const result = formatTruncation('[{count} more items]', 5, 'items');
      expect(result).toBe('[5 more items]');
    });

    it('should replace {type} placeholder', () => {
      const result = formatTruncation('[More {type}]', 0, 'characters');
      expect(result).toBe('[More characters]');
    });

    it('should replace both placeholders', () => {
      const pattern = '[{count} more {type}...]';
      expect(formatTruncation(pattern, 10, 'scenes')).toBe('[10 more scenes...]');
      expect(formatTruncation(pattern, 3, 'characters')).toBe('[3 more characters...]');
    });

    it('should handle patterns without placeholders', () => {
      const result = formatTruncation('[truncated]', 5, 'items');
      expect(result).toBe('[truncated]');
    });

    it('should work with default truncation patterns', () => {
      const { nodeList, edgeList, gapList } = defaultConfig.truncationPatterns;

      expect(formatTruncation(nodeList, 5, 'Characters')).toBe('[5 more Characters...]');
      expect(formatTruncation(edgeList, 10, '')).toContain('10');
      expect(formatTruncation(gapList, 3, '')).toContain('3');
    });
  });

  describe('DEFAULT_STORY_CONTEXT', () => {
    it('should contain expected sections', () => {
      expect(DEFAULT_STORY_CONTEXT).toContain('## Creative Direction');
      expect(DEFAULT_STORY_CONTEXT).toContain('## Themes & Motifs');
      expect(DEFAULT_STORY_CONTEXT).toContain('## Working Notes');
      expect(DEFAULT_STORY_CONTEXT).toContain('## Reference & Inspiration');
      expect(DEFAULT_STORY_CONTEXT).toContain('## Constraints & Rules');
    });

    it('should start with Story Context header', () => {
      expect(DEFAULT_STORY_CONTEXT.startsWith('# Story Context')).toBe(true);
    });

    it('should be trimmed (no leading/trailing whitespace)', () => {
      expect(DEFAULT_STORY_CONTEXT).toBe(DEFAULT_STORY_CONTEXT.trim());
    });

    it('should use ## for section headers', () => {
      const sections = DEFAULT_STORY_CONTEXT.match(/^## .+$/gm);
      expect(sections).not.toBeNull();
      expect(sections!.length).toBe(5);
    });
  });
});
