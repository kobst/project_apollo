/**
 * Bulk Attach Handler
 * POST /stories/:id/relations/bulk-attach
 *
 * Enables attaching multiple entities to a parent in a single atomic operation,
 * with support for ordering and automatic reindexing.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  applyPatch,
  type Edge,
  type EdgeType,
  type EdgeProperties,
  type Patch,
  generateEdgeId,
  EDGE_RULES,
  isParentSource,
  lint,
  registerHardRules,
  registerSoftRules,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, saveVersionedStateById, deserializeGraph, serializeGraph } from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

// =============================================================================
// Request/Response Types
// =============================================================================

interface BulkAttachTarget {
  id: string;
  order?: number;
  properties?: Partial<EdgeProperties>;
}

interface BulkAttachRequest {
  parentId: string;
  edgeType: EdgeType;
  targets: BulkAttachTarget[];
  detachOthers?: boolean;
  ordered?: boolean;
}

interface BulkAttachResponse {
  added: number;
  updated: number;
  removed: number;
  edges: EdgeData[];
  newVersionId: string;
  lintResult?: {
    errorCount: number;
    warningCount: number;
    hasBlockingErrors: boolean;
  };
}

interface EdgeData {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  properties?: EdgeProperties | undefined;
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
  };
}

/**
 * Get edges of a given type involving a parent node.
 */
function getEdgesForParent(
  edges: Edge[],
  edgeType: EdgeType,
  parentId: string,
  parentIsSource: boolean
): Edge[] {
  return edges.filter((edge) => {
    if (edge.type !== edgeType) return false;
    const edgeParentId = parentIsSource ? edge.from : edge.to;
    return edgeParentId === parentId;
  });
}

/**
 * Get the child ID from an edge based on parent position.
 */
function getChildId(edge: Edge, parentIsSource: boolean): string {
  return parentIsSource ? edge.to : edge.from;
}

// =============================================================================
// Handler
// =============================================================================

/**
 * POST /stories/:id/relations/bulk-attach
 *
 * Bulk attach targets to a parent node with support for:
 * - Multi-select attachment
 * - Ordering (for FULFILLS edges and others)
 * - Automatic order normalization
 * - Detach others (sync mode)
 */
export function createBulkAttachHandler(ctx: StorageContext) {
  // Ensure lint rules are registered
  registerHardRules();
  registerSoftRules();

  return async (
    req: Request<{ id: string }, unknown, BulkAttachRequest>,
    res: Response<APIResponse<BulkAttachResponse>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { parentId, edgeType, targets, detachOthers, ordered } = req.body;

      // Validate required fields
      if (!parentId) {
        throw new BadRequestError('parentId is required');
      }
      if (!edgeType) {
        throw new BadRequestError('edgeType is required');
      }
      if (!targets || !Array.isArray(targets)) {
        throw new BadRequestError('targets must be an array');
      }

      // Validate edge type
      const edgeRule = EDGE_RULES[edgeType];
      if (!edgeRule) {
        throw new BadRequestError(`Invalid edge type: ${edgeType}`);
      }

      // Load state
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

      // Validate parent node exists
      const parentNode = graph.nodes.get(parentId);
      if (!parentNode) {
        throw new NotFoundError(`Parent node "${parentId}"`);
      }

      // Determine edge direction
      const parentIsSourceNode = isParentSource(edgeType);

      // Validate parent node type matches edge rules
      if (parentIsSourceNode) {
        if (!edgeRule.source.includes(parentNode.type)) {
          throw new BadRequestError(
            `Node type "${parentNode.type}" cannot be source for ${edgeType} edges. ` +
            `Allowed: ${edgeRule.source.join(', ')}`
          );
        }
      } else {
        if (!edgeRule.target.includes(parentNode.type)) {
          throw new BadRequestError(
            `Node type "${parentNode.type}" cannot be target for ${edgeType} edges. ` +
            `Allowed: ${edgeRule.target.join(', ')}`
          );
        }
      }

      // Validate all target nodes exist and have correct type
      const targetIds = new Set<string>();
      for (const target of targets) {
        if (!target.id) {
          throw new BadRequestError('Each target must have an id');
        }
        if (targetIds.has(target.id)) {
          throw new BadRequestError(`Duplicate target id: ${target.id}`);
        }
        targetIds.add(target.id);

        const targetNode = graph.nodes.get(target.id);
        if (!targetNode) {
          throw new NotFoundError(`Target node "${target.id}"`);
        }

        // Validate target type
        if (parentIsSourceNode) {
          if (!edgeRule.target.includes(targetNode.type)) {
            throw new BadRequestError(
              `Node "${target.id}" type "${targetNode.type}" cannot be target for ${edgeType} edges. ` +
              `Allowed: ${edgeRule.target.join(', ')}`
            );
          }
        } else {
          if (!edgeRule.source.includes(targetNode.type)) {
            throw new BadRequestError(
              `Node "${target.id}" type "${targetNode.type}" cannot be source for ${edgeType} edges. ` +
              `Allowed: ${edgeRule.source.join(', ')}`
            );
          }
        }
      }

      // Get existing edges of this type for this parent
      const existingEdges = getEdgesForParent(graph.edges, edgeType, parentId, parentIsSourceNode);
      const existingTargetIds = new Set(
        existingEdges.map((e) => getChildId(e, parentIsSourceNode))
      );

      // Compute diff
      const toAdd = targets.filter((t) => !existingTargetIds.has(t.id));
      const toUpdate = targets.filter((t) => existingTargetIds.has(t.id));
      const toRemove = detachOthers
        ? existingEdges.filter((e) => !targetIds.has(getChildId(e, parentIsSourceNode)))
        : [];

      // If nothing to do, return early
      if (toAdd.length === 0 && toUpdate.length === 0 && toRemove.length === 0) {
        res.json({
          success: true,
          data: {
            added: 0,
            updated: 0,
            removed: 0,
            edges: existingEdges.map(edgeToData),
            newVersionId: currentVersionId,
          },
        });
        return;
      }

      const timestamp = new Date().toISOString();
      const newVersionId = `ver_${Date.now()}`;

      // Build edges to add
      const edgesToAdd: Edge[] = toAdd.map((target, idx) => {
        const orderValue = ordered
          ? (target.order ?? existingEdges.length + idx + 1)
          : target.order;

        const properties: EdgeProperties | undefined = orderValue !== undefined || target.properties
          ? {
              ...target.properties,
              ...(orderValue !== undefined ? { order: orderValue } : {}),
            }
          : undefined;

        return {
          id: generateEdgeId(),
          type: edgeType,
          from: parentIsSourceNode ? parentId : target.id,
          to: parentIsSourceNode ? target.id : parentId,
          properties,
          provenance: { source: 'human' as const, createdBy: 'user' },
          status: 'approved' as const,
          createdAt: timestamp,
        };
      });

      // Build edge updates
      const edgeUpdates: Array<{ id: string; set: Partial<EdgeProperties> }> = [];
      for (const target of toUpdate) {
        const existingEdge = existingEdges.find(
          (e) => getChildId(e, parentIsSourceNode) === target.id
        );
        if (!existingEdge) continue;

        // If target has properties or order to update
        if (target.properties || (ordered && target.order !== undefined)) {
          const set: Partial<EdgeProperties> = { ...target.properties };
          if (ordered && target.order !== undefined) {
            set.order = target.order;
          }
          if (Object.keys(set).length > 0) {
            edgeUpdates.push({ id: existingEdge.id, set });
          }
        }
      }

      // Build delete list
      const edgesToDelete = toRemove.map((e) => e.id);

      // Build BATCH_EDGE patch
      const patchOps: Patch['ops'] = [];

      if (edgesToAdd.length > 0 || edgeUpdates.length > 0 || edgesToDelete.length > 0) {
        patchOps.push({
          op: 'BATCH_EDGE',
          adds: edgesToAdd,
          updates: edgeUpdates,
          deletes: edgesToDelete,
        });
      }

      const patch: Patch = {
        type: 'Patch',
        id: `patch_bulk_attach_${Date.now()}`,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: patchOps,
        metadata: { source: 'bulkAttach', action: 'bulkAttach', edgeType },
      };

      // Apply patch
      const newGraph = applyPatch(graph, patch);

      // Normalize order if requested (reindex to 1, 2, 3...)
      let finalGraph = newGraph;
      if (ordered) {
        const allEdgesForParent = getEdgesForParent(
          finalGraph.edges,
          edgeType,
          parentId,
          parentIsSourceNode
        );

        // Sort by order, then by createdAt, then by id
        const sortedEdges = [...allEdgesForParent].sort((a, b) => {
          const orderA = a.properties?.order ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.properties?.order ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          if (a.createdAt && b.createdAt) {
            const timeCompare = a.createdAt.localeCompare(b.createdAt);
            if (timeCompare !== 0) return timeCompare;
          }
          return a.id.localeCompare(b.id);
        });

        // Assign sequential order values
        const reindexOps: Patch['ops'] = [];
        const updates: Array<{ id: string; set: Partial<EdgeProperties> }> = [];

        sortedEdges.forEach((edge, idx) => {
          const newOrder = idx + 1;
          if (edge.properties?.order !== newOrder) {
            updates.push({ id: edge.id, set: { order: newOrder } });
          }
        });

        if (updates.length > 0) {
          reindexOps.push({
            op: 'BATCH_EDGE',
            updates,
          });

          const reindexPatch: Patch = {
            type: 'Patch',
            id: `patch_reindex_${Date.now()}`,
            base_story_version_id: currentVersionId,
            created_at: timestamp,
            ops: reindexOps,
            metadata: { source: 'bulkAttach', action: 'reindex', edgeType },
          };

          finalGraph = applyPatch(finalGraph, reindexPatch);
        }
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Bulk attach: +${toAdd.length} ~${toUpdate.length} -${toRemove.length} ${edgeType} edges`,
        created_at: timestamp,
        graph: serializeGraph(finalGraph),
      };
      state.history.currentVersionId = newVersionId;

      await saveVersionedStateById(id, state, ctx);

      // Run scoped lint on parent
      const lintResult = lint(finalGraph, {
        mode: 'touched',
        touchedNodeIds: [parentId],
        expandedNodeIds: [parentId, ...targets.map((t) => t.id)],
      });

      // Get final edges for response
      const finalEdges = getEdgesForParent(
        finalGraph.edges,
        edgeType,
        parentId,
        parentIsSourceNode
      );

      res.json({
        success: true,
        data: {
          added: toAdd.length,
          updated: toUpdate.length,
          removed: toRemove.length,
          edges: finalEdges.map(edgeToData),
          newVersionId,
          lintResult: {
            errorCount: lintResult.errorCount,
            warningCount: lintResult.warningCount,
            hasBlockingErrors: lintResult.hasBlockingErrors,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
