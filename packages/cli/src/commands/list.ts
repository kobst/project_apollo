/**
 * project-apollo list - List all stories
 */

import type { Command } from 'commander';
import { listStories } from '../state/store.js';
import { handleError } from '../utils/errors.js';
import { heading } from '../utils/format.js';
import pc from 'picocolors';

export function listCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List all stories')
    .action(async () => {
      try {
        const stories = await listStories();

        heading('Stories');

        if (stories.length === 0) {
          console.log(pc.dim('No stories yet.'));
          console.log('Run "project-apollo init" to create one.');
          return;
        }

        // Calculate column widths
        const maxIdLen = Math.max(...stories.map((s) => s.id.length), 2);

        for (const story of stories) {
          const marker = story.isCurrent ? pc.green('*') : ' ';
          const id = story.id.padEnd(maxIdLen);
          const name = story.name && story.name !== story.id
            ? pc.cyan(`(${story.name})`)
            : '';
          const logline = story.logline
            ? pc.dim(`"${story.logline.slice(0, 40)}${story.logline.length > 40 ? '...' : ''}"`)
            : pc.dim('(no logline)');
          const current = story.isCurrent ? pc.green(' (current)') : '';

          console.log(`${marker} ${id}  ${name} ${logline}${current}`);
        }

        console.log();
        console.log(pc.dim(`${stories.length} ${stories.length === 1 ? 'story' : 'stories'} total`));

        const currentStory = stories.find((s) => s.isCurrent);
        if (!currentStory) {
          console.log();
          console.log(pc.yellow('No story selected. Run "project-apollo open <id>" to select one.'));
        }
      } catch (error) {
        handleError(error);
      }
    });
}
