/**
 * Idea handlers
 * POST /stories/:id/ideas - Create idea
 * GET /stories/:id/ideas - List ideas
 * GET /stories/:id/ideas/:ideaId - Get single
 * PATCH /stories/:id/ideas/:ideaId - Update properties
 * DELETE /stories/:id/ideas/:ideaId - Delete
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getNode,
  getNodesByType,
  applyPatch,
} from '@apollo/core';
import type { Patch, Idea } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, saveVersionedStateById, deserializeGraph, serializeGraph } from '../storage.js';
import { createLLMClient, isLLMConfigured, getMissingKeyError, type LLMClient } from '../ai/llmClient.js';
import { ai } from '@apollo/core';
import {
  loadIdeaRefinementSession,
  saveIdeaRefinementSession,
  deleteIdeaRefinementSession,
  type IdeaRefinementSession,
  type IdeaRefinementVariant,
} from '../session.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse, NodeData } from '../types.js';
import { findPackageInSession } from '../session.js';

// =============================================================================
// Response Types
// =============================================================================

interface IdeaData extends NodeData {
  source: 'user' | 'ai';
  suggestedType?: string;
  status?: 'active' | 'promoted' | 'dismissed';
  category?: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
  sourcePackageId?: string;
  relatedNodeIds?: string[];
}

interface IdeasListData {
  ideas: IdeaData[];
  totalCount: number;
  limit: number;
  offset: number;
}

interface CreateIdeaData {
  idea: IdeaData;
  newVersionId: string;
}

interface UpdateIdeaData {
  idea: IdeaData;
  newVersionId: string;
  fieldsUpdated: string[];
}

interface DeleteIdeaData {
  deleted: true;
  newVersionId: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getIdeaLabel(idea: Idea): string {
  return idea.title || `Idea:${idea.id.slice(0, 8)}`;
}

function sanitizeIdeaData(idea: Idea): Record<string, unknown> {
  const { id, type, ...rest } = idea as unknown as Record<string, unknown>;
  return rest;
}

function toIdeaData(idea: Idea): IdeaData {
  return {
    id: idea.id,
    type: idea.type,
    label: getIdeaLabel(idea),
    data: sanitizeIdeaData(idea),
    source: idea.source,
    ...(idea.suggestedType && { suggestedType: idea.suggestedType }),
    ...(idea.status && { status: idea.status }),
    ...(idea.category && { category: idea.category }),
    ...(idea.sourcePackageId && { sourcePackageId: idea.sourcePackageId }),
    ...(idea.relatedNodeIds && { relatedNodeIds: idea.relatedNodeIds }),
  };
}

function inferKindFromContentAPI(content: string): 'proposal' | 'question' | 'direction' | 'constraint' | 'note' {
  const lower = content.toLowerCase();
  if (/^(who|what|when|where|why|how|should|could|is|are|does)\b/.test(content)) return 'question';
  if (/(must|should not|cannot|avoid|never|^no\s|don't)/.test(lower)) return 'constraint';
  if (/(act\s*\d|scene|beat|should|needs to|has to|make sure)/.test(lower)) return 'direction';
  return 'proposal';
}

// =============================================================================
// POST /stories/:id/ideas
// =============================================================================

interface CreateIdeaBody {
  title: string;
  description: string;
  source?: 'user' | 'ai';
  suggestedType?: 'StoryBeat' | 'Scene' | 'Character' | 'Location' | 'Object';
  status?: 'active' | 'promoted' | 'dismissed';
  category?: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
  sourcePackageId?: string;
  relatedNodeIds?: string[];
  // Enhanced planning fields (optional)
  kind?: 'proposal' | 'question' | 'direction' | 'constraint' | 'note';
  resolutionStatus?: 'open' | 'discussed' | 'resolved' | 'archived';
  resolution?: string;
  parent_idea_id?: string;
  refinement_guidance?: string;
  targetBeat?: string;
  targetAct?: number;
  targetScene?: string;
  themes?: string[];
  moods?: string[];
}

export function createIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, CreateIdeaBody>,
    res: Response<APIResponse<CreateIdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        source = 'user',
        suggestedType,
        status = 'active',
        category,
        sourcePackageId,
        relatedNodeIds,
        kind,
        resolutionStatus,
        resolution,
        parent_idea_id,
        refinement_guidance,
        targetBeat,
        targetAct,
        targetScene,
        themes,
        moods,
      } = req.body;

      if (!title || title.trim() === '') {
        throw new BadRequestError('title is required');
      }

      if (!description || description.trim() === '') {
        throw new BadRequestError('description is required');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Generate IDs
      const timestamp = new Date().toISOString();
      const ideaId = `idea_${Date.now()}`;
      const patchId = `patch_idea_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Build the Idea node
      const idea: Idea = {
        type: 'Idea',
        id: ideaId,
        title: title.trim(),
        description: description.trim(),
        source,
        status,
        createdAt: timestamp,
      };

      if (suggestedType) idea.suggestedType = suggestedType;
      if (category) idea.category = category;
      if (sourcePackageId) idea.sourcePackageId = sourcePackageId;
      if (relatedNodeIds) idea.relatedNodeIds = relatedNodeIds;
      const ideaAny = idea as unknown as Record<string, unknown>;
      if (kind) ideaAny.kind = kind;
      if (resolutionStatus) ideaAny.resolutionStatus = resolutionStatus;
      if (resolution) ideaAny.resolution = resolution;
      if (parent_idea_id) ideaAny.parent_idea_id = parent_idea_id;
      if (refinement_guidance) ideaAny.refinement_guidance = refinement_guidance;
      if (targetBeat) ideaAny.targetBeat = targetBeat;
      if (typeof targetAct === 'number') ideaAny.targetAct = targetAct;
      if (targetScene) ideaAny.targetScene = targetScene;
      if (themes) ideaAny.themes = themes;
      if (moods) ideaAny.moods = moods;

      // Build patch operations
      const ops: Patch['ops'] = [
        { op: 'ADD_NODE', node: idea },
      ];

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops,
        metadata: {
          source: 'ideaHandler',
          action: 'create',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Created Idea: ${idea.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.status(201).json({
        success: true,
        data: {
          idea: toIdeaData(idea),
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// GET /stories/:id/ideas
// =============================================================================

interface ListIdeasQuery {
  source?: string;
  suggestedType?: string;
  status?: string;
  category?: string;
  limit?: string;
  offset?: string;
  // Enhanced planning filters
  kind?: string;
  resolutionStatus?: string;
  targetBeat?: string;
  targetAct?: string;
}

export function listIdeasHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, ListIdeasQuery>,
    res: Response<APIResponse<IdeasListData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { source, suggestedType, status, category, kind, resolutionStatus, targetBeat, targetAct, limit: limitStr, offset: offsetStr } = req.query;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);

      // Get all ideas
      let ideas = getNodesByType<Idea>(graph, 'Idea');

      // Apply filters
      if (source) {
        ideas = ideas.filter((i) => i.source === source);
      }
      if (suggestedType) {
        ideas = ideas.filter((i) => i.suggestedType === suggestedType);
      }
      if (status) {
        ideas = ideas.filter((i) => (i.status || 'active') === status);
      }
      if (category) {
        ideas = ideas.filter((i) => i.category === category);
      }
      if (kind) {
        const kinds = new Set(kind.split(',').map((k) => k.trim()));
        ideas = ideas.filter((i) => kinds.has(((i as any).kind || 'proposal')));
      }
      if (resolutionStatus) {
        const statuses = new Set(resolutionStatus.split(',').map((s) => s.trim()));
        ideas = ideas.filter((i) => statuses.has(((i as any).resolutionStatus || 'open')));
      }
      if (targetBeat) {
        ideas = ideas.filter((i) => !(i as any).targetBeat || (i as any).targetBeat === targetBeat);
      }
      if (targetAct) {
        const actNum = parseInt(targetAct, 10);
        if (!Number.isNaN(actNum)) {
          ideas = ideas.filter((i) => !(i as any).targetAct || (i as any).targetAct === actNum);
        }
      }

      // Sort by createdAt descending (newest first)
      ideas.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Apply pagination
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
      const totalCount = ideas.length;
      const paginatedIdeas = ideas.slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          ideas: paginatedIdeas.map(toIdeaData),
          totalCount,
          limit,
          offset,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// GET /stories/:id/ideas/:ideaId
// =============================================================================

export function getIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }>,
    res: Response<APIResponse<IdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const idea = getNode(graph, ideaId) as Idea | undefined;

      if (!idea || idea.type !== 'Idea') {
        throw new NotFoundError(`Idea "${ideaId}"`);
      }

      res.json({
        success: true,
        data: toIdeaData(idea),
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// PATCH /stories/:id/ideas/:ideaId
// =============================================================================

export function updateIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }, unknown, { changes: Record<string, unknown> }>,
    res: Response<APIResponse<UpdateIdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;
      const { changes } = req.body;

      if (!changes || Object.keys(changes).length === 0) {
        throw new BadRequestError('No changes provided');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const idea = getNode(graph, ideaId) as Idea | undefined;

      if (!idea || idea.type !== 'Idea') {
        throw new NotFoundError(`Idea "${ideaId}"`);
      }

      // Build UPDATE_NODE patch
      const timestamp = new Date().toISOString();
      const patchId = `patch_idea_update_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'UPDATE_NODE',
            id: ideaId,
            set: changes,
          },
        ],
        metadata: {
          source: 'ideaHandler',
          action: 'update',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Get updated node
      const updatedIdea = getNode(updatedGraph, ideaId) as Idea | undefined;
      if (!updatedIdea) {
        throw new Error('Failed to update idea');
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Updated Idea: ${updatedIdea.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          idea: toIdeaData(updatedIdea),
          newVersionId,
          fieldsUpdated: Object.keys(changes),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// DELETE /stories/:id/ideas/:ideaId
// =============================================================================

export function deleteIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }>,
    res: Response<APIResponse<DeleteIdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(
          `Story "${id}"`,
          'Use POST /stories/init to create a story'
        );
      }

      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      const graph = deserializeGraph(currentVersion.graph);
      const idea = getNode(graph, ideaId) as Idea | undefined;

      if (!idea || idea.type !== 'Idea') {
        throw new NotFoundError(`Idea "${ideaId}"`);
      }

      // Build DELETE_NODE patch
      const timestamp = new Date().toISOString();
      const patchId = `patch_idea_delete_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [
          { op: 'DELETE_NODE', id: ideaId },
        ],
        metadata: {
          source: 'ideaHandler',
          action: 'delete',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Deleted Idea: ${idea.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.json({
        success: true,
        data: {
          deleted: true,
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// POST /stories/:id/ideas/:ideaId/refine
// =============================================================================

interface RefineIdeaBody {
  guidance: string;
  generateArtifacts?: boolean;
}

export function createRefineIdeaHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }, unknown, RefineIdeaBody>,
    res: Response<APIResponse<{ sessionId?: string; variants: unknown[]; suggestedArtifacts?: unknown[] }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;
      const { guidance } = req.body;

      if (!guidance || !guidance.trim()) {
        throw new BadRequestError('guidance is required');
      }

      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      // Load state/graph and idea
      const state = await loadVersionedStateById(id, ctx);
      if (!state) throw new NotFoundError(`Story "${id}"`);
      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) throw new NotFoundError('Current version');
      const graph = deserializeGraph(currentVersion.graph);
      const idea = getNode(graph, ideaId) as Idea | undefined;
      if (!idea || idea.type !== 'Idea') throw new NotFoundError(`Idea "${ideaId}"`);

      // Serialize story context
      const meta: ai.StoryMetadata = {};
      if (state.metadata?.name) meta.name = state.metadata.name;
      const storyContext = ai.serializeStoryState(graph, meta);

      // Collect constraints and related ideas
      const allIdeas = getNodesByType<Idea>(graph, 'Idea');
      const constraints = allIdeas.filter((i) => (i as any).kind === 'constraint').slice(0, 10);

      const relatedIdeas = allIdeas.filter((i) => {
        if (i.id === idea.id) return false;
        const sameBeat = (i as any).targetBeat && (i as any).targetBeat === (idea as any).targetBeat;
        const sameAct = (i as any).targetAct && (i as any).targetAct === (idea as any).targetAct;
        const relatedOverlap = i.relatedNodeIds && idea.relatedNodeIds && i.relatedNodeIds.some((rid) => idea.relatedNodeIds!.includes(rid));
        return Boolean(sameBeat || sameAct || relatedOverlap);
      }).slice(0, 5);

      const constraintLines = constraints.length
        ? `\n## Constraints (must respect)\n${constraints
            .map((c) => `- ${c.title}: ${c.description}`)
            .join('\n')}\n`
        : '';
      const relatedLines = relatedIdeas.length
        ? `\n## Related Ideas\n${relatedIdeas
            .map((i) => `- ${i.title}: ${i.description.slice(0, 100)}`)
            .join('\n')}\n`
        : '';

      const prompt = `## Idea Refinement v1.0.0

Refine this planning idea based on user guidance.

## Original Idea
**Kind:** ${(idea as any).kind || 'proposal'}
**Title:** ${idea.title}
**Description:** ${idea.description}
${(idea as any).resolution ? `**Current Resolution:** ${(idea as any).resolution}` : ''}

## User Guidance
"${guidance.trim()}"

## Story Context
${storyContext}
${constraintLines}${relatedLines}
## Your Task

Based on the guidance, generate 2-3 refined variants of this idea:

1. **If QUESTION:** Provide more specific sub-questions OR suggest resolution OR clarify intent
2. **If DIRECTION:** Make more specific and actionable OR suggest concrete StoryBeats
3. **If CONSTRAINT:** Clarify boundaries OR add concrete examples

## Output Format

\`\`\`json
{
  "variants": [
    {
      "id": "idea_refined_{timestamp}_{chars}",
      "kind": "question" | "direction" | "constraint" | "note",
      "title": "Refined title",
      "description": "More specific description incorporating guidance",
      "resolution": "If question, suggested answer",
      "confidence": 0.0,
      "suggestedArtifacts": [
        {
          "type": "StoryBeat" | "Scene",
          "title": "...",
          "summary": "...",
          "rationale": "Why this realizes the idea"
        }
      ]
    }
  ]
}
\`\`\`

Each variant should incorporate the user's guidance and move toward either:
- A clearer question with possible resolution
- A more specific, actionable direction
- Concrete artifacts that realize the idea

Output JSON only.`;

      const llm: LLMClient = createLLMClient({ enableCache: false });
      const response = await llm.complete(prompt);
      let data: any;
      try {
        data = JSON.parse(response.content);
      } catch {
        throw new BadRequestError('LLM did not return valid JSON for refinement');
      }

      const variants = Array.isArray(data?.variants) ? data.variants : [];
      const suggestedArtifacts = Array.isArray(data?.variants)
        ? variants.flatMap((v: any) => Array.isArray(v.suggestedArtifacts) ? v.suggestedArtifacts : [])
        : undefined;

      res.status(200).json({
        success: true,
        data: {
          variants,
          ...(suggestedArtifacts ? { suggestedArtifacts } : {}),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// GET /stories/:id/ideas/:ideaId/refinement-history
// =============================================================================

export function createGetIdeaRefinementHistoryHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }>,
    res: Response<APIResponse<{ idea: IdeaData; refinements: IdeaData[] }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;
      const state = await loadVersionedStateById(id, ctx);
      if (!state) throw new NotFoundError(`Story "${id}"`);
      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) throw new NotFoundError('Current version');
      const graph = deserializeGraph(currentVersion.graph);

      const idea = getNode(graph, ideaId) as Idea | undefined;
      if (!idea || idea.type !== 'Idea') throw new NotFoundError(`Idea "${ideaId}"`);

      const allIdeas = getNodesByType<Idea>(graph, 'Idea');
      // Simple lineage: children with parent_idea_id = this id
      const refinements = allIdeas.filter((i) => (i as any).parent_idea_id === ideaId);

      res.json({
        success: true,
        data: {
          idea: toIdeaData(idea),
          refinements: refinements.map(toIdeaData),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Idea Refinement Session Endpoints
// =============================================================================

export function createStartIdeaRefineSessionHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }, unknown, { guidance: string; generateArtifacts?: boolean }>,
    res: Response<APIResponse<{ sessionId: string; variants: IdeaRefinementVariant[] }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;
      const { guidance } = req.body;

      if (!guidance || !guidance.trim()) {
        throw new BadRequestError('guidance is required');
      }
      if (!isLLMConfigured()) {
        const { message, suggestion } = getMissingKeyError();
        throw new BadRequestError(message, suggestion);
      }

      // Load story + idea
      const state = await loadVersionedStateById(id, ctx);
      if (!state) throw new NotFoundError(`Story "${id}"`);
      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) throw new NotFoundError('Current version');
      const graph = deserializeGraph(currentVersion.graph);
      const idea = getNode(graph, ideaId) as Idea | undefined;
      if (!idea || idea.type !== 'Idea') throw new NotFoundError(`Idea "${ideaId}"`);

      // Build prompt (reuse logic)
      const meta: ai.StoryMetadata = {};
      if (state.metadata?.name) meta.name = state.metadata.name;
      const storyContext = ai.serializeStoryState(graph, meta);
      const allIdeas = getNodesByType<Idea>(graph, 'Idea');
      const constraints = allIdeas.filter((i) => (i as any).kind === 'constraint').slice(0, 10);
      const relatedIdeas = allIdeas.filter((i) => {
        if (i.id === idea.id) return false;
        const sameBeat = (i as any).targetBeat && (i as any).targetBeat === (idea as any).targetBeat;
        const sameAct = (i as any).targetAct && (i as any).targetAct === (idea as any).targetAct;
        const relatedOverlap = i.relatedNodeIds && idea.relatedNodeIds && i.relatedNodeIds.some((rid) => idea.relatedNodeIds!.includes(rid));
        return Boolean(sameBeat || sameAct || relatedOverlap);
      }).slice(0, 5);

      const constraintLines = constraints.length
        ? `\n## Constraints (must respect)\n${constraints.map((c) => `- ${c.title}: ${c.description}`).join('\n')}\n`
        : '';
      const relatedLines = relatedIdeas.length
        ? `\n## Related Ideas\n${relatedIdeas.map((i) => `- ${i.title}: ${i.description.slice(0, 100)}`).join('\n')}\n`
        : '';
      const prompt = `## Idea Refinement v1.0.0

Refine this planning idea based on user guidance.

## Original Idea
**Kind:** ${(idea as any).kind || 'proposal'}
**Title:** ${idea.title}
**Description:** ${idea.description}
${(idea as any).resolution ? `**Current Resolution:** ${(idea as any).resolution}` : ''}

## User Guidance
"${guidance.trim()}"

## Story Context
${storyContext}
${constraintLines}${relatedLines}
## Your Task

Based on the guidance, generate 2-3 refined variants of this idea:

1. **If QUESTION:** Provide more specific sub-questions OR suggest resolution OR clarify intent
2. **If DIRECTION:** Make more specific and actionable OR suggest concrete StoryBeats
3. **If CONSTRAINT:** Clarify boundaries OR add concrete examples

## Output Format

\`\`\`json
{ "variants": [ { "id": "idea_refined_{timestamp}_{chars}", "kind": "question" | "direction" | "constraint" | "note", "title": "Refined title", "description": "More specific description", "resolution": "If question, suggested answer", "confidence": 0.0 } ] }
\`\`\`

Output JSON only.`;

      const llm: LLMClient = createLLMClient({ enableCache: false });
      const response = await llm.complete(prompt);
      let data: any;
      try { data = JSON.parse(response.content); } catch { throw new BadRequestError('LLM did not return valid JSON for refinement'); }
      const variants: IdeaRefinementVariant[] = Array.isArray(data?.variants) ? data.variants : [];

      // Create session
      const session: IdeaRefinementSession = {
        id: `irs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        storyId: id,
        ideaId,
        guidance: guidance.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        variants,
      };
      await saveIdeaRefinementSession(id, session, ctx);

      res.status(201).json({ success: true, data: { sessionId: session.id, variants } });
    } catch (error) {
      next(error);
    }
  };
}

export function createGetIdeaRefineSessionHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }>,
    res: Response<APIResponse<IdeaRefinementSession | null>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;
      const session = await loadIdeaRefinementSession(id, ideaId, ctx);
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  };
}

export function createCommitIdeaRefineSessionHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }, unknown, { variantIndex: number; mode: 'update' | 'create' }>,
    res: Response<APIResponse<{ newVersionId: string; ideaId: string }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;
      const { variantIndex, mode } = req.body;

      const session = await loadIdeaRefinementSession(id, ideaId, ctx);
      if (!session || session.status !== 'active') throw new NotFoundError('Active refinement session');
      if (variantIndex < 0 || variantIndex >= session.variants.length) throw new BadRequestError('Invalid variantIndex');
      const variant = session.variants[variantIndex]!;

      // Load graph
      const state = await loadVersionedStateById(id, ctx);
      if (!state) throw new NotFoundError(`Story "${id}"`);
      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) throw new NotFoundError('Current version');
      const graph = deserializeGraph(currentVersion.graph);

      // Build patch
      const timestamp = new Date().toISOString();
      const patchId = `patch_idea_refine_commit_${Date.now()}`;
      const ops: Patch['ops'] = [];

      if (mode === 'update') {
        // Update existing idea
        const set: Record<string, unknown> = {};
        if (variant.title) set.title = variant.title;
        if (variant.description) set.description = variant.description;
        if (variant.kind) set.kind = variant.kind;
        if (variant.resolution) {
          set.resolution = variant.resolution;
          set.resolutionStatus = 'resolved';
        }
        set.lastReviewedAt = timestamp;
        ops.push({ op: 'UPDATE_NODE', id: ideaId, set });
      } else {
        // Create a new idea from variant, linked to parent
        const newId = `idea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const newIdea: Idea = {
          type: 'Idea',
          id: newId,
          title: variant.title,
          description: variant.description,
          source: 'ai',
          status: 'active',
          createdAt: timestamp,
        } as Idea;
        const newIdeaAny = newIdea as any;
        newIdeaAny.parent_idea_id = ideaId;
        if (variant.kind) newIdeaAny.kind = variant.kind;
        if (variant.resolution) {
          newIdeaAny.resolution = variant.resolution;
          newIdeaAny.resolutionStatus = 'resolved';
        }
        ops.push({ op: 'ADD_NODE', node: newIdea });
      }

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops,
        metadata: { source: 'ideaRefineSession', action: 'commit' },
      };

      const updatedGraph = applyPatch(graph, patch);
      const newVersionId = await saveGraphVersion(id, updatedGraph, `Commit idea refinement variant`, ctx);

      // Mark session committed
      const committed: IdeaRefinementSession = { ...session, status: 'committed', committedVariantIndex: variantIndex, updatedAt: timestamp };
      await saveIdeaRefinementSession(id, committed, ctx);

      res.json({ success: true, data: { newVersionId, ideaId } });
    } catch (error) {
      next(error);
    }
  };
}

export function createDiscardIdeaRefineSessionHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; ideaId: string }>,
    res: Response<APIResponse<{ discarded: boolean }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, ideaId } = req.params;
      await deleteIdeaRefinementSession(id, ideaId, ctx);
      res.json({ success: true, data: { discarded: true } });
    } catch (error) {
      next(error);
    }
  };
}

// Helper: save a graph as a new version (reuse storage APIs)
async function saveGraphVersion(
  storyId: string,
  graph: import('@apollo/core').GraphState,
  label: string,
  ctx: StorageContext
): Promise<string> {
  // We reuse updateGraphById but need to import dynamically to avoid circular
  const { updateGraphById } = await import('../storage.js');
  return updateGraphById(storyId, graph, label, undefined, ctx);
}

// =============================================================================
// POST /stories/:id/ideas/from-package
// =============================================================================

interface IdeaFromPackageBody {
  packageId: string;
  elementType: 'node' | 'edge' | 'storyContext';
  elementIndex?: number; // preferred selector
  elementId?: string;    // optional fallback for nodes
  title?: string;        // optional override
  description?: string;  // optional override
  category?: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
}

export function createIdeaFromPackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, IdeaFromPackageBody>,
    res: Response<APIResponse<CreateIdeaData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { packageId, elementType, elementIndex, elementId, title, description, category } = req.body;

      if (!packageId || !elementType) {
        throw new BadRequestError('packageId and elementType are required');
      }

      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');
      }
      const currentVersionId = state.history.currentVersionId;
      const currentVersion = state.history.versions[currentVersionId];
      if (!currentVersion) throw new NotFoundError('Current version');

      // Locate package from active session
      const pkg = await findPackageInSession(id, packageId, ctx);
      if (!pkg) throw new NotFoundError(`Package "${packageId}"`);

      // Determine idea content from element
      let derivedTitle = title?.trim();
      let derivedDesc = description?.trim();
      let suggestedType: Idea['suggestedType'] | undefined;
      let relatedNodeIds: string[] | undefined;

      if (elementType === 'node') {
        const nc = typeof elementIndex === 'number'
          ? pkg.changes.nodes[elementIndex]
          : pkg.changes.nodes.find((n) => n.node_id === elementId);
        if (!nc) throw new NotFoundError('Package node element');
        suggestedType = nc.node_type as any;
        relatedNodeIds = [nc.node_id];
        const name = (nc.data?.name || nc.data?.title || nc.node_id);
        derivedTitle = derivedTitle || `${nc.operation.toUpperCase()} ${nc.node_type}: ${name}`;
        const summ = [
          `Operation: ${nc.operation}`,
          `Type: ${nc.node_type}`,
          `Id: ${nc.node_id}`,
          nc.data ? `Data: ${JSON.stringify(nc.data).slice(0, 400)}` : undefined,
        ].filter(Boolean).join('\n');
        derivedDesc = derivedDesc || `${pkg.title || 'Package'} → Node candidate\n\n${summ}`;
      } else if (elementType === 'edge') {
        const ec = typeof elementIndex === 'number'
          ? pkg.changes.edges[elementIndex]
          : undefined;
        if (!ec) throw new NotFoundError('Package edge element');
        suggestedType = undefined;
        relatedNodeIds = [ec.from, ec.to];
        derivedTitle = derivedTitle || `${ec.operation.toUpperCase()} EDGE: ${ec.edge_type}`;
        derivedDesc = derivedDesc || `${pkg.title || 'Package'} → Edge candidate\n\n${JSON.stringify(ec).slice(0, 500)}`;
      } else if (elementType === 'storyContext') {
        const sc = typeof elementIndex === 'number'
          ? (pkg.changes.storyContext ?? [])[elementIndex]
          : undefined;
        if (!sc) throw new NotFoundError('Package storyContext element');
        derivedTitle = derivedTitle || `StoryContext suggestion`;
        derivedDesc = derivedDesc || `${pkg.title || 'Package'} → StoryContext change\n\n${JSON.stringify(sc).slice(0, 500)}`;
      }

      if (!derivedTitle || !derivedDesc) {
        throw new BadRequestError('Failed to derive idea content; provide title/description');
      }

      // Build idea node and new version (reuse logic from createIdeaHandler)
      const graph = deserializeGraph(currentVersion.graph);
      const timestamp = new Date().toISOString();
      const ideaId = `idea_${Date.now()}`;
      const patchId = `patch_idea_from_pkg_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      const idea: Idea = {
        type: 'Idea',
        id: ideaId,
        title: derivedTitle,
        description: derivedDesc,
        source: 'ai',
        status: 'active',
        createdAt: timestamp,
        ...(suggestedType ? { suggestedType } : {}),
        ...(category ? { category } : {}),
        sourcePackageId: packageId,
        ...(relatedNodeIds ? { relatedNodeIds } : {}),
      };
      (idea as any).kind = inferKindFromContentAPI(`${derivedTitle}\n\n${derivedDesc}`);

      const ops: Patch['ops'] = [ { op: 'ADD_NODE', node: idea } ];
      const patch: Patch = {
        type: 'Patch', id: patchId, base_story_version_id: currentVersionId, created_at: timestamp, ops,
        metadata: { source: 'ideas.fromPackage', action: 'create' },
      };

      const updatedGraph = applyPatch(graph, patch);

      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Captured Idea from package: ${idea.title}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;
      await saveVersionedStateById(id, state, ctx);

      res.status(201).json({ success: true, data: { idea: toIdeaData(idea), newVersionId } });
    } catch (error) {
      next(error);
    }
  };
}
