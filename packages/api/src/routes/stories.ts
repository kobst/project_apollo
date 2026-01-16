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
  createGetConnectedNodesHandler,
  createDeleteNodeHandler,
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
  createBulkAttachHandler,
  createPlotPointHandler,
  listPlotPointsHandler,
  getPlotPointHandler,
  updatePlotPointHandler,
  deletePlotPointHandler,
  createCoverageHandler,
  createGapsHandler,
  createRecomputeOrderHandler,
  createSceneHandler,
  listScenesHandler,
  getSceneHandler,
  updateSceneHandler,
  deleteSceneHandler,
  createGetContextHandler,
  createUpdateContextHandler,
  createIdeaHandler,
  listIdeasHandler,
  getIdeaHandler,
  updateIdeaHandler,
  deleteIdeaHandler,
  createInterpretHandler,
  createGenerateHandler,
  createRegenerateHandler,
  createRefineHandler,
  createGetSessionHandler,
  createDeleteSessionHandler,
  createConvertProposalHandler,
  createApplyPackageHandler,
  createAcceptPackageHandler,
  createRegenerateElementHandler,
  createApplyElementOptionHandler,
  createValidatePackageHandler,
  createUpdatePackageElementHandler,
  createListSavedPackagesHandler,
  createGetSavedPackageHandler,
  createSavePackageHandler,
  createUpdateSavedPackageHandler,
  createDeleteSavedPackageHandler,
  createApplySavedPackageHandler,
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
  router.get('/:id/nodes/:nodeId/connected', createGetConnectedNodesHandler(ctx));
  router.patch('/:id/nodes/:nodeId', createUpdateNodeHandler(ctx));
  router.delete('/:id/nodes/:nodeId', createDeleteNodeHandler(ctx));

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

  // Bulk attach endpoint
  router.post('/:id/relations/bulk-attach', createBulkAttachHandler(ctx));

  // Lint endpoints
  router.post('/:id/lint', createLintHandler(ctx));
  router.post('/:id/lint/apply', createApplyFixHandler(ctx));
  router.get('/:id/lint/precommit', createPreCommitLintHandler(ctx));

  // Coverage endpoint (deprecated - use /gaps instead)
  router.get('/:id/coverage', createCoverageHandler(ctx));

  // Unified gaps endpoint (replaces /coverage and /open-questions)
  router.get('/:id/gaps', createGapsHandler(ctx));

  // Recompute order endpoint (migration/sync)
  router.post('/:id/recompute-order', createRecomputeOrderHandler(ctx));

  // PlotPoint endpoints
  router.post('/:id/plot-points', createPlotPointHandler(ctx));
  router.get('/:id/plot-points', listPlotPointsHandler(ctx));
  router.get('/:id/plot-points/:ppId', getPlotPointHandler(ctx));
  router.patch('/:id/plot-points/:ppId', updatePlotPointHandler(ctx));
  router.delete('/:id/plot-points/:ppId', deletePlotPointHandler(ctx));

  // Scene endpoints
  router.post('/:id/scenes', createSceneHandler(ctx));
  router.get('/:id/scenes', listScenesHandler(ctx));
  router.get('/:id/scenes/:sceneId', getSceneHandler(ctx));
  router.patch('/:id/scenes/:sceneId', updateSceneHandler(ctx));
  router.delete('/:id/scenes/:sceneId', deleteSceneHandler(ctx));

  // Story Context endpoints
  router.get('/:id/context', createGetContextHandler(ctx));
  router.patch('/:id/context', createUpdateContextHandler(ctx));

  // Idea endpoints
  router.post('/:id/ideas', createIdeaHandler(ctx));
  router.get('/:id/ideas', listIdeasHandler(ctx));
  router.get('/:id/ideas/:ideaId', getIdeaHandler(ctx));
  router.patch('/:id/ideas/:ideaId', updateIdeaHandler(ctx));
  router.delete('/:id/ideas/:ideaId', deleteIdeaHandler(ctx));

  // AI Generation endpoints
  router.post('/:id/interpret', createInterpretHandler(ctx));
  router.post('/:id/generate', createGenerateHandler(ctx));
  router.post('/:id/regenerate', createRegenerateHandler(ctx));
  router.post('/:id/refine', createRefineHandler(ctx));
  router.get('/:id/session', createGetSessionHandler(ctx));
  router.delete('/:id/session', createDeleteSessionHandler(ctx));
  router.post('/:id/proposal-to-package', createConvertProposalHandler(ctx));
  router.post('/:id/apply-package', createApplyPackageHandler(ctx));
  router.post('/:id/accept-package', createAcceptPackageHandler(ctx));

  // Package Editing endpoints
  router.post('/:id/regenerate-element', createRegenerateElementHandler(ctx));
  router.post('/:id/apply-element-option', createApplyElementOptionHandler(ctx));
  router.post('/:id/validate-package', createValidatePackageHandler(ctx));
  router.post('/:id/update-package-element', createUpdatePackageElementHandler(ctx));

  // Saved Packages endpoints
  router.get('/:id/saved-packages', createListSavedPackagesHandler(ctx));
  router.get('/:id/saved-packages/:spId', createGetSavedPackageHandler(ctx));
  router.post('/:id/saved-packages', createSavePackageHandler(ctx));
  router.patch('/:id/saved-packages/:spId', createUpdateSavedPackageHandler(ctx));
  router.delete('/:id/saved-packages/:spId', createDeleteSavedPackageHandler(ctx));
  router.post('/:id/saved-packages/:spId/apply', createApplySavedPackageHandler(ctx));

  return router;
}
