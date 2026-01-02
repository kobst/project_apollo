/**
 * project-apollo checkout <version_id> - Switch to a specific version
 */

import type { Command } from 'commander';
import {
  getCurrentStoryId,
  getVersion,
  checkoutVersion,
  getVersionHistory,
} from '../state/store.js';
import { CLIError, handleError } from '../utils/errors.js';
import { success, warn } from '../utils/format.js';
import pc from 'picocolors';

// =============================================================================
// Checkout Command
// =============================================================================

export function checkoutCommand(program: Command): void {
  program
    .command('checkout')
    .description('Switch to a specific version')
    .argument('<version_id>', 'The version ID to checkout')
    .action(async (versionId: string) => {
      try {
        const storyId = await getCurrentStoryId();
        if (!storyId) {
          throw new CLIError(
            'No story selected.',
            'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
          );
        }

        // Verify version exists
        const version = await getVersion(versionId);
        if (!version) {
          throw new CLIError(
            `Version "${versionId}" not found.`,
            'Run "project-apollo log" to see available versions.'
          );
        }

        // Check if we're already on this version
        const history = await getVersionHistory();
        const currentVersion = history.find((v) => v.isCurrent);
        if (currentVersion?.id === versionId) {
          console.log(pc.dim(`Already on version: ${versionId}`));
          return;
        }

        // Perform checkout - returns branch info
        const { branch } = await checkoutVersion(versionId);

        success(`Switched to version: ${versionId}`);
        console.log(pc.dim('Label:'), version.label);

        // Show branch status
        if (branch) {
          console.log(pc.dim('Branch:'), pc.green(branch));
        } else {
          console.log();
          warn('You are in detached HEAD state.');
          console.log(pc.dim('Create a branch to save your work:'));
          console.log(`  ${pc.cyan('project-apollo branch create <name>')}`);
        }

        console.log();
        console.log('Run "project-apollo status" to see the story at this version.');
        console.log('Run "project-apollo log" to see version history.');
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}
