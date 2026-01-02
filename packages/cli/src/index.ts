#!/usr/bin/env node

/**
 * Apollo CLI - Screenplay knowledge graph system
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { openCommand } from './commands/open.js';
import { currentCommand } from './commands/current.js';
import { statusCommand } from './commands/status.js';
import { oqsCommand } from './commands/oqs.js';
import { clusterCommand } from './commands/cluster.js';
import { acceptCommand } from './commands/accept.js';
import { previewCommand } from './commands/preview.js';
import { saveCommand } from './commands/save.js';
import { loadCommand } from './commands/load.js';
import { addCommand } from './commands/add.js';
import { editCommand } from './commands/edit.js';
import { deleteCommand } from './commands/delete.js';
import { logCommand } from './commands/log.js';
import { checkoutCommand } from './commands/checkout.js';
import { handleError } from './utils/errors.js';

const program = new Command();

program
  .name('project-apollo')
  .description('Project Apollo - Screenplay knowledge graph CLI')
  .version('0.1.0');

// Register commands
initCommand(program);
listCommand(program);
openCommand(program);
currentCommand(program);
statusCommand(program);
oqsCommand(program);
clusterCommand(program);
acceptCommand(program);
previewCommand(program);
saveCommand(program);
loadCommand(program);
addCommand(program);
editCommand(program);
deleteCommand(program);
logCommand(program);
checkoutCommand(program);

// Global error handling
program.exitOverride((err) => {
  // Commander throws on --help and --version with specific codes
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(0);
  }
  throw err;
});

try {
  await program.parseAsync(process.argv);
} catch (error) {
  // Ignore commander exit errors for help/version
  const isCommanderExit =
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('commander.');

  if (isCommanderExit) {
    process.exit(0);
  }
  handleError(error);
}
