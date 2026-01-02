/**
 * project-apollo oqs - List open questions
 */

import type { Command } from 'commander';
import { deriveOpenQuestions } from '@apollo/core';
import type { OQPhase, OQSeverity, OQDomain } from '@apollo/core';
import { loadGraph, loadVersionedState, getCurrentStoryId } from '../state/store.js';
import { handleError, CLIError } from '../utils/errors.js';
import { heading, formatOQList, phaseColor } from '../utils/format.js';

export function oqsCommand(program: Command): void {
  program
    .command('oqs')
    .description('List open questions')
    .option(
      '-p, --phase <phase>',
      'Filter by phase (OUTLINE, DRAFT, REVISION)'
    )
    .option(
      '-s, --severity <severity>',
      'Filter by severity (BLOCKING, IMPORTANT, SOFT)'
    )
    .option('-d, --domain <domain>', 'Filter by domain')
    .action(
      async (options: {
        phase?: string;
        severity?: string;
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

          const state = await loadVersionedState();
          const phase: OQPhase =
            (options.phase as OQPhase) ?? state?.metadata?.phase ?? 'OUTLINE';

          let questions = deriveOpenQuestions(graph, phase);

          // Apply filters
          if (options.severity) {
            const severity = options.severity.toUpperCase() as OQSeverity;
            questions = questions.filter((q) => q.severity === severity);
          }
          if (options.domain) {
            const domain = options.domain.toUpperCase() as OQDomain;
            questions = questions.filter((q) => q.domain === domain);
          }

          heading(`Open Questions (${phaseColor(phase)})`);
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
