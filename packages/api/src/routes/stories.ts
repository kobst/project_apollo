/**
 * Story routes
 */

import { Router } from 'express';
import type { StorageContext } from '../config.js';
import {
  createInitHandler,
  createListStoriesHandler,
  createStatusHandler,
  createGenerateHandler,
  createOQsHandler,
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
  createStagedLintHandler,
  createBulkAttachHandler,
  createStoryBeatHandler,
  listStoryBeatsHandler,
  getStoryBeatHandler,
  updateStoryBeatHandler,
  deleteStoryBeatHandler,
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
  createIdeaFromPackageHandler,
  createRefineIdeaHandler,
  createGetIdeaRefinementHistoryHandler,
  createStartIdeaRefineSessionHandler,
  createGetIdeaRefineSessionHandler,
  createCommitIdeaRefineSessionHandler,
  createDiscardIdeaRefineSessionHandler,
  createGetSessionHandler,
  createDeleteSessionHandler,
  createConvertProposalHandler,
  createApplyPackageHandler,
  createRegenerateElementHandler,
  createApplyElementOptionHandler,
  createValidatePackageHandler,
  createUpdatePackageElementHandler,
  // Unified Propose handlers
  createProposeHandler,
  createGetActiveProposalHandler,
  createDiscardProposalHandler,
  createCommitProposalHandler,
  createRefineProposalHandler,
  createProposeStoryBeatsHandler,
  createProposeCharactersHandler,
  createProposeScenesHandler,
  createProposeExpandHandler,
  createListSavedPackagesHandler,
  createGetSavedPackageHandler,
  createSavePackageHandler,
  createUpdateSavedPackageHandler,
  createDeleteSavedPackageHandler,
  createApplySavedPackageHandler,
  createRunAgentHandler,
  createAgentEventsHandler,
  createCancelAgentJobHandler,
  createOverlayDiffHandler,
  createEnrichImpactHandler,
  // Mentions handlers
  createRenameEntityHandler,
  createRebuildMentionsHandler,
  createValidateMentionsHandler,
  createGetEntityMentionsHandler,
  createGetIntroductionPointsHandler,
  createGetMentionsStatsHandler,
} from '../handlers/index.js';

export function createStoriesRouter(ctx: StorageContext): Router {
  const router = Router();

  // List all stories
  router.get('/', createListStoriesHandler(ctx));

  // Core endpoints
  router.post('/init', createInitHandler(ctx));
  router.get('/:id/status', createStatusHandler(ctx));
  // Unified generation endpoint (orchestrated)
  router.post('/:id/generate', createGenerateHandler(ctx));
  router.get('/:id/open-questions', createOQsHandler(ctx));
  // Legacy cluster/move endpoints removed in favor of propose/session workflow
  router.all('/:id/clusters', (_req, res) => {
    res.status(410).json({
      success: false,
      error: 'Endpoint removed',
      suggestion: 'Use POST /stories/:id/propose* endpoints and /stories/:id/propose/commit',
    });
  });
  router.all('/:id/moves/:moveId/preview', (_req, res) => {
    res.status(410).json({
      success: false,
      error: 'Endpoint removed',
      suggestion: 'Use POST /stories/:id/validate-package with a NarrativePackage',
    });
  });
  router.all('/:id/accept', (_req, res) => {
    res.status(410).json({
      success: false,
      error: 'Endpoint removed',
      suggestion: 'Use POST /stories/:id/propose/commit with a packageId',
    });
  });
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
  router.post('/:id/lint/staged', createStagedLintHandler(ctx));

  // Coverage endpoint (deprecated - use /gaps instead)
  router.get('/:id/coverage', createCoverageHandler(ctx));

  // Unified gaps endpoint (replaces /coverage and /open-questions)
  router.get('/:id/gaps', createGapsHandler(ctx));

  // Recompute order endpoint (migration/sync)
  router.post('/:id/recompute-order', createRecomputeOrderHandler(ctx));

  // StoryBeat endpoints
  router.post('/:id/story-beats', createStoryBeatHandler(ctx));
  router.get('/:id/story-beats', listStoryBeatsHandler(ctx));
  router.get('/:id/story-beats/:sbId', getStoryBeatHandler(ctx));
  router.patch('/:id/story-beats/:sbId', updateStoryBeatHandler(ctx));
  router.delete('/:id/story-beats/:sbId', deleteStoryBeatHandler(ctx));

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
  // Idea refinement sessions
  router.post('/:id/ideas/:ideaId/refine-session', createStartIdeaRefineSessionHandler(ctx));
  router.get('/:id/ideas/:ideaId/refine-session', createGetIdeaRefineSessionHandler(ctx));
  router.post('/:id/ideas/:ideaId/refine-session/commit', createCommitIdeaRefineSessionHandler(ctx));
  router.delete('/:id/ideas/:ideaId/refine-session', createDiscardIdeaRefineSessionHandler(ctx));
  router.post('/:id/ideas/:ideaId/refine', createRefineIdeaHandler(ctx));
  router.get('/:id/ideas/:ideaId/refinement-history', createGetIdeaRefinementHistoryHandler(ctx));
  router.patch('/:id/ideas/:ideaId', updateIdeaHandler(ctx));
  router.delete('/:id/ideas/:ideaId', deleteIdeaHandler(ctx));
  router.post('/:id/ideas/from-package', createIdeaFromPackageHandler(ctx));

  // Unified Propose endpoints (AI pipeline)
  router.post('/:id/propose', createProposeHandler(ctx));
  router.get('/:id/propose/active', createGetActiveProposalHandler(ctx));
  router.delete('/:id/propose/active', createDiscardProposalHandler(ctx));
  router.post('/:id/propose/commit', createCommitProposalHandler(ctx));
  router.post('/:id/propose/refine', createRefineProposalHandler(ctx));
  router.post('/:id/propose/story-beats', createProposeStoryBeatsHandler(ctx));
  router.post('/:id/propose/characters', createProposeCharactersHandler(ctx));
  router.post('/:id/propose/scenes', createProposeScenesHandler(ctx));
  router.post('/:id/propose/expand', createProposeExpandHandler(ctx));
  router.get('/:id/propose/overlay-diff/:packageId', createOverlayDiffHandler(ctx));

  // Session management (for active proposal)
  router.get('/:id/session', createGetSessionHandler(ctx));
  router.delete('/:id/session', createDeleteSessionHandler(ctx));

  // Package utilities
  router.post('/:id/proposal-to-package', createConvertProposalHandler(ctx));
  router.post('/:id/apply-package', createApplyPackageHandler(ctx));
  // Deprecated accept-package removed; use /propose/commit

  // Impact enrichment (LLM critic)
  router.post('/:id/packages/:packageId/enrich-impact', createEnrichImpactHandler(ctx));

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

  // Agents (minimal runner)
  router.post('/:id/agents/run', createRunAgentHandler(ctx));
  router.get('/:id/agents/jobs/:jobId/events', createAgentEventsHandler(ctx));
  router.post('/:id/agents/jobs/:jobId/cancel', createCancelAgentJobHandler(ctx));

  // Mentions/Entity tracking endpoints
  router.post('/:id/entities/:entityId/rename', createRenameEntityHandler(ctx));
  router.get('/:id/entities/:entityId/mentions', createGetEntityMentionsHandler(ctx));
  router.post('/:id/mentions/rebuild', createRebuildMentionsHandler(ctx));
  router.get('/:id/mentions/validate', createValidateMentionsHandler(ctx));
  router.get('/:id/mentions/introductions', createGetIntroductionPointsHandler(ctx));
  router.get('/:id/mentions/stats', createGetMentionsStatsHandler(ctx));

  return router;
}
