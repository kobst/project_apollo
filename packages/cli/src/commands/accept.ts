/**
 * project-apollo accept <move_id> - Apply a move's patch
 */

import type { Command } from 'commander';
import { createInterface } from 'readline';
import { applyPatch, validatePatch } from '@apollo/core';
import { loadState, deserializeGraph, updateState, getCurrentStoryId } from '../state/store.js';
import { findMove, acceptMove } from '../state/session.js';
import {
  CLIError,
  requireState,
  handleError,
} from '../utils/errors.js';
import { success, formatPatch, formatValidationErrors, heading } from '../utils/format.js';
import pc from 'picocolors';

/**
 * Prompt user for confirmation.
 */
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

export function acceptCommand(program: Command): void {
  program
    .command('accept')
    .description("Apply a move's patch to the story")
    .argument('<move_id>', 'The move ID to accept')
    .option('-y, --yes', 'Skip confirmation and apply immediately')
    .action(async (moveId: string, options: { yes?: boolean }) => {
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

        // Find the move (don't remove yet - only after confirmation)
        const found = await findMove(moveId);
        if (!found) {
          throw new CLIError(
            `Move "${moveId}" not found in active clusters.`,
            'Run "project-apollo cluster <oq_id>" to generate moves first.'
          );
        }

        const { move, patch } = found;
        const graph = deserializeGraph(state.graph);

        // Validate patch first
        const validation = validatePatch(graph, patch);

        // If validation fails, show errors and exit with non-zero code
        if (!validation.success) {
          console.log();
          console.log(formatValidationErrors(validation.errors));
          process.exit(1);
        }

        // If not --yes, show preview and ask for confirmation
        if (!options.yes) {
          heading(`Accept Move: ${move.title}`);
          console.log();
          console.log(pc.dim('Confidence:'), `${Math.round((move.confidence ?? 0) * 100)}%`);
          console.log(pc.dim('Rationale:'), move.rationale);
          console.log();
          console.log(formatPatch(patch));

          const confirmed = await confirm(pc.yellow('Apply this patch?'));
          if (!confirmed) {
            console.log(pc.dim('Cancelled.'));
            process.exit(0);
          }
        }

        // Now actually accept and remove from session
        await acceptMove(moveId);

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
        process.exit(1);
      }
    });
}
