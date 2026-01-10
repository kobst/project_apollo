/**
 * POST /stories/:id/input - Add narrative input (character, location, conflict, scene)
 */

import type { Request, Response, NextFunction } from 'express';
import {
  applyPatch,
  validatePatch,
  generateEdgeId,
  type Patch,
  type Character,
  type Location,
  type Scene,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  loadVersionedStateById,
  deserializeGraph,
  updateGraphById,
} from '../storage.js';
import { NotFoundError, BadRequestError, ValidationError } from '../middleware/error.js';
import type { APIResponse, InputRequest } from '../types.js';

interface InputResponseData {
  nodeId: string;
  type: string;
  name: string;
  newVersionId: string;
}

function generateId(type: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20);
  return `${type.toLowerCase()}_${slug}_${Date.now().toString(36)}`;
}

export function createInputHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, InputRequest & Record<string, unknown>>,
    res: Response<APIResponse<InputResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { type, name, description, ...rest } = req.body;

      if (!type) {
        throw new BadRequestError('type is required');
      }
      if (!name) {
        throw new BadRequestError('name is required');
      }

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
      let patch: Patch;
      let nodeId: string;

      switch (type) {
        case 'character': {
          nodeId = generateId('char', name);
          const archetype = rest.archetype as string | undefined;
          const rawTraits = rest.traits;
          const traits = rawTraits
            ? Array.isArray(rawTraits)
              ? rawTraits as string[]
              : (rawTraits as string).split(',').map((t: string) => t.trim())
            : undefined;

          const character: Character = {
            type: 'Character',
            id: nodeId,
            name,
            status: 'ACTIVE',
          };
          if (description) character.description = description;
          if (archetype) character.archetype = archetype;
          if (traits) character.traits = traits;

          patch = {
            type: 'Patch',
            id: `patch_add_${nodeId}`,
            base_story_version_id: state.history.currentVersionId,
            created_at: new Date().toISOString(),
            ops: [{ op: 'ADD_NODE', node: character }],
            metadata: { source: 'api-input' },
          };
          break;
        }

        case 'location': {
          nodeId = generateId('loc', name);
          const parent = rest.parent as string | undefined;
          const rawTags = rest.tags;
          const tags = rawTags
            ? Array.isArray(rawTags)
              ? rawTags as string[]
              : (rawTags as string).split(',').map((t: string) => t.trim())
            : undefined;

          const location: Location = {
            type: 'Location',
            id: nodeId,
            name,
          };
          if (description) location.description = description;
          if (parent) location.parent_location_id = parent;
          if (tags) location.tags = tags;

          patch = {
            type: 'Patch',
            id: `patch_add_${nodeId}`,
            base_story_version_id: state.history.currentVersionId,
            created_at: new Date().toISOString(),
            ops: [{ op: 'ADD_NODE', node: location }],
            metadata: { source: 'api-input' },
          };
          break;
        }

        case 'scene': {
          const beatId = rest.beatId as string;
          const overview = rest.overview as string;
          if (!beatId) {
            throw new BadRequestError('beatId is required for scenes');
          }
          if (!overview || overview.length < 20) {
            throw new BadRequestError('overview is required (min 20 characters)');
          }

          nodeId = generateId('scene', beatId);
          const scene: Scene = {
            type: 'Scene',
            id: nodeId,
            heading: (rest.heading as string) ?? 'INT. LOCATION - DAY',
            scene_overview: overview,
            beat_id: beatId.startsWith('beat_') ? beatId : `beat_${beatId}`,
            order_index: rest.order ? Number(rest.order) : 1,
            status: 'DRAFT',
            source_provenance: 'USER',
          };

          const ops: Patch['ops'] = [{ op: 'ADD_NODE', node: scene }];

          // Add character edges
          if (rest.characters) {
            const charIds = Array.isArray(rest.characters)
              ? rest.characters
              : (rest.characters as string).split(',').map((c: string) => c.trim());
            for (const charId of charIds) {
              ops.push({
                op: 'ADD_EDGE',
                edge: {
                  id: generateEdgeId(),
                  type: 'HAS_CHARACTER',
                  from: nodeId,
                  to: charId.startsWith('char_') ? charId : `char_${charId}`,
                },
              });
            }
          }

          // Add location edge
          if (rest.location) {
            const locId = (rest.location as string).startsWith('loc_')
              ? rest.location as string
              : `loc_${rest.location}`;
            ops.push({
              op: 'ADD_EDGE',
              edge: { id: generateEdgeId(), type: 'LOCATED_AT', from: nodeId, to: locId },
            });
          }

          patch = {
            type: 'Patch',
            id: `patch_add_${nodeId}`,
            base_story_version_id: state.history.currentVersionId,
            created_at: new Date().toISOString(),
            ops,
            metadata: { source: 'api-input' },
          };
          break;
        }

        default:
          throw new BadRequestError(
            `Invalid type: "${type}"`,
            'Valid types: character, location, conflict, scene'
          );
      }

      // Validate patch
      const validation = validatePatch(graph, patch);
      if (!validation.success) {
        throw new ValidationError(
          'Validation failed',
          validation.errors.map((e) => ({
            code: e.code,
            node_id: e.node_id,
            field: e.field,
            suggested_fix: e.message,
          }))
        );
      }

      // Apply patch
      const newGraph = applyPatch(graph, patch);

      // Save with version
      const newVersionId = await updateGraphById(
        id,
        newGraph,
        `Add ${type}: ${name}`,
        undefined,
        ctx
      );

      res.status(201).json({
        success: true,
        data: {
          nodeId,
          type,
          name,
          newVersionId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
