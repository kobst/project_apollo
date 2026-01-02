/**
 * project-apollo delete <node_id> - Delete a node from the story graph
 */

import type { Command } from 'commander';
import { createInterface } from 'readline';
import { applyPatch, validatePatch, type Patch } from '@apollo/core';
import {
  loadState,
  deserializeGraph,
  updateState,
  getCurrentStoryId,
} from '../state/store.js';
import { CLIError, requireState, handleError } from '../utils/errors.js';
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

// =============================================================================
// Delete Command
// =============================================================================

interface DeleteOptions {
  force?: boolean;
  cascade?: boolean;
}

export function deleteCommand(program: Command): void {
  program
    .command('delete')
    .description('Delete a node from the story graph')
    .argument('<node_id>', 'The node ID to delete')
    .option('-f, --force', 'Skip confirmation')
    .option('--cascade', 'Also delete edges connected to this node')
    .action(async (nodeId: string, options: DeleteOptions) => {
      try {
        await deleteNode(nodeId, options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}

async function deleteNode(nodeId: string, options: DeleteOptions): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new CLIError(
      'No story selected.',
      'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
    );
  }

  const state = await loadState();
  requireState(state, 'Current story not found.');

  const graph = deserializeGraph(state.graph);

  // Find the node
  const node = graph.nodes.get(nodeId);
  if (!node) {
    throw new CLIError(
      `Node "${nodeId}" not found.`,
      'Run "project-apollo status" to see available nodes.'
    );
  }

  // Find connected edges
  const connectedEdges = graph.edges.filter(
    (e) => e.from === nodeId || e.to === nodeId
  );

  // Build operations
  const ops: Patch['ops'] = [];

  // Delete connected edges first (if cascade or always for consistency)
  if (connectedEdges.length > 0) {
    if (!options.cascade && !options.force) {
      // Warn about connected edges
      console.log();
      console.log(pc.yellow('Warning:'), `Node has ${connectedEdges.length} connected edge(s).`);
      console.log('Use --cascade to delete edges, or remove edges first.');
      console.log();
      for (const edge of connectedEdges) {
        console.log(`  ${pc.dim(edge.type)}: ${edge.from} → ${edge.to}`);
      }
      console.log();
    }

    // Always cascade edges when deleting a node (needed for graph consistency)
    for (const edge of connectedEdges) {
      ops.push({
        op: 'DELETE_EDGE',
        edge: { type: edge.type, from: edge.from, to: edge.to },
      });
    }
  }

  // Delete the node
  ops.push({ op: 'DELETE_NODE', id: nodeId });

  const patch: Patch = {
    type: 'Patch',
    id: `patch_delete_${nodeId}_${Date.now()}`,
    base_story_version_id: 'current',
    created_at: new Date().toISOString(),
    ops,
    metadata: { source: 'cli-delete' },
  };

  // Validate patch first
  const validation = validatePatch(graph, patch);
  if (!validation.success) {
    console.log();
    console.log(formatValidationErrors(validation.errors));
    process.exit(1);
  }

  // Show what will be deleted and confirm
  if (!options.force) {
    heading(`Delete: ${nodeId}`);
    console.log();
    console.log(pc.dim('Type:'), node.type);

    // Show key identifying fields
    if ('name' in node && node.name) {
      console.log(pc.dim('Name:'), node.name);
    }
    if ('heading' in node && node.heading) {
      console.log(pc.dim('Heading:'), node.heading);
    }
    if ('statement' in node && node.statement) {
      console.log(pc.dim('Statement:'), node.statement);
    }
    if ('description' in node && node.description) {
      const desc = String(node.description);
      const truncated = desc.length > 60 ? desc.slice(0, 60) + '...' : desc;
      console.log(pc.dim('Description:'), truncated);
    }

    console.log();

    if (connectedEdges.length > 0) {
      console.log(pc.bold(`Connected edges (${connectedEdges.length}):`));
      for (const edge of connectedEdges.slice(0, 5)) {
        const direction = edge.from === nodeId ? '→' : '←';
        const other = edge.from === nodeId ? edge.to : edge.from;
        console.log(`  ${pc.red('DELETE')} ${edge.type} ${direction} ${other}`);
      }
      if (connectedEdges.length > 5) {
        console.log(pc.dim(`  ... and ${connectedEdges.length - 5} more`));
      }
      console.log();
    }

    console.log(pc.red('This action cannot be undone.'));
    console.log();

    const confirmed = await confirm(pc.red('Delete this node?'));
    if (!confirmed) {
      console.log(pc.dim('Cancelled.'));
      process.exit(0);
    }
  }

  // Apply patch
  const newGraph = applyPatch(graph, patch);
  await updateState(newGraph);

  success(`Deleted: ${nodeId}`);
  if (connectedEdges.length > 0) {
    console.log(pc.dim(`Also removed ${connectedEdges.length} connected edge(s).`));
  }
}
