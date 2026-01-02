/**
 * project-apollo status - Show current graph summary
 */

import type { Command } from 'commander';
import { getGraphStats, deriveOpenQuestions } from '@apollo/core';
import { loadGraph, loadVersionedState, getCurrentStoryId } from '../state/store.js';
import { loadSession } from '../state/session.js';
import { handleError, CLIError } from '../utils/errors.js';
import { heading, formatNodeCounts, phaseColor } from '../utils/format.js';
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
        const phase = state.metadata?.phase ?? 'OUTLINE';
        const questions = deriveOpenQuestions(graph, phase);
        const session = await loadSession();

        heading('Story Status');

        // Story ID and metadata
        console.log(pc.dim('Story:'), storyId);
        if (state.metadata?.name && state.metadata.name !== storyId) {
          console.log(pc.dim('Name:'), state.metadata.name);
        }
        if (state.metadata?.logline) {
          console.log(pc.dim('Logline:'), state.metadata.logline);
        }
        console.log(pc.dim('Phase:'), phaseColor(phase));
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
        const blocking = questions.filter((q) => q.severity === 'BLOCKING').length;
        const important = questions.filter((q) => q.severity === 'IMPORTANT').length;
        const soft = questions.filter((q) => q.severity === 'SOFT').length;

        console.log(pc.bold('Open Questions:'));
        if (blocking > 0) {
          console.log('  ' + pc.red(`${blocking} blocking`));
        }
        if (important > 0) {
          console.log('  ' + pc.yellow(`${important} important`));
        }
        if (soft > 0) {
          console.log('  ' + pc.dim(`${soft} soft`));
        }
        if (questions.length === 0) {
          console.log('  ' + pc.green('None! Story complete for this phase.'));
        }
        console.log();

        // Session info
        if (session.activeClusters.length > 0) {
          console.log(
            pc.dim(
              `Active clusters: ${session.activeClusters.length} (run "project-apollo accept <move_id>" to apply)`
            )
          );
        }
      } catch (error) {
        handleError(error);
      }
    });
}
