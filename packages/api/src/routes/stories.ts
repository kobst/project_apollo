/**
 * Story routes
 */

import { Router } from 'express';
import type { StorageContext } from '../config.js';
import {
  createInitHandler,
  createListStoriesHandler,
  createStatusHandler,
  createOQsHandler,
  createClustersHandler,
  createPreviewHandler,
  createAcceptHandler,
  createInputHandler,
  createDiffHandler,
  createBranchHandler,
  createListBranchesHandler,
  createCheckoutHandler,
  createLogHandler,
  createListNodesHandler,
  createGetNodeHandler,
  createNodeRelationsHandler,
} from '../handlers/index.js';

export function createStoriesRouter(ctx: StorageContext): Router {
  const router = Router();

  // List all stories
  router.get('/', createListStoriesHandler(ctx));

  // Core endpoints
  router.post('/init', createInitHandler(ctx));
  router.get('/:id/status', createStatusHandler(ctx));
  router.get('/:id/open-questions', createOQsHandler(ctx));
  router.post('/:id/clusters', createClustersHandler(ctx));
  router.get('/:id/moves/:moveId/preview', createPreviewHandler(ctx));
  router.post('/:id/accept', createAcceptHandler(ctx));
  router.post('/:id/input', createInputHandler(ctx));
  router.get('/:id/diff', createDiffHandler(ctx));

  // Optional endpoints
  router.post('/:id/branch', createBranchHandler(ctx));
  router.get('/:id/branches', createListBranchesHandler(ctx));
  router.post('/:id/checkout', createCheckoutHandler(ctx));
  router.get('/:id/log', createLogHandler(ctx));

  // Node browsing endpoints
  router.get('/:id/nodes', createListNodesHandler(ctx));
  router.get('/:id/nodes/:nodeId', createGetNodeHandler(ctx));
  router.get('/:id/nodes/:nodeId/relations', createNodeRelationsHandler(ctx));

  return router;
}
