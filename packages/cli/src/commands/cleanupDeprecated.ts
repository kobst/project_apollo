/**
 * project-apollo cleanup:deprecated
 *
 * Delete deprecated nodes and their incident edges.
 * Default target: StoryBeat nodes with status 'deprecated'.
 */

import type { Command } from 'commander';
import pc from 'picocolors';
import { applyPatch, validatePatch, type Patch } from '@apollo/core';
import { loadGraph, updateState, getCurrentStoryId } from '../state/store.js';
import { CLIError } from '../utils/errors.js';
import { heading, success, formatPatch, formatValidationErrors } from '../utils/format.js';

type TargetType = 'StoryBeat' | 'Scene' | 'Character' | 'Location' | 'Object' | 'ALL';

export function cleanupDeprecatedCommand(program: Command): void {
  program
    .command('cleanup:deprecated')
    .description('Delete deprecated nodes (default: StoryBeats) and incident edges')
    .option('-t, --type <type>', 'Target type (StoryBeat|Scene|Character|Location|Object|ALL)', 'StoryBeat')
    .option('-y, --yes', 'Apply without confirmation')
    .option('--dry-run', 'Show the generated patch without applying')
    .action(async (opts: { type?: string; yes?: boolean; dryRun?: boolean }) => {
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

      const target = (opts.type ?? 'StoryBeat').toUpperCase();
      const valid: TargetType[] = ['StoryBeat', 'Scene', 'Character', 'Location', 'Object', 'ALL'];
      if (!valid.map((v) => v.toUpperCase()).includes(target)) {
        throw new CLIError('Invalid --type', 'Use one of: StoryBeat|Scene|Character|Location|Object|ALL');
      }

      // Collect nodes to delete
      const toDelete: string[] = [];
      for (const [id, node] of graph.nodes) {
        const typeMatch = target === 'ALL' || node.type.toUpperCase() === target;
        const isDeprecated = (node as any).status === 'deprecated' || (node as any).status === 'CUT';
        if (typeMatch && isDeprecated) toDelete.push(id);
      }

      if (toDelete.length === 0) {
        console.log(pc.green('No deprecated nodes found to delete.'));
        return;
      }

      const now = new Date().toISOString();
      const patch: Patch = {
        type: 'Patch',
        id: `patch_cleanup_deprecated_${Date.now()}`,
        base_story_version_id: 'current',
        created_at: now,
        ops: toDelete.map((id) => ({ op: 'DELETE_NODE', id } as const)),
        metadata: { source: 'cli-cleanup-deprecated' },
      };

      // Validate
      const validation = validatePatch(graph, patch);
      if (!validation.success) {
        console.log();
        console.log(formatValidationErrors(validation.errors));
        process.exit(1);
      }

      // Dry run or apply
      const summary = `Cleanup Deprecated (${toDelete.length} node${toDelete.length === 1 ? '' : 's'})`;
      heading(summary);
      console.log(pc.dim(`Targets: ${toDelete.length}`));
      console.log();
      console.log(formatPatch(patch));

      if (opts.dryRun) {
        console.log(pc.yellow('Dry-run: no changes applied.'));
        return;
      }

      if (!opts.yes) {
        console.log(pc.yellow('Run again with --yes to apply this cleanup.'));
        return;
      }

      const newGraph = applyPatch(graph, patch);
      await updateState(newGraph);
      success(summary);
    });
}

