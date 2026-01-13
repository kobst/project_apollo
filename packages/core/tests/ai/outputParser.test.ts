/**
 * Tests for AI output parsing.
 */

import { describe, it, expect } from 'vitest';
import {
  parseInterpretationResponse,
  parseGenerationResponse,
  validateGeneratedIds,
  validateEdgeReferences,
  regenerateInvalidIds,
  ParseError,
} from '../../src/ai/outputParser.js';
import { createDeterministicIdGenerator } from '../../src/ai/idGenerator.js';
import { aiFixtures } from '../fixtures/index.js';

describe('outputParser', () => {
  describe('parseInterpretationResponse', () => {
    it('should parse valid interpretation response', () => {
      const fixture = aiFixtures.validInterpretationResponse();
      const raw = JSON.stringify(fixture);

      const result = parseInterpretationResponse(raw);

      expect(result.interpretation.summary).toBe(fixture.interpretation.summary);
      expect(result.interpretation.confidence).toBe(fixture.interpretation.confidence);
      expect(result.proposals).toHaveLength(fixture.proposals.length);
    });

    it('should extract JSON from markdown code block', () => {
      const cases = aiFixtures.malformedResponses();
      const result = parseInterpretationResponse(cases.interpretation_with_block);

      expect(result.interpretation.summary).toBe('User wants to add a character');
      expect(result.interpretation.confidence).toBe(0.88);
      expect(result.proposals).toHaveLength(1);
    });

    it('should throw ParseError for missing interpretation field', () => {
      const raw = JSON.stringify({ proposals: [] });

      expect(() => parseInterpretationResponse(raw)).toThrow(ParseError);
      expect(() => parseInterpretationResponse(raw)).toThrow(
        'Missing or invalid interpretation field'
      );
    });

    it('should throw ParseError for missing proposals array', () => {
      const raw = JSON.stringify({
        interpretation: { summary: 'test', confidence: 0.5 },
      });

      expect(() => parseInterpretationResponse(raw)).toThrow(ParseError);
      expect(() => parseInterpretationResponse(raw)).toThrow(
        'Missing or invalid proposals array'
      );
    });

    it('should throw ParseError for non-JSON input', () => {
      expect(() => parseInterpretationResponse('not json')).toThrow(ParseError);
      expect(() => parseInterpretationResponse('not json')).toThrow(
        'No JSON found in response'
      );
    });
  });

  describe('parseGenerationResponse', () => {
    it('should parse valid generation response', () => {
      const fixture = aiFixtures.validGenerationResponse();
      const raw = JSON.stringify(fixture);

      const result = parseGenerationResponse(raw);

      expect(result.packages).toHaveLength(3);
      expect(result.packages[0].title).toBe('The Corruption Reveal');
      expect(result.packages[0].confidence).toBe(0.85);
    });

    it('should extract JSON from markdown code block with json label', () => {
      const cases = aiFixtures.malformedResponses();
      const result = parseGenerationResponse(cases.with_markdown_block);

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].title).toBe('Test Package');
    });

    it('should extract JSON from unmarked code block', () => {
      const cases = aiFixtures.malformedResponses();
      const result = parseGenerationResponse(cases.with_unmarked_block);

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].title).toBe('Unmarked Block');
    });

    it('should handle trailing commas in JSON', () => {
      const cases = aiFixtures.malformedResponses();
      const result = parseGenerationResponse(cases.trailing_commas);

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].title).toBe('Trailing Commas');
    });

    it('should extract raw JSON without wrapper', () => {
      const cases = aiFixtures.malformedResponses();
      const result = parseGenerationResponse(cases.raw_json);

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].title).toBe('Raw JSON');
    });

    it('should extract JSON with preamble text', () => {
      const cases = aiFixtures.malformedResponses();
      const result = parseGenerationResponse(cases.with_preamble);

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].title).toBe('With Preamble');
    });

    it('should throw ParseError for missing packages field', () => {
      const cases = aiFixtures.malformedResponses();

      expect(() => parseGenerationResponse(cases.missing_packages_field)).toThrow(
        ParseError
      );
    });

    it('should throw ParseError for missing required package fields', () => {
      const cases = aiFixtures.malformedResponses();

      expect(() => parseGenerationResponse(cases.missing_required_fields)).toThrow(
        ParseError
      );
    });

    it('should throw ParseError for non-JSON input', () => {
      const cases = aiFixtures.malformedResponses();

      expect(() => parseGenerationResponse(cases.not_json)).toThrow(ParseError);
    });

    it('should throw ParseError for empty object', () => {
      const cases = aiFixtures.malformedResponses();

      expect(() => parseGenerationResponse(cases.empty_object)).toThrow(ParseError);
    });
  });

  describe('normalization', () => {
    it('should normalize confidence to 0-1 range', () => {
      const raw = JSON.stringify({
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 1.5, // Over 1
            changes: { nodes: [], edges: [] },
          },
        ],
      });

      const result = parseGenerationResponse(raw);
      expect(result.packages[0].confidence).toBe(1);
    });

    it('should clamp negative confidence to 0', () => {
      const raw = JSON.stringify({
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: -0.5,
            changes: { nodes: [], edges: [] },
          },
        ],
      });

      const result = parseGenerationResponse(raw);
      expect(result.packages[0].confidence).toBe(0);
    });

    it('should default missing confidence to 0.5', () => {
      const raw = JSON.stringify({
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            changes: { nodes: [], edges: [] },
          },
        ],
      });

      const result = parseGenerationResponse(raw);
      expect(result.packages[0].confidence).toBe(0.5);
    });

    it('should filter non-string values from style_tags', () => {
      const raw = JSON.stringify({
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            style_tags: ['valid', 123, null, 'also_valid', {}],
            changes: { nodes: [], edges: [] },
          },
        ],
      });

      const result = parseGenerationResponse(raw);
      expect(result.packages[0].style_tags).toEqual(['valid', 'also_valid']);
    });

    it('should default missing style_tags to empty array', () => {
      const raw = JSON.stringify({
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            changes: { nodes: [], edges: [] },
          },
        ],
      });

      const result = parseGenerationResponse(raw);
      expect(result.packages[0].style_tags).toEqual([]);
    });

    it('should default missing nodes/edges to empty arrays', () => {
      const raw = JSON.stringify({
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            changes: {},
          },
        ],
      });

      const result = parseGenerationResponse(raw);
      expect(result.packages[0].changes.nodes).toEqual([]);
      expect(result.packages[0].changes.edges).toEqual([]);
    });

    it('should default missing impact to empty objects', () => {
      const raw = JSON.stringify({
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            changes: { nodes: [], edges: [] },
          },
        ],
      });

      const result = parseGenerationResponse(raw);
      expect(result.packages[0].impact).toEqual({
        fulfills_gaps: [],
        creates_gaps: [],
        conflicts: [],
      });
    });

    it('should preserve optional parent_package_id', () => {
      const raw = JSON.stringify({
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            parent_package_id: 'pkg_parent',
            changes: { nodes: [], edges: [] },
          },
        ],
      });

      const result = parseGenerationResponse(raw);
      expect(result.packages[0].parent_package_id).toBe('pkg_parent');
    });

    it('should preserve optional refinement_prompt', () => {
      const raw = JSON.stringify({
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            refinement_prompt: 'Make it darker',
            changes: { nodes: [], edges: [] },
          },
        ],
      });

      const result = parseGenerationResponse(raw);
      expect(result.packages[0].refinement_prompt).toBe('Make it darker');
    });
  });

  describe('validateGeneratedIds', () => {
    it('should pass for valid unique IDs', () => {
      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [
                {
                  operation: 'add' as const,
                  node_type: 'Character',
                  node_id: 'character_1736500000000_abc12',
                },
              ],
              edges: [],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const validation = validateGeneratedIds(result, new Set());
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect duplicate IDs with existing graph', () => {
      const existingIds = new Set(['character_existing_001']);
      const fixture = aiFixtures.invalidIdsResponse();

      const result = {
        packages: [fixture.packages[3]], // Package with collision
      };

      const validation = validateGeneratedIds(result, existingIds);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.code === 'DUPLICATE_ID')).toBe(true);
    });

    it('should detect duplicate IDs within packages', () => {
      const fixture = aiFixtures.invalidIdsResponse();

      const result = {
        packages: [fixture.packages[0]], // Package with duplicates
      };

      const validation = validateGeneratedIds(result, new Set());
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.code === 'DUPLICATE_ID_IN_PACKAGE')).toBe(
        true
      );
    });

    it('should detect invalid ID formats', () => {
      const fixture = aiFixtures.invalidIdsResponse();

      const result = {
        packages: [fixture.packages[1]], // Package with invalid formats
      };

      const validation = validateGeneratedIds(result, new Set());
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.code === 'INVALID_ID_FORMAT')).toBe(true);
    });

    it('should skip validation for modify/delete operations', () => {
      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [
                {
                  operation: 'modify' as const,
                  node_type: 'Character',
                  node_id: 'existing_id',
                  data: { name: 'Updated' },
                },
                {
                  operation: 'delete' as const,
                  node_type: 'Character',
                  node_id: 'another_id',
                },
              ],
              edges: [],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const validation = validateGeneratedIds(result, new Set());
      expect(validation.valid).toBe(true);
    });
  });

  describe('validateEdgeReferences', () => {
    it('should pass when edges reference existing nodes', () => {
      const existingIds = new Set(['character_001', 'scene_001']);
      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [],
              edges: [
                {
                  operation: 'add' as const,
                  edge_type: 'HAS_CHARACTER',
                  from: 'scene_001',
                  to: 'character_001',
                },
              ],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const validation = validateEdgeReferences(result, existingIds);
      expect(validation.valid).toBe(true);
    });

    it('should pass when edges reference new nodes in same package', () => {
      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [
                {
                  operation: 'add' as const,
                  node_type: 'Scene',
                  node_id: 'scene_new_001',
                },
                {
                  operation: 'add' as const,
                  node_type: 'Character',
                  node_id: 'character_new_001',
                },
              ],
              edges: [
                {
                  operation: 'add' as const,
                  edge_type: 'HAS_CHARACTER',
                  from: 'scene_new_001',
                  to: 'character_new_001',
                },
              ],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const validation = validateEdgeReferences(result, new Set());
      expect(validation.valid).toBe(true);
    });

    it('should detect invalid from reference', () => {
      const fixture = aiFixtures.invalidIdsResponse();
      const existingIds = new Set(['location_123']); // Only to exists

      const result = {
        packages: [fixture.packages[2]], // Package with invalid edge references
      };

      const validation = validateEdgeReferences(result, existingIds);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.code === 'INVALID_EDGE_FROM')).toBe(true);
    });

    it('should detect invalid to reference', () => {
      const fixture = aiFixtures.invalidIdsResponse();

      const result = {
        packages: [fixture.packages[2]], // Package with invalid edge references
      };

      const validation = validateEdgeReferences(result, new Set());
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.code === 'INVALID_EDGE_TO')).toBe(true);
    });

    it('should skip validation for delete operations', () => {
      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [],
              edges: [
                {
                  operation: 'delete' as const,
                  edge_type: 'HAS_CHARACTER',
                  from: 'nonexistent_from',
                  to: 'nonexistent_to',
                },
              ],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const validation = validateEdgeReferences(result, new Set());
      expect(validation.valid).toBe(true);
    });
  });

  describe('regenerateInvalidIds', () => {
    it('should regenerate duplicate IDs', () => {
      const existingIds = new Set(['character_existing']);
      const idGen = createDeterministicIdGenerator();

      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [
                {
                  operation: 'add' as const,
                  node_type: 'Character',
                  node_id: 'character_existing', // Duplicate
                },
              ],
              edges: [],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const fixed = regenerateInvalidIds(result, existingIds, idGen);
      expect(fixed.packages[0].changes.nodes[0].node_id).toBe('character_test_001');
    });

    it('should regenerate invalid format IDs', () => {
      const idGen = createDeterministicIdGenerator();

      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [
                {
                  operation: 'add' as const,
                  node_type: 'Character',
                  node_id: 'bad-format-id', // Invalid
                },
              ],
              edges: [],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const fixed = regenerateInvalidIds(result, new Set(), idGen);
      expect(fixed.packages[0].changes.nodes[0].node_id).toBe('character_test_001');
    });

    it('should update edge references when IDs are regenerated', () => {
      const idGen = createDeterministicIdGenerator();

      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [
                {
                  operation: 'add' as const,
                  node_type: 'Scene',
                  node_id: 'bad-scene-id',
                },
                {
                  operation: 'add' as const,
                  node_type: 'Character',
                  node_id: 'bad-char-id',
                },
              ],
              edges: [
                {
                  operation: 'add' as const,
                  edge_type: 'HAS_CHARACTER',
                  from: 'bad-scene-id',
                  to: 'bad-char-id',
                },
              ],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const fixed = regenerateInvalidIds(result, new Set(), idGen);

      expect(fixed.packages[0].changes.nodes[0].node_id).toBe('scene_test_001');
      expect(fixed.packages[0].changes.nodes[1].node_id).toBe('character_test_001');
      expect(fixed.packages[0].changes.edges[0].from).toBe('scene_test_001');
      expect(fixed.packages[0].changes.edges[0].to).toBe('character_test_001');
    });

    it('should not modify valid IDs', () => {
      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [
                {
                  operation: 'add' as const,
                  node_type: 'Character',
                  node_id: 'character_1736500000000_abc12', // Valid
                },
              ],
              edges: [],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const fixed = regenerateInvalidIds(result, new Set());
      expect(fixed.packages[0].changes.nodes[0].node_id).toBe(
        'character_1736500000000_abc12'
      );
    });

    it('should not modify modify/delete operations', () => {
      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [
                {
                  operation: 'modify' as const,
                  node_type: 'Character',
                  node_id: 'any_id_format',
                  data: { name: 'Updated' },
                },
              ],
              edges: [],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const fixed = regenerateInvalidIds(result, new Set());
      expect(fixed.packages[0].changes.nodes[0].node_id).toBe('any_id_format');
    });

    it('should preserve edge references to existing nodes', () => {
      const existingIds = new Set(['character_existing']);

      const result = {
        packages: [
          {
            id: 'pkg_1',
            title: 'Test',
            rationale: 'Reason',
            confidence: 0.8,
            style_tags: [],
            changes: {
              nodes: [
                {
                  operation: 'add' as const,
                  node_type: 'Scene',
                  node_id: 'scene_1736500000000_valid',
                },
              ],
              edges: [
                {
                  operation: 'add' as const,
                  edge_type: 'HAS_CHARACTER',
                  from: 'scene_1736500000000_valid',
                  to: 'character_existing', // Existing, should not change
                },
              ],
            },
            impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
          },
        ],
      };

      const fixed = regenerateInvalidIds(result, existingIds);
      expect(fixed.packages[0].changes.edges[0].to).toBe('character_existing');
    });
  });

  describe('ParseError', () => {
    it('should include raw data in error', () => {
      const rawData = { test: 'data' };
      const error = new ParseError('Test error', rawData);

      expect(error.message).toBe('Test error');
      expect(error.rawData).toBe(rawData);
      expect(error.name).toBe('ParseError');
    });

    it('should be instanceof Error', () => {
      const error = new ParseError('Test', null);
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ParseError).toBe(true);
    });
  });
});
