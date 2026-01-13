/**
 * Tests for context serialization.
 */

import { describe, it, expect } from 'vitest';
import {
  serializeStoryContext,
  serializeNodeContext,
  serializeGaps,
  serializeStoryContextMd,
  type StoryMetadata,
} from '../../src/ai/contextSerializer.js';
import { createEmptyGraph } from '../../src/core/graph.js';
import type { GraphState } from '../../src/core/graph.js';
import type { Gap } from '../../src/coverage/types.js';
import { aiFixtures } from '../fixtures/index.js';

describe('contextSerializer', () => {
  describe('serializeStoryContext', () => {
    it('should include story header with name', () => {
      const graph = createEmptyGraph();
      const metadata: StoryMetadata = { name: 'Test Story' };

      const result = serializeStoryContext(graph, metadata);

      expect(result).toContain('# Story: Test Story');
    });

    it('should use "Untitled" when name is not provided', () => {
      const graph = createEmptyGraph();
      const metadata: StoryMetadata = {};

      const result = serializeStoryContext(graph, metadata);

      expect(result).toContain('# Story: Untitled');
    });

    it('should include logline when provided', () => {
      const graph = createEmptyGraph();
      const metadata: StoryMetadata = {
        name: 'Test',
        logline: 'A detective investigates a murder.',
      };

      const result = serializeStoryContext(graph, metadata);

      expect(result).toContain('Logline: "A detective investigates a murder."');
    });

    it('should include Story Context section when provided', () => {
      const graph = createEmptyGraph();
      const metadata: StoryMetadata = {
        name: 'Test',
        storyContext: '## Themes\n- Betrayal\n- Redemption',
      };

      const result = serializeStoryContext(graph, metadata);

      expect(result).toContain('## Story Context (Creative Direction)');
      expect(result).toContain('## Themes');
      expect(result).toContain('- Betrayal');
    });

    it('should include state summary section', () => {
      const graph = createEmptyGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      const result = serializeStoryContext(graph, metadata);

      expect(result).toContain('## Current State Summary');
      expect(result).toContain('- Total Edges:');
    });

    it('should include nodes section', () => {
      const graph = createEmptyGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      const result = serializeStoryContext(graph, metadata);

      expect(result).toContain('## Nodes');
    });

    it('should count nodes by type in summary', () => {
      const graph = aiFixtures.sampleGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      const result = serializeStoryContext(graph, metadata);

      // Sample graph has 3 characters, 2 locations, etc.
      expect(result).toContain('- Characters: 3');
      expect(result).toContain('- Locations: 2');
    });

    it('should include relationships section when includeEdges is true', () => {
      const graph = aiFixtures.sampleGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      const result = serializeStoryContext(graph, metadata, { includeEdges: true });

      expect(result).toContain('## Relationships');
      expect(result).toContain('-[');
      expect(result).toContain(']->');
    });

    it('should not include relationships section by default', () => {
      const graph = aiFixtures.sampleGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      const result = serializeStoryContext(graph, metadata);

      expect(result).not.toContain('## Relationships');
    });

    it('should truncate nodes when exceeding maxNodes', () => {
      const graph = aiFixtures.sampleGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      const result = serializeStoryContext(graph, metadata, { maxNodes: 3 });

      expect(result).toContain('[Context truncated due to size limits]');
    });

    it('should show truncation message for each type group', () => {
      const graph = aiFixtures.sampleGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      // Very small limit to trigger per-group truncation
      const result = serializeStoryContext(graph, metadata, { maxNodes: 2 });

      // Should have truncation indicator
      expect(result).toContain('more');
    });

    it('should group nodes by type correctly', () => {
      const graph = aiFixtures.sampleGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      const result = serializeStoryContext(graph, metadata);

      expect(result).toContain('### Characters');
      expect(result).toContain('### Locations & Settings');
      expect(result).toContain('### Structure (Beats)');
    });

    it('should serialize node brief with label and type', () => {
      const graph = aiFixtures.sampleGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      const result = serializeStoryContext(graph, metadata);

      // Should include node ID, type, and label
      expect(result).toMatch(/- \*\*character_mike_001\*\* \(Character\): Detective Mike Reyes/);
    });
  });

  describe('serializeNodeContext', () => {
    it('should return not found message for missing node', () => {
      const graph = createEmptyGraph();

      const result = serializeNodeContext(graph, 'nonexistent_id');

      expect(result).toBe('[Node nonexistent_id not found]');
    });

    it('should include focus node header', () => {
      const graph = aiFixtures.sampleGraph();

      const result = serializeNodeContext(graph, 'character_mike_001');

      expect(result).toContain('## Focus: Character "Detective Mike Reyes"');
    });

    it('should include focus node details', () => {
      const graph = aiFixtures.sampleGraph();

      const result = serializeNodeContext(graph, 'character_mike_001');

      expect(result).toContain('- **ID:** character_mike_001');
      expect(result).toContain('- **Type:** Character');
    });

    it('should include connected nodes section', () => {
      const graph = aiFixtures.sampleGraph();

      const result = serializeNodeContext(graph, 'character_mike_001');

      expect(result).toContain('### Connected Nodes');
    });

    it('should include relationships section', () => {
      const graph = aiFixtures.sampleGraph();

      const result = serializeNodeContext(graph, 'scene_crime_002');

      expect(result).toContain('### Relationships');
    });

    it('should respect depth parameter', () => {
      const graph = aiFixtures.sampleGraph();

      // Depth 0 should have no connected nodes
      const depth0 = serializeNodeContext(graph, 'character_mike_001', 0);
      expect(depth0).not.toContain('### Connected Nodes');

      // Depth 1 should have some connected nodes
      const depth1 = serializeNodeContext(graph, 'character_mike_001', 1);
      // Mike is connected to scenes
      expect(depth1).toContain('### Connected Nodes');
    });

    it('should use label fallback chain (name -> title -> heading -> id)', () => {
      const graph = aiFixtures.sampleGraph();

      // Character has name
      const charResult = serializeNodeContext(graph, 'character_mike_001');
      expect(charResult).toContain('"Detective Mike Reyes"');

      // PlotPoint has title
      const ppResult = serializeNodeContext(graph, 'plotpoint_murder_001');
      expect(ppResult).toContain('"Murder Discovery"');

      // Scene has heading
      const sceneResult = serializeNodeContext(graph, 'scene_opening_001');
      expect(sceneResult).toContain('"EXT. CITY STREETS - NIGHT"');
    });
  });

  describe('serializeGaps', () => {
    it('should return "No open gaps." for empty array', () => {
      const result = serializeGaps([]);

      expect(result).toBe('No open gaps.');
    });

    it('should include header', () => {
      const gaps: Gap[] = [
        {
          id: 'gap_1',
          tier: 'structure',
          type: 'missing_scene',
          title: 'Missing Scene',
          description: 'Need a scene for this plot point',
          scopeRefs: { nodeIds: ['plotpoint_001'] },
        },
      ];

      const result = serializeGaps(gaps);

      expect(result).toContain('## Gaps (Generation Opportunities)');
    });

    it('should group gaps by tier', () => {
      const gaps: Gap[] = [
        {
          id: 'gap_1',
          tier: 'structure',
          type: 'missing_scene',
          title: 'Structure Gap',
          description: 'Structure description',
          scopeRefs: {},
        },
        {
          id: 'gap_2',
          tier: 'foundations',
          type: 'missing_character',
          title: 'Foundations Gap',
          description: 'Foundations description',
          scopeRefs: {},
        },
      ];

      const result = serializeGaps(gaps);

      expect(result).toContain('### Foundations Tier');
      expect(result).toContain('### Structure Tier');
      // Foundations should come before Structure
      const foundationsIndex = result.indexOf('Foundations Tier');
      const structureIndex = result.indexOf('Structure Tier');
      expect(foundationsIndex).toBeLessThan(structureIndex);
    });

    it('should include gap title, type, and description', () => {
      const gaps: Gap[] = [
        {
          id: 'gap_1',
          tier: 'plotPoints',
          type: 'missing_plotpoint',
          title: 'Missing Midpoint',
          description: 'Story needs a midpoint plot point',
          scopeRefs: {},
        },
      ];

      const result = serializeGaps(gaps);

      expect(result).toContain('**Missing Midpoint** (missing_plotpoint)');
      expect(result).toContain('Story needs a midpoint plot point');
    });

    it('should include target node IDs when present', () => {
      const gaps: Gap[] = [
        {
          id: 'gap_1',
          tier: 'scenes',
          type: 'missing_scene',
          title: 'Missing Scene',
          description: 'Scene needed',
          scopeRefs: { nodeIds: ['plotpoint_001', 'character_002'] },
        },
      ];

      const result = serializeGaps(gaps);

      expect(result).toContain('Target: plotpoint_001, character_002');
    });

    it('should follow tier order: premise, foundations, structure, plotPoints, scenes', () => {
      const gaps: Gap[] = [
        { id: '1', tier: 'scenes', type: 't', title: 'Scenes', description: '', scopeRefs: {} },
        { id: '2', tier: 'premise', type: 't', title: 'Premise', description: '', scopeRefs: {} },
        { id: '3', tier: 'plotPoints', type: 't', title: 'PlotPoints', description: '', scopeRefs: {} },
        { id: '4', tier: 'foundations', type: 't', title: 'Foundations', description: '', scopeRefs: {} },
        { id: '5', tier: 'structure', type: 't', title: 'Structure', description: '', scopeRefs: {} },
      ];

      const result = serializeGaps(gaps);

      const order = ['Premise', 'Foundations', 'Structure', 'Plotpoints', 'Scenes'];
      let lastIndex = -1;
      for (const tier of order) {
        const index = result.indexOf(`${tier} Tier`);
        if (index !== -1) {
          expect(index).toBeGreaterThan(lastIndex);
          lastIndex = index;
        }
      }
    });
  });

  describe('serializeStoryContextMd', () => {
    it('should return the content when provided', () => {
      const content = '## Themes\n- Love\n- Loss';

      const result = serializeStoryContextMd(content);

      expect(result).toBe(content);
    });

    it('should return placeholder when undefined', () => {
      const result = serializeStoryContextMd(undefined);

      expect(result).toBe('[No Story Context defined]');
    });

    it('should return placeholder when empty string', () => {
      const result = serializeStoryContextMd('');

      expect(result).toBe('[No Story Context defined]');
    });
  });

  describe('edge serialization', () => {
    it('should format edges with node labels', () => {
      const graph = aiFixtures.sampleGraph();
      const metadata: StoryMetadata = { name: 'Test' };

      const result = serializeStoryContext(graph, metadata, { includeEdges: true });

      // Should have format: label -[TYPE]-> label
      // Edges go from scene to character, so format is: scene -[HAS_CHARACTER]-> character
      expect(result).toContain('## Relationships');
      expect(result).toMatch(/-\[HAS_CHARACTER\]->/);
    });

    it('should use node ID as fallback when node not found', () => {
      const graph = createEmptyGraph();
      // Add an edge with one invalid reference
      graph.edges.push({
        id: 'edge_test',
        type: 'RELATES_TO',
        from: 'nonexistent_from',
        to: 'nonexistent_to',
      });

      const metadata: StoryMetadata = { name: 'Test' };
      const result = serializeStoryContext(graph, metadata, { includeEdges: true });

      expect(result).toContain('nonexistent_from -[RELATES_TO]-> nonexistent_to');
    });
  });

  describe('node field serialization', () => {
    it('should truncate long string values', () => {
      const graph = createEmptyGraph();
      const longDescription = 'A'.repeat(200);
      graph.nodes.set('char_1', {
        type: 'Character',
        id: 'char_1',
        name: 'Test',
        description: longDescription,
      } as any);

      const result = serializeNodeContext(graph, 'char_1');

      // Should be truncated to 100 chars + "..."
      expect(result).toContain('...');
      expect(result).not.toContain(longDescription);
    });

    it('should format array values with preview', () => {
      const graph = createEmptyGraph();
      graph.nodes.set('char_1', {
        type: 'Character',
        id: 'char_1',
        name: 'Test',
        traits: ['brave', 'loyal', 'cunning', 'smart', 'strong', 'fast'],
      } as any);

      const result = serializeNodeContext(graph, 'char_1');

      // Should show first 5 with ellipsis
      expect(result).toContain('brave, loyal, cunning, smart, strong...');
    });

    it('should skip null and undefined values', () => {
      const graph = createEmptyGraph();
      graph.nodes.set('char_1', {
        type: 'Character',
        id: 'char_1',
        name: 'Test',
        middleName: null,
        nickname: undefined,
      } as any);

      const result = serializeNodeContext(graph, 'char_1');

      expect(result).not.toContain('middleName');
      expect(result).not.toContain('nickname');
    });

    it('should skip internal fields (id, type, createdAt, updatedAt)', () => {
      const graph = createEmptyGraph();
      graph.nodes.set('char_1', {
        type: 'Character',
        id: 'char_1',
        name: 'Test',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      } as any);

      const result = serializeNodeContext(graph, 'char_1');

      // ID and Type are shown in special format
      expect(result).toContain('- **ID:** char_1');
      expect(result).toContain('- **Type:** Character');
      // But not as regular fields
      expect(result).not.toContain('createdAt');
      expect(result).not.toContain('updatedAt');
    });
  });
});
