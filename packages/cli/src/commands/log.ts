/**
 * project-apollo log - Show version history
 */

import type { Command } from 'commander';
import { getVersionHistory, getCurrentStoryId } from '../state/store.js';
import { CLIError, handleError } from '../utils/errors.js';
import { heading } from '../utils/format.js';
import pc from 'picocolors';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format a relative time string.
 */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// =============================================================================
// Log Command
// =============================================================================

interface LogOptions {
  all?: boolean;
  limit?: string;
}

export function logCommand(program: Command): void {
  program
    .command('log')
    .description('Show version history')
    .option('-a, --all', 'Show all versions (default: last 10)')
    .option('-n, --limit <n>', 'Limit number of versions shown')
    .action(async (options: LogOptions) => {
      try {
        const storyId = await getCurrentStoryId();
        if (!storyId) {
          throw new CLIError(
            'No story selected.',
            'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
          );
        }

        const versions = await getVersionHistory();

        if (versions.length === 0) {
          console.log(pc.dim('No version history available.'));
          return;
        }

        heading('Version History');
        console.log();

        // Determine how many to show
        let limit = 10;
        if (options.all) {
          limit = versions.length;
        } else if (options.limit) {
          limit = parseInt(options.limit, 10);
          if (isNaN(limit) || limit < 1) {
            throw new CLIError('Invalid limit: must be >= 1');
          }
        }

        const toShow = versions.slice(0, limit);

        for (const version of toShow) {
          const marker = version.isCurrent ? pc.green('*') : ' ';
          const id = version.isCurrent ? pc.green(version.id) : pc.cyan(version.id);
          const label = version.isCurrent
            ? pc.green(pc.bold(version.label))
            : pc.bold(version.label);
          const time = pc.dim(formatRelativeTime(version.created_at));
          const currentTag = version.isCurrent ? pc.green(' (current)') : '';

          console.log(`${marker} ${id}${currentTag}`);
          console.log(`  ${label} - ${time}`);
          if (version.parent_id) {
            console.log(`  ${pc.dim('parent:')} ${version.parent_id}`);
          }
          console.log();
        }

        if (versions.length > limit) {
          console.log(pc.dim(`... and ${versions.length - limit} more versions`));
          console.log(pc.dim('Use --all to see all versions'));
        }

        console.log(pc.dim('Commands:'));
        console.log(`  ${pc.cyan('project-apollo checkout <version_id>')} - Switch to a version`);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}
