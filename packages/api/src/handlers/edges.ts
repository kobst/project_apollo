/**
 * Edge CRUD handlers
 * GET /stories/:id/edges - List edges with optional filters
 * GET /stories/:id/edges/:edgeId - Get single edge
 * POST /stories/:id/edges - Create edge
 * PATCH /stories/:id/edges/:edgeId - Update edge
 * DELETE /stories/:id/edges/:edgeId - Delete edge
 * POST /stories/:id/edges:batch - Batch operations
 * POST /stories/:id/edges:upsert - Upsert edge
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getEdgeById,
  getEdgesWithFilters,
  applyPatch,
  type Edge,
  type EdgeType,
  type EdgeStatus,
  type EdgeProperties,
  type Patch,
  type PatchOp,
  generateEdgeId,
  computeOrder,
  applyOrderUpdates,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, saveVersionedStateById, deserializeGraph, serializeGraph } from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

// =============================================================================
// Response Types
// =============================================================================

interface EdgeData {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  properties?: EdgeProperties | undefined;
  provenance?: Edge['provenance'] | undefined;
  status?: EdgeStatus | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

interface EdgesListData {
  edges: EdgeData[];
  totalCount: number;
  limit: number;
  offset: number;
}

interface EdgeMutationData {
  edge: EdgeData;
  newVersionId: string;
}

interface BatchEdgeResult {
  added: number;
  updated: number;
  deleted: number;
  newVersionId: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function edgeToData(edge: Edge): EdgeData {
  return {
    id: edge.id,
    type: edge.type,
    from: edge.from,
    to: edge.to,
    properties: edge.properties,
    provenance: edge.provenance,
    status: edge.status,
    createdAt: edge.createdAt,
    updatedAt: edge.updatedAt,
  };
}

/**
 * Check if edge type affects ordering and recompute if needed.
 */
function recomputeOrderIfNeeded(graph: ReturnType<typeof deserializeGraph>, edgeType: EdgeType): ReturnType<typeof deserializeGraph> {
  if (edgeType === 'ALIGNS_WITH' || edgeType === 'SATISFIED_BY') {
    const orderResult = computeOrder(graph);
    if (orderResult.ops.length > 0) {
      return applyOrderUpdates(graph, orderResult);
    }
  }
  return graph;
}

// =============================================================================
// Handlers
// =============================================================================

/**
 * GET /stories/:id/edges
 * List edges with optional filters
 */
export function createListEdgesHandler(ctx: StorageContext) {
  return async (
    req: Request<
      { id: string },
      unknown,
      unknown,
      { type?: string; from?: string; to?: string; status?: string; limit?: string; offset?: string }
    >,
    res: Response<APIResponse<EdgesListData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { type, from, to, status, limit: limitStr, offset: offsetStr } = req.query;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Apply filters - only include defined properties
      const filters: Parameters<typeof getEdgesWithFilters>[1] = {};
      if (type) filters.type = type as EdgeType;
      if (from) filters.from = from;
      if (to) filters.to = to;
      if (status) filters.status = status as EdgeStatus;
      const edges = getEdgesWithFilters(graph, filters);

      // Apply pagination
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
      const totalCount = edges.length;
      const paginatedEdges = edges.slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          edges: paginatedEdges.map(edgeToData),
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

/**
 * GET /stories/:id/edges/:edgeId
 * Get single edge
 */
export function createGetEdgeHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; edgeId: string }>,
    res: Response<APIResponse<EdgeData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, edgeId } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const edge = getEdgeById(graph, edgeId);

      if (!edge) {
        throw new NotFoundError(`Edge "${edgeId}"`);
      }

      res.json({
        success: true,
        data: edgeToData(edge),
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * POST /stories/:id/edges
 * Create a new edge
 */
export function createAddEdgeHandler(ctx: StorageContext) {
  return async (
    req: Request<
      { id: string },
      unknown,
      {
        type: EdgeType;
        from: string;
        to: string;
        properties?: EdgeProperties;
        status?: EdgeStatus;
      }
    >,
    res: Response<APIResponse<EdgeMutationData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { type, from, to, properties, status } = req.body;

      if (!type || !from || !to) {
        throw new BadRequestError('Missing required fields: type, from, to');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const timestamp = new Date().toISOString();
      const edgeId = generateEdgeId();
      const newVersionId = `ver_${Date.now()}`;

      const edge: Edge = {
        id: edgeId,
        type,
        from,
        to,
        properties,
        provenance: { source: 'human' },
        status: status ?? 'approved',
        createdAt: timestamp,
      };

      const patch: Patch = {
        type: 'Patch',
        id: `patch_add_edge_${Date.now()}`,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [{ op: 'ADD_EDGE', edge }],
        metadata: { source: 'edgeAPI', action: 'addEdge' },
      };

      let updatedGraph = applyPatch(graph, patch);

      // Recompute order_index if this edge type affects ordering
      updatedGraph = recomputeOrderIfNeeded(updatedGraph, type);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Added edge: ${type} ${from} → ${to}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      await saveVersionedStateById(id, state, ctx);

      res.status(201).json({
        success: true,
        data: {
          edge: edgeToData(edge),
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * PATCH /stories/:id/edges/:edgeId
 * Update an edge's properties
 */
export function createUpdateEdgeHandler(ctx: StorageContext) {
  return async (
    req: Request<
      { id: string; edgeId: string },
      unknown,
      {
        set?: Partial<EdgeProperties>;
        unset?: (keyof EdgeProperties)[];
        status?: EdgeStatus;
      }
    >,
    res: Response<APIResponse<EdgeMutationData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, edgeId } = req.params;
      const { set, unset, status } = req.body;

      if (!set && !unset && !status) {
        throw new BadRequestError('No changes provided');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const existingEdge = getEdgeById(graph, edgeId);

      if (!existingEdge) {
        throw new NotFoundError(`Edge "${edgeId}"`);
      }

      const timestamp = new Date().toISOString();
      const newVersionId = `ver_${Date.now()}`;

      // Build UPDATE_EDGE op - only include defined properties
      const updateOp: PatchOp = {
        op: 'UPDATE_EDGE',
        id: edgeId,
        ...(set && { set }),
        ...(unset && { unset }),
        ...(status && { status }),
      };

      const patch: Patch = {
        type: 'Patch',
        id: `patch_update_edge_${Date.now()}`,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [updateOp],
        metadata: { source: 'edgeAPI', action: 'updateEdge' },
      };

      const updatedGraph = applyPatch(graph, patch);
      const updatedEdge = getEdgeById(updatedGraph, edgeId);

      if (!updatedEdge) {
        throw new Error('Failed to update edge');
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Updated edge: ${existingEdge.type} ${existingEdge.from} → ${existingEdge.to}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          edge: edgeToData(updatedEdge),
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * DELETE /stories/:id/edges/:edgeId
 * Delete an edge
 */
export function createDeleteEdgeHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; edgeId: string }>,
    res: Response<APIResponse<{ deleted: boolean; newVersionId: string }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, edgeId } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const existingEdge = getEdgeById(graph, edgeId);

      if (!existingEdge) {
        throw new NotFoundError(`Edge "${edgeId}"`);
      }

      const timestamp = new Date().toISOString();
      const newVersionId = `ver_${Date.now()}`;

      const patch: Patch = {
        type: 'Patch',
        id: `patch_delete_edge_${Date.now()}`,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [{ op: 'DELETE_EDGE', edge: { id: edgeId } }],
        metadata: { source: 'edgeAPI', action: 'deleteEdge' },
      };

      let updatedGraph = applyPatch(graph, patch);

      // Recompute order_index if this edge type affects ordering
      updatedGraph = recomputeOrderIfNeeded(updatedGraph, existingEdge.type);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Deleted edge: ${existingEdge.type} ${existingEdge.from} → ${existingEdge.to}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

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

/**
 * POST /stories/:id/edges:batch
 * Batch edge operations
 */
export function createBatchEdgesHandler(ctx: StorageContext) {
  return async (
    req: Request<
      { id: string },
      unknown,
      {
        adds?: Array<{
          type: EdgeType;
          from: string;
          to: string;
          properties?: EdgeProperties;
          status?: EdgeStatus;
        }>;
        updates?: Array<{
          id: string;
          set?: Partial<EdgeProperties>;
          unset?: (keyof EdgeProperties)[];
          status?: EdgeStatus;
        }>;
        deletes?: string[];
      }
    >,
    res: Response<APIResponse<BatchEdgeResult>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { adds, updates, deletes } = req.body;

      if ((!adds || adds.length === 0) && (!updates || updates.length === 0) && (!deletes || deletes.length === 0)) {
        throw new BadRequestError('No operations provided');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const timestamp = new Date().toISOString();
      const newVersionId = `ver_${Date.now()}`;

      // Build edge objects for adds
      const edgesToAdd: Edge[] = (adds ?? []).map((e) => ({
        id: generateEdgeId(),
        type: e.type,
        from: e.from,
        to: e.to,
        properties: e.properties,
        provenance: { source: 'human' as const },
        status: e.status ?? 'approved',
        createdAt: timestamp,
      }));

      // Build BATCH_EDGE op - only include defined arrays
      const batchOp: PatchOp = {
        op: 'BATCH_EDGE',
        ...(edgesToAdd.length > 0 && { adds: edgesToAdd }),
        ...(updates && updates.length > 0 && { updates }),
        ...(deletes && deletes.length > 0 && { deletes }),
      };

      const patch: Patch = {
        type: 'Patch',
        id: `patch_batch_edge_${Date.now()}`,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [batchOp],
        metadata: { source: 'edgeAPI', action: 'batchEdge' },
      };

      let updatedGraph = applyPatch(graph, patch);

      // Recompute order_index if any edges affect ordering
      const hasOrderingEdges = edgesToAdd.some(e => e.type === 'ALIGNS_WITH' || e.type === 'SATISFIED_BY') ||
        deletes?.some(id => {
          const edge = graph.edges.find(e => e.id === id);
          return edge && (edge.type === 'ALIGNS_WITH' || edge.type === 'SATISFIED_BY');
        });
      if (hasOrderingEdges) {
        const orderResult = computeOrder(updatedGraph);
        if (orderResult.ops.length > 0) {
          updatedGraph = applyOrderUpdates(updatedGraph, orderResult);
        }
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Batch edge operation: +${edgesToAdd.length} ~${updates?.length ?? 0} -${deletes?.length ?? 0}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          added: edgesToAdd.length,
          updated: updates?.length ?? 0,
          deleted: deletes?.length ?? 0,
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * POST /stories/:id/edges:upsert
 * Upsert an edge (insert if not exists, update if exists)
 */
export function createUpsertEdgeHandler(ctx: StorageContext) {
  return async (
    req: Request<
      { id: string },
      unknown,
      {
        type: EdgeType;
        from: string;
        to: string;
        properties?: EdgeProperties;
        status?: EdgeStatus;
      }
    >,
    res: Response<APIResponse<EdgeMutationData & { wasInsert: boolean }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { type, from, to, properties, status } = req.body;

      if (!type || !from || !to) {
        throw new BadRequestError('Missing required fields: type, from, to');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const timestamp = new Date().toISOString();
      const newVersionId = `ver_${Date.now()}`;

      // Check if edge exists by uniqueKey (type:from:to)
      const existingEdge = graph.edges.find(
        (e) => e.type === type && e.from === from && e.to === to
      );

      const edge: Edge = {
        id: existingEdge?.id ?? generateEdgeId(),
        type,
        from,
        to,
        properties,
        provenance: { source: 'human' },
        status: status ?? 'approved',
        createdAt: existingEdge?.createdAt ?? timestamp,
        updatedAt: existingEdge ? timestamp : undefined,
      };

      const patch: Patch = {
        type: 'Patch',
        id: `patch_upsert_edge_${Date.now()}`,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [{ op: 'UPSERT_EDGE', edge }],
        metadata: { source: 'edgeAPI', action: 'upsertEdge' },
      };

      let updatedGraph = applyPatch(graph, patch);

      // Recompute order_index if this edge type affects ordering
      updatedGraph = recomputeOrderIfNeeded(updatedGraph, type);

      const resultEdge = updatedGraph.edges.find(
        (e) => e.type === type && e.from === from && e.to === to
      );

      if (!resultEdge) {
        throw new Error('Failed to upsert edge');
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `${existingEdge ? 'Updated' : 'Added'} edge: ${type} ${from} → ${to}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          edge: edgeToData(resultEdge),
          newVersionId,
          wasInsert: !existingEdge,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
