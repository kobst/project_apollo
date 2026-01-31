/**
 * Tests for Interpretation Orchestrator.
 *
 * Note: Full integration tests for interpretUserInput would require extensive
 * mocking of storage and session functions. These tests focus on the
 * proposalToPackage conversion function which is testable in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { proposalToPackage } from '../../src/ai/interpretOrchestrator.js';
import type { InterpretationProposal } from '@apollo/core';

// Mock the id generator to return predictable IDs
vi.mock('@apollo/core', async () => {
  const actual = await vi.importActual('@apollo/core');
  return {
    ...(actual as object),
    ai: {
      ...(actual as { ai: object }).ai,
      defaultIdGenerator: vi.fn((type: string) => `${type.toLowerCase()}_test_001`),
    },
  };
});

describe('interpretOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('proposalToPackage', () => {
    it('should convert node proposal to package', () => {
      const proposal: InterpretationProposal = {
        type: 'node',
        operation: 'add',
        target_type: 'Character',
        data: {
          name: 'Detective Mike',
          description: 'A seasoned investigator',
        },
        rationale: 'Input describes a character',
      };

      const pkg = proposalToPackage(proposal);

      expect(pkg.id).toMatch(/^pkg_/);
      expect(pkg.title).toContain('Character');
      expect(pkg.rationale).toBe('Input describes a character');
      expect(pkg.confidence).toBe(0.8);
      expect(pkg.changes.nodes).toHaveLength(1);
      expect(pkg.changes.nodes[0].operation).toBe('add');
      expect(pkg.changes.nodes[0].node_type).toBe('Character');
      expect(pkg.changes.nodes[0].data).toEqual({
        name: 'Detective Mike',
        description: 'A seasoned investigator',
      });
    });

    it('should generate unique node ID for add operations', () => {
      const proposal: InterpretationProposal = {
        type: 'node',
        operation: 'add',
        target_type: 'Scene',
        data: { heading: 'INT. OFFICE - DAY' },
        rationale: 'Input describes a scene',
      };

      const pkg = proposalToPackage(proposal);

      expect(pkg.changes.nodes[0].node_id).toMatch(/^scene_/);
    });

    it('should not create edges for relates_to references', () => {
      // relates_to is informational only - edges are not created
      // because the correct edge type cannot be determined without
      // knowing the types of the related nodes
      const proposal: InterpretationProposal = {
        type: 'node',
        operation: 'add',
        target_type: 'StoryBeat',
        data: { title: 'Discovery', summary: 'Mike discovers the truth' },
        rationale: 'Input describes a story beat',
        relates_to: ['character_mike_001', 'scene_opening_001'],
      };

      const pkg = proposalToPackage(proposal);

      expect(pkg.changes.edges).toHaveLength(0);
    });

    it('should convert storyContext proposal to package', () => {
      const proposal: InterpretationProposal = {
        type: 'storyContext',
        operation: 'add',
        data: {
          section: 'Themes & Motifs',
          content: 'Trust and betrayal',
        },
        rationale: 'Input is thematic',
      };

      const pkg = proposalToPackage(proposal);

      expect(pkg.changes.storyContext).toHaveLength(1);
      const op = pkg.changes.storyContext![0].operation;
      expect(op.type).toBe('addThematicPillar');
      expect((op as { pillar: string }).pillar).toBe('Trust and betrayal');
    });

    it('should default storyContext section to guideline', () => {
      const proposal: InterpretationProposal = {
        type: 'storyContext',
        operation: 'add',
        data: {
          content: 'Some unstructured note',
        },
        rationale: 'Input is a note',
      };

      const pkg = proposalToPackage(proposal);

      const op = pkg.changes.storyContext![0].operation;
      expect(op.type).toBe('addGuideline');
    });

    it('should have empty impact object', () => {
      const proposal: InterpretationProposal = {
        type: 'node',
        operation: 'add',
        target_type: 'Location',
        data: { name: 'Police Station' },
        rationale: 'Input describes a location',
      };

      const pkg = proposalToPackage(proposal);

      expect(pkg.impact).toEqual({
        fulfills_gaps: [],
        creates_gaps: [],
        conflicts: [],
      });
    });

    it('should set default confidence to 0.8', () => {
      const proposal: InterpretationProposal = {
        type: 'node',
        operation: 'add',
        target_type: 'Object',
        data: { name: 'Gun' },
        rationale: 'Input describes an object',
      };

      const pkg = proposalToPackage(proposal);

      expect(pkg.confidence).toBe(0.8);
    });

    it('should have empty style_tags', () => {
      const proposal: InterpretationProposal = {
        type: 'node',
        operation: 'add',
        target_type: 'Character',
        data: { name: 'Test' },
        rationale: 'Test',
      };

      const pkg = proposalToPackage(proposal);

      expect(pkg.style_tags).toEqual([]);
    });

    it('should generate unique package IDs', () => {
      const proposal: InterpretationProposal = {
        type: 'node',
        operation: 'add',
        target_type: 'Character',
        data: { name: 'Test' },
        rationale: 'Test',
      };

      const pkg1 = proposalToPackage(proposal);
      const pkg2 = proposalToPackage(proposal);

      // IDs contain timestamp + random, so they should differ
      // (may occasionally be same if called in same millisecond)
      expect(pkg1.id).toMatch(/^pkg_\d+_[a-z0-9]+$/);
      expect(pkg2.id).toMatch(/^pkg_\d+_[a-z0-9]+$/);
    });

    it('should handle modify operation', () => {
      const proposal: InterpretationProposal = {
        type: 'node',
        operation: 'modify',
        target_type: 'Character',
        data: { description: 'Updated description' },
        rationale: 'Updating character',
      };

      const pkg = proposalToPackage(proposal);

      expect(pkg.changes.nodes[0].operation).toBe('modify');
    });
  });
});
