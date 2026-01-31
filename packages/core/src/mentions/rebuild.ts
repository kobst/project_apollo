/**
 * Rebuild and manage MENTIONS edges.
 */

import type { GraphState } from '../core/graph.js';
import type { Edge } from '../types/edges.js';
import type { Character } from '../types/nodes.js';
import { getNode, getNodesByType, getAllNodes } from '../core/graph.js';
import { generateEdgeId } from '../types/edges.js';
import { extractMentions, type EntityInfo } from './extraction.js';
import { EXTRACTABLE_FIELDS } from './utils.js';

/**
 * Result of rebuilding mentions for nodes.
 */
export interface MentionRebuildResult {
  /** Number of MENTIONS edges created */
  edgesCreated: number;
  /** Number of MENTIONS edges removed */
  edgesRemoved: number;
  /** Node IDs that were processed */
  nodesProcessed: string[];
}

/**
 * Remove all MENTIONS edges originating from a node.
 */
export function removeMentionsFromNode(graph: GraphState, nodeId: string): number {
  const initialCount = graph.edges.length;
  graph.edges = graph.edges.filter(
    e => !(e.type === 'MENTIONS' && e.from === nodeId)
  );
  return initialCount - graph.edges.length;
}

/**
 * Remove all MENTIONS edges targeting an entity (when entity is deleted).
 */
export function removeMentionsToEntity(graph: GraphState, entityId: string): number {
  const initialCount = graph.edges.length;
  graph.edges = graph.edges.filter(
    e => !(e.type === 'MENTIONS' && e.to === entityId)
  );
  return initialCount - graph.edges.length;
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
 * Rebuild MENTIONS edges for a single node.
 * Removes existing MENTIONS edges from this node, then creates new ones.
 */
export function rebuildMentionsForNode(
  graph: GraphState,
  nodeId: string
): MentionRebuildResult {
  const node = getNode(graph, nodeId);
  if (!node) {
    return { edgesCreated: 0, edgesRemoved: 0, nodesProcessed: [] };
  }
  
  const fields = EXTRACTABLE_FIELDS[node.type];
  if (!fields || fields.length === 0) {
    return { edgesCreated: 0, edgesRemoved: 0, nodesProcessed: [] };
  }
  
  // Remove existing MENTIONS edges from this node
  const edgesRemoved = removeMentionsFromNode(graph, nodeId);
  
  // Get all entities
  const entities = getAllEntities(graph);
  
  // Extract mentions from each field
  let edgesCreated = 0;
  const data = node as unknown as Record<string, unknown>;
  
  for (const field of fields) {
    const value = data[field];
    let text = '';
    
    if (typeof value === 'string') {
      text = value;
    } else if (Array.isArray(value)) {
      text = value.filter(v => typeof v === 'string').join(' ');
    }
    
    if (!text) continue;
    
    const mentions = extractMentions(text, entities);
    
    for (const mention of mentions) {
      const edge: Edge = {
        id: generateEdgeId(),
        type: 'MENTIONS',
        from: nodeId,
        to: mention.entityId,
        properties: {
          field,
          confidence: mention.confidence,
          matchedText: mention.matchedText
        },
        provenance: { source: 'extractor' },
        status: 'approved',
        createdAt: new Date().toISOString()
      };
      
      // Check for duplicate (same from/to/field)
      const exists = graph.edges.some(
        e => e.type === 'MENTIONS' && 
             e.from === nodeId && 
             e.to === mention.entityId &&
             e.properties?.field === field
      );
      
      if (!exists) {
        graph.edges.push(edge);
        edgesCreated++;
      }
    }
  }
  
  return {
    edgesCreated,
    edgesRemoved,
    nodesProcessed: [nodeId]
  };
}

/**
 * Rebuild all MENTIONS edges in the graph.
 * Removes all existing MENTIONS edges, then recreates them from content.
 */
export function rebuildAllMentions(graph: GraphState): MentionRebuildResult {
  // Remove all existing MENTIONS edges
  const initialEdgeCount = graph.edges.length;
  graph.edges = graph.edges.filter(e => e.type !== 'MENTIONS');
  const edgesRemoved = initialEdgeCount - graph.edges.length;
  
  // Get all entities
  const entities = getAllEntities(graph);
  
  // Get all content nodes
  const allNodes = getAllNodes(graph);
  const contentNodes = allNodes.filter(n => EXTRACTABLE_FIELDS[n.type] !== undefined);
  
  let edgesCreated = 0;
  const nodesProcessed: string[] = [];
  
  for (const node of contentNodes) {
    const fields = EXTRACTABLE_FIELDS[node.type];
    if (!fields || fields.length === 0) continue;
    
    nodesProcessed.push(node.id);
    const data = node as unknown as Record<string, unknown>;
    
    for (const field of fields) {
      const value = data[field];
      let text = '';
      
      if (typeof value === 'string') {
        text = value;
      } else if (Array.isArray(value)) {
        text = value.filter(v => typeof v === 'string').join(' ');
      }
      
      if (!text) continue;
      
      const mentions = extractMentions(text, entities);
      
      for (const mention of mentions) {
        const edge: Edge = {
          id: generateEdgeId(),
          type: 'MENTIONS',
          from: node.id,
          to: mention.entityId,
          properties: {
            field,
            confidence: mention.confidence,
            matchedText: mention.matchedText
          },
          provenance: { source: 'extractor' },
          status: 'approved',
          createdAt: new Date().toISOString()
        };
        
        // Check for duplicate
        const exists = graph.edges.some(
          e => e.type === 'MENTIONS' && 
               e.from === node.id && 
               e.to === mention.entityId &&
               e.properties?.field === field
        );
        
        if (!exists) {
          graph.edges.push(edge);
          edgesCreated++;
        }
      }
    }
  }
  
  return {
    edgesCreated,
    edgesRemoved,
    nodesProcessed
  };
}
