/**
 * Idea handlers
 * POST /stories/:id/ideas - Create idea
 * GET /stories/:id/ideas - List ideas
 * GET /stories/:id/ideas/:ideaId - Get single
 * PATCH /stories/:id/ideas/:ideaId - Update properties
 * DELETE /stories/:id/ideas/:ideaId - Delete
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getNode,
  getNodesByType,
  applyPatch,
} from '@apollo/core';
import type { Patch, Idea } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, saveVersionedStateById, deserializeGraph, serializeGraph } from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse, NodeData } from '../types.js';

// =============================================================================
// Response Types
// =============================================================================

interface IdeaData extends NodeData {
  source: 'user' | 'ai';
  suggestedType?: string;
}

interface IdeasListData {
  ideas: IdeaData[];
  totalCount: number;
  limit: number;
  offset: number;
}

interface CreateIdeaData {
  idea: IdeaData;
  newVersionId: string;
}

interface UpdateIdeaData {
  idea: IdeaData;
  newVersionId: string;
  fieldsUpdated: string[];
}

interface DeleteIdeaData {
  deleted: true;
  newVersionId: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getIdeaLabel(idea: Idea): string {
  return idea.title || `Idea:${idea.id.slice(0, 8)}`;
}

function sanitizeIdeaData(idea: Idea): Record<string, unknown> {
  const { id, type, ...rest } = idea as unknown as Record<string, unknown>;
  return rest;
}

function toIdeaData(idea: Idea): IdeaData {
  return {
    id: idea.id,
    type: idea.type,
    label: getIdeaLabel(idea),
    data: sanitizeIdeaData(idea),
    source: idea.source,
    ...(idea.suggestedType && { suggestedType: idea.suggestedType }),
  };
}

// =============================================================================
// POST /stories/:id/ideas
// =============================================================================

interface CreateIdeaBody {
  title: string;
  description: string;
  source?: 'user' | 'ai';
  suggestedType?: 'PlotPoint' | 'Scene' | 'Character' | 'Location' | 'Object';
}

export function createIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, CreateIdeaBody>,
    res: Response<APIResponse<CreateIdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, description, source = 'user', suggestedType } = req.body;

      if (!title || title.trim() === '') {
        throw new BadRequestError('title is required');
      }

      if (!description || description.trim() === '') {
        throw new BadRequestError('description is required');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Generate IDs
      const timestamp = new Date().toISOString();
      const ideaId = `idea_${Date.now()}`;
      const patchId = `patch_idea_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Build the Idea node
      const idea: Idea = {
        type: 'Idea',
        id: ideaId,
        title: title.trim(),
        description: description.trim(),
        source,
        createdAt: timestamp,
      };

      if (suggestedType) idea.suggestedType = suggestedType;

      // Build patch operations
      const ops: Patch['ops'] = [
        { op: 'ADD_NODE', node: idea },
      ];

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops,
        metadata: {
          source: 'ideaHandler',
          action: 'create',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Created Idea: ${idea.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.status(201).json({
        success: true,
        data: {
          idea: toIdeaData(idea),
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// GET /stories/:id/ideas
// =============================================================================

interface ListIdeasQuery {
  source?: string;
  suggestedType?: string;
  limit?: string;
  offset?: string;
}

export function listIdeasHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, ListIdeasQuery>,
    res: Response<APIResponse<IdeasListData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { source, suggestedType, limit: limitStr, offset: offsetStr } = req.query;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Get all ideas
      let ideas = getNodesByType<Idea>(graph, 'Idea');

      // Apply filters
      if (source) {
        ideas = ideas.filter((i) => i.source === source);
      }
      if (suggestedType) {
        ideas = ideas.filter((i) => i.suggestedType === suggestedType);
      }

      // Sort by createdAt descending (newest first)
      ideas.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Apply pagination
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
      const totalCount = ideas.length;
      const paginatedIdeas = ideas.slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          ideas: paginatedIdeas.map(toIdeaData),
          totalCount,
          limit,
          offset,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// GET /stories/:id/ideas/:ideaId
// =============================================================================

export function getIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }>,
    res: Response<APIResponse<IdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const idea = getNode(graph, ideaId) as Idea | undefined;

      if (!idea || idea.type !== 'Idea') {
        throw new NotFoundError(`Idea "${ideaId}"`);
      }

      res.json({
        success: true,
        data: toIdeaData(idea),
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// PATCH /stories/:id/ideas/:ideaId
// =============================================================================

export function updateIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }, unknown, { changes: Record<string, unknown> }>,
    res: Response<APIResponse<UpdateIdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;
      const { changes } = req.body;

      if (!changes || Object.keys(changes).length === 0) {
        throw new BadRequestError('No changes provided');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const idea = getNode(graph, ideaId) as Idea | undefined;

      if (!idea || idea.type !== 'Idea') {
        throw new NotFoundError(`Idea "${ideaId}"`);
      }

      // Build UPDATE_NODE patch
      const timestamp = new Date().toISOString();
      const patchId = `patch_idea_update_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'UPDATE_NODE',
            id: ideaId,
            set: changes,
          },
        ],
        metadata: {
          source: 'ideaHandler',
          action: 'update',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Get updated node
      const updatedIdea = getNode(updatedGraph, ideaId) as Idea | undefined;
      if (!updatedIdea) {
        throw new Error('Failed to update idea');
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Updated Idea: ${updatedIdea.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          idea: toIdeaData(updatedIdea),
          newVersionId,
          fieldsUpdated: Object.keys(changes),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// DELETE /stories/:id/ideas/:ideaId
// =============================================================================

export function deleteIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }>,
    res: Response<APIResponse<DeleteIdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const idea = getNode(graph, ideaId) as Idea | undefined;

      if (!idea || idea.type !== 'Idea') {
        throw new NotFoundError(`Idea "${ideaId}"`);
      }

      // Build DELETE_NODE patch
      const timestamp = new Date().toISOString();
      const patchId = `patch_idea_delete_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [
          { op: 'DELETE_NODE', id: ideaId },
        ],
        metadata: {
          source: 'ideaHandler',
          action: 'delete',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Deleted Idea: ${idea.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          deleted: true,
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
