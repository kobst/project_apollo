/**
 * project-apollo edit <node_id> - Edit node properties
 */

import type { Command } from 'commander';
import { createInterface } from 'readline';
import { applyPatch, validatePatch, type Patch } from '@apollo/core';
import {
  loadGraph,
  updateState,
  getCurrentStoryId,
} from '../state/store.js';
import { CLIError, handleError } from '../utils/errors.js';
import {
  success,
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

/**
 * Parse --set arguments like "name=John" or "traits=wise,patient"
 */
function parseSetArgs(setArgs: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const arg of setArgs) {
    const eqIndex = arg.indexOf('=');
    if (eqIndex === -1) {
      throw new CLIError(
        `Invalid --set format: "${arg}"`,
        'Use --set key=value (e.g., --set name="John")'
      );
    }

    const key = arg.slice(0, eqIndex).trim();
    let value: unknown = arg.slice(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value as string).startsWith('"') && (value as string).endsWith('"') ||
      (value as string).startsWith("'") && (value as string).endsWith("'")
    ) {
      value = (value as string).slice(1, -1);
    }

    // Try to parse as JSON for arrays/objects
    if ((value as string).startsWith('[') || (value as string).startsWith('{')) {
      try {
        value = JSON.parse(value as string);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    // Try to parse as number
    if (!isNaN(Number(value)) && (value as string).trim() !== '') {
      value = Number(value);
    }

    // Parse comma-separated values for known array fields
    if (
      typeof value === 'string' &&
      ['traits', 'tags', 'scene_tags', 'key_actions', 'notable_dialogue'].includes(key) &&
      value.includes(',')
    ) {
      value = value.split(',').map((v) => v.trim());
    }

    result[key] = value;
  }

  return result;
}

// =============================================================================
// Edit Command
// =============================================================================

interface EditOptions {
  set: string[];
  unset?: string[];
  yes?: boolean;
}

export function editCommand(program: Command): void {
  program
    .command('edit')
    .description('Edit a node in the story graph')
    .argument('<node_id>', 'The node ID to edit')
    .option('--set <key=value...>', 'Set field values (repeatable)', collectArgs, [])
    .option('--unset <fields...>', 'Remove fields (repeatable)', collectArgs, [])
    .option('-y, --yes', 'Skip confirmation')
    .action(async (nodeId: string, options: EditOptions) => {
      try {
        await editNode(nodeId, options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}

/**
 * Collect multiple --set or --unset arguments
 */
function collectArgs(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

async function editNode(nodeId: string, options: EditOptions): Promise<void> {
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

  // Find the node
  const node = graph.nodes.get(nodeId);
  if (!node) {
    throw new CLIError(
      `Node "${nodeId}" not found.`,
      'Run "project-apollo status" to see available nodes.'
    );
  }

  // Validate we have something to do
  if (options.set.length === 0 && (!options.unset || options.unset.length === 0)) {
    throw new CLIError(
      'No changes specified.',
      'Use --set key=value or --unset field to modify the node.'
    );
  }

  // Parse --set arguments
  const setFields = parseSetArgs(options.set);

  // Build the UPDATE_NODE operation
  const patch: Patch = {
    type: 'Patch',
    id: `patch_edit_${nodeId}_${Date.now()}`,
    base_story_version_id: 'current',
    created_at: new Date().toISOString(),
    ops: [
      {
        op: 'UPDATE_NODE',
        id: nodeId,
        set: setFields,
        ...(options.unset && options.unset.length > 0 && { unset: options.unset }),
      },
    ],
    metadata: { source: 'cli-edit' },
  };

  // Validate patch first
  const validation = validatePatch(graph, patch);
  if (!validation.success) {
    console.log();
    console.log(formatValidationErrors(validation.errors));
    process.exit(1);
  }

  // Show current values and proposed changes
  if (!options.yes) {
    heading(`Edit: ${nodeId}`);
    console.log();
    console.log(pc.dim('Current node type:'), node.type);
    console.log();

    // Show current values of fields being changed
    console.log(pc.bold('Current values:'));
    const nodeRecord = node as unknown as Record<string, unknown>;
    for (const key of Object.keys(setFields)) {
      const currentVal = nodeRecord[key];
      console.log(`  ${pc.dim(key + ':')} ${formatValue(currentVal)}`);
    }
    if (options.unset) {
      for (const key of options.unset) {
        const currentVal = nodeRecord[key];
        console.log(`  ${pc.dim(key + ':')} ${formatValue(currentVal)}`);
      }
    }
    console.log();

    // Show proposed changes
    console.log(pc.bold('Changes:'));
    for (const [key, value] of Object.entries(setFields)) {
      console.log(`  ${pc.cyan('set')} ${key} = ${formatValue(value)}`);
    }
    if (options.unset) {
      for (const key of options.unset) {
        console.log(`  ${pc.red('unset')} ${key}`);
      }
    }
    console.log();

    const confirmed = await confirm(pc.yellow('Apply these changes?'));
    if (!confirmed) {
      console.log(pc.dim('Cancelled.'));
      process.exit(0);
    }
  }

  // Apply patch
  const newGraph = applyPatch(graph, patch);
  await updateState(newGraph);

  success(`Updated: ${nodeId}`);
}

function formatValue(value: unknown): string {
  if (value === undefined) {
    return pc.dim('(not set)');
  }
  if (value === null) {
    return pc.dim('null');
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return String(value);
}
