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
  createUpdateNodeHandler,
  createOutlineHandler,
  createExtractHandler,
  createExtractPreviewHandler,
  createExtractAcceptHandler,
  createListEdgesHandler,
  createGetEdgeHandler,
  createAddEdgeHandler,
  createUpdateEdgeHandler,
  createDeleteEdgeHandler,
  createBatchEdgesHandler,
  createUpsertEdgeHandler,
  createLintHandler,
  createApplyFixHandler,
  createPreCommitLintHandler,
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

  // Node browsing and editing endpoints
  router.get('/:id/nodes', createListNodesHandler(ctx));
  router.get('/:id/nodes/:nodeId', createGetNodeHandler(ctx));
  router.get('/:id/nodes/:nodeId/relations', createNodeRelationsHandler(ctx));
  router.patch('/:id/nodes/:nodeId', createUpdateNodeHandler(ctx));

  // Outline endpoint
  router.get('/:id/outline', createOutlineHandler(ctx));

  // Extraction endpoints
  router.post('/:id/extract', createExtractHandler(ctx));
  router.get('/:id/extract/:proposalId/preview', createExtractPreviewHandler(ctx));
  router.post('/:id/extract/:proposalId/accept', createExtractAcceptHandler(ctx));

  // Edge CRUD endpoints
  router.get('/:id/edges', createListEdgesHandler(ctx));
  router.get('/:id/edges/:edgeId', createGetEdgeHandler(ctx));
  router.post('/:id/edges', createAddEdgeHandler(ctx));
  router.patch('/:id/edges/:edgeId', createUpdateEdgeHandler(ctx));
  router.delete('/:id/edges/:edgeId', createDeleteEdgeHandler(ctx));
  // Note: Using regex to match :batch and :upsert as sub-resources
  router.post('/:id/edges\\:batch', createBatchEdgesHandler(ctx));
  router.post('/:id/edges\\:upsert', createUpsertEdgeHandler(ctx));

  // Lint endpoints
  router.post('/:id/lint', createLintHandler(ctx));
  router.post('/:id/lint/apply', createApplyFixHandler(ctx));
  router.get('/:id/lint/precommit', createPreCommitLintHandler(ctx));

  return router;
}
