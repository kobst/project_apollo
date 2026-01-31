/**
 * Temporal and continuity validation using mentions.
 */

import type { GraphState } from '../core/graph.js';
import type { Character, StoryBeat, Scene } from '../types/nodes.js';
import type { NarrativePackage } from '../ai/types.js';
import { getNodesByType, getEdgesByType, getNode } from '../core/graph.js';
import { extractMentions, extractTextFromNode, type EntityInfo } from './extraction.js';
import { getBeatOrder, getAlignedBeat, getSceneAlignedBeat, EXTRACTABLE_FIELDS } from './utils.js';

/**
 * A temporal violation where an entity is referenced before introduction.
 */
export interface TemporalViolation {
  /** Node ID containing the violation */
  nodeId: string;
  /** Type of the node */
  nodeType: string;
  /** ID of the entity that was mentioned */
  mentionedEntity: string;
  /** Name of the entity */
  mentionedEntityName: string;
  /** Beat where the mention occurs */
  atBeat: string;
  /** Position of the beat (1-15) */
  atPosition: number;
  /** Beat where the entity is introduced */
  introducedAtBeat: string;
  /** Position of the introduction beat */
  introducedAtPosition: number;
  /** Human-readable message */
  message: string;
}

/**
 * Map of entity ID to their first appearance beat.
 */
export type IntroductionMap = Map<string, string>;

/**
 * Compute when each character is first introduced in the story.
 * Introduction = first appearance via HAS_CHARACTER edge or MENTIONS edge.
 */
export function computeIntroductionPoints(graph: GraphState): IntroductionMap {
  const introductions = new Map<string, string>();
  const beatOrder = getBeatOrder(graph);
  
  const characters = getNodesByType<Character>(graph, 'Character');
  
  for (const char of characters) {
    let earliestBeat: string | null = null;
    let earliestPosition = Infinity;
    
    // Check HAS_CHARACTER edges (character participates in scene)
    const hasCharEdges = getEdgesByType(graph, 'HAS_CHARACTER');
    for (const edge of hasCharEdges) {
      if (edge.to === char.id) {
        const sceneBeat = getSceneAlignedBeat(graph, edge.from);
        if (sceneBeat) {
          const pos = beatOrder.get(sceneBeat) ?? Infinity;
          if (pos < earliestPosition) {
            earliestPosition = pos;
            earliestBeat = sceneBeat;
          }
        }
      }
    }
    
    // Check MENTIONS edges (character mentioned in content)
    const mentionsEdges = getEdgesByType(graph, 'MENTIONS');
    for (const edge of mentionsEdges) {
      if (edge.to === char.id) {
        const node = getNode(graph, edge.from);
        if (!node) continue;
        
        if (node.type === 'StoryBeat') {
          const alignedBeat = getAlignedBeat(graph, node.id);
          if (alignedBeat) {
            const pos = beatOrder.get(alignedBeat) ?? Infinity;
            if (pos < earliestPosition) {
              earliestPosition = pos;
              earliestBeat = alignedBeat;
            }
          }
        } else if (node.type === 'Scene') {
          const sceneBeat = getSceneAlignedBeat(graph, node.id);
          if (sceneBeat) {
            const pos = beatOrder.get(sceneBeat) ?? Infinity;
            if (pos < earliestPosition) {
              earliestPosition = pos;
              earliestBeat = sceneBeat;
            }
          }
        }
      }
    }
    
    if (earliestBeat) {
      introductions.set(char.id, earliestBeat);
    }
  }
  
  return introductions;
}

/**
 * Validate temporal consistency of the entire graph.
 * Checks for entities mentioned before they are introduced.
 */
export function validateTemporalConsistency(graph: GraphState): TemporalViolation[] {
  const violations: TemporalViolation[] = [];
  const beatOrder = getBeatOrder(graph);
  const introductions = computeIntroductionPoints(graph);
  
  // Get all entities for mention extraction
  const entities = getAllEntities(graph);
  
  // Check each StoryBeat
  const storyBeats = getNodesByType<StoryBeat>(graph, 'StoryBeat');
  
  for (const beat of storyBeats) {
    const alignedTo = getAlignedBeat(graph, beat.id);
    if (!alignedTo) continue;
    
    const beatPosition = beatOrder.get(alignedTo);
    if (beatPosition === undefined) continue;
    
    // Get text to check for mentions
    const fields = EXTRACTABLE_FIELDS['StoryBeat'] || [];
    const text = extractTextFromNode(beat as unknown as Record<string, unknown>, fields);
    
    const mentions = extractMentions(text, entities);
    
    for (const mention of mentions) {
      const introBeat = introductions.get(mention.entityId);
      if (!introBeat) continue; // Entity has no tracked introduction
      
      const introPosition = beatOrder.get(introBeat);
      if (introPosition === undefined) continue;
      
      // Check if mentioned before introduction
      if (introPosition > beatPosition) {
        const entity = entities.find(e => e.id === mention.entityId);
        violations.push({
          nodeId: beat.id,
          nodeType: 'StoryBeat',
          mentionedEntity: mention.entityId,
          mentionedEntityName: entity?.name || mention.entityId,
          atBeat: alignedTo,
          atPosition: beatPosition,
          introducedAtBeat: introBeat,
          introducedAtPosition: introPosition,
          message: `"${entity?.name || mention.entityId}" referenced at ${formatBeatName(alignedTo)} (position ${beatPosition}) but introduced at ${formatBeatName(introBeat)} (position ${introPosition})`
        });
      }
    }
  }
  
  // Check each Scene
  const scenes = getNodesByType<Scene>(graph, 'Scene');
  
  for (const scene of scenes) {
    const sceneBeat = getSceneAlignedBeat(graph, scene.id);
    if (!sceneBeat) continue;
    
    const beatPosition = beatOrder.get(sceneBeat);
    if (beatPosition === undefined) continue;
    
    const fields = EXTRACTABLE_FIELDS['Scene'] || [];
    const text = extractTextFromNode(scene as unknown as Record<string, unknown>, fields);
    
    const mentions = extractMentions(text, entities);
    
    for (const mention of mentions) {
      const introBeat = introductions.get(mention.entityId);
      if (!introBeat) continue;
      
      const introPosition = beatOrder.get(introBeat);
      if (introPosition === undefined) continue;
      
      if (introPosition > beatPosition) {
        const entity = entities.find(e => e.id === mention.entityId);
        violations.push({
          nodeId: scene.id,
          nodeType: 'Scene',
          mentionedEntity: mention.entityId,
          mentionedEntityName: entity?.name || mention.entityId,
          atBeat: sceneBeat,
          atPosition: beatPosition,
          introducedAtBeat: introBeat,
          introducedAtPosition: introPosition,
          message: `"${entity?.name || mention.entityId}" referenced at ${formatBeatName(sceneBeat)} (position ${beatPosition}) but introduced at ${formatBeatName(introBeat)} (position ${introPosition})`
        });
      }
    }
  }
  
  return violations;
}

/**
 * Validate mentions in a proposal before committing.
 */
export function validateProposalMentions(
  pkg: NarrativePackage,
  graph: GraphState
): TemporalViolation[] {
  const violations: TemporalViolation[] = [];
  const beatOrder = getBeatOrder(graph);
  const introductions = computeIntroductionPoints(graph);
  
  // Get existing entities
  const existingEntities = getAllEntities(graph);
  
  // Get proposed entities (characters/locations being added)
  const proposedEntities: EntityInfo[] = pkg.changes.nodes
    .filter(n => n.operation === 'add' && ['Character', 'Location', 'Object'].includes(n.node_type))
    .map(n => ({
      id: n.node_id,
      type: n.node_type as 'Character' | 'Location' | 'Object',
      name: (n.data as Record<string, unknown>)?.name as string || '',
      aliases: (n.data as Record<string, unknown>)?.aliases as string[] | undefined
    }))
    .filter(e => e.name);
  
  const allEntities = [...existingEntities, ...proposedEntities];
  
  // Track where proposed entities are introduced (first mention in proposal)
  const proposedIntroductions = new Map<string, { beat: string; position: number }>();
  
  // Find introduction points for proposed story beats (sorted by position)
  const proposedStoryBeats = pkg.changes.nodes
    .filter(n => n.operation === 'add' && n.node_type === 'StoryBeat')
    .map(n => {
      const alignsEdge = pkg.changes.edges.find(
        e => e.operation === 'add' && e.edge_type === 'ALIGNS_WITH' && e.from === n.node_id
      );
      return {
        node: n,
        alignedTo: alignsEdge?.to,
        position: alignsEdge?.to ? beatOrder.get(alignsEdge.to) : undefined
      };
    })
    .filter(x => x.position !== undefined)
    .sort((a, b) => (a.position as number) - (b.position as number));
  
  // Process in order to track introductions
  for (const { node, alignedTo, position } of proposedStoryBeats) {
    if (!alignedTo || position === undefined) continue;
    
    const fields = EXTRACTABLE_FIELDS['StoryBeat'] || [];
    const data = node.data as Record<string, unknown>;
    const text = extractTextFromNode(data, fields);
    
    const mentions = extractMentions(text, allEntities);
    
    for (const mention of mentions) {
      // Track introduction for proposed entities
      if (!proposedIntroductions.has(mention.entityId) && proposedEntities.some(e => e.id === mention.entityId)) {
        proposedIntroductions.set(mention.entityId, { beat: alignedTo, position });
      }
      
      // Check if entity is mentioned before introduction
      let introPosition: number | undefined;
      let introBeat: string | undefined;
      
      // Check existing introductions
      const existingIntroBeat = introductions.get(mention.entityId);
      if (existingIntroBeat) {
        introBeat = existingIntroBeat;
        introPosition = beatOrder.get(existingIntroBeat);
      }
      
      // Check proposed introductions (only for earlier beats in this proposal)
      const proposedIntro = proposedIntroductions.get(mention.entityId);
      if (proposedIntro && (introPosition === undefined || proposedIntro.position < introPosition)) {
        introBeat = proposedIntro.beat;
        introPosition = proposedIntro.position;
      }
      
      // If still no introduction, it's a new entity being introduced here
      if (introPosition === undefined) {
        continue; // First mention = introduction, no violation
      }
      
      // Check for violation
      if (introPosition > position) {
        const entity = allEntities.find(e => e.id === mention.entityId);
        violations.push({
          nodeId: node.node_id,
          nodeType: 'StoryBeat',
          mentionedEntity: mention.entityId,
          mentionedEntityName: entity?.name || mention.entityId,
          atBeat: alignedTo,
          atPosition: position,
          introducedAtBeat: introBeat!,
          introducedAtPosition: introPosition,
          message: `"${entity?.name || mention.entityId}" referenced at ${formatBeatName(alignedTo)} (position ${position}) but introduced at ${formatBeatName(introBeat!)} (position ${introPosition})`
        });
      }
    }
  }
  
  return violations;
}

/**
 * Get all mentionable entities from the graph.
 */
function getAllEntities(graph: GraphState): EntityInfo[] {
  const entities: EntityInfo[] = [];
  
  const characters = getNodesByType<Character>(graph, 'Character');
  for (const char of characters) {
    entities.push({
      id: char.id,
      type: 'Character',
      name: char.name,
      aliases: (char as unknown as Record<string, unknown>).aliases as string[] | undefined
    });
  }
  
  const locations = getNodesByType(graph, 'Location');
  for (const loc of locations) {
    const data = loc as unknown as Record<string, unknown>;
    if (data.name) {
      entities.push({
        id: loc.id,
        type: 'Location',
        name: data.name as string
      });
    }
  }
  
  const objects = getNodesByType(graph, 'Object');
  for (const obj of objects) {
    const data = obj as unknown as Record<string, unknown>;
    if (data.name) {
      entities.push({
        id: obj.id,
        type: 'Object',
        name: data.name as string
      });
    }
  }
  
  return entities;
}

/**
 * Format a beat ID into a human-readable name.
 */
function formatBeatName(beatId: string): string {
  // beat_OpeningImage -> Opening Image
  const name = beatId.replace('beat_', '');
  return name.replace(/([A-Z])/g, ' $1').trim();
}
