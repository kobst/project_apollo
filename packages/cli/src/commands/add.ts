/**
 * project-apollo add <type> - Add nodes directly to the story graph
 */

import type { Command } from 'commander';
import { createInterface } from 'readline';
import {
  applyPatch,
  validatePatch,
  generateEdgeId,
  type Patch,
  type Character,
  type Location,
  type Scene,
} from '@apollo/core';
import {
  loadGraph,
  updateState,
  getCurrentStoryId,
} from '../state/store.js';
import { CLIError, handleError } from '../utils/errors.js';
import {
  success,
  formatPatch,
  formatValidationErrors,
  heading,
} from '../utils/format.js';
import pc from 'picocolors';

// =============================================================================
// Helpers
// =============================================================================

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function generateId(type: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20);
  return `${type.toLowerCase()}_${slug}_${Date.now().toString(36)}`;
}

async function applyPatchWithConfirmation(
  patch: Patch,
  summary: string,
  skipConfirm: boolean
): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new CLIError(
      'No story selected.',
      'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
    );
  }

  const graph = await loadGraph();
  if (!graph) {
    throw new CLIError('Current story not found.');
  }

  // Validate patch first
  const validation = validatePatch(graph, patch);
  if (!validation.success) {
    console.log();
    console.log(formatValidationErrors(validation.errors));
    process.exit(1);
  }

  // Show preview and confirm unless --yes
  if (!skipConfirm) {
    heading(summary);
    console.log();
    console.log(formatPatch(patch));

    const confirmed = await confirm(pc.yellow('Apply this change?'));
    if (!confirmed) {
      console.log(pc.dim('Cancelled.'));
      process.exit(0);
    }
  }

  // Apply patch
  const newGraph = applyPatch(graph, patch);
  await updateState(newGraph);

  success(summary);
}

// =============================================================================
// Add Character
// =============================================================================

interface AddCharacterOptions {
  description?: string;
  archetype?: string;
  traits?: string;
  yes?: boolean;
}

async function addCharacter(
  name: string,
  options: AddCharacterOptions
): Promise<void> {
  const id = generateId('char', name);

  const character: Character = {
    type: 'Character',
    id,
    name,
    ...(options.description && { description: options.description }),
    ...(options.archetype && { archetype: options.archetype }),
    ...(options.traits && { traits: options.traits.split(',').map((t) => t.trim()) }),
    status: 'ACTIVE',
  };

  const patch: Patch = {
    type: 'Patch',
    id: `patch_add_${id}`,
    base_story_version_id: 'current',
    created_at: new Date().toISOString(),
    ops: [{ op: 'ADD_NODE', node: character }],
    metadata: { source: 'cli-add' },
  };

  await applyPatchWithConfirmation(
    patch,
    `Add Character: ${name}`,
    options.yes ?? false
  );

  console.log(pc.dim('ID:'), id);
}

// =============================================================================
// Add Location
// =============================================================================

interface AddLocationOptions {
  description?: string;
  parent?: string;
  tags?: string;
  yes?: boolean;
}

async function addLocation(
  name: string,
  options: AddLocationOptions
): Promise<void> {
  const id = generateId('loc', name);

  const location: Location = {
    type: 'Location',
    id,
    name,
    ...(options.description && { description: options.description }),
    ...(options.parent && { parent_location_id: options.parent }),
    ...(options.tags && { tags: options.tags.split(',').map((t) => t.trim()) }),
  };

  const patch: Patch = {
    type: 'Patch',
    id: `patch_add_${id}`,
    base_story_version_id: 'current',
    created_at: new Date().toISOString(),
    ops: [{ op: 'ADD_NODE', node: location }],
    metadata: { source: 'cli-add' },
  };

  await applyPatchWithConfirmation(
    patch,
    `Add Location: ${name}`,
    options.yes ?? false
  );

  console.log(pc.dim('ID:'), id);
}

// =============================================================================
// Add Scene
// =============================================================================

interface AddSceneOptions {
  overview: string;
  beat: string;
  heading?: string;
  characters?: string;
  location?: string;
  order?: string;
  yes?: boolean;
}

async function addScene(options: AddSceneOptions): Promise<void> {
  // Build heading if not provided
  const heading = options.heading ?? 'INT. LOCATION - DAY';

  // Parse order_index
  const orderIndex = options.order ? parseInt(options.order, 10) : 1;
  if (isNaN(orderIndex) || orderIndex < 1) {
    throw new CLIError('Invalid order: must be >= 1');
  }

  const id = generateId('scene', options.beat);

  const scene: Scene = {
    type: 'Scene',
    id,
    heading,
    scene_overview: options.overview,
    beat_id: `beat_${options.beat}`,
    order_index: orderIndex,
    status: 'DRAFT',
    source_provenance: 'USER',
  };

  const ops: Patch['ops'] = [{ op: 'ADD_NODE', node: scene }];

  // Add character edges
  if (options.characters) {
    const charIds = options.characters.split(',').map((c) => c.trim());
    for (const charId of charIds) {
      ops.push({
        op: 'ADD_EDGE',
        edge: {
          id: generateEdgeId(),
          type: 'HAS_CHARACTER',
          from: id,
          to: charId.startsWith('char_') ? charId : `char_${charId}`,
        },
      });
    }
  }

  // Add location edge
  if (options.location) {
    const locId = options.location.startsWith('loc_')
      ? options.location
      : `loc_${options.location}`;
    ops.push({
      op: 'ADD_EDGE',
      edge: { id: generateEdgeId(), type: 'LOCATED_AT', from: id, to: locId },
    });
  }

  const patch: Patch = {
    type: 'Patch',
    id: `patch_add_${id}`,
    base_story_version_id: 'current',
    created_at: new Date().toISOString(),
    ops,
    metadata: { source: 'cli-add' },
  };

  await applyPatchWithConfirmation(
    patch,
    `Add Scene for beat: ${options.beat}`,
    options.yes ?? false
  );

  console.log(pc.dim('ID:'), id);
}

// =============================================================================
// Command Registration
// =============================================================================

export function addCommand(program: Command): void {
  const add = program
    .command('add')
    .description('Add nodes to the story graph');

  // add character
  add
    .command('character')
    .description('Add a new character')
    .argument('<name>', 'Character name')
    .option('-d, --description <text>', 'Character description')
    .option('-a, --archetype <type>', 'Character archetype (e.g., Hero, Mentor)')
    .option('-t, --traits <list>', 'Comma-separated traits')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (name: string, opts: AddCharacterOptions) => {
      try {
        await addCharacter(name, opts);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });

  // add location
  add
    .command('location')
    .description('Add a new location')
    .argument('<name>', 'Location name')
    .option('-d, --description <text>', 'Location description')
    .option('-p, --parent <id>', 'Parent location ID')
    .option('-t, --tags <list>', 'Comma-separated tags')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (name: string, opts: AddLocationOptions) => {
      try {
        await addLocation(name, opts);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });

  // add scene
  add
    .command('scene')
    .description('Add a new scene')
    .requiredOption('--beat <beatType>', 'Beat type (e.g., Catalyst, Midpoint)')
    .requiredOption('--overview <text>', 'Scene overview (min 20 chars)')
    .option('--heading <text>', 'Scene heading (e.g., "INT. CAFE - DAY")')
    .option('--characters <ids>', 'Comma-separated character IDs')
    .option('--location <id>', 'Location ID')
    .option('--order <n>', 'Order index within beat (default: 1)')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (opts: AddSceneOptions) => {
      try {
        await addScene(opts);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}
