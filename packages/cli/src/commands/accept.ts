/**
 * project-apollo accept <move_id> - Apply a move's patch
 */

import type { Command } from 'commander';
import { applyPatch, validatePatch } from '@apollo/core';
import { loadState, deserializeGraph, updateState, getCurrentStoryId } from '../state/store.js';
import { acceptMove } from '../state/session.js';
import {
  CLIError,
  ValidationError,
  requireState,
  handleError,
} from '../utils/errors.js';
import { success } from '../utils/format.js';
import pc from 'picocolors';

export function acceptCommand(program: Command): void {
  program
    .command('accept')
    .description("Apply a move's patch to the story")
    .argument('<move_id>', 'The move ID to accept')
    .action(async (moveId: string) => {
      try {
        const storyId = await getCurrentStoryId();
        if (!storyId) {
          throw new CLIError(
            'No story selected.',
            'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
          );
        }

        const state = await loadState();
        requireState(state, 'Current story not found.');

        // Find and remove the move from session
        const found = await acceptMove(moveId);
        if (!found) {
          throw new CLIError(
            `Move "${moveId}" not found in active clusters.`,
            'Run "project-apollo cluster <oq_id>" to generate moves first.'
          );
        }

        const { move, patch } = found;
        const graph = deserializeGraph(state.graph);

        // Validate patch
        const validation = validatePatch(graph, patch);
        if (!validation.success) {
          throw new ValidationError(
            'Move validation failed',
            validation.errors.map((e) => e.message)
          );
        }

        // Apply patch
        const newGraph = applyPatch(graph, patch);

        // Update state
        await updateState(newGraph);

        // Display result
        success(`Move accepted: ${move.title}`);
        console.log(pc.dim('Patch applied:'), `${patch.ops.length} operations`);
        console.log();
        console.log('Run "project-apollo status" to see updated story.');
        console.log('Run "project-apollo oqs" to see remaining open questions.');
      } catch (error) {
        handleError(error);
      }
    });
}
