/**
 * Tests for Package to Patch conversion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  packageToPatch,
  validatePackageForConversion,
} from '../../src/ai/packageToPatches.js';
import type { NarrativePackage } from '../../src/ai/types.js';

describe('packageToPatches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('packageToPatch', () => {
    it('should convert add node operations to ADD_NODE patch ops', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [
            {
              operation: 'add',
              node_type: 'Character',
              node_id: 'character_new_001',
              data: { name: 'John', description: 'A detective' },
            },
          ],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.patch.ops).toHaveLength(1);
      expect(result.patch.ops[0]).toMatchObject({
        op: 'ADD_NODE',
        node: {
          type: 'Character',
          id: 'character_new_001',
          name: 'John',
          description: 'A detective',
        },
      });
    });

    it('should convert modify node operations to UPDATE_NODE patch ops', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [
            {
              operation: 'modify',
              node_type: 'Character',
              node_id: 'character_existing',
              data: { description: 'Updated description' },
            },
          ],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.patch.ops).toHaveLength(1);
      expect(result.patch.ops[0]).toMatchObject({
        op: 'UPDATE_NODE',
        id: 'character_existing',
        set: { description: 'Updated description' },
      });
    });

    it('should convert delete node operations to DELETE_NODE patch ops', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [
            {
              operation: 'delete',
              node_type: 'Character',
              node_id: 'character_to_delete',
            },
          ],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.patch.ops).toHaveLength(1);
      expect(result.patch.ops[0]).toMatchObject({
        op: 'DELETE_NODE',
        id: 'character_to_delete',
      });
    });

    it('should convert add edge operations to ADD_EDGE patch ops', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [],
          edges: [
            {
              operation: 'add',
              edge_type: 'HAS_CHARACTER',
              from: 'scene_001',
              to: 'character_001',
            },
          ],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.patch.ops).toHaveLength(1);
      expect(result.patch.ops[0]).toMatchObject({
        op: 'ADD_EDGE',
        edge: {
          type: 'HAS_CHARACTER',
          from: 'scene_001',
          to: 'character_001',
        },
      });
    });

    it('should convert delete edge operations to DELETE_EDGE patch ops', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [],
          edges: [
            {
              operation: 'delete',
              edge_type: 'HAS_CHARACTER',
              from: 'scene_001',
              to: 'character_001',
            },
          ],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.patch.ops).toHaveLength(1);
      expect(result.patch.ops[0]).toMatchObject({
        op: 'DELETE_EDGE',
        edge: {
          type: 'HAS_CHARACTER',
          from: 'scene_001',
          to: 'character_001',
        },
      });
    });

    it('should include edge properties when present', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [],
          edges: [
            {
              operation: 'add',
              edge_type: 'PRECEDES',
              from: 'plotpoint_001',
              to: 'plotpoint_002',
              properties: { causality: 'strong' },
            },
          ],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      const addEdgeOp = result.patch.ops[0] as { op: string; edge: { properties?: unknown } };
      expect(addEdgeOp.edge.properties).toEqual({ causality: 'strong' });
    });

    it('should generate unique patch ID', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: { nodes: [], edges: [] },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.patch.id).toMatch(/^patch_\d+_[a-z0-9]{5}$/);
    });

    it('should set base_story_version_id', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: { nodes: [], edges: [] },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_custom_version');

      expect(result.patch.base_story_version_id).toBe('sv_custom_version');
    });

    it('should include metadata with package info', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_123',
        title: 'The Reveal',
        rationale: 'Reason',
        confidence: 0.85,
        style_tags: [],
        changes: { nodes: [], edges: [] },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.patch.metadata).toEqual({
        source: 'ai_generation',
        package_id: 'pkg_123',
        package_title: 'The Reveal',
        confidence: 0.85,
      });
    });

    it('should set created_at timestamp', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: { nodes: [], edges: [] },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.patch.created_at).toBe('2026-01-10T12:00:00.000Z');
    });
  });

  describe('Story Context changes', () => {
    it('should return storyContextUpdate for add operations', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          storyContext: [
            {
              operation: { type: 'addThematicPillar', pillar: 'Trust and betrayal' },
            },
          ],
          nodes: [],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.storyContextUpdate).toBeDefined();
      expect(result.storyContextUpdate!.changes).toHaveLength(1);
      expect(result.storyContextUpdate!.changes[0].operation.type).toBe('addThematicPillar');
    });

    it('should pass through multiple storyContext changes', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          storyContext: [
            {
              operation: { type: 'addThematicPillar', pillar: 'New theme' },
            },
            {
              operation: { type: 'setWorkingNotes', content: 'A note' },
            },
          ],
          nodes: [],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.storyContextUpdate!.changes).toHaveLength(2);
      expect(result.storyContextUpdate!.changes[0].operation.type).toBe('addThematicPillar');
      expect(result.storyContextUpdate!.changes[1].operation.type).toBe('setWorkingNotes');
    });

    it('should handle addGuideline operations', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          storyContext: [
            {
              operation: { type: 'addGuideline', guideline: { id: 'sg_001', tags: ['general'], text: 'New content' } },
            },
          ],
          nodes: [],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.storyContextUpdate!.changes).toHaveLength(1);
      expect(result.storyContextUpdate!.changes[0].operation.type).toBe('addGuideline');
    });

    it('should handle addHardRule operations', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          storyContext: [
            {
              operation: { type: 'addHardRule', rule: { id: 'hr_001', text: 'No flashbacks' } },
            },
          ],
          nodes: [],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.storyContextUpdate!.changes).toHaveLength(1);
      expect(result.storyContextUpdate!.changes[0].operation.type).toBe('addHardRule');
    });

    it('should handle removeThematicPillar operations', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          storyContext: [
            {
              operation: { type: 'removeThematicPillar', index: 0 },
            },
          ],
          nodes: [],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base');

      expect(result.storyContextUpdate!.changes).toHaveLength(1);
      expect(result.storyContextUpdate!.changes[0].operation.type).toBe('removeThematicPillar');
    });

    it('should not return storyContextUpdate when no story context changes', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = packageToPatch(pkg, 'sv_base', 'Some context');

      expect(result.storyContextUpdate).toBeUndefined();
    });
  });

  describe('validatePackageForConversion', () => {
    it('should pass for valid add operations', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [
            {
              operation: 'add',
              node_type: 'Character',
              node_id: 'character_new',
              data: { name: 'New' },
            },
          ],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = validatePackageForConversion(pkg, new Set());

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for modify operations on existing nodes', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [
            {
              operation: 'modify',
              node_type: 'Character',
              node_id: 'character_existing',
              data: { description: 'Updated' },
            },
          ],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const existingIds = new Set(['character_existing']);
      const result = validatePackageForConversion(pkg, existingIds);

      expect(result.valid).toBe(true);
    });

    it('should fail for modify operations on non-existent nodes', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [
            {
              operation: 'modify',
              node_type: 'Character',
              node_id: 'nonexistent',
              data: { description: 'Updated' },
            },
          ],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = validatePackageForConversion(pkg, new Set());

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot modify non-existent node: nonexistent');
    });

    it('should fail for delete operations on non-existent nodes', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [
            {
              operation: 'delete',
              node_type: 'Character',
              node_id: 'nonexistent',
            },
          ],
          edges: [],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = validatePackageForConversion(pkg, new Set());

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot delete non-existent node: nonexistent');
    });

    it('should fail for edge delete operations with non-existent nodes', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [],
          edges: [
            {
              operation: 'delete',
              edge_type: 'HAS_CHARACTER',
              from: 'scene_missing',
              to: 'character_001',
            },
          ],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const existingIds = new Set(['character_001']);
      const result = validatePackageForConversion(pkg, existingIds);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('scene_missing');
    });

    it('should pass for edge add operations (no validation needed)', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_1',
        title: 'Test',
        rationale: 'Reason',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [],
          edges: [
            {
              operation: 'add',
              edge_type: 'HAS_CHARACTER',
              from: 'scene_new',
              to: 'character_new',
            },
          ],
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = validatePackageForConversion(pkg, new Set());

      expect(result.valid).toBe(true);
    });
  });
});
