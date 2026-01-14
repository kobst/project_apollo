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
  type Patch,
  type PatchOp,
  type NodeType,
  type EdgeType,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
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
  createLLMClient,
  isLLMConfigured,
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
        throw new BadRequestError(
          'ANTHROPIC_API_KEY not configured',
          'Set the ANTHROPIC_API_KEY environment variable'
        );
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

        res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
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
        throw new BadRequestError(
          'ANTHROPIC_API_KEY not configured',
          'Set the ANTHROPIC_API_KEY environment variable'
        );
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
        throw new BadRequestError(
          'ANTHROPIC_API_KEY not configured',
          'Set the ANTHROPIC_API_KEY environment variable'
        );
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
        throw new BadRequestError(
          'ANTHROPIC_API_KEY not configured',
          'Set the ANTHROPIC_API_KEY environment variable'
        );
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
}

export function createConvertProposalHandler(_ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, { proposal: ai.InterpretationProposal }>,
    res: Response<APIResponse<ConvertProposalResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { proposal } = req.body;

      if (!proposal) {
        throw new BadRequestError('proposal is required');
      }

      const pkg = proposalToPackage(proposal);

      res.json({
        success: true,
        data: { package: pkg },
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
function packageToPatch(
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
