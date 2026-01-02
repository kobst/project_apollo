/**
 * project-apollo branch - Branch management commands
 */

import type { Command } from 'commander';
import { createInterface } from 'readline';
import {
  listBranches,
  createBranch,
  switchBranch,
  deleteBranch,
  getCurrentBranch,
  getCurrentStoryId,
} from '../state/store.js';
import { CLIError, handleError } from '../utils/errors.js';
import { success, warn, heading } from '../utils/format.js';
import pc from 'picocolors';

// =============================================================================
// Helpers
// =============================================================================

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
// List Branches
// =============================================================================

async function listBranchesAction(): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new CLIError(
      'No story selected.',
      'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
    );
  }

  const branches = await listBranches();
  const currentBranch = await getCurrentBranch();

  if (branches.length === 0) {
    console.log(pc.dim('No branches found.'));
    return;
  }

  heading('Branches');
  console.log();

  for (const branch of branches) {
    const marker = branch.isCurrent ? pc.green('*') : ' ';
    const name = branch.isCurrent ? pc.green(pc.bold(branch.name)) : branch.name;
    const time = pc.dim(formatRelativeTime(branch.createdAt));
    const head = pc.dim(`→ ${branch.headVersionId.slice(0, 16)}...`);

    console.log(`${marker} ${name} ${head} ${time}`);
    if (branch.description) {
      console.log(`    ${pc.dim(branch.description)}`);
    }
  }

  if (currentBranch === null) {
    console.log();
    warn('You are in detached HEAD state.');
    console.log(pc.dim('Create a branch to save your work: project-apollo branch create <name>'));
  }

  console.log();
  console.log(pc.dim('Commands:'));
  console.log(`  ${pc.cyan('project-apollo branch create <name>')}  - Create a new branch`);
  console.log(`  ${pc.cyan('project-apollo branch switch <name>')}  - Switch to a branch`);
}

// =============================================================================
// Create Branch
// =============================================================================

interface CreateOptions {
  description?: string;
}

async function createBranchAction(name: string, options: CreateOptions): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new CLIError(
      'No story selected.',
      'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
    );
  }

  await createBranch(name, options.description);

  success(`Created and switched to branch: ${name}`);
  console.log(pc.dim('New commits will now be added to this branch.'));
}

// =============================================================================
// Switch Branch
// =============================================================================

async function switchBranchAction(name: string): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new CLIError(
      'No story selected.',
      'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
    );
  }

  const currentBranch = await getCurrentBranch();
  if (currentBranch === name) {
    console.log(pc.dim(`Already on branch: ${name}`));
    return;
  }

  await switchBranch(name);

  success(`Switched to branch: ${name}`);
}

// =============================================================================
// Delete Branch
// =============================================================================

interface DeleteOptions {
  force?: boolean;
}

async function deleteBranchAction(name: string, options: DeleteOptions): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new CLIError(
      'No story selected.',
      'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
    );
  }

  if (!options.force) {
    const confirmed = await confirm(pc.yellow(`Delete branch "${name}"?`));
    if (!confirmed) {
      console.log(pc.dim('Cancelled.'));
      return;
    }
  }

  await deleteBranch(name);

  success(`Deleted branch: ${name}`);
}

// =============================================================================
// Command Registration
// =============================================================================

export function branchCommand(program: Command): void {
  const branch = program
    .command('branch')
    .description('Manage branches')
    .action(async () => {
      try {
        await listBranchesAction();
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });

  // branch create <name>
  branch
    .command('create')
    .description('Create a new branch at the current version')
    .argument('<name>', 'Branch name')
    .option('-d, --description <text>', 'Branch description')
    .action(async (name: string, opts: CreateOptions) => {
      try {
        await createBranchAction(name, opts);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });

  // branch switch <name>
  branch
    .command('switch')
    .description('Switch to a different branch')
    .argument('<name>', 'Branch name')
    .action(async (name: string) => {
      try {
        await switchBranchAction(name);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });

  // branch delete <name>
  branch
    .command('delete')
    .description('Delete a branch')
    .argument('<name>', 'Branch name')
    .option('-f, --force', 'Skip confirmation')
    .action(async (name: string, opts: DeleteOptions) => {
      try {
        await deleteBranchAction(name, opts);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}
