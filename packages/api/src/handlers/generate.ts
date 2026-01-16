/**
 * AI Generation Handlers
 *
 * Handles AI-powered narrative generation endpoints:
 * - POST /stories/:id/interpret - Interpret freeform input
 * - POST /stories/:id/generate - Generate narrative packages
 * - POST /stories/:id/refine - Refine a package with variations
 * - GET /stories/:id/session - Get current generation session
 * - DELETE /stories/:id/session - Abandon generation session
 * - POST /stories/:id/accept-package - Accept a package and apply to graph
 */

import type { Request, Response, NextFunction } from 'express';
import {
  ai,
  applyPatch,
  validatePatch,
  generateEdgeId,
  computeCoverage,
  type Patch,
  type PatchOp,
  type NodeType,
  type EdgeType,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  loadGraphById,
  deserializeGraph,
  updateGraphById,
} from '../storage.js';
import {
  loadGenerationSession,
  markSessionAbandoned,
  markSessionAccepted,
  deleteGenerationSession,
  findPackageInSession,
  type GenerationEntryPoint,
} from '../session.js';
import {
  interpretUserInput,
  proposalToPackage,
  type InterpretRequest,
} from '../ai/interpretOrchestrator.js';
import {
  generatePackages,
  regenerateAll,
  type GenerateRequest,
} from '../ai/generateOrchestrator.js';
import {
  refinePackage,
  getRefinableElements,
  type RefineRequest,
} from '../ai/refineOrchestrator.js';
import {
  regenerateElement,
  applyElementOption,
  type ElementType,
  type RegenerateElementRequest,
} from '../ai/regenerateElementOrchestrator.js';
import {
  createLLMClient,
  isLLMConfigured,
  getMissingKeyError,
  type StreamCallbacks,
} from '../ai/llmClient.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';

// =============================================================================
// Interpret Handler
// =============================================================================

interface InterpretResponseData {
  interpretation: {
    summary: string;
    confidence: number;
  };
  proposals: ai.InterpretationProposal[];
  /** Pre-computed validation for each proposal (by index) */
  validations: Record<number, ai.ProposalValidation>;
  alternatives?: Array<{
    summary: string;
    confidence: number;
  }>;
}

export function createInterpretHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, InterpretRequest>,
    res: Response<APIResponse<InterpretResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { userInput, targetType } = req.body;

      if (!userInput || !userInput.trim()) {
        throw new BadRequestError('userInput is required');
      }

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      // Check for streaming request
      const wantsStream = req.headers.accept === 'text/event-stream';

      if (wantsStream) {
        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const streamCallbacks: StreamCallbacks = {
          onToken: (token) => {
            res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
          },
          onComplete: (response) => {
            res.write(`data: ${JSON.stringify({ type: 'usage', usage: response.usage })}\n\n`);
          },
          onError: (error) => {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          },
        };

        const interpretRequest: InterpretRequest = { userInput };
        if (targetType) interpretRequest.targetType = targetType;
        const result = await interpretUserInput(
          id,
          interpretRequest,
          ctx,
          llmClient,
          streamCallbacks
        );

        // Auto-validate each proposal against the graph
        const graph = await loadGraphById(id, ctx);
        const validations: Record<number, ai.ProposalValidation> = {};
        if (graph && result.proposals) {
          const { gaps } = computeCoverage(graph);
          result.proposals.forEach((proposal, index) => {
            validations[index] = ai.validateProposal(graph, proposal, gaps);
          });
        }

        res.write(`data: ${JSON.stringify({ type: 'result', data: { ...result, validations } })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const interpretRequest: InterpretRequest = { userInput };
        if (targetType) interpretRequest.targetType = targetType;
        const result = await interpretUserInput(
          id,
          interpretRequest,
          ctx,
          llmClient
        );

        // Auto-validate each proposal against the graph
        const graph = await loadGraphById(id, ctx);
        const validations: Record<number, ai.ProposalValidation> = {};
        if (graph && result.proposals) {
          const { gaps } = computeCoverage(graph);
          result.proposals.forEach((proposal, index) => {
            validations[index] = ai.validateProposal(graph, proposal, gaps);
          });
        }

        res.json({
          success: true,
          data: { ...result, validations },
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Generate Handler
// =============================================================================

interface GenerateResponseData {
  sessionId: string;
  packages: ai.NarrativePackage[];
}

interface GenerateRequestBody {
  entryPoint: GenerationEntryPoint;
  depth?: ai.GenerationDepth;
  count?: ai.GenerationCount;
  direction?: string;
}

export function createGenerateHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, GenerateRequestBody>,
    res: Response<APIResponse<GenerateResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    console.log('[generateHandler] Received generate request');
    try {
      const { id } = req.params;
      const { entryPoint, depth = 'medium', count = 'few', direction } = req.body;
      console.log(`[generateHandler] Story: ${id}, entryPoint: ${entryPoint?.type}, depth: ${depth}, count: ${count}`);

      if (!entryPoint || !entryPoint.type) {
        throw new BadRequestError('entryPoint with type is required');
      }

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      // Check for streaming request
      const wantsStream = req.headers.accept === 'text/event-stream';

      const request: GenerateRequest = {
        entryPoint,
        depth,
        count,
      };
      if (direction) {
        request.direction = direction;
      }

      if (wantsStream) {
        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const streamCallbacks: StreamCallbacks = {
          onToken: (token) => {
            res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
          },
          onComplete: (response) => {
            res.write(`data: ${JSON.stringify({ type: 'usage', usage: response.usage })}\n\n`);
          },
          onError: (error) => {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          },
        };

        const result = await generatePackages(id, request, ctx, llmClient, streamCallbacks);

        res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await generatePackages(id, request, ctx, llmClient);

        res.json({
          success: true,
          data: result,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Regenerate Handler
// =============================================================================

export function createRegenerateHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<GenerateResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      // Check for streaming request
      const wantsStream = req.headers.accept === 'text/event-stream';

      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const streamCallbacks: StreamCallbacks = {
          onToken: (token) => {
            res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
          },
          onComplete: (response) => {
            res.write(`data: ${JSON.stringify({ type: 'usage', usage: response.usage })}\n\n`);
          },
          onError: (error) => {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          },
        };

        const result = await regenerateAll(id, ctx, llmClient, streamCallbacks);

        res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await regenerateAll(id, ctx, llmClient);

        res.json({
          success: true,
          data: result,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Refine Handler
// =============================================================================

interface RefineResponseData {
  variations: ai.NarrativePackage[];
}

interface RefineRequestBody {
  basePackageId: string;
  keepElements?: string[];
  regenerateElements?: string[];
  guidance: string;
  depth?: ai.GenerationDepth;
  count?: ai.GenerationCount;
}

export function createRefineHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, RefineRequestBody>,
    res: Response<APIResponse<RefineResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        basePackageId,
        keepElements = [],
        regenerateElements = [],
        guidance,
        depth = 'medium',
        count = 'few',
      } = req.body;

      if (!basePackageId) {
        throw new BadRequestError('basePackageId is required');
      }
      if (!guidance || !guidance.trim()) {
        throw new BadRequestError('guidance is required');
      }

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      const request: RefineRequest = {
        basePackageId,
        keepElements,
        regenerateElements,
        guidance,
        depth,
        count,
      };

      // Check for streaming request
      const wantsStream = req.headers.accept === 'text/event-stream';

      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const streamCallbacks: StreamCallbacks = {
          onToken: (token) => {
            res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
          },
          onComplete: (response) => {
            res.write(`data: ${JSON.stringify({ type: 'usage', usage: response.usage })}\n\n`);
          },
          onError: (error) => {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          },
        };

        const result = await refinePackage(id, request, ctx, llmClient, streamCallbacks);

        res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await refinePackage(id, request, ctx, llmClient);

        res.json({
          success: true,
          data: result,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Session Handlers
// =============================================================================

interface SessionResponseData {
  id: string;
  storyId: string;
  createdAt: string;
  updatedAt: string;
  entryPoint: GenerationEntryPoint;
  packages: ai.NarrativePackage[];
  currentPackageId?: string;
  status: 'active' | 'accepted' | 'abandoned';
  acceptedPackageId?: string;
  refinableElements?: ReturnType<typeof getRefinableElements>;
}

export function createGetSessionHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<SessionResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const session = await loadGenerationSession(id, ctx);

      if (!session) {
        throw new NotFoundError(
          `Generation session for story "${id}"`,
          'Start a generation with POST /stories/:id/generate'
        );
      }

      // Include refinable elements for current package if present
      let refinableElements: ReturnType<typeof getRefinableElements> | undefined;
      if (session.currentPackageId) {
        const currentPkg = session.packages.find((p) => p.id === session.currentPackageId);
        if (currentPkg) {
          refinableElements = getRefinableElements(currentPkg);
        }
      }

      const responseData: SessionResponseData = {
        ...session,
      };
      if (refinableElements) {
        responseData.refinableElements = refinableElements;
      }

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  };
}

export function createDeleteSessionHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<{ abandoned: boolean }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const session = await loadGenerationSession(id, ctx);

      if (!session) {
        throw new NotFoundError(`Generation session for story "${id}"`);
      }

      // Mark as abandoned then delete
      await markSessionAbandoned(id, ctx);
      await deleteGenerationSession(id, ctx);

      res.json({
        success: true,
        data: { abandoned: true },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Proposal to Package Helper
// =============================================================================

interface ConvertProposalResponseData {
  package: ai.NarrativePackage;
  validation: ai.ProposalValidation;
}

export function createConvertProposalHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, { proposal: ai.InterpretationProposal }>,
    res: Response<APIResponse<ConvertProposalResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { proposal } = req.body;

      if (!proposal) {
        throw new BadRequestError('proposal is required');
      }

      // Load graph and compute gaps for validation
      const graph = await loadGraphById(id, ctx);
      if (!graph) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const { gaps } = computeCoverage(graph);

      // Validate proposal against graph
      const validation = ai.validateProposal(graph, proposal, gaps);

      // Convert to package
      const pkg = proposalToPackage(proposal);

      res.json({
        success: true,
        data: { package: pkg, validation },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Accept Package Handler
// =============================================================================

interface AcceptPackageResponseData {
  packageId: string;
  title: string;
  newVersionId: string;
  patchOpsApplied: number;
  nodesAdded: number;
  nodesModified: number;
  nodesDeleted: number;
  edgesAdded: number;
  edgesDeleted: number;
  storyContextUpdated: boolean;
}

/**
 * Convert a NarrativePackage to a Patch that can be applied to the graph.
 */
export function packageToPatch(
  pkg: ai.NarrativePackage,
  baseVersionId: string
): Patch {
  const ops: PatchOp[] = [];

  // Convert node changes to patch ops
  for (const nodeChange of pkg.changes.nodes) {
    switch (nodeChange.operation) {
      case 'add':
        ops.push({
          op: 'ADD_NODE',
          node: {
            type: nodeChange.node_type as NodeType,
            id: nodeChange.node_id,
            ...(nodeChange.data ?? {}),
          } as Parameters<typeof applyPatch>[1]['ops'][0] extends { op: 'ADD_NODE'; node: infer T } ? T : never,
        });
        break;
      case 'modify':
        ops.push({
          op: 'UPDATE_NODE',
          id: nodeChange.node_id,
          set: nodeChange.data ?? {},
        });
        break;
      case 'delete':
        ops.push({
          op: 'DELETE_NODE',
          id: nodeChange.node_id,
        });
        break;
    }
  }

  // Convert edge changes to patch ops
  for (const edgeChange of pkg.changes.edges) {
    switch (edgeChange.operation) {
      case 'add':
        ops.push({
          op: 'ADD_EDGE',
          edge: {
            id: generateEdgeId(),
            type: edgeChange.edge_type,
            from: edgeChange.from,
            to: edgeChange.to,
            ...(edgeChange.properties ?? {}),
          } as Parameters<typeof applyPatch>[1]['ops'][0] extends { op: 'ADD_EDGE'; edge: infer T } ? T : never,
        });
        break;
      case 'delete':
        // Delete edge by type/from/to
        ops.push({
          op: 'DELETE_EDGE',
          edge: {
            type: edgeChange.edge_type as EdgeType,
            from: edgeChange.from,
            to: edgeChange.to,
          },
        });
        break;
    }
  }

  return {
    type: 'Patch',
    id: `patch_pkg_${pkg.id}`,
    base_story_version_id: baseVersionId,
    created_at: new Date().toISOString(),
    ops,
    metadata: {
      source: 'ai-package',
      packageId: pkg.id,
      packageTitle: pkg.title,
    },
  };
}

// Note: Story Context changes are tracked but applied separately
// via the PATCH /stories/:id/context endpoint. The function below
// is kept for future implementation of inline Story Context updates.
//
// function applyStoryContextChanges(
//   currentContext: string | undefined,
//   changes: ai.StoryContextChange[]
// ): string { ... }

/**
 * Apply a package directly (without needing a session).
 * Used for interpretation proposals that aren't part of a generation session.
 */
export function createApplyPackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, { package: ai.NarrativePackage }>,
    res: Response<APIResponse<AcceptPackageResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const pkg = req.body.package;

      if (!pkg || !pkg.id) {
        throw new BadRequestError('package is required');
      }

      // Load current graph state
      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      let graph = deserializeGraph(currentVersion.graph);

      // Convert package to patch
      const patch = packageToPatch(pkg, state.history.currentVersionId);

      // Validate patch
      const validation = validatePatch(graph, patch);
      if (!validation.success) {
        throw new BadRequestError(
          'Package validation failed',
          validation.errors.map((e) => e.message).join('; ')
        );
      }

      // Apply patch
      graph = applyPatch(graph, patch);

      // Save updated graph
      const newVersionId = await updateGraphById(
        id,
        graph,
        `Apply package: ${pkg.title}`,
        undefined,
        ctx
      );

      // Compute stats
      const stats = {
        nodesAdded: pkg.changes.nodes.filter((n) => n.operation === 'add').length,
        nodesModified: pkg.changes.nodes.filter((n) => n.operation === 'modify').length,
        nodesDeleted: pkg.changes.nodes.filter((n) => n.operation === 'delete').length,
        edgesAdded: pkg.changes.edges.filter((e) => e.operation === 'add').length,
        edgesDeleted: pkg.changes.edges.filter((e) => e.operation === 'delete').length,
      };

      res.json({
        success: true,
        data: {
          packageId: pkg.id,
          title: pkg.title,
          newVersionId,
          patchOpsApplied: patch.ops.length,
          ...stats,
          storyContextUpdated: Boolean(pkg.changes.storyContext?.length),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export function createAcceptPackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, { packageId: string }>,
    res: Response<APIResponse<AcceptPackageResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { packageId } = req.body;

      if (!packageId) {
        throw new BadRequestError('packageId is required');
      }

      // 1. Load the session and find the package
      const session = await loadGenerationSession(id, ctx);
      if (!session) {
        throw new NotFoundError(
          `Generation session for story "${id}"`,
          'Start a generation with POST /stories/:id/generate'
        );
      }

      if (session.status !== 'active') {
        throw new BadRequestError(
          `Cannot accept package: session is ${session.status}`,
          'Start a new generation session'
        );
      }

      const pkg = await findPackageInSession(id, packageId, ctx);
      if (!pkg) {
        throw new NotFoundError(
          `Package "${packageId}" in session`,
          'Use GET /stories/:id/session to see available packages'
        );
      }

      // 2. Load current graph state
      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      let graph = deserializeGraph(currentVersion.graph);

      // 3. Convert package to patch
      const patch = packageToPatch(pkg, state.history.currentVersionId);

      // 4. Validate patch
      const validation = validatePatch(graph, patch);
      if (!validation.success) {
        throw new BadRequestError(
          'Package validation failed',
          validation.errors.map((e) => e.message).join('; ')
        );
      }

      // 5. Apply patch
      graph = applyPatch(graph, patch);

      // 6. Handle Story Context changes
      let storyContextUpdated = false;
      if (pkg.changes.storyContext && pkg.changes.storyContext.length > 0) {
        // Note: Story Context updates would be applied separately
        // through the context endpoint. For now, we track the intent.
        storyContextUpdated = true;
      }

      // 7. Save updated graph
      const newVersionId = await updateGraphById(
        id,
        graph,
        `Accept package: ${pkg.title}`,
        undefined,
        ctx
      );

      // 8. Mark session as accepted
      await markSessionAccepted(id, packageId, ctx);

      // 9. Compute stats
      const stats = {
        nodesAdded: pkg.changes.nodes.filter((n) => n.operation === 'add').length,
        nodesModified: pkg.changes.nodes.filter((n) => n.operation === 'modify').length,
        nodesDeleted: pkg.changes.nodes.filter((n) => n.operation === 'delete').length,
        edgesAdded: pkg.changes.edges.filter((e) => e.operation === 'add').length,
        edgesDeleted: pkg.changes.edges.filter((e) => e.operation === 'delete').length,
      };

      res.json({
        success: true,
        data: {
          packageId: pkg.id,
          title: pkg.title,
          newVersionId,
          patchOpsApplied: patch.ops.length,
          ...stats,
          storyContextUpdated,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Regenerate Element Handler
// =============================================================================

interface RegenerateElementRequestBody {
  packageId: string;
  elementType: ElementType;
  elementIndex: number;
  guidance?: string;
  count?: ai.GenerationCount;
}

interface RegenerateElementResponseData {
  options: Array<ai.NodeChange | ai.EdgeChange | ai.StoryContextChange>;
}

export function createRegenerateElementHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, RegenerateElementRequestBody>,
    res: Response<APIResponse<RegenerateElementResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { packageId, elementType, elementIndex, guidance, count = 'few' } = req.body;

      if (!packageId) {
        throw new BadRequestError('packageId is required');
      }
      if (!elementType) {
        throw new BadRequestError('elementType is required');
      }
      if (elementIndex === undefined || elementIndex < 0) {
        throw new BadRequestError('elementIndex must be a non-negative number');
      }
      if (!['node', 'edge', 'storyContext'].includes(elementType)) {
        throw new BadRequestError('elementType must be "node", "edge", or "storyContext"');
      }

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      const request: RegenerateElementRequest = {
        packageId,
        elementType,
        elementIndex,
        count,
      };
      if (guidance) {
        request.guidance = guidance;
      }

      // Check for streaming request
      const wantsStream = req.headers.accept === 'text/event-stream';

      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const streamCallbacks: StreamCallbacks = {
          onToken: (token) => {
            res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
          },
          onComplete: (response) => {
            res.write(`data: ${JSON.stringify({ type: 'usage', usage: response.usage })}\n\n`);
          },
          onError: (error) => {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          },
        };

        const result = await regenerateElement(id, request, ctx, llmClient, streamCallbacks);

        res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await regenerateElement(id, request, ctx, llmClient);

        res.json({
          success: true,
          data: result,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Apply Element Option Handler
// =============================================================================

interface ApplyElementOptionRequestBody {
  packageId: string;
  elementType: ElementType;
  elementIndex: number;
  newElement: ai.NodeChange | ai.EdgeChange | ai.StoryContextChange;
}

interface ApplyElementOptionResponseData {
  package: ai.NarrativePackage;
}

export function createApplyElementOptionHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ApplyElementOptionRequestBody>,
    res: Response<APIResponse<ApplyElementOptionResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { packageId, elementType, elementIndex, newElement } = req.body;

      if (!packageId) {
        throw new BadRequestError('packageId is required');
      }
      if (!elementType) {
        throw new BadRequestError('elementType is required');
      }
      if (elementIndex === undefined || elementIndex < 0) {
        throw new BadRequestError('elementIndex must be a non-negative number');
      }
      if (!newElement) {
        throw new BadRequestError('newElement is required');
      }
      if (!['node', 'edge', 'storyContext'].includes(elementType)) {
        throw new BadRequestError('elementType must be "node", "edge", or "storyContext"');
      }

      const updatedPackage = await applyElementOption(
        id,
        packageId,
        elementType,
        elementIndex,
        newElement,
        ctx
      );

      res.json({
        success: true,
        data: { package: updatedPackage },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Validate Package Handler
// =============================================================================

interface ValidatePackageRequestBody {
  package: ai.NarrativePackage;
}

interface ValidationError {
  type: 'node' | 'edge' | 'storyContext';
  index: number;
  field?: string;
  message: string;
}

interface ValidatePackageResponseData {
  valid: boolean;
  errors: ValidationError[];
}

export function createValidatePackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ValidatePackageRequestBody>,
    res: Response<APIResponse<ValidatePackageResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const pkg = req.body.package;

      if (!pkg || !pkg.id) {
        throw new BadRequestError('package is required');
      }

      // Load current graph state
      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const errors: ValidationError[] = [];

      // Convert package to patch for validation
      const patch = packageToPatch(pkg, state.history.currentVersionId);

      // Run patch validation
      const validation = validatePatch(graph, patch);
      if (!validation.success) {
        // Map patch errors back to package elements
        for (const err of validation.errors) {
          // Try to identify which element caused the error
          const nodeMatch = err.message.match(/node[:\s]+["']?([^"'\s]+)["']?/i);
          const edgeMatch = err.message.match(/edge/i);

          if (nodeMatch) {
            const nodeId = nodeMatch[1];
            const nodeIndex = pkg.changes.nodes.findIndex((n) => n.node_id === nodeId);
            if (nodeIndex >= 0) {
              errors.push({
                type: 'node',
                index: nodeIndex,
                message: err.message,
              });
              continue;
            }
          }

          if (edgeMatch) {
            // Generic edge error - hard to map back precisely
            errors.push({
              type: 'edge',
              index: 0,
              message: err.message,
            });
            continue;
          }

          // General error
          errors.push({
            type: 'node',
            index: 0,
            message: err.message,
          });
        }
      }

      // Validate node changes have required fields
      for (let i = 0; i < pkg.changes.nodes.length; i++) {
        const node = pkg.changes.nodes[i]!;
        if (!node.node_id) {
          errors.push({
            type: 'node',
            index: i,
            field: 'node_id',
            message: 'Node ID is required',
          });
        }
        if (!node.node_type) {
          errors.push({
            type: 'node',
            index: i,
            field: 'node_type',
            message: 'Node type is required',
          });
        }
        if (!node.operation) {
          errors.push({
            type: 'node',
            index: i,
            field: 'operation',
            message: 'Operation is required',
          });
        }
      }

      // Validate edge changes have required fields
      for (let i = 0; i < pkg.changes.edges.length; i++) {
        const edge = pkg.changes.edges[i]!;
        if (!edge.edge_type) {
          errors.push({
            type: 'edge',
            index: i,
            field: 'edge_type',
            message: 'Edge type is required',
          });
        }
        if (!edge.from) {
          errors.push({
            type: 'edge',
            index: i,
            field: 'from',
            message: 'From node is required',
          });
        }
        if (!edge.to) {
          errors.push({
            type: 'edge',
            index: i,
            field: 'to',
            message: 'To node is required',
          });
        }
        if (!edge.operation) {
          errors.push({
            type: 'edge',
            index: i,
            field: 'operation',
            message: 'Operation is required',
          });
        }

        // Check if from/to nodes exist (for add operations, the node might be in the package)
        if (edge.operation === 'add') {
          const fromExists =
            graph.nodes.has(edge.from) ||
            pkg.changes.nodes.some((n) => n.node_id === edge.from && n.operation === 'add');
          const toExists =
            graph.nodes.has(edge.to) ||
            pkg.changes.nodes.some((n) => n.node_id === edge.to && n.operation === 'add');

          if (!fromExists) {
            errors.push({
              type: 'edge',
              index: i,
              field: 'from',
              message: `Source node "${edge.from}" does not exist`,
            });
          }
          if (!toExists) {
            errors.push({
              type: 'edge',
              index: i,
              field: 'to',
              message: `Target node "${edge.to}" does not exist`,
            });
          }
        }
      }

      // Validate story context changes
      const storyContextChanges = pkg.changes.storyContext ?? [];
      for (let i = 0; i < storyContextChanges.length; i++) {
        const sc = storyContextChanges[i]!;
        if (!sc.section) {
          errors.push({
            type: 'storyContext',
            index: i,
            field: 'section',
            message: 'Section is required',
          });
        }
        if (!sc.content && sc.operation !== 'delete') {
          errors.push({
            type: 'storyContext',
            index: i,
            field: 'content',
            message: 'Content is required for add/modify operations',
          });
        }
        if (!sc.operation) {
          errors.push({
            type: 'storyContext',
            index: i,
            field: 'operation',
            message: 'Operation is required',
          });
        }
      }

      res.json({
        success: true,
        data: {
          valid: errors.length === 0,
          errors,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Update Package Element Handler (for manual edits)
// =============================================================================

interface UpdatePackageElementRequestBody {
  packageId: string;
  elementType: ElementType;
  elementIndex: number;
  updatedElement: ai.NodeChange | ai.EdgeChange | ai.StoryContextChange;
}

interface UpdatePackageElementResponseData {
  package: ai.NarrativePackage;
}

export function createUpdatePackageElementHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, UpdatePackageElementRequestBody>,
    res: Response<APIResponse<UpdatePackageElementResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { packageId, elementType, elementIndex, updatedElement } = req.body;

      if (!packageId) {
        throw new BadRequestError('packageId is required');
      }
      if (!elementType) {
        throw new BadRequestError('elementType is required');
      }
      if (elementIndex === undefined || elementIndex < 0) {
        throw new BadRequestError('elementIndex must be a non-negative number');
      }
      if (!updatedElement) {
        throw new BadRequestError('updatedElement is required');
      }
      if (!['node', 'edge', 'storyContext'].includes(elementType)) {
        throw new BadRequestError('elementType must be "node", "edge", or "storyContext"');
      }

      // Use applyElementOption to update the element
      const updatedPackage = await applyElementOption(
        id,
        packageId,
        elementType,
        elementIndex,
        updatedElement,
        ctx
      );

      res.json({
        success: true,
        data: { package: updatedPackage },
      });
    } catch (error) {
      next(error);
    }
  };
}
