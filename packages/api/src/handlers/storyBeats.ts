/**
 * StoryBeat handlers
 * POST /stories/:id/story-beats - Create story beat
 * GET /stories/:id/story-beats - List with filters
 * GET /stories/:id/story-beats/:sbId - Get single
 * PATCH /stories/:id/story-beats/:sbId - Update properties
 * DELETE /stories/:id/story-beats/:sbId - Delete
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getNode,
  getNodesByType,
  applyPatch,
  generateEdgeId,
} from '@apollo/core';
import type { Patch, StoryBeat } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, saveVersionedStateById, deserializeGraph, serializeGraph } from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse, NodeData } from '../types.js';

// =============================================================================
// Response Types
// =============================================================================

interface StoryBeatData extends NodeData {
  fulfillmentCount: number;
  alignedBeatId?: string | undefined;
}

interface StoryBeatsListData {
  storyBeats: StoryBeatData[];
  totalCount: number;
  limit: number;
  offset: number;
}

interface CreateStoryBeatData {
  storyBeat: StoryBeatData;
  newVersionId: string;
}

interface UpdateStoryBeatData {
  storyBeat: StoryBeatData;
  newVersionId: string;
  fieldsUpdated: string[];
}

interface DeleteStoryBeatData {
  deleted: true;
  newVersionId: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getStoryBeatLabel(sb: StoryBeat): string {
  return sb.title || `StoryBeat:${sb.id.slice(0, 8)}`;
}

function sanitizeStoryBeatData(sb: StoryBeat): Record<string, unknown> {
  const { id, type, ...rest } = sb as unknown as Record<string, unknown>;
  return rest;
}

function toStoryBeatData(sb: StoryBeat, fulfillmentCount: number, alignedBeatId?: string): StoryBeatData {
  return {
    id: sb.id,
    type: sb.type,
    label: getStoryBeatLabel(sb),
    data: sanitizeStoryBeatData(sb),
    fulfillmentCount,
    alignedBeatId,
  };
}

// =============================================================================
// POST /stories/:id/story-beats
// =============================================================================

interface CreateStoryBeatBody {
  title: string;
  intent?: 'plot' | 'character' | 'tone';
  summary?: string;
  priority?: 'low' | 'medium' | 'high';
  urgency?: 'low' | 'medium' | 'high';
  stakes_change?: 'up' | 'down' | 'steady';
  act?: 1 | 2 | 3 | 4 | 5;
  alignToBeatId?: string;
}

export function createStoryBeatHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, CreateStoryBeatBody>,
    res: Response<APIResponse<CreateStoryBeatData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, intent, summary, priority, urgency, stakes_change, act, alignToBeatId } = req.body;

      if (!title || title.trim() === '') {
        throw new BadRequestError('title is required');
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

      // If aligning to beat, verify beat exists
      if (alignToBeatId) {
        const beat = getNode(graph, alignToBeatId);
        if (!beat || beat.type !== 'Beat') {
          throw new NotFoundError(`Beat "${alignToBeatId}"`);
        }
      }

      // Generate IDs
      const timestamp = new Date().toISOString();
      const storyBeatId = `sb_${Date.now()}`;
      const patchId = `patch_sb_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Build the StoryBeat node
      const storyBeat: StoryBeat = {
        type: 'StoryBeat',
        id: storyBeatId,
        title: title.trim(),
        status: 'proposed',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      if (summary) storyBeat.summary = summary;
      if (intent) storyBeat.intent = intent;
      if (priority) storyBeat.priority = priority;
      if (urgency) storyBeat.urgency = urgency;
      if (stakes_change) storyBeat.stakes_change = stakes_change;
      if (act) storyBeat.act = act;

      // Build patch operations
      const ops: Patch['ops'] = [
        { op: 'ADD_NODE', node: storyBeat },
      ];

      // Add ALIGNS_WITH edge if aligning to beat
      if (alignToBeatId) {
        ops.push({
          op: 'ADD_EDGE',
          edge: {
            id: generateEdgeId(),
            type: 'ALIGNS_WITH',
            from: storyBeatId,
            to: alignToBeatId,
          },
        });
      }

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops,
        metadata: {
          source: 'storyBeatHandler',
          action: 'create',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Created StoryBeat: ${storyBeat.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.status(201).json({
        success: true,
        data: {
          storyBeat: toStoryBeatData(storyBeat, 0, alignToBeatId),
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// GET /stories/:id/story-beats
// =============================================================================

interface ListStoryBeatsQuery {
  status?: string;
  act?: string;
  intent?: string;
  unfulfilled?: string;
  limit?: string;
  offset?: string;
}

export function listStoryBeatsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, ListStoryBeatsQuery>,
    res: Response<APIResponse<StoryBeatsListData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, act, intent, unfulfilled, limit: limitStr, offset: offsetStr } = req.query;

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

      // Get all story beats
      let storyBeats = getNodesByType<StoryBeat>(graph, 'StoryBeat');

      // Apply filters
      if (status) {
        storyBeats = storyBeats.filter((sb) => sb.status === status);
      }
      if (act) {
        const actNum = parseInt(act, 10) as 1 | 2 | 3 | 4 | 5;
        storyBeats = storyBeats.filter((sb) => sb.act === actNum);
      }
      if (intent) {
        storyBeats = storyBeats.filter((sb) => sb.intent === intent);
      }
      if (unfulfilled === 'true') {
        storyBeats = storyBeats.filter((sb) => {
          const satisfiedByEdges = graph.edges.filter(
            (e) => e.type === 'SATISFIED_BY' && e.from === sb.id
          );
          return satisfiedByEdges.length === 0;
        });
      }

      // Apply pagination
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
      const totalCount = storyBeats.length;
      const paginatedStoryBeats = storyBeats.slice(offset, offset + limit);

      // Convert to response format with fulfillment data
      const storyBeatData: StoryBeatData[] = paginatedStoryBeats.map((sb) => {
        const satisfiedByEdges = graph.edges.filter(
          (e) => e.type === 'SATISFIED_BY' && e.from === sb.id
        );
        const alignsWithEdge = graph.edges.find(
          (e) => e.type === 'ALIGNS_WITH' && e.from === sb.id
        );
        return toStoryBeatData(sb, satisfiedByEdges.length, alignsWithEdge?.to);
      });

      res.json({
        success: true,
        data: {
          storyBeats: storyBeatData,
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
// GET /stories/:id/story-beats/:sbId
// =============================================================================

export function getStoryBeatHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; sbId: string }>,
    res: Response<APIResponse<StoryBeatData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, sbId } = req.params;

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
      const sb = getNode(graph, sbId) as StoryBeat | undefined;

      if (!sb || sb.type !== 'StoryBeat') {
        throw new NotFoundError(`StoryBeat "${sbId}"`);
      }

      const satisfiedByEdges = graph.edges.filter(
        (e) => e.type === 'SATISFIED_BY' && e.from === sb.id
      );
      const alignsWithEdge = graph.edges.find(
        (e) => e.type === 'ALIGNS_WITH' && e.from === sb.id
      );

      res.json({
        success: true,
        data: toStoryBeatData(sb, satisfiedByEdges.length, alignsWithEdge?.to),
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// PATCH /stories/:id/story-beats/:sbId
// =============================================================================

export function updateStoryBeatHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; sbId: string }, unknown, { changes: Record<string, unknown> }>,
    res: Response<APIResponse<UpdateStoryBeatData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, sbId } = req.params;
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
      const sb = getNode(graph, sbId) as StoryBeat | undefined;

      if (!sb || sb.type !== 'StoryBeat') {
        throw new NotFoundError(`StoryBeat "${sbId}"`);
      }

      // Build UPDATE_NODE patch
      const timestamp = new Date().toISOString();
      const patchId = `patch_sb_update_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Add updatedAt to changes
      const updatedChanges = { ...changes, updatedAt: timestamp };

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'UPDATE_NODE',
            id: sbId,
            set: updatedChanges,
          },
        ],
        metadata: {
          source: 'storyBeatHandler',
          action: 'update',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Get updated node
      const updatedSB = getNode(updatedGraph, sbId) as StoryBeat | undefined;
      if (!updatedSB) {
        throw new Error('Failed to update story beat');
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Updated StoryBeat: ${updatedSB.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      const satisfiedByEdges = updatedGraph.edges.filter(
        (e) => e.type === 'SATISFIED_BY' && e.from === sbId
      );
      const alignsWithEdge = updatedGraph.edges.find(
        (e) => e.type === 'ALIGNS_WITH' && e.from === sbId
      );

      res.json({
        success: true,
        data: {
          storyBeat: toStoryBeatData(updatedSB, satisfiedByEdges.length, alignsWithEdge?.to),
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
// DELETE /stories/:id/story-beats/:sbId
// =============================================================================

export function deleteStoryBeatHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; sbId: string }>,
    res: Response<APIResponse<DeleteStoryBeatData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, sbId } = req.params;

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
      const sb = getNode(graph, sbId) as StoryBeat | undefined;

      if (!sb || sb.type !== 'StoryBeat') {
        throw new NotFoundError(`StoryBeat "${sbId}"`);
      }

      // Build DELETE_NODE patch (also removes connected edges)
      const timestamp = new Date().toISOString();
      const patchId = `patch_sb_delete_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Find all edges connected to this node
      const connectedEdges = graph.edges.filter(
        (e) => e.from === sbId || e.to === sbId
      );

      const ops: Patch['ops'] = [
        // Delete connected edges first
        ...connectedEdges.map((e) => ({
          op: 'DELETE_EDGE' as const,
          edge: { id: e.id },
        })),
        // Then delete the node
        { op: 'DELETE_NODE' as const, id: sbId },
      ];

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops,
        metadata: {
          source: 'storyBeatHandler',
          action: 'delete',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Deleted StoryBeat: ${sb.title}`,
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
