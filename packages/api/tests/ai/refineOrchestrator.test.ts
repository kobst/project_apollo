/**
 * Tests for Refinement Orchestrator.
 *
 * Focuses on the getRefinableElements helper function which is testable
 * in isolation without mocking external dependencies.
 */

import { describe, it, expect } from 'vitest';
import { getRefinableElements } from '../../src/ai/refineOrchestrator.js';
import { createMockNarrativePackage } from '../helpers/fixtures.js';
import type { NarrativePackage } from '@apollo/core';

describe('refineOrchestrator', () => {
  describe('getRefinableElements', () => {
    it('should extract node elements from package', () => {
      const pkg = createMockNarrativePackage({
        changes: {
          nodes: [
            {
              operation: 'add',
              node_type: 'Character',
              node_id: 'char_001',
              data: { name: 'Detective Mike' },
            },
            {
              operation: 'add',
              node_type: 'Location',
              node_id: 'loc_001',
              data: { name: 'Police Station' },
            },
          ],
          edges: [],
        },
      });

      const result = getRefinableElements(pkg);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]).toEqual({
        id: 'char_001',
        type: 'Character',
        label: 'Detective Mike',
      });
      expect(result.nodes[1]).toEqual({
        id: 'loc_001',
        type: 'Location',
        label: 'Police Station',
      });
    });

    it('should use title as label when name is not available', () => {
      const pkg = createMockNarrativePackage({
        changes: {
          nodes: [
            {
              operation: 'add',
              node_type: 'PlotPoint',
              node_id: 'pp_001',
              data: { title: 'The Discovery' },
            },
          ],
          edges: [],
        },
      });

      const result = getRefinableElements(pkg);

      expect(result.nodes[0].label).toBe('The Discovery');
    });

    it('should use node_id as label when no name or title', () => {
      const pkg = createMockNarrativePackage({
        changes: {
          nodes: [
            {
              operation: 'add',
              node_type: 'Object',
              node_id: 'obj_001',
              data: {},
            },
          ],
          edges: [],
        },
      });

      const result = getRefinableElements(pkg);

      expect(result.nodes[0].label).toBe('obj_001');
    });

    it('should extract storyContext changes', () => {
      const pkg = createMockNarrativePackage({
        changes: {
          storyContext: [
            {
              operation: 'add',
              section: 'Themes & Motifs',
              content: 'Trust and betrayal',
            },
            {
              operation: 'modify',
              section: 'Constraints',
              content: 'No flashbacks',
              previous_content: 'Limited flashbacks',
            },
          ],
          nodes: [],
          edges: [],
        },
      });

      const result = getRefinableElements(pkg);

      expect(result.storyContextChanges).toHaveLength(2);
      expect(result.storyContextChanges[0]).toEqual({
        section: 'Themes & Motifs',
        operation: 'add',
      });
      expect(result.storyContextChanges[1]).toEqual({
        section: 'Constraints',
        operation: 'modify',
      });
    });

    it('should return empty arrays for package with no changes', () => {
      const pkg = createMockNarrativePackage({
        changes: {
          nodes: [],
          edges: [],
        },
      });

      const result = getRefinableElements(pkg);

      expect(result.nodes).toHaveLength(0);
      expect(result.storyContextChanges).toHaveLength(0);
    });

    it('should handle package with undefined storyContext', () => {
      const pkg: NarrativePackage = {
        id: 'pkg_001',
        title: 'Test',
        rationale: 'Test',
        confidence: 0.8,
        style_tags: [],
        changes: {
          nodes: [
            {
              operation: 'add',
              node_type: 'Scene',
              node_id: 'scene_001',
              data: { heading: 'INT. OFFICE - DAY' },
            },
          ],
          edges: [],
          // storyContext is undefined
        },
        impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
      };

      const result = getRefinableElements(pkg);

      expect(result.storyContextChanges).toHaveLength(0);
      expect(result.nodes).toHaveLength(1);
    });

    it('should handle modify operations', () => {
      const pkg = createMockNarrativePackage({
        changes: {
          nodes: [
            {
              operation: 'modify',
              node_type: 'Character',
              node_id: 'char_existing',
              data: { description: 'Updated description' },
            },
          ],
          edges: [],
        },
      });

      const result = getRefinableElements(pkg);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('char_existing');
    });

    it('should handle delete operations', () => {
      const pkg = createMockNarrativePackage({
        changes: {
          nodes: [
            {
              operation: 'delete',
              node_type: 'Character',
              node_id: 'char_to_delete',
            },
          ],
          edges: [],
        },
      });

      const result = getRefinableElements(pkg);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].label).toBe('char_to_delete');
    });

    it('should handle mixed node operations', () => {
      const pkg = createMockNarrativePackage({
        changes: {
          nodes: [
            {
              operation: 'add',
              node_type: 'Character',
              node_id: 'char_new',
              data: { name: 'New Character' },
            },
            {
              operation: 'modify',
              node_type: 'Location',
              node_id: 'loc_existing',
              data: { name: 'Updated Location' },
            },
            {
              operation: 'delete',
              node_type: 'Object',
              node_id: 'obj_delete',
            },
          ],
          edges: [],
        },
      });

      const result = getRefinableElements(pkg);

      expect(result.nodes).toHaveLength(3);
      expect(result.nodes.map((n) => n.id)).toEqual([
        'char_new',
        'loc_existing',
        'obj_delete',
      ]);
    });
  });
});
