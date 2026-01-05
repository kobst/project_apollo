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
  const nodeRecord = node as unknown as Record<string, unknown>;

  // For Beat nodes, use beat_type formatted nicely (e.g., "Midpoint", "All Is Lost")
  if (node.type === 'Beat' && typeof nodeRecord.beat_type === 'string') {
    // Convert camelCase to Title Case with spaces (e.g., "AllIsLost" -> "All Is Lost")
    const beatType = nodeRecord.beat_type as string;
    const formatted = beatType
      .replace(/([A-Z])/g, ' $1')
      .replace(/^[\s]/, '')
      .replace('And', '&')
      .trim();
    return formatted;
  }

  // For Premise nodes, use logline truncated
  if (node.type === 'Premise' && typeof nodeRecord.logline === 'string') {
    const logline = nodeRecord.logline as string;
    if (logline.length > 50) {
      return logline.slice(0, 47) + '...';
    }
    return logline;
  }

  // For GenreTone nodes, combine genre and tone
  if (node.type === 'GenreTone') {
    const parts: string[] = [];
    if (typeof nodeRecord.genre === 'string') {
      parts.push(nodeRecord.genre);
    }
    if (typeof nodeRecord.tone === 'string') {
      parts.push(nodeRecord.tone);
    }
    if (parts.length > 0) {
      return parts.join(' / ');
    }
    if (typeof nodeRecord.tone_description === 'string') {
      const desc = nodeRecord.tone_description as string;
      return desc.length > 50 ? desc.slice(0, 47) + '...' : desc;
    }
    return 'Genre/Tone';
  }

  // Check for common label properties
  const labelProps = ['name', 'title', 'label', 'beatName', 'heading', 'statement'];
  for (const prop of labelProps) {
    if (prop in nodeRecord && typeof nodeRecord[prop] === 'string') {
      const value = nodeRecord[prop] as string;
      // Truncate long labels (e.g., theme statements)
      if (value.length > 60) {
        return value.slice(0, 57) + '...';
      }
      return value;
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
 * Delete node response type
 */
interface DeleteNodeData {
  deletedNode: NodeData;
  deletedEdgeCount: number;
  newVersionId: string;
}

/**
 * Connected nodes info for delete confirmation
 */
interface ConnectedNodesData {
  node: NodeData;
  connectedNodes: Array<{
    node: NodeData;
    edgeType: string;
    direction: 'outgoing' | 'incoming';
    /** Total edges this connected node has (including to the node being deleted) */
    totalConnections: number;
    /** True if deleting the parent node will leave this node with 0 connections */
    willBeOrphaned: boolean;
  }>;
  edgeCount: number;
  /** Count of nodes that will become orphaned (0 connections after deletion) */
  orphanCount: number;
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

/**
 * GET /stories/:id/nodes/:nodeId/connected
 * Get connected nodes info for delete confirmation
 */
export function createGetConnectedNodesHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; nodeId: string }>,
    res: Response<APIResponse<ConnectedNodesData>>,
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

      // Get all connected edges to/from the node being deleted
      const outgoingEdges = getEdgesFrom(graph, nodeId);
      const incomingEdges = getEdgesTo(graph, nodeId);

      // Count how many edges connect to the node being deleted, per connected node
      const edgesToDeletedNode = new Map<string, number>();
      for (const edge of outgoingEdges) {
        edgesToDeletedNode.set(edge.to, (edgesToDeletedNode.get(edge.to) ?? 0) + 1);
      }
      for (const edge of incomingEdges) {
        edgesToDeletedNode.set(edge.from, (edgesToDeletedNode.get(edge.from) ?? 0) + 1);
      }

      // Build connected nodes list with edge info and orphan status
      const connectedNodes: ConnectedNodesData['connectedNodes'] = [];
      const seenNodes = new Set<string>();
      let orphanCount = 0;

      for (const edge of outgoingEdges) {
        if (!seenNodes.has(edge.to)) {
          seenNodes.add(edge.to);
          const connectedNode = getNode(graph, edge.to);
          if (connectedNode) {
            // Count total edges for this connected node
            const connectedOutgoing = getEdgesFrom(graph, edge.to);
            const connectedIncoming = getEdgesTo(graph, edge.to);
            const totalConnections = connectedOutgoing.length + connectedIncoming.length;

            // It will be orphaned if all its connections are to the node being deleted
            const edgesToDeleted = edgesToDeletedNode.get(edge.to) ?? 0;
            const willBeOrphaned = totalConnections === edgesToDeleted;
            if (willBeOrphaned) orphanCount++;

            connectedNodes.push({
              node: {
                id: connectedNode.id,
                type: connectedNode.type,
                label: getNodeLabel(connectedNode),
                data: sanitizeNodeData(connectedNode),
              },
              edgeType: edge.type,
              direction: 'outgoing',
              totalConnections,
              willBeOrphaned,
            });
          }
        }
      }

      for (const edge of incomingEdges) {
        if (!seenNodes.has(edge.from)) {
          seenNodes.add(edge.from);
          const connectedNode = getNode(graph, edge.from);
          if (connectedNode) {
            // Count total edges for this connected node
            const connectedOutgoing = getEdgesFrom(graph, edge.from);
            const connectedIncoming = getEdgesTo(graph, edge.from);
            const totalConnections = connectedOutgoing.length + connectedIncoming.length;

            // It will be orphaned if all its connections are to the node being deleted
            const edgesToDeleted = edgesToDeletedNode.get(edge.from) ?? 0;
            const willBeOrphaned = totalConnections === edgesToDeleted;
            if (willBeOrphaned) orphanCount++;

            connectedNodes.push({
              node: {
                id: connectedNode.id,
                type: connectedNode.type,
                label: getNodeLabel(connectedNode),
                data: sanitizeNodeData(connectedNode),
              },
              edgeType: edge.type,
              direction: 'incoming',
              totalConnections,
              willBeOrphaned,
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          node: {
            id: node.id,
            type: node.type,
            label: getNodeLabel(node),
            data: sanitizeNodeData(node),
          },
          connectedNodes,
          edgeCount: outgoingEdges.length + incomingEdges.length,
          orphanCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * DELETE /stories/:id/nodes/:nodeId
 * Delete a node and its incident edges
 */
export function createDeleteNodeHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; nodeId: string }>,
    res: Response<APIResponse<DeleteNodeData>>,
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

      // Count edges that will be deleted
      const outgoingEdges = getEdgesFrom(graph, nodeId);
      const incomingEdges = getEdgesTo(graph, nodeId);
      const deletedEdgeCount = outgoingEdges.length + incomingEdges.length;

      // Capture node data before deletion
      const deletedNodeData: NodeData = {
        id: node.id,
        type: node.type,
        label: getNodeLabel(node),
        data: sanitizeNodeData(node),
      };

      // Build DELETE_NODE patch op
      const timestamp = new Date().toISOString();
      const patchId = `patch_delete_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      const deleteOp: PatchOp = {
        op: 'DELETE_NODE',
        id: nodeId,
      };

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [deleteOp],
        metadata: {
          source: 'nodeEditor',
          action: 'deleteNode',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Deleted ${node.type}: ${getNodeLabel(node)}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          deletedNode: deletedNodeData,
          deletedEdgeCount,
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
