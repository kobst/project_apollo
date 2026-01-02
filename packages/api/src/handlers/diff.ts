/**
 * GET /stories/:id/diff - Compare versions or branches
 */

import type { Request, Response, NextFunction } from 'express';
import { computeGraphDiff } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  deserializeGraph,
  getVersionById,
} from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse, DiffData, NodeChange, ModifiedNodeChange, EdgeChange } from '../types.js';

interface DiffQuery {
  from?: string;
  to?: string;
}

function getNodeLabel(node: unknown): string | undefined {
  const n = node as Record<string, unknown>;
  if (typeof n.name === 'string') return n.name;
  if (typeof n.heading === 'string') return n.heading;
  if (typeof n.title === 'string') return n.title;
  return undefined;
}

export function createDiffHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, DiffQuery>,
    res: Response<APIResponse<DiffData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { from, to } = req.query;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      // Determine version IDs
      let fromVersionId: string;
      let toVersionId: string;

      if (from && to) {
        // Explicit from/to
        // Check if these are branch names
        const fromBranch = state.history.branches[from];
        const toBranch = state.history.branches[to];
        fromVersionId = fromBranch ? fromBranch.headVersionId : from;
        toVersionId = toBranch ? toBranch.headVersionId : to;
      } else if (from) {
        // Compare from to current
        const fromBranch = state.history.branches[from];
        fromVersionId = fromBranch ? fromBranch.headVersionId : from;
        toVersionId = state.history.currentVersionId;
      } else {
        // Compare current to parent
        const currentVersion = state.history.versions[state.history.currentVersionId];
        if (!currentVersion) {
          throw new NotFoundError('Current version');
        }
        if (!currentVersion.parent_id) {
          throw new BadRequestError(
            'No parent version to compare against',
            'Specify from and to versions explicitly'
          );
        }
        fromVersionId = currentVersion.parent_id;
        toVersionId = state.history.currentVersionId;
      }

      // Load versions
      const fromVersion = await getVersionById(id, fromVersionId, ctx);
      const toVersion = await getVersionById(id, toVersionId, ctx);

      if (!fromVersion) {
        throw new NotFoundError(`Version "${fromVersionId}"`);
      }
      if (!toVersion) {
        throw new NotFoundError(`Version "${toVersionId}"`);
      }

      // Compute diff
      const fromGraph = deserializeGraph(fromVersion.graph);
      const toGraph = deserializeGraph(toVersion.graph);
      const diff = computeGraphDiff(fromGraph, toGraph);

      // Format response
      const addedNodes: NodeChange[] = diff.nodes.added.map((n) => {
        const label = getNodeLabel(n);
        return {
          id: n.id,
          type: n.type,
          ...(label !== undefined && { label }),
        };
      });

      const removedNodes: NodeChange[] = diff.nodes.removed.map((n) => {
        const label = getNodeLabel(n);
        return {
          id: n.id,
          type: n.type,
          ...(label !== undefined && { label }),
        };
      });

      const modifiedNodes: ModifiedNodeChange[] = diff.nodes.modified.map((m) => ({
        id: m.id,
        nodeType: m.nodeType,
        changes: m.changes,
      }));

      const addedEdges: EdgeChange[] = diff.edges.added.map((e) => ({
        type: e.type,
        source: e.from,
        target: e.to,
      }));

      const removedEdges: EdgeChange[] = diff.edges.removed.map((e) => ({
        type: e.type,
        source: e.from,
        target: e.to,
      }));

      res.json({
        success: true,
        data: {
          fromVersion: fromVersionId,
          toVersion: toVersionId,
          nodes: {
            added: addedNodes,
            removed: removedNodes,
            modified: modifiedNodes,
          },
          edges: {
            added: addedEdges,
            removed: removedEdges,
          },
          summary: {
            nodesAdded: diff.summary.nodesAdded,
            nodesRemoved: diff.summary.nodesRemoved,
            nodesModified: diff.summary.nodesModified,
            edgesAdded: diff.summary.edgesAdded,
            edgesRemoved: diff.summary.edgesRemoved,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
