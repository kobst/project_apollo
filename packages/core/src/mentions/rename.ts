/**
 * Entity renaming with text propagation.
 */

import type { GraphState } from '../core/graph.js';
import { getNode, getEdgesByType } from '../core/graph.js';
import { escapeRegex } from './utils.js';
import { rebuildAllMentions } from './rebuild.js';

/**
 * A text field that was updated during rename.
 */
export interface TextUpdate {
  nodeId: string;
  nodeType: string;
  field: string;
  oldText: string;
  newText: string;
  matchCount: number;
}

/**
 * Result of a rename operation.
 */
export interface RenameResult {
  /** Entity ID that was renamed */
  entityId: string;
  /** Old name */
  oldName: string;
  /** New name */
  newName: string;
  /** Text fields that were updated */
  textUpdates: TextUpdate[];
  /** Total number of text occurrences replaced */
  totalReplacements: number;
  /** Number of MENTIONS edges updated */
  mentionsUpdated: number;
  /** Whether a full mentions rebuild was performed */
  mentionsRebuilt: boolean;
}

/**
 * Replace name in text while preserving possessive forms.
 */
function replaceName(text: string, oldName: string, newName: string): { newText: string; count: number } {
  let count = 0;
  let newText = text;
  
  // Replace possessive form first (to avoid double-replacing)
  const possessivePattern = new RegExp(`\\b${escapeRegex(oldName)}'s\\b`, 'g');
  newText = newText.replace(possessivePattern, () => {
    count++;
    return `${newName}'s`;
  });
  
  // Replace non-possessive form
  const basePattern = new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'g');
  newText = newText.replace(basePattern, () => {
    count++;
    return newName;
  });
  
  return { newText, count };
}

/**
 * Get the name field for an entity node.
 */
function getEntityName(node: unknown): string | undefined {
  const data = node as Record<string, unknown>;
  return data.name as string | undefined;
}

/**
 * Set the name field for an entity node.
 */
function setEntityName(node: unknown, newName: string): void {
  const data = node as Record<string, unknown>;
  data.name = newName;
}

/**
 * Rename an entity and propagate the change to all mentions.
 * 
 * @param graph - The graph state (will be mutated)
 * @param entityId - ID of the entity to rename
 * @param newName - New name for the entity
 * @returns Result of the rename operation
 */
export function renameEntity(
  graph: GraphState,
  entityId: string,
  newName: string
): RenameResult {
  const node = getNode(graph, entityId);
  if (!node) {
    throw new Error(`Entity not found: ${entityId}`);
  }
  
  const oldName = getEntityName(node);
  if (!oldName) {
    throw new Error(`Entity ${entityId} has no name field`);
  }
  
  if (oldName === newName) {
    return {
      entityId,
      oldName,
      newName,
      textUpdates: [],
      totalReplacements: 0,
      mentionsUpdated: 0,
      mentionsRebuilt: false
    };
  }
  
  // Update the entity's name
  setEntityName(node, newName);
  
  // Find all MENTIONS edges pointing to this entity
  const mentionsEdges = getEdgesByType(graph, 'MENTIONS');
  const mentioningSources = new Set<string>();
  
  for (const edge of mentionsEdges) {
    if (edge.to === entityId) {
      mentioningSources.add(edge.from);
    }
  }
  
  // Update text in all nodes that mention this entity
  const textUpdates: TextUpdate[] = [];
  let totalReplacements = 0;
  
  for (const sourceId of mentioningSources) {
    const sourceNode = getNode(graph, sourceId);
    if (!sourceNode) continue;
    
    const data = sourceNode as unknown as Record<string, unknown>;
    
    // Update text fields
    for (const [field, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        const { newText, count } = replaceName(value, oldName, newName);
        if (count > 0) {
          data[field] = newText;
          textUpdates.push({
            nodeId: sourceId,
            nodeType: sourceNode.type,
            field,
            oldText: value,
            newText,
            matchCount: count
          });
          totalReplacements += count;
        }
      } else if (Array.isArray(value)) {
        // Handle array fields like key_actions
        let arrayUpdated = false;
        const newArray = value.map((item) => {
          if (typeof item === 'string') {
            const { newText, count } = replaceName(item, oldName, newName);
            if (count > 0) {
              arrayUpdated = true;
              totalReplacements += count;
              return newText;
            }
          }
          return item;
        });
        
        if (arrayUpdated) {
          const oldValue = JSON.stringify(value);
          data[field] = newArray;
          textUpdates.push({
            nodeId: sourceId,
            nodeType: sourceNode.type,
            field,
            oldText: oldValue,
            newText: JSON.stringify(newArray),
            matchCount: totalReplacements
          });
        }
      }
    }
  }
  
  // Update matchedText in MENTIONS edges
  let mentionsUpdated = 0;
  for (const edge of mentionsEdges) {
    if (edge.to === entityId && edge.properties?.matchedText) {
      const { newText, count } = replaceName(edge.properties.matchedText, oldName, newName);
      if (count > 0) {
        edge.properties.matchedText = newText;
        mentionsUpdated++;
      }
    }
  }
  
  // Optionally rebuild all mentions to catch any new matches with the new name
  // This is important if the new name might match additional content
  const needsRebuild = newName.length !== oldName.length || 
                       newName.split(/\s+/).length !== oldName.split(/\s+/).length;
  
  if (needsRebuild) {
    rebuildAllMentions(graph);
  }
  
  return {
    entityId,
    oldName,
    newName,
    textUpdates,
    totalReplacements,
    mentionsUpdated,
    mentionsRebuilt: needsRebuild
  };
}
