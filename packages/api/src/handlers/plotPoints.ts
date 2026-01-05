/**
 * PlotPoint handlers
 * POST /stories/:id/plot-points - Create plot point
 * GET /stories/:id/plot-points - List with filters
 * GET /stories/:id/plot-points/:ppId - Get single
 * PATCH /stories/:id/plot-points/:ppId - Update properties
 * DELETE /stories/:id/plot-points/:ppId - Delete
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getNode,
  getNodesByType,
  applyPatch,
  generateEdgeId,
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

function getPlotPointLabel(pp: PlotPoint): string {
  return pp.title || `PlotPoint:${pp.id.slice(0, 8)}`;
}

function sanitizePlotPointData(pp: PlotPoint): Record<string, unknown> {
  const { id, type, ...rest } = pp as unknown as Record<string, unknown>;
  return rest;
}

function toPlotPointData(pp: PlotPoint, fulfillmentCount: number, alignedBeatId?: string): PlotPointData {
  return {
    id: pp.id,
    type: pp.type,
    label: getPlotPointLabel(pp),
    data: sanitizePlotPointData(pp),
    fulfillmentCount,
    alignedBeatId,
  };
}

// =============================================================================
// POST /stories/:id/plot-points
// =============================================================================

interface CreatePlotPointBody {
  title: string;
  intent: 'plot' | 'character' | 'theme' | 'tone';
  summary?: string;
  criteria_of_satisfaction?: string;
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
      const { title, intent, summary, criteria_of_satisfaction, priority, urgency, stakes_change, act, alignToBeatId } = req.body;

      if (!title || title.trim() === '') {
        throw new BadRequestError('title is required');
      }

      if (!intent) {
        throw new BadRequestError('intent is required');
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
      const plotPointId = `pp_${Date.now()}`;
      const patchId = `patch_pp_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Build the PlotPoint node
      const plotPoint: PlotPoint = {
        type: 'PlotPoint',
        id: plotPointId,
        title: title.trim(),
        intent,
        status: 'proposed',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      if (summary) plotPoint.summary = summary;
      if (criteria_of_satisfaction) plotPoint.criteria_of_satisfaction = criteria_of_satisfaction;
      if (priority) plotPoint.priority = priority;
      if (urgency) plotPoint.urgency = urgency;
      if (stakes_change) plotPoint.stakes_change = stakes_change;
      if (act) plotPoint.act = act;

      // Build patch operations
      const ops: Patch['ops'] = [
        { op: 'ADD_NODE', node: plotPoint },
      ];

      // Add ALIGNS_WITH edge if aligning to beat
      if (alignToBeatId) {
        ops.push({
          op: 'ADD_EDGE',
          edge: {
            id: generateEdgeId(),
            type: 'ALIGNS_WITH',
            from: plotPointId,
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
        plotPoints = plotPoints.filter((pp) => pp.status === status);
      }
      if (act) {
        const actNum = parseInt(act, 10) as 1 | 2 | 3 | 4 | 5;
        plotPoints = plotPoints.filter((pp) => pp.act === actNum);
      }
      if (intent) {
        plotPoints = plotPoints.filter((pp) => pp.intent === intent);
      }
      if (unfulfilled === 'true') {
        plotPoints = plotPoints.filter((pp) => {
          const satisfiedByEdges = graph.edges.filter(
            (e) => e.type === 'SATISFIED_BY' && e.from === pp.id
          );
          return satisfiedByEdges.length === 0;
        });
      }

      // Apply pagination
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
      const totalCount = plotPoints.length;
      const paginatedPlotPoints = plotPoints.slice(offset, offset + limit);

      // Convert to response format with fulfillment data
      const plotPointData: PlotPointData[] = paginatedPlotPoints.map((pp) => {
        const satisfiedByEdges = graph.edges.filter(
          (e) => e.type === 'SATISFIED_BY' && e.from === pp.id
        );
        const alignsWithEdge = graph.edges.find(
          (e) => e.type === 'ALIGNS_WITH' && e.from === pp.id
        );
        return toPlotPointData(pp, satisfiedByEdges.length, alignsWithEdge?.to);
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
// GET /stories/:id/plot-points/:ppId
// =============================================================================

export function getPlotPointHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ppId: string }>,
    res: Response<APIResponse<PlotPointData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ppId } = req.params;

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
      const pp = getNode(graph, ppId) as PlotPoint | undefined;

      if (!pp || pp.type !== 'PlotPoint') {
        throw new NotFoundError(`PlotPoint "${ppId}"`);
      }

      const satisfiedByEdges = graph.edges.filter(
        (e) => e.type === 'SATISFIED_BY' && e.from === pp.id
      );
      const alignsWithEdge = graph.edges.find(
        (e) => e.type === 'ALIGNS_WITH' && e.from === pp.id
      );

      res.json({
        success: true,
        data: toPlotPointData(pp, satisfiedByEdges.length, alignsWithEdge?.to),
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// PATCH /stories/:id/plot-points/:ppId
// =============================================================================

export function updatePlotPointHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ppId: string }, unknown, { changes: Record<string, unknown> }>,
    res: Response<APIResponse<UpdatePlotPointData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ppId } = req.params;
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
      const pp = getNode(graph, ppId) as PlotPoint | undefined;

      if (!pp || pp.type !== 'PlotPoint') {
        throw new NotFoundError(`PlotPoint "${ppId}"`);
      }

      // Build UPDATE_NODE patch
      const timestamp = new Date().toISOString();
      const patchId = `patch_pp_update_${Date.now()}`;
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
            id: ppId,
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
      const updatedPP = getNode(updatedGraph, ppId) as PlotPoint | undefined;
      if (!updatedPP) {
        throw new Error('Failed to update plot point');
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Updated PlotPoint: ${updatedPP.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      const satisfiedByEdges = updatedGraph.edges.filter(
        (e) => e.type === 'SATISFIED_BY' && e.from === ppId
      );
      const alignsWithEdge = updatedGraph.edges.find(
        (e) => e.type === 'ALIGNS_WITH' && e.from === ppId
      );

      res.json({
        success: true,
        data: {
          plotPoint: toPlotPointData(updatedPP, satisfiedByEdges.length, alignsWithEdge?.to),
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
// DELETE /stories/:id/plot-points/:ppId
// =============================================================================

export function deletePlotPointHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ppId: string }>,
    res: Response<APIResponse<DeletePlotPointData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ppId } = req.params;

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
      const pp = getNode(graph, ppId) as PlotPoint | undefined;

      if (!pp || pp.type !== 'PlotPoint') {
        throw new NotFoundError(`PlotPoint "${ppId}"`);
      }

      // Build DELETE_NODE patch (also removes connected edges)
      const timestamp = new Date().toISOString();
      const patchId = `patch_pp_delete_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Find all edges connected to this node
      const connectedEdges = graph.edges.filter(
        (e) => e.from === ppId || e.to === ppId
      );

      const ops: Patch['ops'] = [
        // Delete connected edges first
        ...connectedEdges.map((e) => ({
          op: 'DELETE_EDGE' as const,
          edge: { id: e.id },
        })),
        // Then delete the node
        { op: 'DELETE_NODE' as const, id: ppId },
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
        label: `Deleted PlotPoint: ${pp.title}`,
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
