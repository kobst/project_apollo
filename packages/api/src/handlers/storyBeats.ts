/**
 * PlotPoint handlers
 * POST /stories/:id/plot-points - Create plot point
 * GET /stories/:id/plot-points - List with filters
 * GET /stories/:id/plot-points/:sbId - Get single
 * PATCH /stories/:id/plot-points/:sbId - Update properties
 * DELETE /stories/:id/plot-points/:sbId - Delete
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getNode,
  getNodesByType,
  applyPatch,
} from '@apollo/core';
import type { Patch, PlotPoint } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, saveVersionedStateById, deserializeGraph, serializeGraph } from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse, NodeData } from '../types.js';

// =============================================================================
// Response Types
// =============================================================================

interface PlotPointData extends NodeData {
  fulfillmentCount: number;
  alignedBeatId?: string | undefined;
}

interface PlotPointsListData {
  plotPoints: PlotPointData[];
  totalCount: number;
  limit: number;
  offset: number;
}

interface CreatePlotPointData {
  plotPoint: PlotPointData;
  newVersionId: string;
}

interface UpdatePlotPointData {
  plotPoint: PlotPointData;
  newVersionId: string;
  fieldsUpdated: string[];
}

interface DeletePlotPointData {
  deleted: true;
  newVersionId: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getPlotPointLabel(sb: PlotPoint): string {
  return sb.title || `PlotPoint:${sb.id.slice(0, 8)}`;
}

function sanitizePlotPointData(sb: PlotPoint): Record<string, unknown> {
  const { id, type, ...rest } = sb as unknown as Record<string, unknown>;
  return rest;
}

function toPlotPointData(sb: PlotPoint, fulfillmentCount: number, alignedBeatId?: string): PlotPointData {
  return {
    id: sb.id,
    type: sb.type,
    label: getPlotPointLabel(sb),
    data: sanitizePlotPointData(sb),
    fulfillmentCount,
    alignedBeatId,
  };
}

// =============================================================================
// POST /stories/:id/plot-points
// =============================================================================

interface CreatePlotPointBody {
  title: string;
  intent?: 'plot' | 'character' | 'tone';
  summary?: string;
  narrative_function?: import('@apollo/core').PlotPoint['narrative_function'];
  priority?: 'low' | 'medium' | 'high';
  urgency?: 'low' | 'medium' | 'high';
  stakes_change?: 'up' | 'down' | 'steady';
  act?: 1 | 2 | 3 | 4 | 5;
  alignToBeatId?: string;
}

export function createPlotPointHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, CreatePlotPointBody>,
    res: Response<APIResponse<CreatePlotPointData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, intent, summary, narrative_function, priority, urgency, stakes_change, act, alignToBeatId } = req.body;

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
      const plotPointId = `sb_${Date.now()}`;
      const patchId = `patch_sb_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Build the PlotPoint node
      const plotPoint: PlotPoint = {
        type: 'PlotPoint',
        id: plotPointId,
        title: title.trim(),
        status: 'proposed',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      if (summary) plotPoint.summary = summary;
      if (narrative_function) plotPoint.narrative_function = narrative_function;
      if (intent) plotPoint.intent = intent;
      if (priority) plotPoint.priority = priority;
      if (urgency) plotPoint.urgency = urgency;
      if (stakes_change) plotPoint.stakes_change = stakes_change;
      if (act) plotPoint.act = act;

      // Set alignedBeatId on the node if aligning to beat
      if (alignToBeatId) {
        (plotPoint as any).alignedBeatId = alignToBeatId;
      }

      // Build patch operations
      const ops: Patch['ops'] = [
        { op: 'ADD_NODE', node: plotPoint },
      ];

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops,
        metadata: {
          source: 'plotPointHandler',
          action: 'create',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Created PlotPoint: ${plotPoint.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.status(201).json({
        success: true,
        data: {
          plotPoint: toPlotPointData(plotPoint, 0, alignToBeatId),
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// GET /stories/:id/plot-points
// =============================================================================

interface ListPlotPointsQuery {
  status?: string;
  act?: string;
  intent?: string;
  unfulfilled?: string;
  limit?: string;
  offset?: string;
}

export function listPlotPointsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, ListPlotPointsQuery>,
    res: Response<APIResponse<PlotPointsListData>>,
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

      // Get all plot points
      let plotPoints = getNodesByType<PlotPoint>(graph, 'PlotPoint');

      // Apply filters
      if (status) {
        plotPoints = plotPoints.filter((sb) => sb.status === status);
      }
      if (act) {
        const actNum = parseInt(act, 10) as 1 | 2 | 3 | 4 | 5;
        plotPoints = plotPoints.filter((sb) => sb.act === actNum);
      }
      if (intent) {
        plotPoints = plotPoints.filter((sb) => sb.intent === intent);
      }
      if (unfulfilled === 'true') {
        plotPoints = plotPoints.filter((sb) => {
          const realizedByEdges = graph.edges.filter(
            (e) => e.type === 'REALIZED_BY' && e.from === sb.id
          );
          return realizedByEdges.length === 0;
        });
      }

      // Apply pagination
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
      const totalCount = plotPoints.length;
      const paginatedPlotPoints = plotPoints.slice(offset, offset + limit);

      // Convert to response format with fulfillment data
      const plotPointData: PlotPointData[] = paginatedPlotPoints.map((sb) => {
        const realizedByEdges = graph.edges.filter(
          (e) => e.type === 'REALIZED_BY' && e.from === sb.id
        );
        const alignedBeatId = (sb as any).alignedBeatId as string | undefined;
        return toPlotPointData(sb, realizedByEdges.length, alignedBeatId);
      });

      res.json({
        success: true,
        data: {
          plotPoints: plotPointData,
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
// GET /stories/:id/plot-points/:sbId
// =============================================================================

export function getPlotPointHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; sbId: string }>,
    res: Response<APIResponse<PlotPointData>>,
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
      const sb = getNode(graph, sbId) as PlotPoint | undefined;

      if (!sb || sb.type !== 'PlotPoint') {
        throw new NotFoundError(`PlotPoint "${sbId}"`);
      }

      const realizedByEdges = graph.edges.filter(
        (e) => e.type === 'REALIZED_BY' && e.from === sb.id
      );
      const alignedBeatId = (sb as any).alignedBeatId as string | undefined;

      res.json({
        success: true,
        data: toPlotPointData(sb, realizedByEdges.length, alignedBeatId),
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// PATCH /stories/:id/plot-points/:sbId
// =============================================================================

export function updatePlotPointHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; sbId: string }, unknown, { changes: Record<string, unknown> }>,
    res: Response<APIResponse<UpdatePlotPointData>>,
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
      const sb = getNode(graph, sbId) as PlotPoint | undefined;

      if (!sb || sb.type !== 'PlotPoint') {
        throw new NotFoundError(`PlotPoint "${sbId}"`);
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
          source: 'plotPointHandler',
          action: 'update',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Get updated node
      const updatedSB = getNode(updatedGraph, sbId) as PlotPoint | undefined;
      if (!updatedSB) {
        throw new Error('Failed to update plot point');
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Updated PlotPoint: ${updatedSB.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      const realizedByEdges = updatedGraph.edges.filter(
        (e) => e.type === 'REALIZED_BY' && e.from === sbId
      );
      const alignedBeatId = (updatedSB as any).alignedBeatId as string | undefined;

      res.json({
        success: true,
        data: {
          plotPoint: toPlotPointData(updatedSB, realizedByEdges.length, alignedBeatId),
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
// DELETE /stories/:id/plot-points/:sbId
// =============================================================================

export function deletePlotPointHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; sbId: string }>,
    res: Response<APIResponse<DeletePlotPointData>>,
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
      const sb = getNode(graph, sbId) as PlotPoint | undefined;

      if (!sb || sb.type !== 'PlotPoint') {
        throw new NotFoundError(`PlotPoint "${sbId}"`);
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
          source: 'plotPointHandler',
          action: 'delete',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Deleted PlotPoint: ${sb.title}`,
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
