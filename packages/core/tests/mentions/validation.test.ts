/**
 * Tests for temporal validation using mentions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphState } from '../../src/core/graph.js';
import type { Beat, Character, PlotPoint, Scene } from '../../src/types/nodes.js';
import type { Edge } from '../../src/types/edges.js';
import {
  computeIntroductionPoints,
  validateTemporalConsistency,
  validateProposalMentions
} from '../../src/mentions/validation.js';
import type { NarrativePackage } from '../../src/ai/types.js';

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
      act: 1, // Simplified
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

// Helper to add plot point to graph
function addPlotPoint(
  graph: GraphState,
  id: string,
  title: string,
  summary: string,
  alignedToBeat: string
): void {
  const pp: PlotPoint = {
    type: 'PlotPoint',
    id,
    title,
    summary,
    alignedBeatId: alignedToBeat,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  graph.nodes.set(id, pp as any);
}

// Helper to add scene to graph
function addScene(
  graph: GraphState,
  id: string,
  heading: string,
  overview: string,
  plotPointId: string
): void {
  const scene: Scene = {
    type: 'Scene',
    id,
    heading,
    scene_overview: overview
  };
  graph.nodes.set(id, scene as any);

  // Add REALIZED_BY edge from PlotPoint to Scene
  const edge: Edge = {
    id: `edge_${plotPointId}_${id}`,
    type: 'REALIZED_BY',
    from: plotPointId,
    to: id,
    status: 'approved'
  };
  graph.edges.push(edge);
}

// Helper to add HAS_CHARACTER edge
function addHasCharacter(graph: GraphState, sceneId: string, charId: string): void {
  const edge: Edge = {
    id: `edge_${sceneId}_${charId}`,
    type: 'HAS_CHARACTER',
    from: sceneId,
    to: charId,
    status: 'approved'
  };
  graph.edges.push(edge);
}

describe('computeIntroductionPoints', () => {
  let graph: GraphState;

  beforeEach(() => {
    graph = createGraphWith15Beats();
  });

  it('should return empty map for no characters', () => {
    const introductions = computeIntroductionPoints(graph);
    expect(introductions.size).toBe(0);
  });

  it('should track character introduction via HAS_CHARACTER edge', () => {
    // Add character
    addCharacter(graph, 'char_1', 'John');
    
    // Add story beat at Catalyst
    addPlotPoint(graph, 'sb_1', 'John arrives', 'John arrives at the station', 'beat_Catalyst');
    
    // Add scene for that beat
    addScene(graph, 'scene_1', 'INT. STATION - DAY', 'John enters the station', 'sb_1');
    
    // Add HAS_CHARACTER edge
    addHasCharacter(graph, 'scene_1', 'char_1');
    
    const introductions = computeIntroductionPoints(graph);
    
    expect(introductions.get('char_1')).toBe('beat_Catalyst');
  });

  it('should find earliest introduction across multiple appearances', () => {
    addCharacter(graph, 'char_1', 'John');
    
    // First appearance at Setup (position 3)
    addPlotPoint(graph, 'sb_1', 'Meet John', 'We meet John', 'beat_Setup');
    addScene(graph, 'scene_1', 'INT. OFFICE - DAY', 'John at work', 'sb_1');
    addHasCharacter(graph, 'scene_1', 'char_1');
    
    // Second appearance at Midpoint (position 9)
    addPlotPoint(graph, 'sb_2', 'John returns', 'John comes back', 'beat_Midpoint');
    addScene(graph, 'scene_2', 'INT. OFFICE - NIGHT', 'John returns', 'sb_2');
    addHasCharacter(graph, 'scene_2', 'char_1');
    
    const introductions = computeIntroductionPoints(graph);
    
    // Should return Setup (earlier position)
    expect(introductions.get('char_1')).toBe('beat_Setup');
  });
});

describe('validateTemporalConsistency', () => {
  let graph: GraphState;

  beforeEach(() => {
    graph = createGraphWith15Beats();
  });

  it('should return empty violations for valid graph', () => {
    // Add character introduced at Setup
    addCharacter(graph, 'char_1', 'John');
    addPlotPoint(graph, 'sb_1', 'Meet John', 'John arrives', 'beat_Setup');
    addScene(graph, 'scene_1', 'INT. OFFICE - DAY', 'John enters', 'sb_1');
    addHasCharacter(graph, 'scene_1', 'char_1');
    
    // Story beat at Midpoint mentions John (after introduction)
    addPlotPoint(graph, 'sb_2', 'John decides', 'John makes a decision', 'beat_Midpoint');
    
    const violations = validateTemporalConsistency(graph);
    
    expect(violations).toHaveLength(0);
  });

  it('should detect character mentioned before introduction', () => {
    // Add character, introduced at Midpoint
    addCharacter(graph, 'char_1', 'Sarah');
    addPlotPoint(graph, 'sb_intro', 'Sarah arrives', 'Sarah joins', 'beat_Midpoint');
    addScene(graph, 'scene_intro', 'INT. OFFICE - DAY', 'Sarah enters', 'sb_intro');
    addHasCharacter(graph, 'scene_intro', 'char_1');
    
    // Story beat at Setup (before Midpoint) mentions Sarah
    addPlotPoint(graph, 'sb_early', 'Sarah mentioned', 'Sarah calls ahead', 'beat_Setup');
    
    const violations = validateTemporalConsistency(graph);
    
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.mentionedEntity).toBe('char_1');
    expect(violations[0]?.atBeat).toBe('beat_Setup');
    expect(violations[0]?.introducedAtBeat).toBe('beat_Midpoint');
  });
});

describe('validateProposalMentions', () => {
  let graph: GraphState;

  beforeEach(() => {
    graph = createGraphWith15Beats();
  });

  it('should validate proposal with new character introduced before mention', () => {
    const pkg: NarrativePackage = {
      id: 'pkg_1',
      title: 'Test Package',
      rationale: 'Testing',
      confidence: 0.9,
      style_tags: [],
      changes: {
        nodes: [
          {
            operation: 'add',
            node_type: 'Character',
            node_id: 'char_new',
            data: { name: 'Marcus', type: 'Character' }
          },
          {
            operation: 'add',
            node_type: 'PlotPoint',
            node_id: 'sb_1',
            data: {
              title: 'Marcus intro',
              summary: 'Marcus enters the scene',
              type: 'PlotPoint',
              alignedBeatId: 'beat_Setup' // Position 3
            }
          },
          {
            operation: 'add',
            node_type: 'PlotPoint',
            node_id: 'sb_2',
            data: {
              title: 'Marcus acts',
              summary: 'Marcus makes his move',
              type: 'PlotPoint',
              alignedBeatId: 'beat_Midpoint' // Position 9
            }
          }
        ],
        edges: []
      },
      impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] }
    };
    
    const violations = validateProposalMentions(pkg, graph);
    
    // No violations - Marcus introduced at Setup, mentioned at Midpoint
    expect(violations).toHaveLength(0);
  });

  it('should detect proposal referencing existing character before their introduction', () => {
    // Add an existing character introduced at Midpoint
    addCharacter(graph, 'char_existing', 'Elena');
    addPlotPoint(graph, 'sb_intro_existing', 'Elena appears', 'Elena arrives at the party', 'beat_Midpoint');
    addScene(graph, 'scene_intro', 'INT. PARTY - NIGHT', 'Elena enters', 'sb_intro_existing');
    addHasCharacter(graph, 'scene_intro', 'char_existing');
    
    // Proposal adds a plot point at Setup (before Midpoint) that mentions Elena
    const pkg: NarrativePackage = {
      id: 'pkg_1',
      title: 'Test Package',
      rationale: 'Testing',
      confidence: 0.9,
      style_tags: [],
      changes: {
        nodes: [
          {
            operation: 'add',
            node_type: 'PlotPoint',
            node_id: 'sb_early',
            data: {
              title: 'Elena discussed',
              summary: 'Elena is mentioned by the others before she arrives',
              type: 'PlotPoint',
              alignedBeatId: 'beat_Setup' // Position 3, before Midpoint position 9
            }
          }
        ],
        edges: []
      },
      impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] }
    };
    
    const violations = validateProposalMentions(pkg, graph);
    
    // Elena is mentioned at Setup but introduced at Midpoint
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.mentionedEntityName).toBe('Elena');
    expect(violations[0]?.atPosition).toBeLessThan(violations[0]?.introducedAtPosition || 0);
  });
});
