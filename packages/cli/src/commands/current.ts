/**
 * project-apollo current - Show current story
 */

import type { Command } from 'commander';
import { getCurrentStoryId, loadState } from '../state/store.js';
import { handleError } from '../utils/errors.js';
import { heading } from '../utils/format.js';
import pc from 'picocolors';

export function currentCommand(program: Command): void {
  program
    .command('current')
    .description('Show the current story')
    .action(async () => {
      try {
        const storyId = await getCurrentStoryId();

        if (!storyId) {
          console.log(pc.yellow('No story selected.'));
          console.log('Run "project-apollo list" to see available stories.');
          console.log('Run "project-apollo open <id>" to select one.');
          return;
        }

        const state = await loadState();

        if (!state) {
          console.log(pc.yellow(`Current story "${storyId}" not found.`));
          console.log('It may have been deleted. Run "project-apollo list" to see available stories.');
          return;
        }

        heading('Current Story');
        console.log(pc.dim('ID:'), storyId);

        if (state.metadata?.name && state.metadata.name !== storyId) {
          console.log(pc.dim('Name:'), state.metadata.name);
        }
        console.log(pc.dim('Updated:'), state.updatedAt);
      } catch (error) {
        handleError(error);
      }
    });
}
