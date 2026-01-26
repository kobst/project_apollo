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
  getNode,
  isValidEdgeType,
  type Patch,
  type PatchOp,
  type NodeType,
  type EdgeType,
  type GraphState,
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
  propose,
  getActiveProposal,
  discardActiveProposal,
} from '../ai/proposeOrchestrator.js';
import {
  proposeStoryBeats,
  type ProposeStoryBeatsRequest,
} from '../ai/storyBeatOrchestrator.js';
import {
  proposeCharacters,
  type ProposeCharactersRequest,
} from '../ai/characterOrchestrator.js';
import {
  proposeScenes,
  type ProposeScenesRequest,
} from '../ai/sceneOrchestrator.js';
import {
  proposeExpand,
  type ProposeExpandRequest,
} from '../ai/expandOrchestrator.js';
import type { MissingBeatInfo } from '@apollo/core';
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

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.write(`data: ${JSON.stringify({ type: 'result', data: enrichedResult })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await generatePackages(id, request, ctx, llmClient);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.json({
          success: true,
          data: enrichedResult,
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

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.write(`data: ${JSON.stringify({ type: 'result', data: enrichedResult })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await regenerateAll(id, ctx, llmClient);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.json({
          success: true,
          data: enrichedResult,
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

        // Enrich variations with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          variations: result.variations.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.write(`data: ${JSON.stringify({ type: 'result', data: enrichedResult })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await refinePackage(id, request, ctx, llmClient);

        // Enrich variations with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          variations: result.variations.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.json({
          success: true,
          data: enrichedResult,
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

      // Load graph to resolve edge names
      const graph = await loadGraphById(id, ctx);

      // Enrich packages with resolved edge names
      const enrichedPackages = session.packages.map((pkg) =>
        resolveEdgeNames(pkg, graph)
      );

      // Include refinable elements for current package if present
      let refinableElements: ReturnType<typeof getRefinableElements> | undefined;
      if (session.currentPackageId) {
        const currentPkg = enrichedPackages.find((p) => p.id === session.currentPackageId);
        if (currentPkg) {
          refinableElements = getRefinableElements(currentPkg);
        }
      }

      const responseData: SessionResponseData = {
        ...session,
        packages: enrichedPackages,
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
 * Truncate text to a maximum length with ellipsis.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get a human-readable name for a node.
 * For Scene nodes, combines heading with title or truncated scene_overview.
 */
function getNodeName(nodeData: Record<string, unknown>, nodeType?: string): string | null {
  // Special handling for Scene nodes - combine heading with content
  if (nodeType === 'Scene') {
    const heading = nodeData.heading as string | undefined;
    const title = nodeData.title as string | undefined;
    const overview = nodeData.scene_overview as string | undefined;

    if (heading) {
      // Prefer title if set, otherwise use truncated overview
      const content = title ?? (overview ? truncate(overview, 30) : null);
      if (content) {
        return `${heading}: ${content}`;
      }
      return heading;
    }
  }

  // Standard name extraction for other node types
  const name = nodeData.name ?? nodeData.title ?? nodeData.heading ?? nodeData.text;
  if (name && typeof name === 'string' && name.trim()) {
    return name.trim();
  }
  return null;
}

/**
 * Resolve edge IDs to human-readable names.
 * Looks up nodes in both the existing graph and new nodes in the package.
 */
export function resolveEdgeNames(
  pkg: ai.NarrativePackage,
  graph: GraphState | null
): ai.NarrativePackage {
  // Build a lookup of new node IDs to names from the package
  const newNodeNames = new Map<string, string>();
  for (const nodeChange of pkg.changes.nodes) {
    if (nodeChange.data) {
      const name = getNodeName(
        nodeChange.data as Record<string, unknown>,
        nodeChange.node_type
      );
      if (name) {
        newNodeNames.set(nodeChange.node_id, name);
      }
    }
  }

  // Resolve names for each edge
  const enrichedEdges = pkg.changes.edges.map((edge) => {
    let fromName: string | undefined;
    let toName: string | undefined;

    // Try new nodes first, then existing graph
    fromName = newNodeNames.get(edge.from);
    if (!fromName && graph) {
      const fromNode = getNode(graph, edge.from);
      if (fromNode) {
        fromName = getNodeName(
          fromNode as unknown as Record<string, unknown>,
          fromNode.type
        ) ?? undefined;
      }
    }

    toName = newNodeNames.get(edge.to);
    if (!toName && graph) {
      const toNode = getNode(graph, edge.to);
      if (toNode) {
        toName = getNodeName(
          toNode as unknown as Record<string, unknown>,
          toNode.type
        ) ?? undefined;
      }
    }

    // Only include name properties if defined (exactOptionalPropertyTypes compliance)
    const result = { ...edge };
    if (fromName !== undefined) {
      result.from_name = fromName;
    }
    if (toName !== undefined) {
      result.to_name = toName;
    }
    return result;
  });

  return {
    ...pkg,
    changes: {
      ...pkg.changes,
      edges: enrichedEdges,
    },
  };
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

  // Convert edge changes to patch ops (filter out invalid edge types)
  for (const edgeChange of pkg.changes.edges) {
    // Skip invalid edge types that the LLM might have hallucinated
    if (!isValidEdgeType(edgeChange.edge_type)) {
      console.warn(`[packageToPatch] Skipping invalid edge type: ${edgeChange.edge_type}`);
      continue;
    }

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

      // Handle Story Context changes
      let storyContextUpdated = false;
      let metadataUpdates: { storyContext?: string; storyContextModifiedAt?: string } | undefined;

      if (pkg.changes.storyContext && pkg.changes.storyContext.length > 0) {
        const currentContext = state.metadata?.storyContext;
        const updatedContext = applyStoryContextChanges(currentContext, pkg.changes.storyContext);

        metadataUpdates = {
          storyContext: updatedContext,
          storyContextModifiedAt: new Date().toISOString(),
        };
        storyContextUpdated = true;
      }

      // Save updated graph (with optional story context updates)
      const newVersionId = await updateGraphById(
        id,
        graph,
        `Apply package: ${pkg.title}`,
        metadataUpdates,
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
          storyContextUpdated,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export function createAcceptPackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, { packageId: string; excludedStashedIdeaIds?: string[] }>,
    res: Response<APIResponse<AcceptPackageResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { packageId, excludedStashedIdeaIds } = req.body;

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

      // 6. Handle stashed ideas -> convert to Idea nodes (filter excluded ones)
      let ideasCreated = 0;
      const excludedIdsSet = excludedStashedIdeaIds ? new Set(excludedStashedIdeaIds) : new Set<string>();
      if (pkg.suggestions?.stashedIdeas && pkg.suggestions.stashedIdeas.length > 0) {
        const timestamp = new Date().toISOString();
        for (const idea of pkg.suggestions.stashedIdeas) {
          // Skip excluded ideas
          if (excludedIdsSet.has(idea.id)) {
            continue;
          }

          // Create Idea node and add to graph
          const ideaNode = {
            type: 'Idea' as const,
            id: idea.id.startsWith('idea_') ? idea.id : `idea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            title: idea.content.slice(0, 50) + (idea.content.length > 50 ? '...' : ''),
            description: idea.content,
            source: 'ai' as const,
            status: 'active' as const,
            category: idea.category,
            sourcePackageId: pkg.id,
            createdAt: timestamp,
          };

          // Add idea node to graph
          graph.nodes.set(ideaNode.id, ideaNode as unknown as Parameters<typeof graph.nodes.set>[1]);
          ideasCreated++;
        }
      }

      // 7. Handle Story Context changes
      let storyContextUpdated = false;
      let metadataUpdates: { storyContext?: string; storyContextModifiedAt?: string } | undefined;

      if (pkg.changes.storyContext && pkg.changes.storyContext.length > 0) {
        const currentContext = state.metadata?.storyContext;
        const updatedContext = applyStoryContextChanges(currentContext, pkg.changes.storyContext);

        metadataUpdates = {
          storyContext: updatedContext,
          storyContextModifiedAt: new Date().toISOString(),
        };
        storyContextUpdated = true;
      }

      // 8. Save updated graph (with optional story context updates)
      const newVersionId = await updateGraphById(
        id,
        graph,
        `Accept package: ${pkg.title}`,
        metadataUpdates,
        ctx
      );

      // 9. Mark session as accepted
      await markSessionAccepted(id, packageId, ctx);

      // 10. Compute stats
      const stats = {
        nodesAdded: pkg.changes.nodes.filter((n) => n.operation === 'add').length + ideasCreated,
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
          patchOpsApplied: patch.ops.length + ideasCreated,
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
// Story Context Change Application
// =============================================================================

/**
 * Apply story context changes to the existing story context.
 * Returns the updated story context string.
 */
function applyStoryContextChanges(
  currentContext: string | undefined,
  changes: ai.StoryContextChange[]
): string {
  let context = currentContext ?? '';

  for (const change of changes) {
    switch (change.operation) {
      case 'add': {
        // Find the section or create it
        const sectionRegex = new RegExp(`^## ${escapeRegex(change.section)}\\s*$`, 'm');
        const sectionMatch = context.match(sectionRegex);

        if (sectionMatch && sectionMatch.index !== undefined) {
          // Section exists - find where to insert (before next ## or end of file)
          const afterSection = context.slice(sectionMatch.index + sectionMatch[0].length);
          const nextSectionMatch = afterSection.match(/^## /m);

          if (nextSectionMatch && nextSectionMatch.index !== undefined) {
            // Insert before next section
            const insertPos = sectionMatch.index + sectionMatch[0].length + nextSectionMatch.index;
            const before = context.slice(0, insertPos).trimEnd();
            const after = context.slice(insertPos);
            context = before + '\n\n' + change.content + '\n\n' + after.trimStart();
          } else {
            // No next section - append at end
            context = context.trimEnd() + '\n\n' + change.content;
          }
        } else {
          // Section doesn't exist - create it at the end
          context = context.trimEnd() + '\n\n## ' + change.section + '\n\n' + change.content;
        }
        break;
      }

      case 'modify': {
        if (change.previous_content) {
          // Replace the previous content with new content
          const escapedPrevious = escapeRegex(change.previous_content);
          const modifyRegex = new RegExp(escapedPrevious, 'g');
          context = context.replace(modifyRegex, change.content);
        } else {
          // No previous_content - just add to section
          const sectionRegex = new RegExp(`^## ${escapeRegex(change.section)}\\s*$`, 'm');
          const sectionMatch = context.match(sectionRegex);

          if (sectionMatch && sectionMatch.index !== undefined) {
            // Find the end of section content (next ## or end)
            const afterSection = context.slice(sectionMatch.index + sectionMatch[0].length);
            const nextSectionMatch = afterSection.match(/^## /m);

            if (nextSectionMatch && nextSectionMatch.index !== undefined) {
              const insertPos = sectionMatch.index + sectionMatch[0].length + nextSectionMatch.index;
              const before = context.slice(0, insertPos).trimEnd();
              const after = context.slice(insertPos);
              context = before + '\n\n' + change.content + '\n\n' + after.trimStart();
            } else {
              context = context.trimEnd() + '\n\n' + change.content;
            }
          }
        }
        break;
      }

      case 'delete': {
        // Remove the specified content
        const escapedContent = escapeRegex(change.content);
        const deleteRegex = new RegExp(escapedContent + '\\s*', 'g');
        context = context.replace(deleteRegex, '');
        // Clean up multiple blank lines
        context = context.replace(/\n{3,}/g, '\n\n');
        break;
      }
    }
  }

  return context.trim();
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// =============================================================================
// Unified Propose Handlers
// =============================================================================

interface ProposeResponseData {
  sessionId: string;
  packages: ai.NarrativePackage[];
  interpretation?: {
    summary: string;
    confidence: number;
    alternatives?: Array<{ summary: string; confidence: number }>;
  };
}

interface ProposeRequestBody {
  intent: ai.ProposeIntent;
  scope: ai.ProposeScope;
  input?: ai.ProposeInput;
  mode?: ai.ProposalMode;
  constraints?: ai.ProposeConstraints;
  options?: ai.ProposeOptions;
}

/**
 * POST /stories/:id/propose
 *
 * Unified endpoint for all AI-assisted story generation.
 * Routes to appropriate strategy based on intent, entry point, and creativity.
 */
export function createProposeHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ProposeRequestBody>,
    res: Response<APIResponse<ProposeResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    console.log('[proposeHandler] Received propose request');
    try {
      const { id } = req.params;
      const { intent, scope, input, mode, constraints, options } = req.body;

      // Validate required fields
      if (!intent) {
        throw new BadRequestError('intent is required');
      }
      if (!scope?.entryPoint) {
        throw new BadRequestError('scope.entryPoint is required');
      }
      // Either mode or constraints.creativity must be provided
      if (!mode && constraints?.creativity === undefined) {
        throw new BadRequestError('Either mode or constraints.creativity is required');
      }

      console.log(`[proposeHandler] Story: ${id}, intent: ${intent}, entryPoint: ${scope.entryPoint}, mode: ${mode ?? 'none'}, creativity: ${constraints?.creativity ?? 'from mode'}`);

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      // Build propose request - let orchestrator resolve defaults from mode
      const proposeRequest: ai.ProposeRequest = {
        intent,
        scope,
      };

      // Add mode if provided
      if (mode) {
        proposeRequest.mode = mode;
      }

      // Add input if provided
      if (input) {
        proposeRequest.input = input;
      }

      // Add constraints if provided (overrides mode defaults)
      if (constraints) {
        proposeRequest.constraints = {};
        if (constraints.creativity !== undefined) {
          proposeRequest.constraints.creativity = constraints.creativity;
        }
        if (constraints.inventNewEntities !== undefined) {
          proposeRequest.constraints.inventNewEntities = constraints.inventNewEntities;
        }
        if (constraints.respectStructure !== undefined) {
          proposeRequest.constraints.respectStructure = constraints.respectStructure;
        }
      }

      // Add options if provided (overrides mode defaults)
      if (options) {
        proposeRequest.options = {};
        if (options.packageCount !== undefined) {
          proposeRequest.options.packageCount = options.packageCount;
        }
        if (options.maxNodesPerPackage !== undefined) {
          proposeRequest.options.maxNodesPerPackage = options.maxNodesPerPackage;
        }
      }

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

        const result = await propose(id, proposeRequest, ctx, llmClient, streamCallbacks);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.write(`data: ${JSON.stringify({ type: 'result', data: enrichedResult })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await propose(id, proposeRequest, ctx, llmClient);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.json({
          success: true,
          data: enrichedResult,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * GET /stories/:id/propose/active
 *
 * Get the active proposal for a story.
 */
export function createGetActiveProposalHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<ProposeResponseData | null>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await getActiveProposal(id, ctx);

      if (!result) {
        res.json({
          success: true,
          data: null,
        });
        return;
      }

      // Enrich packages with edge names
      const graph = await loadGraphById(id, ctx);
      const enrichedPackages = result.packages.map((pkg) => resolveEdgeNames(pkg, graph));

      res.json({
        success: true,
        data: {
          sessionId: result.sessionId,
          packages: enrichedPackages,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * DELETE /stories/:id/propose/active
 *
 * Discard the active proposal for a story.
 */
export function createDiscardProposalHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<{ discarded: boolean }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await discardActiveProposal(id, ctx);

      res.json({
        success: true,
        data: { discarded: true },
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * POST /stories/:id/propose/commit
 *
 * Commit the active proposal (accept a package).
 * Wrapper around accept-package for the propose pipeline.
 */
export function createCommitProposalHandler(ctx: StorageContext) {
  // Reuse the existing accept package handler
  return createAcceptPackageHandler(ctx);
}

/**
 * POST /stories/:id/propose/refine
 *
 * Refine a package in the active proposal.
 */
export function createRefineProposalHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, { packageId: string; guidance: string; creativity?: number }>,
    res: Response<APIResponse<ProposeResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    console.log('[refineProposalHandler] Received refine request');
    try {
      const { id } = req.params;
      const { packageId, guidance, creativity = 0.5 } = req.body;

      if (!packageId) {
        throw new BadRequestError('packageId is required');
      }
      if (!guidance || !guidance.trim()) {
        throw new BadRequestError('guidance is required');
      }

      console.log(`[refineProposalHandler] Story: ${id}, packageId: ${packageId}, creativity: ${creativity}`);

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      // Build propose request for refinement
      const proposeRequest: ai.ProposeRequest = {
        intent: 'edit',
        scope: {
          entryPoint: 'node',
          targetIds: [packageId],
        },
        input: { text: guidance },
        constraints: {
          creativity,
          inventNewEntities: creativity > 0.5,
          respectStructure: creativity < 0.5 ? 'strict' : 'soft',
        },
        options: { packageCount: 3 },
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

        const result = await propose(id, proposeRequest, ctx, llmClient, streamCallbacks);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.write(`data: ${JSON.stringify({ type: 'result', data: enrichedResult })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await propose(id, proposeRequest, ctx, llmClient);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.json({
          success: true,
          data: enrichedResult,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Propose StoryBeats Handler (StoryBeat-only generation)
// =============================================================================

interface ProposeStoryBeatsResponseData {
  sessionId: string;
  packages: ai.NarrativePackage[];
  missingBeats: MissingBeatInfo[];
}

interface ProposeStoryBeatsRequestBody {
  priorityBeats?: string[];
  packageCount?: number;
  maxStoryBeatsPerPackage?: number;
  direction?: string;
  creativity?: number;
  expansionScope?: ai.ExpansionScope;
  targetAct?: 1 | 2 | 3 | 4 | 5;
}

/**
 * POST /stories/:id/propose/story-beats
 *
 * Generate StoryBeat nodes to fill structural gaps (beats without alignment).
 * Returns only StoryBeat nodes with ALIGNS_WITH and PRECEDES edges.
 */
export function createProposeStoryBeatsHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ProposeStoryBeatsRequestBody>,
    res: Response<APIResponse<ProposeStoryBeatsResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    console.log('[proposeStoryBeatsHandler] Received propose story-beats request');
    try {
      const { id } = req.params;
      const {
        priorityBeats = [],
        packageCount = 3,
        maxStoryBeatsPerPackage = 5,
        direction,
        creativity = 0.5,
        expansionScope = 'flexible',
        targetAct,
      } = req.body;

      console.log(`[proposeStoryBeatsHandler] Story: ${id}, priorityBeats: ${priorityBeats.length}, packageCount: ${packageCount}`);

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      const request: ProposeStoryBeatsRequest = {
        priorityBeats,
        packageCount,
        maxStoryBeatsPerPackage,
        creativity,
        expansionScope,
      };
      if (targetAct) {
        request.targetAct = targetAct;
      }
      if (direction) {
        request.direction = direction;
      }

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

        const result = await proposeStoryBeats(id, request, ctx, llmClient, streamCallbacks);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.write(`data: ${JSON.stringify({ type: 'result', data: enrichedResult })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await proposeStoryBeats(id, request, ctx, llmClient);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.json({
          success: true,
          data: enrichedResult,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Propose Characters Handler (Character-focused generation)
// =============================================================================

interface ProposeCharactersResponseData {
  sessionId: string;
  packages: ai.NarrativePackage[];
  existingCharacters: ai.CharacterSummary[];
}

interface ProposeCharactersRequestBody {
  focus: ai.CharacterFocus;
  characterId?: string;
  includeArcs?: boolean;
  maxCharactersPerPackage?: number;
  expansionScope?: ai.ExpansionScope;
  direction?: string;
  packageCount?: number;
  creativity?: number;
}

/**
 * POST /stories/:id/propose/characters
 *
 * Generate Character nodes with optional CharacterArc nodes.
 */
export function createProposeCharactersHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ProposeCharactersRequestBody>,
    res: Response<APIResponse<ProposeCharactersResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    console.log('[proposeCharactersHandler] Received propose characters request');
    try {
      const { id } = req.params;
      const {
        focus,
        characterId,
        includeArcs = true,
        maxCharactersPerPackage = 3,
        expansionScope = 'flexible',
        direction,
        packageCount = 3,
        creativity = 0.5,
      } = req.body;

      if (!focus) {
        throw new BadRequestError('focus is required');
      }

      if (focus === 'develop_existing' && !characterId) {
        throw new BadRequestError('characterId is required for "develop_existing" focus');
      }

      console.log(`[proposeCharactersHandler] Story: ${id}, focus: ${focus}, includeArcs: ${includeArcs}`);

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      const request: ProposeCharactersRequest = {
        focus,
        includeArcs,
        maxCharactersPerPackage,
        expansionScope,
        packageCount,
        creativity,
      };
      if (characterId) {
        request.characterId = characterId;
      }
      if (direction) {
        request.direction = direction;
      }

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

        const result = await proposeCharacters(id, request, ctx, llmClient, streamCallbacks);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.write(`data: ${JSON.stringify({ type: 'result', data: enrichedResult })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await proposeCharacters(id, request, ctx, llmClient);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.json({
          success: true,
          data: enrichedResult,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Propose Scenes Handler (Scene-focused generation)
// =============================================================================

interface ProposeScenesResponseData {
  sessionId: string;
  packages: ai.NarrativePackage[];
  validatedBeats: ai.ValidatedBeatInfo[];
  rejectedBeats: ai.RejectedBeatInfo[];
}

interface ProposeScenesRequestBody {
  storyBeatIds: string[];
  scenesPerBeat?: number;
  maxScenesPerPackage?: number;
  expansionScope?: ai.ExpansionScope;
  direction?: string;
  packageCount?: number;
  creativity?: number;
}

/**
 * POST /stories/:id/propose/scenes
 *
 * Generate Scene nodes for committed StoryBeats.
 */
export function createProposeScenesHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ProposeScenesRequestBody>,
    res: Response<APIResponse<ProposeScenesResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    console.log('[proposeScenesHandler] Received propose scenes request');
    try {
      const { id } = req.params;
      const {
        storyBeatIds,
        scenesPerBeat = 1,
        maxScenesPerPackage = 5,
        expansionScope = 'flexible',
        direction,
        packageCount = 3,
        creativity = 0.5,
      } = req.body;

      if (!storyBeatIds || storyBeatIds.length === 0) {
        throw new BadRequestError('storyBeatIds is required and must contain at least one ID');
      }

      console.log(`[proposeScenesHandler] Story: ${id}, storyBeatIds: ${storyBeatIds.length}`);

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      const request: ProposeScenesRequest = {
        storyBeatIds,
        scenesPerBeat,
        maxScenesPerPackage,
        expansionScope,
        packageCount,
        creativity,
      };
      if (direction) {
        request.direction = direction;
      }

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

        const result = await proposeScenes(id, request, ctx, llmClient, streamCallbacks);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.write(`data: ${JSON.stringify({ type: 'result', data: enrichedResult })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await proposeScenes(id, request, ctx, llmClient);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.json({
          success: true,
          data: enrichedResult,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Propose Expand Handler (Generic node expansion)
// =============================================================================

interface ProposeExpandResponseData {
  sessionId: string;
  packages: ai.NarrativePackage[];
  expandedTarget: {
    type: 'node' | 'story-context';
    nodeId?: string;
    nodeType?: string;
    section?: ai.ContextSection;
  };
}

interface ProposeExpandRequestBody {
  target: ai.ExpandTarget;
  depth?: 'surface' | 'deep';
  maxNodesPerPackage?: number;
  expansionScope?: ai.ExpansionScope;
  direction?: string;
  packageCount?: number;
  creativity?: number;
}

/**
 * POST /stories/:id/propose/expand
 *
 * Expand a node or story context into related content.
 */
export function createProposeExpandHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ProposeExpandRequestBody>,
    res: Response<APIResponse<ProposeExpandResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    console.log('[proposeExpandHandler] Received propose expand request');
    try {
      const { id } = req.params;
      const {
        target,
        depth = 'deep',
        maxNodesPerPackage = 5,
        expansionScope = 'flexible',
        direction,
        packageCount = 3,
        creativity = 0.5,
      } = req.body;

      if (!target || !target.type) {
        throw new BadRequestError('target with type is required');
      }

      if (target.type === 'node' && !target.nodeId) {
        throw new BadRequestError('nodeId is required for node expansion');
      }

      if (target.type === 'story-context-section' && !target.section) {
        throw new BadRequestError('section is required for story-context-section expansion');
      }

      console.log(`[proposeExpandHandler] Story: ${id}, target type: ${target.type}`);

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      const llmClient = createLLMClient();

      const request: ProposeExpandRequest = {
        target,
        depth,
        maxNodesPerPackage,
        expansionScope,
        packageCount,
        creativity,
      };
      if (direction) {
        request.direction = direction;
      }

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

        const result = await proposeExpand(id, request, ctx, llmClient, streamCallbacks);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.write(`data: ${JSON.stringify({ type: 'result', data: enrichedResult })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const result = await proposeExpand(id, request, ctx, llmClient);

        // Enrich packages with edge names
        const graph = await loadGraphById(id, ctx);
        const enrichedResult = {
          ...result,
          packages: result.packages.map((pkg) => resolveEdgeNames(pkg, graph)),
        };

        res.json({
          success: true,
          data: enrichedResult,
        });
      }
    } catch (error) {
      next(error);
    }
  };
}
