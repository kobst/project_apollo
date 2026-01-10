/**
 * project-apollo oqs - List open questions
 */

import type { Command } from 'commander';
import { deriveOpenQuestions } from '@apollo/core';
import type { OQDomain } from '@apollo/core';
import { loadGraph, getCurrentStoryId } from '../state/store.js';
import { handleError, CLIError } from '../utils/errors.js';
import { heading, formatOQList } from '../utils/format.js';

export function oqsCommand(program: Command): void {
  program
    .command('oqs')
    .description('List open questions')
    .option('-d, --domain <domain>', 'Filter by domain')
    .action(
      async (options: {
        domain?: string;
      }) => {
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

          let questions = deriveOpenQuestions(graph);

          // Apply filters
          if (options.domain) {
            const domain = options.domain.toUpperCase() as OQDomain;
            questions = questions.filter((q) => q.domain === domain);
          }

          heading(`Open Questions`);
          console.log(`Total: ${questions.length}`);
          console.log();
          console.log(formatOQList(questions));

          if (questions.length > 0) {
            console.log();
            console.log(
              'Run "project-apollo cluster <oq_id>" to generate moves for a question.'
            );
          }
        } catch (error) {
          handleError(error);
        }
      }
    );
}
