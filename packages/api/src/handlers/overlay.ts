/**
 * Overlay diff provider for staged package preview
 * GET /stories/:id/propose/overlay-diff/:packageId
 */

import type { Request, Response, NextFunction } from 'express';
import type { StorageContext } from '../config.js';
import type { APIResponse } from '../types.js';
import { NotFoundError } from '../middleware/error.js';
import { findPackageInSession } from '../session.js';
import { ai } from '@apollo/core';

interface OverlayEdge {
  type: string;
  from: string;
  to: string;
}

interface OverlayDiffData {
  nodes: { created: string[]; modified: string[]; deleted: string[] };
  edges: { created: OverlayEdge[]; modified: OverlayEdge[]; deleted: OverlayEdge[] };
}

export function createOverlayDiffHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; packageId: string }>,
    res: Response<APIResponse<OverlayDiffData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, packageId } = req.params;
      const pkg = await findPackageInSession(id, packageId, ctx);
      if (!pkg) throw new NotFoundError(`Package "${packageId}"`);

      // Build a simple overlay from the package changes only (no live graph mutation)
      const nodeCreated: string[] = [];
      const nodeModified: string[] = [];
      const nodeDeleted: string[] = [];
      const edgeCreated: OverlayEdge[] = [];
      const edgeModified: OverlayEdge[] = [];
      const edgeDeleted: OverlayEdge[] = [];

      for (const n of pkg.changes.nodes as ai.NodeChange[]) {
        switch (n.operation) {
          case 'add':
            nodeCreated.push(n.node_id);
            break;
          case 'modify':
            nodeModified.push(n.node_id);
            break;
          case 'delete':
            nodeDeleted.push(n.node_id);
            break;
        }
      }

      for (const e of pkg.changes.edges as ai.EdgeChange[]) {
        const out = { type: e.edge_type, from: e.from, to: e.to };
        if (e.operation === 'add') edgeCreated.push(out);
        else if (e.operation === 'delete') edgeDeleted.push(out);
      }

      res.json({
        success: true,
        data: {
          nodes: { created: nodeCreated, modified: nodeModified, deleted: nodeDeleted },
          edges: { created: edgeCreated, modified: edgeModified, deleted: edgeDeleted },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
