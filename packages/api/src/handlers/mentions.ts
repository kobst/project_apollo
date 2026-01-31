/**
 * Mentions handlers
 * 
 * POST /stories/:id/entities/:entityId/rename - Rename entity with text propagation
 * POST /stories/:id/mentions/rebuild - Rebuild all MENTIONS edges
 * GET /stories/:id/mentions/validate - Validate temporal consistency
 * GET /stories/:id/entities/:entityId/mentions - Get mentions of an entity
 */

import type { Request, Response, NextFunction } from 'express';
import { mentions, applyPatch } from '@apollo/core';
import type { Patch, PatchOp } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  saveVersionedStateById,
  deserializeGraph,
  serializeGraph,
  loadGraphById
} from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

// =============================================================================
// Response Types
// =============================================================================

interface RenameEntityData {
  entityId: string;
  oldName: string;
  newName: string;
  textUpdatesCount: number;
  mentionsUpdated: number;
  mentionsRebuilt: boolean;
  affectedNodes: string[];
}

interface RebuildMentionsData {
  edgesCreated: number;
  edgesRemoved: number;
  nodesProcessed: number;
}

interface ValidateMentionsData {
  valid: boolean;
  violationCount: number;
  violations: mentions.TemporalViolation[];
}

interface EntityMentionsData {
  entityId: string;
  entityName: string;
  mentionCount: number;
  mentions: Array<{
    nodeId: string;
    nodeType: string;
    field: string;
    matchedText: string;
    confidence: number;
  }>;
}

// =============================================================================
// Rename Entity Handler
// =============================================================================

/**
 * POST /stories/:id/entities/:entityId/rename
 * Rename an entity and propagate changes to all text mentioning it.
 */
export function createRenameEntityHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; entityId: string }, unknown, { newName: string }>,
    res: Response<APIResponse<RenameEntityData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, entityId } = req.params;
      const { newName } = req.body;

      if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
        throw new BadRequestError('newName is required and must be a non-empty string');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Check entity exists
      const entity = graph.nodes.get(entityId);
      if (!entity) {
        throw new NotFoundError(`Entity "${entityId}"`);
      }

      // Perform the rename
      const result = mentions.renameEntity(graph, entityId, newName.trim());

      // Create a patch for the rename operation
      const patchOps: PatchOp[] = [];

      // Update the entity itself
      patchOps.push({
        op: 'MODIFY_NODE',
        nodeId: entityId,
        data: { name: newName.trim() }
      });

      // Update all affected nodes
      for (const update of result.textUpdates) {
        patchOps.push({
          op: 'MODIFY_NODE',
          nodeId: update.nodeId,
          data: { [update.field]: JSON.parse(update.newText) }
        });
      }

      // Apply patch if there are changes
      if (patchOps.length > 0) {
        const patch: Patch = {
          id: `patch_rename_${Date.now()}`,
          storyVersionId: state.history.currentVersionId,
          createdAt: new Date().toISOString(),
          description: `Renamed ${entityId} from "${result.oldName}" to "${result.newName}"`,
          ops: patchOps
        };

        // Save updated graph
        currentVersion.graph = serializeGraph(graph);
        currentVersion.updatedAt = new Date().toISOString();
        await saveVersionedStateById(id, state, ctx);
      }

      res.json({
        success: true,
        data: {
          entityId,
          oldName: result.oldName,
          newName: result.newName,
          textUpdatesCount: result.textUpdates.length,
          mentionsUpdated: result.mentionsUpdated,
          mentionsRebuilt: result.mentionsRebuilt,
          affectedNodes: result.textUpdates.map(u => u.nodeId)
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Rebuild Mentions Handler
// =============================================================================

/**
 * POST /stories/:id/mentions/rebuild
 * Rebuild all MENTIONS edges in the story.
 */
export function createRebuildMentionsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<RebuildMentionsData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Rebuild all mentions
      const result = mentions.rebuildAllMentions(graph);

      // Save updated graph
      currentVersion.graph = serializeGraph(graph);
      currentVersion.updatedAt = new Date().toISOString();
      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          edgesCreated: result.edgesCreated,
          edgesRemoved: result.edgesRemoved,
          nodesProcessed: result.nodesProcessed.length
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Validate Mentions Handler
// =============================================================================

/**
 * GET /stories/:id/mentions/validate
 * Validate temporal consistency of the story.
 */
export function createValidateMentionsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<ValidateMentionsData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const graph = await loadGraphById(id, ctx);
      if (!graph) {
        throw new NotFoundError(`Story "${id}"`);
      }

      // Validate temporal consistency
      const violations = mentions.validateTemporalConsistency(graph);

      res.json({
        success: true,
        data: {
          valid: violations.length === 0,
          violationCount: violations.length,
          violations
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Get Entity Mentions Handler
// =============================================================================

/**
 * GET /stories/:id/entities/:entityId/mentions
 * Get all nodes that mention a specific entity.
 */
export function createGetEntityMentionsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; entityId: string }>,
    res: Response<APIResponse<EntityMentionsData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, entityId } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Check entity exists
      const entity = graph.nodes.get(entityId);
      if (!entity) {
        throw new NotFoundError(`Entity "${entityId}"`);
      }

      // Get entity name
      const entityData = entity as unknown as Record<string, unknown>;
      const entityName = (entityData.name as string) || entityId;

      // Find all MENTIONS edges pointing to this entity
      const mentionEdges = graph.edges.filter(
        e => e.type === 'MENTIONS' && e.to === entityId
      );

      // Build mention details
      const mentionDetails = mentionEdges.map(edge => {
        const sourceNode = graph.nodes.get(edge.from);
        return {
          nodeId: edge.from,
          nodeType: sourceNode?.type || 'unknown',
          field: edge.properties?.field || 'unknown',
          matchedText: edge.properties?.matchedText || entityName,
          confidence: edge.properties?.confidence ?? 1.0
        };
      });

      res.json({
        success: true,
        data: {
          entityId,
          entityName,
          mentionCount: mentionDetails.length,
          mentions: mentionDetails
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Compute Introduction Points Handler
// =============================================================================

interface IntroductionPointsData {
  characters: Array<{
    id: string;
    name: string;
    introducedAtBeat: string | null;
    introducedAtPosition: number | null;
  }>;
}

/**
 * GET /stories/:id/mentions/introductions
 * Get when each character is first introduced.
 */
export function createGetIntroductionPointsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<IntroductionPointsData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const graph = await loadGraphById(id, ctx);
      if (!graph) {
        throw new NotFoundError(`Story "${id}"`);
      }

      // Compute introduction points
      const introductions = mentions.computeIntroductionPoints(graph);
      const beatOrder = mentions.getBeatOrder(graph);

      // Get all characters
      const characters: IntroductionPointsData['characters'] = [];
      for (const node of graph.nodes.values()) {
        if (node.type === 'Character') {
          const data = node as unknown as Record<string, unknown>;
          const name = (data.name as string) || node.id;
          const introBeat = introductions.get(node.id);
          const introPosition = introBeat ? beatOrder.get(introBeat) : null;

          characters.push({
            id: node.id,
            name,
            introducedAtBeat: introBeat || null,
            introducedAtPosition: introPosition ?? null
          });
        }
      }

      // Sort by introduction position (unintroduced last)
      characters.sort((a, b) => {
        if (a.introducedAtPosition === null) return 1;
        if (b.introducedAtPosition === null) return -1;
        return a.introducedAtPosition - b.introducedAtPosition;
      });

      res.json({
        success: true,
        data: { characters }
      });
    } catch (error) {
      next(error);
    }
  };
}
