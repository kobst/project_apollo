/**
 * Tests for MENTIONS edge rebuilding
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphState } from '../../src/core/graph.js';
import type { Beat, Character, StoryBeat } from '../../src/types/nodes.js';
import {
  rebuildMentionsForNode,
  rebuildAllMentions,
  removeMentionsFromNode
} from '../../src/mentions/rebuild.js';

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

describe('rebuildMentionsForNode', () => {
  let graph: GraphState;

  beforeEach(() => {
    graph = createGraphWith15Beats();
  });

  it('should create MENTIONS edges for character references', () => {
    addCharacter(graph, 'char_1', 'John');
    addStoryBeat(graph, 'sb_1', 'John acts', 'John makes a big decision');
    
    const result = rebuildMentionsForNode(graph, 'sb_1');
    
    expect(result.edgesCreated).toBe(2); // title + summary
    expect(result.nodesProcessed).toContain('sb_1');
    
    const mentionEdges = graph.edges.filter(e => e.type === 'MENTIONS');
    expect(mentionEdges).toHaveLength(2);
    expect(mentionEdges[0]?.to).toBe('char_1');
  });

  it('should remove old MENTIONS before rebuilding', () => {
    addCharacter(graph, 'char_1', 'John');
    addStoryBeat(graph, 'sb_1', 'John acts', 'John decides');
    
    // Build mentions first time
    rebuildMentionsForNode(graph, 'sb_1');
    expect(graph.edges.filter(e => e.type === 'MENTIONS')).toHaveLength(2);
    
    // Rebuild - should have same count, not double
    const result = rebuildMentionsForNode(graph, 'sb_1');
    
    expect(result.edgesRemoved).toBe(2);
    expect(result.edgesCreated).toBe(2);
    expect(graph.edges.filter(e => e.type === 'MENTIONS')).toHaveLength(2);
  });

  it('should not create edges for non-extractable node types', () => {
    addCharacter(graph, 'char_1', 'John');
    
    const result = rebuildMentionsForNode(graph, 'beat_Setup');
    
    expect(result.edgesCreated).toBe(0);
    expect(result.nodesProcessed).toHaveLength(0);
  });

  it('should handle non-existent node gracefully', () => {
    const result = rebuildMentionsForNode(graph, 'non_existent');
    
    expect(result.edgesCreated).toBe(0);
    expect(result.edgesRemoved).toBe(0);
    expect(result.nodesProcessed).toHaveLength(0);
  });
});

describe('rebuildAllMentions', () => {
  let graph: GraphState;

  beforeEach(() => {
    graph = createGraphWith15Beats();
  });

  it('should rebuild all mentions across the graph', () => {
    addCharacter(graph, 'char_1', 'John');
    addCharacter(graph, 'char_2', 'Sarah');
    addStoryBeat(graph, 'sb_1', 'John meets Sarah', 'John and Sarah meet for the first time');
    addStoryBeat(graph, 'sb_2', 'Sarah decides', 'Sarah makes up her mind');
    
    const result = rebuildAllMentions(graph);
    
    expect(result.nodesProcessed.length).toBeGreaterThan(0);
    expect(result.edgesCreated).toBeGreaterThan(0);
    
    const mentionEdges = graph.edges.filter(e => e.type === 'MENTIONS');
    expect(mentionEdges.length).toBeGreaterThan(0);
  });

  it('should remove all existing MENTIONS before rebuild', () => {
    addCharacter(graph, 'char_1', 'John');
    addStoryBeat(graph, 'sb_1', 'John acts', 'John decides');
    
    // First build
    rebuildAllMentions(graph);
    const firstCount = graph.edges.filter(e => e.type === 'MENTIONS').length;
    
    // Second build - should replace, not add
    const result = rebuildAllMentions(graph);
    
    expect(result.edgesRemoved).toBe(firstCount);
    expect(graph.edges.filter(e => e.type === 'MENTIONS')).toHaveLength(firstCount);
  });
});

describe('removeMentionsFromNode', () => {
  let graph: GraphState;

  beforeEach(() => {
    graph = createGraphWith15Beats();
  });

  it('should remove all MENTIONS edges from a specific node', () => {
    addCharacter(graph, 'char_1', 'John');
    addStoryBeat(graph, 'sb_1', 'John acts', 'John decides');
    addStoryBeat(graph, 'sb_2', 'John returns', 'John comes back');
    
    rebuildAllMentions(graph);
    const totalBefore = graph.edges.filter(e => e.type === 'MENTIONS').length;
    
    // Remove from just sb_1
    const removed = removeMentionsFromNode(graph, 'sb_1');
    
    expect(removed).toBe(2); // title + summary
    expect(graph.edges.filter(e => e.type === 'MENTIONS')).toHaveLength(totalBefore - 2);
    
    // sb_2 mentions should still exist
    expect(graph.edges.some(e => e.type === 'MENTIONS' && e.from === 'sb_2')).toBe(true);
  });
});
