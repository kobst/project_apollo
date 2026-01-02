/**
 * project-apollo preview <move_id> - Preview a move's patch before accepting
 */

import type { Command } from 'commander';
import { validatePatch } from '@apollo/core';
import { loadState, deserializeGraph, getCurrentStoryId } from '../state/store.js';
import { findMove } from '../state/session.js';
import { CLIError, requireState, handleError } from '../utils/errors.js';
import { heading, formatPatch, info, formatValidationErrors } from '../utils/format.js';
import pc from 'picocolors';

export function previewCommand(program: Command): void {
  program
    .command('preview')
    .description("Preview a move's patch operations before accepting")
    .argument('<move_id>', 'The move ID to preview')
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

        // Find the move
        const found = await findMove(moveId);
        if (!found) {
          throw new CLIError(
            `Move "${moveId}" not found in active clusters.`,
            'Run "project-apollo cluster <oq_id>" to generate moves first.'
          );
        }

        const { move, patch } = found;
        const graph = deserializeGraph(state.graph);

        // Display move info
        heading(`Move Preview: ${move.title}`);
        console.log();

        // Display confidence
        if (move.confidence !== undefined) {
          console.log(pc.dim('Confidence:'), `${Math.round(move.confidence * 100)}%`);
        }

        // Display rationale
        console.log(pc.dim('Rationale:'), move.rationale);
        console.log();

        // Display patch operations
        console.log(formatPatch(patch));

        // Display expected effects
        if (move.expected_effects && move.expected_effects.length > 0) {
          console.log(pc.bold('Expected Effects:'));
          for (const effect of move.expected_effects) {
            console.log(`  ${pc.dim('•')} ${effect}`);
          }
          console.log();
        }

        // Display style tags
        if (move.move_style_tags && move.move_style_tags.length > 0) {
          console.log(pc.dim('Style tags:'), move.move_style_tags.join(', '));
          console.log();
        }

        // Validate the patch
        const validation = validatePatch(graph, patch);
        if (validation.success) {
          info('Patch validation: ' + pc.green('PASS'));
          console.log();
          console.log(pc.dim('To apply this move, run:'));
          console.log(`  project-apollo accept ${moveId}`);
        } else {
          console.log();
          console.log(formatValidationErrors(validation.errors));
        }
      } catch (error) {
        handleError(error);
      }
    });
}
