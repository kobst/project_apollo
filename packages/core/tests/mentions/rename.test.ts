/**
 * Tests for entity renaming with text propagation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphState } from '../../src/core/graph.js';
import type { Beat, Character, StoryBeat } from '../../src/types/nodes.js';
import type { Edge } from '../../src/types/edges.js';
import { renameEntity } from '../../src/mentions/rename.js';
import { rebuildAllMentions } from '../../src/mentions/rebuild.js';

// Helper to create a graph with beats
function createGraphWith15Beats(): GraphState {
  const nodes = new Map<string, Beat>();
  
  const beatTypes = [
    'OpeningImage', 'ThemeStated', 'Setup', 'Catalyst', 'Debate',
    'BreakIntoTwo', 'BStory', 'FunAndGames', 'Midpoint',
    'BadGuysCloseIn', 'AllIsLost', 'DarkNightOfSoul',
    'BreakIntoThree', 'Finale', 'FinalImage'
  ] as const;
  
  beatTypes.forEach((beatType, index) => {
    const beat: Beat = {
      type: 'Beat',
      id: `beat_${beatType}`,
      beat_type: beatType,
      act: 1,
      position_index: index + 1,
      status: 'EMPTY'
    };
    nodes.set(beat.id, beat as any);
  });
  
  return { nodes, edges: [] };
}

// Helper to add character to graph
function addCharacter(graph: GraphState, id: string, name: string): void {
  const char: Character = {
    type: 'Character',
    id,
    name,
    status: 'ACTIVE'
  };
  graph.nodes.set(id, char as any);
}

// Helper to add story beat to graph
function addStoryBeat(
  graph: GraphState, 
  id: string, 
  title: string, 
  summary: string
): void {
  const sb: StoryBeat = {
    type: 'StoryBeat',
    id,
    title,
    summary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  graph.nodes.set(id, sb as any);
}

describe('renameEntity', () => {
  let graph: GraphState;

  beforeEach(() => {
    graph = createGraphWith15Beats();
  });

  it('should update character name', () => {
    addCharacter(graph, 'char_1', 'John');
    
    const result = renameEntity(graph, 'char_1', 'Jonathan');
    
    const char = graph.nodes.get('char_1') as any;
    expect(char.name).toBe('Jonathan');
    expect(result.oldName).toBe('John');
    expect(result.newName).toBe('Jonathan');
  });

  it('should propagate name change to text fields', () => {
    addCharacter(graph, 'char_1', 'John');
    addStoryBeat(graph, 'sb_1', 'John decides', 'John makes a big decision');
    
    // Build mentions first
    rebuildAllMentions(graph);
    
    const result = renameEntity(graph, 'char_1', 'Jonathan');
    
    const sb = graph.nodes.get('sb_1') as any;
    expect(sb.title).toBe('Jonathan decides');
    expect(sb.summary).toBe('Jonathan makes a big decision');
    expect(result.totalReplacements).toBeGreaterThan(0);
  });

  it('should handle possessive forms correctly', () => {
    addCharacter(graph, 'char_1', 'John');
    addStoryBeat(graph, 'sb_1', "John's plan", "John's strategy unfolds");
    
    rebuildAllMentions(graph);
    
    renameEntity(graph, 'char_1', 'Jonathan');
    
    const sb = graph.nodes.get('sb_1') as any;
    expect(sb.title).toBe("Jonathan's plan");
    expect(sb.summary).toBe("Jonathan's strategy unfolds");
  });

  it('should not change text for unrelated entities', () => {
    addCharacter(graph, 'char_1', 'John');
    addCharacter(graph, 'char_2', 'Sarah');
    addStoryBeat(graph, 'sb_1', 'Sarah waits', 'Sarah waits for news');
    
    rebuildAllMentions(graph);
    
    renameEntity(graph, 'char_1', 'Jonathan');
    
    const sb = graph.nodes.get('sb_1') as any;
    expect(sb.title).toBe('Sarah waits'); // Unchanged
    expect(sb.summary).toBe('Sarah waits for news'); // Unchanged
  });

  it('should handle no-op rename (same name)', () => {
    addCharacter(graph, 'char_1', 'John');
    addStoryBeat(graph, 'sb_1', 'John decides', 'John acts');
    
    const result = renameEntity(graph, 'char_1', 'John');
    
    expect(result.totalReplacements).toBe(0);
    expect(result.textUpdates).toHaveLength(0);
  });

  it('should throw for non-existent entity', () => {
    expect(() => {
      renameEntity(graph, 'non_existent', 'NewName');
    }).toThrow('Entity not found');
  });

  it('should throw for entity without name field', () => {
    // Beat doesn't have a name field
    expect(() => {
      renameEntity(graph, 'beat_Setup', 'NewName');
    }).toThrow('no name field');
  });

  it('should update MENTIONS edge matchedText', () => {
    addCharacter(graph, 'char_1', 'John');
    addStoryBeat(graph, 'sb_1', 'John acts', 'John decides');
    
    rebuildAllMentions(graph);
    
    const result = renameEntity(graph, 'char_1', 'Jonathan');
    
    expect(result.mentionsUpdated).toBeGreaterThan(0);
    
    const mentionEdges = graph.edges.filter(e => e.type === 'MENTIONS' && e.to === 'char_1');
    for (const edge of mentionEdges) {
      expect(edge.properties?.matchedText).toBe('Jonathan');
    }
  });

  it('should handle multiple occurrences in same field', () => {
    addCharacter(graph, 'char_1', 'John');
    addStoryBeat(graph, 'sb_1', 'John meets John', 'John talks to John about John');
    
    rebuildAllMentions(graph);
    
    const result = renameEntity(graph, 'char_1', 'Jack');
    
    const sb = graph.nodes.get('sb_1') as any;
    expect(sb.title).toBe('Jack meets Jack');
    expect(sb.summary).toBe('Jack talks to Jack about Jack');
    expect(result.totalReplacements).toBe(5); // 2 in title + 3 in summary
  });
});
