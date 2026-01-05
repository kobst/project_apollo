/**
 * Node browsing handlers
 * GET /stories/:id/nodes - List nodes with optional type filter
 * GET /stories/:id/nodes/:nodeId - Get single node
 * GET /stories/:id/nodes/:nodeId/relations - Get node's edges and related nodes
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getNode,
  getNodesByType,
  getAllNodes,
  getEdgesFrom,
  getEdgesTo,
  applyPatch,
} from '@apollo/core';
import type { KGNode, Patch, PatchOp } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, saveVersionedStateById, deserializeGraph, serializeGraph } from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse, NodeData, NodesListData, NodeRelationsData } from '../types.js';

/**
 * GET /stories/:id/nodes
 * List nodes with optional type filter
 */
export function createListNodesHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, { type?: string; limit?: string; offset?: string }>,
    res: Response<APIResponse<NodesListData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { type, limit: limitStr, offset: offsetStr } = req.query;

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

      // Get nodes - filtered by type if specified
      let nodes: KGNode[];
      if (type) {
        nodes = getNodesByType(graph, type);
      } else {
        nodes = getAllNodes(graph);
      }

      // Apply pagination
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
      const totalCount = nodes.length;
      const paginatedNodes = nodes.slice(offset, offset + limit);

      // Convert to response format
      const nodeData: NodeData[] = paginatedNodes.map((node) => ({
        id: node.id,
        type: node.type,
        label: getNodeLabel(node),
        data: sanitizeNodeData(node),
      }));

      res.json({
        success: true,
        data: {
          nodes: nodeData,
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
 * GET /stories/:id/nodes/:nodeId
 * Get single node
 */
export function createGetNodeHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; nodeId: string }>,
    res: Response<APIResponse<NodeData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, nodeId } = req.params;

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
      const node = getNode(graph, nodeId);

      if (!node) {
        throw new NotFoundError(`Node "${nodeId}"`);
      }

      res.json({
        success: true,
        data: {
          id: node.id,
          type: node.type,
          label: getNodeLabel(node),
          data: sanitizeNodeData(node),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * GET /stories/:id/nodes/:nodeId/relations
 * Get node's edges and related nodes
 */
export function createNodeRelationsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; nodeId: string }>,
    res: Response<APIResponse<NodeRelationsData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, nodeId } = req.params;

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
      const node = getNode(graph, nodeId);

      if (!node) {
        throw new NotFoundError(`Node "${nodeId}"`);
      }

      // Get incoming and outgoing edges
      // Edge type uses 'from' and 'to', we map to 'source' and 'target' for API consistency
      const outgoingEdges = getEdgesFrom(graph, nodeId);
      const incomingEdges = getEdgesTo(graph, nodeId);

      // Get related nodes
      const relatedNodeIds = new Set<string>();
      outgoingEdges.forEach((edge) => relatedNodeIds.add(edge.to));
      incomingEdges.forEach((edge) => relatedNodeIds.add(edge.from));

      const relatedNodes: NodeData[] = [];
      relatedNodeIds.forEach((relatedId) => {
        const relatedNode = getNode(graph, relatedId);
        if (relatedNode) {
          relatedNodes.push({
            id: relatedNode.id,
            type: relatedNode.type,
            label: getNodeLabel(relatedNode),
            data: sanitizeNodeData(relatedNode),
          });
        }
      });

      res.json({
        success: true,
        data: {
          node: {
            id: node.id,
            type: node.type,
            label: getNodeLabel(node),
            data: sanitizeNodeData(node),
          },
          outgoing: outgoingEdges.map((edge) => ({
            type: edge.type,
            source: edge.from,
            target: edge.to,
          })),
          incoming: incomingEdges.map((edge) => ({
            type: edge.type,
            source: edge.from,
            target: edge.to,
          })),
          relatedNodes,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Get a human-readable label for a node
 */
function getNodeLabel(node: KGNode): string {
  // Check for common label properties
  const labelProps = ['name', 'title', 'label', 'beatName', 'heading'];
  const nodeRecord = node as unknown as Record<string, unknown>;
  for (const prop of labelProps) {
    if (prop in nodeRecord && typeof nodeRecord[prop] === 'string') {
      return nodeRecord[prop] as string;
    }
  }

  // For Scene nodes, try scene_overview truncated as fallback
  if (node.type === 'Scene' && 'scene_overview' in nodeRecord) {
    const overview = nodeRecord.scene_overview as string;
    if (overview) {
      return overview.slice(0, 50) + (overview.length > 50 ? '...' : '');
    }
  }

  // Fallback to type + id
  return `${node.type}:${node.id.slice(0, 8)}`;
}

/**
 * Sanitize node data for API response (remove internal fields)
 */
function sanitizeNodeData(node: KGNode): Record<string, unknown> {
  const nodeRecord = node as unknown as Record<string, unknown>;
  const { id, type, ...rest } = nodeRecord;
  return rest;
}

/**
 * Update node response type
 */
interface UpdateNodeData {
  node: NodeData;
  newVersionId: string;
  fieldsUpdated: string[];
}

/**
 * PATCH /stories/:id/nodes/:nodeId
 * Update a node's fields
 */
export function createUpdateNodeHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; nodeId: string }, unknown, { changes: Record<string, unknown> }>,
    res: Response<APIResponse<UpdateNodeData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, nodeId } = req.params;
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
      const node = getNode(graph, nodeId);

      if (!node) {
        throw new NotFoundError(`Node "${nodeId}"`);
      }

      // Build UPDATE_NODE patch op
      const timestamp = new Date().toISOString();
      const patchId = `patch_update_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      const updateOp: PatchOp = {
        op: 'UPDATE_NODE',
        id: nodeId,
        set: changes,
      };

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [updateOp],
        metadata: {
          source: 'nodeEditor',
          action: 'updateNode',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Get updated node
      const updatedNode = getNode(updatedGraph, nodeId);
      if (!updatedNode) {
        throw new Error('Failed to update node');
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Updated ${node.type}: ${getNodeLabel(node)}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          node: {
            id: updatedNode.id,
            type: updatedNode.type,
            label: getNodeLabel(updatedNode),
            data: sanitizeNodeData(updatedNode),
          },
          newVersionId,
          fieldsUpdated: Object.keys(changes),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
