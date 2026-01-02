/**
 * project-apollo diff - Compare versions or branches
 */

import type { Command } from 'commander';
import { computeGraphDiff, isDiffEmpty, type GraphDiff } from '@apollo/core';
import {
  getCurrentStoryId,
  getVersion,
  getCurrentVersion,
  getBranch,
  deserializeGraph,
} from '../state/store.js';
import { CLIError, handleError } from '../utils/errors.js';
import { heading } from '../utils/format.js';
import pc from 'picocolors';

// =============================================================================
// Diff Formatting
// =============================================================================

function formatDiff(diff: GraphDiff, beforeId: string, afterId: string): void {
  heading(`Comparing ${beforeId} → ${afterId}`);
  console.log();

  if (isDiffEmpty(diff)) {
    console.log(pc.dim('No changes between versions.'));
    return;
  }

  // Nodes section
  const hasNodeChanges =
    diff.nodes.added.length > 0 ||
    diff.nodes.removed.length > 0 ||
    diff.nodes.modified.length > 0;

  if (hasNodeChanges) {
    console.log(pc.bold('Nodes:'));

    // Added nodes
    for (const node of diff.nodes.added) {
      const label = getNodeLabel(node);
      console.log(`  ${pc.green('+')} ${pc.green(node.id)} (${node.type}) ${label}`);
    }

    // Modified nodes
    for (const mod of diff.nodes.modified) {
      console.log(`  ${pc.yellow('~')} ${pc.yellow(mod.id)}:`);
      for (const change of mod.changes) {
        const oldVal = formatValue(change.oldValue);
        const newVal = formatValue(change.newValue);
        console.log(`      ${pc.dim(change.field)} ${oldVal} → ${newVal}`);
      }
    }

    // Removed nodes
    for (const node of diff.nodes.removed) {
      const label = getNodeLabel(node);
      console.log(`  ${pc.red('-')} ${pc.red(node.id)} (${node.type}) ${label}`);
    }

    console.log();
  }

  // Edges section
  const hasEdgeChanges = diff.edges.added.length > 0 || diff.edges.removed.length > 0;

  if (hasEdgeChanges) {
    console.log(pc.bold('Edges:'));

    for (const edge of diff.edges.added) {
      console.log(`  ${pc.green('+')} ${edge.type} ${edge.from} → ${edge.to}`);
    }

    for (const edge of diff.edges.removed) {
      console.log(`  ${pc.red('-')} ${edge.type} ${edge.from} → ${edge.to}`);
    }

    console.log();
  }

  // Summary
  const parts: string[] = [];
  if (diff.summary.nodesAdded > 0) parts.push(pc.green(`+${diff.summary.nodesAdded}`));
  if (diff.summary.nodesModified > 0) parts.push(pc.yellow(`~${diff.summary.nodesModified}`));
  if (diff.summary.nodesRemoved > 0) parts.push(pc.red(`-${diff.summary.nodesRemoved}`));

  const nodeSummary = parts.length > 0 ? parts.join(' ') + ' nodes' : '';

  const edgeParts: string[] = [];
  if (diff.summary.edgesAdded > 0) edgeParts.push(pc.green(`+${diff.summary.edgesAdded}`));
  if (diff.summary.edgesRemoved > 0) edgeParts.push(pc.red(`-${diff.summary.edgesRemoved}`));

  const edgeSummary = edgeParts.length > 0 ? edgeParts.join(' ') + ' edges' : '';

  const summary = [nodeSummary, edgeSummary].filter(Boolean).join(' | ');
  console.log(pc.dim('Summary:'), summary);
}

/**
 * Get a display label for a node (heading, name, or truncated id).
 */
function getNodeLabel(node: unknown): string {
  const n = node as Record<string, unknown>;
  if (typeof n['heading'] === 'string') {
    return pc.dim(`"${truncate(n['heading'], 30)}"`);
  }
  if (typeof n['name'] === 'string') {
    return pc.dim(`"${truncate(n['name'], 30)}"`);
  }
  if (typeof n['title'] === 'string') {
    return pc.dim(`"${truncate(n['title'], 30)}"`);
  }
  return '';
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}

function formatValue(value: unknown): string {
  if (value === undefined) return pc.dim('(unset)');
  if (value === null) return pc.dim('null');
  if (typeof value === 'string') {
    const truncated = truncate(value, 40);
    return `"${truncated}"`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 3) return JSON.stringify(value);
    return `[${value.length} items]`;
  }
  if (typeof value === 'object') {
    return '{...}';
  }
  return String(value);
}

// =============================================================================
// Diff Command
// =============================================================================

export function diffCommand(program: Command): void {
  program
    .command('diff')
    .description('Compare versions or branches')
    .argument('[ref1]', 'First version ID, branch name, or omit for parent')
    .argument('[ref2]', 'Second version ID or branch name (default: current)')
    .action(async (ref1?: string, ref2?: string) => {
      try {
        await runDiff(ref1, ref2);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}

async function runDiff(ref1?: string, ref2?: string): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new CLIError(
      'No story selected.',
      'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
    );
  }

  const current = await getCurrentVersion();
  if (!current) {
    throw new CLIError('No current version found.');
  }

  let beforeId: string;
  let afterId: string;

  if (!ref1 && !ref2) {
    // No arguments: diff current vs parent
    if (!current.parent_id) {
      throw new CLIError(
        'No parent version.',
        'This is the initial version. Use "project-apollo diff <version_id>" to compare with a specific version.'
      );
    }
    beforeId = current.parent_id;
    afterId = current.id;
  } else if (ref1 && !ref2) {
    // One argument: diff ref1 vs current
    beforeId = await resolveRef(ref1);
    afterId = current.id;
  } else if (ref1 && ref2) {
    // Two arguments: diff ref1 vs ref2
    beforeId = await resolveRef(ref1);
    afterId = await resolveRef(ref2);
  } else {
    throw new CLIError('Invalid arguments.');
  }

  // Load both versions
  const beforeVersion = await getVersion(beforeId);
  if (!beforeVersion) {
    throw new CLIError(
      `Version "${beforeId}" not found.`,
      'Run "project-apollo log" to see available versions.'
    );
  }

  const afterVersion = await getVersion(afterId);
  if (!afterVersion) {
    throw new CLIError(
      `Version "${afterId}" not found.`,
      'Run "project-apollo log" to see available versions.'
    );
  }

  // Deserialize graphs
  const beforeGraph = deserializeGraph(beforeVersion.graph);
  const afterGraph = deserializeGraph(afterVersion.graph);

  // Compute diff
  const diff = computeGraphDiff(beforeGraph, afterGraph);

  // Format and display
  formatDiff(diff, beforeId, afterId);
}

/**
 * Resolve a ref to a version ID.
 * Can be a version ID directly, or a branch name.
 */
async function resolveRef(ref: string): Promise<string> {
  // First try as branch name
  const branch = await getBranch(ref);
  if (branch) {
    return branch.headVersionId;
  }

  // Otherwise treat as version ID
  const version = await getVersion(ref);
  if (version) {
    return version.id;
  }

  throw new CLIError(
    `Reference "${ref}" not found.`,
    'Specify a valid version ID or branch name.'
  );
}
