/**
 * project-apollo status - Show current graph summary
 */

import type { Command } from 'commander';
import { getGraphStats, deriveOpenQuestions } from '@apollo/core';
import { loadGraph, loadVersionedState, getCurrentStoryId } from '../state/store.js';
import { handleError, CLIError } from '../utils/errors.js';
import { heading, formatNodeCounts } from '../utils/format.js';
import pc from 'picocolors';

export function statusCommand(program: Command): void {
  program
    .command('status')
    .description('Show current story summary')
    .action(async () => {
      try {
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

        const state = await loadVersionedState();
        if (!state) {
          throw new CLIError('Current story state not found.');
        }
        const stats = getGraphStats(graph);
        const questions = deriveOpenQuestions(graph);
        heading('Story Status');

        // Story ID and metadata
        console.log(pc.dim('Story:'), storyId);
        if (state.metadata?.name && state.metadata.name !== storyId) {
          console.log(pc.dim('Name:'), state.metadata.name);
        }
        console.log(pc.dim('Updated:'), state.updatedAt);
        console.log();

        // Node counts
        console.log(pc.bold('Nodes:'));
        console.log(formatNodeCounts(stats.nodeCountByType));
        console.log();

        // Edge count
        console.log(pc.dim('Edges:'), stats.edgeCount);
        console.log();

        // Open questions summary
        console.log(pc.bold('Open Questions:'));
        if (questions.length > 0) {
          console.log('  ' + `${questions.length} total`);
        } else {
          console.log('  ' + pc.green('None!'));
        }
        console.log();

      } catch (error) {
        handleError(error);
      }
    });
}
