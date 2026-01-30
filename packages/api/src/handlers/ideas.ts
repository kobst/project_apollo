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
import { findPackageInSession } from '../session.js';

// =============================================================================
// Response Types
// =============================================================================

interface IdeaData extends NodeData {
  source: 'user' | 'ai';
  suggestedType?: string;
  status?: 'active' | 'promoted' | 'dismissed';
  category?: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
  sourcePackageId?: string;
  relatedNodeIds?: string[];
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
    ...(idea.status && { status: idea.status }),
    ...(idea.category && { category: idea.category }),
    ...(idea.sourcePackageId && { sourcePackageId: idea.sourcePackageId }),
    ...(idea.relatedNodeIds && { relatedNodeIds: idea.relatedNodeIds }),
  };
}

// =============================================================================
// POST /stories/:id/ideas
// =============================================================================

interface CreateIdeaBody {
  title: string;
  description: string;
  source?: 'user' | 'ai';
  suggestedType?: 'StoryBeat' | 'Scene' | 'Character' | 'Location' | 'Object';
  status?: 'active' | 'promoted' | 'dismissed';
  category?: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
  sourcePackageId?: string;
  relatedNodeIds?: string[];
}

export function createIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, CreateIdeaBody>,
    res: Response<APIResponse<CreateIdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        source = 'user',
        suggestedType,
        status = 'active',
        category,
        sourcePackageId,
        relatedNodeIds,
      } = req.body;

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
        status,
        createdAt: timestamp,
      };

      if (suggestedType) idea.suggestedType = suggestedType;
      if (category) idea.category = category;
      if (sourcePackageId) idea.sourcePackageId = sourcePackageId;
      if (relatedNodeIds) idea.relatedNodeIds = relatedNodeIds;

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
  status?: string;
  category?: string;
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
      const { source, suggestedType, status, category, limit: limitStr, offset: offsetStr } = req.query;

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
      if (status) {
        ideas = ideas.filter((i) => (i.status || 'active') === status);
      }
      if (category) {
        ideas = ideas.filter((i) => i.category === category);
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

// =============================================================================
// POST /stories/:id/ideas/from-package
// =============================================================================

interface IdeaFromPackageBody {
  packageId: string;
  elementType: 'node' | 'edge' | 'storyContext';
  elementIndex?: number; // preferred selector
  elementId?: string;    // optional fallback for nodes
  title?: string;        // optional override
  description?: string;  // optional override
  category?: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
}

export function createIdeaFromPackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, IdeaFromPackageBody>,
    res: Response<APIResponse<CreateIdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { packageId, elementType, elementIndex, elementId, title, description, category } = req.body;

      if (!packageId || !elementType) {
        throw new BadRequestError('packageId and elementType are required');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');
      }
      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) throw new NotFoundError('Current version');

      // Locate package from active session
      const pkg = await findPackageInSession(id, packageId, ctx);
      if (!pkg) throw new NotFoundError(`Package "${packageId}"`);

      // Determine idea content from element
      let derivedTitle = title?.trim();
      let derivedDesc = description?.trim();
      let suggestedType: Idea['suggestedType'] | undefined;
      let relatedNodeIds: string[] | undefined;

      if (elementType === 'node') {
        const nc = typeof elementIndex === 'number'
          ? pkg.changes.nodes[elementIndex]
          : pkg.changes.nodes.find((n) => n.node_id === elementId);
        if (!nc) throw new NotFoundError('Package node element');
        suggestedType = nc.node_type as any;
        relatedNodeIds = [nc.node_id];
        const name = (nc.data?.name || nc.data?.title || nc.node_id);
        derivedTitle = derivedTitle || `${nc.operation.toUpperCase()} ${nc.node_type}: ${name}`;
        const summ = [
          `Operation: ${nc.operation}`,
          `Type: ${nc.node_type}`,
          `Id: ${nc.node_id}`,
          nc.data ? `Data: ${JSON.stringify(nc.data).slice(0, 400)}` : undefined,
        ].filter(Boolean).join('\n');
        derivedDesc = derivedDesc || `${pkg.title || 'Package'} → Node candidate\n\n${summ}`;
      } else if (elementType === 'edge') {
        const ec = typeof elementIndex === 'number'
          ? pkg.changes.edges[elementIndex]
          : undefined;
        if (!ec) throw new NotFoundError('Package edge element');
        suggestedType = undefined;
        relatedNodeIds = [ec.from, ec.to];
        derivedTitle = derivedTitle || `${ec.operation.toUpperCase()} EDGE: ${ec.edge_type}`;
        derivedDesc = derivedDesc || `${pkg.title || 'Package'} → Edge candidate\n\n${JSON.stringify(ec).slice(0, 500)}`;
      } else if (elementType === 'storyContext') {
        const sc = typeof elementIndex === 'number'
          ? (pkg.changes.storyContext ?? [])[elementIndex]
          : undefined;
        if (!sc) throw new NotFoundError('Package storyContext element');
        derivedTitle = derivedTitle || `StoryContext suggestion`;
        derivedDesc = derivedDesc || `${pkg.title || 'Package'} → StoryContext change\n\n${JSON.stringify(sc).slice(0, 500)}`;
      }

      if (!derivedTitle || !derivedDesc) {
        throw new BadRequestError('Failed to derive idea content; provide title/description');
      }

      // Build idea node and new version (reuse logic from createIdeaHandler)
      const graph = deserializeGraph(currentVersion.graph);
      const timestamp = new Date().toISOString();
      const ideaId = `idea_${Date.now()}`;
      const patchId = `patch_idea_from_pkg_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      const idea: Idea = {
        type: 'Idea',
        id: ideaId,
        title: derivedTitle,
        description: derivedDesc,
        source: 'ai',
        status: 'active',
        createdAt: timestamp,
        ...(suggestedType ? { suggestedType } : {}),
        ...(category ? { category } : {}),
        sourcePackageId: packageId,
        ...(relatedNodeIds ? { relatedNodeIds } : {}),
      };

      const ops: Patch['ops'] = [ { op: 'ADD_NODE', node: idea } ];
      const patch: Patch = {
        type: 'Patch', id: patchId, base_story_version_id: currentVersionId, created_at: timestamp, ops,
        metadata: { source: 'ideas.fromPackage', action: 'create' },
      };

      const updatedGraph = applyPatch(graph, patch);

      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Captured Idea from package: ${idea.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;
      await saveVersionedStateById(id, state, ctx);

      res.status(201).json({ success: true, data: { idea: toIdeaData(idea), newVersionId } });
    } catch (error) {
      next(error);
    }
  };
}
