/**
 * Scene handlers
 * POST /stories/:id/scenes - Create scene
 * GET /stories/:id/scenes - List scenes
 * GET /stories/:id/scenes/:sceneId - Get single scene
 * PATCH /stories/:id/scenes/:sceneId - Update scene
 * DELETE /stories/:id/scenes/:sceneId - Delete scene
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getNode,
  getNodesByType,
  applyPatch,
  generateEdgeId,
} from '@apollo/core';
import type { Patch, Scene, IntExt } from '@apollo/core';
import type { StorageContext } from '../config.js';
import { loadVersionedStateById, saveVersionedStateById, deserializeGraph, serializeGraph } from '../storage.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse, NodeData } from '../types.js';

// =============================================================================
// Response Types
// =============================================================================

interface SceneData extends NodeData {
  connectedPlotPointId?: string | undefined;
}

interface ScenesListData {
  scenes: SceneData[];
  totalCount: number;
  limit: number;
  offset: number;
}

interface CreateSceneData {
  scene: SceneData;
  newVersionId: string;
}

interface UpdateSceneData {
  scene: SceneData;
  newVersionId: string;
  fieldsUpdated: string[];
}

interface DeleteSceneData {
  deleted: true;
  newVersionId: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getSceneLabel(scene: Scene): string {
  return scene.heading || scene.title || `Scene:${scene.id.slice(0, 8)}`;
}

function sanitizeSceneData(scene: Scene): Record<string, unknown> {
  const { id, type, ...rest } = scene as unknown as Record<string, unknown>;
  return rest;
}

function toSceneData(scene: Scene, connectedPlotPointId?: string): SceneData {
  return {
    id: scene.id,
    type: scene.type,
    label: getSceneLabel(scene),
    data: sanitizeSceneData(scene),
    connectedPlotPointId,
  };
}

// =============================================================================
// POST /stories/:id/scenes
// =============================================================================

interface CreateSceneBody {
  heading: string;
  scene_overview?: string;
  int_ext?: IntExt;
  time_of_day?: string;
  mood?: string;
  /** Optional: immediately attach to a PlotPoint */
  attachToPlotPointId?: string;
}

export function createSceneHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, CreateSceneBody>,
    res: Response<APIResponse<CreateSceneData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { heading, scene_overview, int_ext, time_of_day, mood, attachToPlotPointId } = req.body;

      if (!heading || heading.trim() === '') {
        throw new BadRequestError('heading is required');
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

      // If attaching to PlotPoint, verify it exists
      if (attachToPlotPointId) {
        const plotPoint = getNode(graph, attachToPlotPointId);
        if (!plotPoint || plotPoint.type !== 'PlotPoint') {
          throw new NotFoundError(`PlotPoint "${attachToPlotPointId}"`);
        }
      }

      // Generate IDs
      const timestamp = new Date().toISOString();
      const sceneId = `scene_${Date.now()}`;
      const patchId = `patch_scene_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Build the Scene node
      const scene: Scene = {
        type: 'Scene',
        id: sceneId,
        heading: heading.trim(),
        scene_overview: scene_overview ?? '',
        status: 'DRAFT',
        source_provenance: 'USER',
      };

      if (int_ext) scene.int_ext = int_ext;
      if (time_of_day) scene.time_of_day = time_of_day;
      if (mood) scene.mood = mood;

      // Build patch operations
      const ops: Patch['ops'] = [
        { op: 'ADD_NODE', node: scene },
      ];

      // Add SATISFIED_BY edge if attaching to PlotPoint
      // Edge direction: PlotPoint --SATISFIED_BY--> Scene
      if (attachToPlotPointId) {
        ops.push({
          op: 'ADD_EDGE',
          edge: {
            id: generateEdgeId(),
            type: 'SATISFIED_BY',
            from: attachToPlotPointId,
            to: sceneId,
          },
        });
      }

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops,
        metadata: {
          source: 'sceneHandler',
          action: 'create',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Created Scene: ${scene.heading}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      res.status(201).json({
        success: true,
        data: {
          scene: toSceneData(scene, attachToPlotPointId),
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// GET /stories/:id/scenes
// =============================================================================

interface ListScenesQuery {
  unassigned?: string;
  limit?: string;
  offset?: string;
}

export function listScenesHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, unknown, ListScenesQuery>,
    res: Response<APIResponse<ScenesListData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { unassigned, limit: limitStr, offset: offsetStr } = req.query;

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

      // Get all scenes
      let scenes = getNodesByType<Scene>(graph, 'Scene');

      // Build scene -> PlotPoint mapping
      const sceneToPlotPoint = new Map<string, string>();
      for (const edge of graph.edges) {
        if (edge.type === 'SATISFIED_BY') {
          sceneToPlotPoint.set(edge.to, edge.from);
        }
      }

      // Apply filters
      if (unassigned === 'true') {
        scenes = scenes.filter((s) => !sceneToPlotPoint.has(s.id));
      }

      // Apply pagination
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
      const totalCount = scenes.length;
      const paginatedScenes = scenes.slice(offset, offset + limit);

      // Convert to response format
      const sceneData: SceneData[] = paginatedScenes.map((s) => {
        return toSceneData(s, sceneToPlotPoint.get(s.id));
      });

      res.json({
        success: true,
        data: {
          scenes: sceneData,
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
// GET /stories/:id/scenes/:sceneId
// =============================================================================

export function getSceneHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; sceneId: string }>,
    res: Response<APIResponse<SceneData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, sceneId } = req.params;

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
      const scene = getNode(graph, sceneId) as Scene | undefined;

      if (!scene || scene.type !== 'Scene') {
        throw new NotFoundError(`Scene "${sceneId}"`);
      }

      const satisfiedByEdge = graph.edges.find(
        (e) => e.type === 'SATISFIED_BY' && e.to === scene.id
      );

      res.json({
        success: true,
        data: toSceneData(scene, satisfiedByEdge?.from),
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// PATCH /stories/:id/scenes/:sceneId
// =============================================================================

export function updateSceneHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; sceneId: string }, unknown, { changes: Record<string, unknown> }>,
    res: Response<APIResponse<UpdateSceneData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, sceneId } = req.params;
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
      const scene = getNode(graph, sceneId) as Scene | undefined;

      if (!scene || scene.type !== 'Scene') {
        throw new NotFoundError(`Scene "${sceneId}"`);
      }

      // Build UPDATE_NODE patch
      const timestamp = new Date().toISOString();
      const patchId = `patch_scene_update_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Apply the changes
      const updatedChanges = { ...changes };

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'UPDATE_NODE',
            id: sceneId,
            set: updatedChanges,
          },
        ],
        metadata: {
          source: 'sceneHandler',
          action: 'update',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Get updated node
      const updatedScene = getNode(updatedGraph, sceneId) as Scene | undefined;
      if (!updatedScene) {
        throw new Error('Failed to update scene');
      }

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Updated Scene: ${updatedScene.heading}`,
        created_at: timestamp,
        graph: serializeGraph(updatedGraph),
      };
      state.history.currentVersionId = newVersionId;

      // Save state
      await saveVersionedStateById(id, state, ctx);

      const satisfiedByEdge = updatedGraph.edges.find(
        (e) => e.type === 'SATISFIED_BY' && e.to === sceneId
      );

      res.json({
        success: true,
        data: {
          scene: toSceneData(updatedScene, satisfiedByEdge?.from),
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
// DELETE /stories/:id/scenes/:sceneId
// =============================================================================

export function deleteSceneHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; sceneId: string }>,
    res: Response<APIResponse<DeleteSceneData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, sceneId } = req.params;

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
      const scene = getNode(graph, sceneId) as Scene | undefined;

      if (!scene || scene.type !== 'Scene') {
        throw new NotFoundError(`Scene "${sceneId}"`);
      }

      // Build DELETE_NODE patch (also removes connected edges)
      const timestamp = new Date().toISOString();
      const patchId = `patch_scene_delete_${Date.now()}`;
      const newVersionId = `ver_${Date.now()}`;

      // Find all edges connected to this node
      const connectedEdges = graph.edges.filter(
        (e) => e.from === sceneId || e.to === sceneId
      );

      const ops: Patch['ops'] = [
        // Delete connected edges first
        ...connectedEdges.map((e) => ({
          op: 'DELETE_EDGE' as const,
          edge: { id: e.id },
        })),
        // Then delete the node
        { op: 'DELETE_NODE' as const, id: sceneId },
      ];

      const patch: Patch = {
        type: 'Patch',
        id: patchId,
        base_story_version_id: currentVersionId,
        created_at: timestamp,
        ops,
        metadata: {
          source: 'sceneHandler',
          action: 'delete',
        },
      };

      // Apply patch
      const updatedGraph = applyPatch(graph, patch);

      // Create new version
      state.history.versions[newVersionId] = {
        id: newVersionId,
        parent_id: currentVersionId,
        label: `Deleted Scene: ${scene.heading}`,
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
