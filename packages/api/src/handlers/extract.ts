/**
 * POST /stories/:id/extract - Extract proposals from freeform text input
 * Returns extraction proposals that can be previewed and accepted like moves
 */

import type { Request, Response, NextFunction } from 'express';
import { extractFromInput, applyPatch } from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  saveVersionedStateById,
  serializeGraph,
  deserializeGraph,
} from '../storage.js';
import {
  setExtractionProposalsById,
  findExtractionProposalById,
  removeExtractionProposalById,
} from '../session.js';
import type { ExtractionProposal } from '../session.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';

// Request body
interface ExtractRequest {
  input: string;
  targetType?: string;
  targetNodeId?: string;
}

// Response types
interface ExtractedEntity {
  type: string;
  name: string;
  id: string;
}

interface ProposalData {
  id: string;
  title: string;
  description: string;
  confidence: number;
  extractedEntities: ExtractedEntity[];
  patchId: string;
  opsCount: number;
}

interface ExtractData {
  storyId: string;
  inputSummary: string;
  targetType: string | null;
  targetNodeId: string | null;
  proposals: ProposalData[];
}

export function createExtractHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, ExtractRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { input, targetType, targetNodeId } = req.body;

      if (!input || typeof input !== 'string') {
        throw new BadRequestError('input is required and must be a string');
      }

      if (input.trim().length < 10) {
        throw new BadRequestError(
          'input must be at least 10 characters',
          'Provide more descriptive text for extraction'
        );
      }

      // Load story state
      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      // Get current version ID
      const currentVersionId = state.history.currentVersionId;

      // Run extraction
      const result = extractFromInput(
        input.trim(),
        currentVersionId,
        targetType,
        targetNodeId
      );

      // Convert to session format and store
      const sessionProposals: ExtractionProposal[] = result.proposals.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        confidence: p.confidence,
        extractedEntities: p.extractedEntities,
        patch: p.patch,
      }));

      await setExtractionProposalsById(id, sessionProposals, ctx);

      // Format response
      const data: ExtractData = {
        storyId: id,
        inputSummary: result.inputSummary,
        targetType: result.targetType,
        targetNodeId: result.targetNodeId,
        proposals: result.proposals.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          confidence: p.confidence,
          extractedEntities: p.extractedEntities,
          patchId: p.patch.id,
          opsCount: p.patch.ops.length,
        })),
      };

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * GET /stories/:id/extract/:proposalId/preview - Preview an extraction proposal
 */
export function createExtractPreviewHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; proposalId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, proposalId } = req.params;

      // Get stored proposal from session
      const proposal = await findExtractionProposalById(id, proposalId, ctx);

      if (!proposal) {
        throw new NotFoundError(
          `Proposal "${proposalId}"`,
          'Run POST /stories/:id/extract first'
        );
      }

      // Return the patch details for preview
      res.json({
        success: true,
        data: {
          proposal: {
            id: proposal.id,
            title: proposal.title,
            description: proposal.description,
            confidence: proposal.confidence,
            extractedEntities: proposal.extractedEntities,
          },
          patch: {
            id: proposal.patch.id,
            baseVersionId: proposal.patch.base_story_version_id,
            ops: proposal.patch.ops.map((op) => {
              const result: Record<string, unknown> = { op: op.op };
              if ('node' in op && op.node) {
                const node = op.node as { type?: string; id?: string };
                result.type = node.type;
                result.id = node.id;
              }
              if ('edge' in op && op.edge) {
                const edge = op.edge as { type: string; from: string; to: string };
                result.edge = {
                  type: edge.type,
                  source: edge.from,
                  target: edge.to,
                };
              }
              return result;
            }),
          },
          // Simple validation - always valid for stub
          validation: {
            valid: true,
            errors: [],
          },
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * POST /stories/:id/extract/:proposalId/accept - Accept an extraction proposal
 */
export function createExtractAcceptHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; proposalId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, proposalId } = req.params;

      // Get stored proposal from session
      const proposal = await findExtractionProposalById(id, proposalId, ctx);

      if (!proposal) {
        throw new NotFoundError(
          `Proposal "${proposalId}"`,
          'Run POST /stories/:id/extract first'
        );
      }

      // Load current state
      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Apply the patch
      const newGraph = applyPatch(graph, proposal.patch);

      // Create new version
      const newVersionId = `v_${Date.now()}`;
      const timestamp = new Date().toISOString();

      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: state.history.currentVersionId,
        created_at: timestamp,
        label: `Extract: ${proposal.title}`,
        graph: serializeGraph(newGraph),
      };

      state.history.currentVersionId = newVersionId;
      state.updatedAt = timestamp;

      // Update branch if on one
      if (state.history.currentBranch) {
        const branch = state.history.branches[state.history.currentBranch];
        if (branch) {
          branch.headVersionId = newVersionId;
        }
      }

      // Save state
      await saveVersionedStateById(id, state, ctx);

      // Remove the proposal from session
      await removeExtractionProposalById(id, proposalId, ctx);

      res.json({
        success: true,
        data: {
          accepted: {
            proposalId: proposal.id,
            title: proposal.title,
          },
          newVersionId,
          opsApplied: proposal.patch.ops.length,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
