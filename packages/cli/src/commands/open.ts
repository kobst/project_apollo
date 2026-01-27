/**
 * project-apollo open <name-or-id> - Switch to a story
 */

import type { Command } from 'commander';
import { findStory, setCurrentStory, loadStateById } from '../state/store.js';
import { CLIError, handleError } from '../utils/errors.js';
import { success } from '../utils/format.js';
import pc from 'picocolors';

export function openCommand(program: Command): void {
  program
    .command('open')
    .description('Switch to a different story')
    .argument('<name-or-id>', 'Story name or ID')
    .action(async (nameOrId: string) => {
      try {
        const storyId = await findStory(nameOrId);

        if (!storyId) {
          throw new CLIError(
            `Story "${nameOrId}" not found.`,
            'Run "project-apollo list" to see available stories.'
          );
        }

        await setCurrentStory(storyId);

        // Load state to show info
        const state = await loadStateById(storyId);

        success(`Switched to story: ${storyId}`);

        if (state?.metadata?.name && state.metadata.name !== storyId) {
          console.log(pc.dim('Name:'), state.metadata.name);
        }
      } catch (error) {
        handleError(error);
      }
    });
}
