/**
 * project-apollo cluster <oq_id> - Generate move cluster for an open question
 */

import type { Command } from 'commander';
import { deriveOpenQuestions, generateClusterForQuestion } from '@apollo/core';
import type { OQPhase } from '@apollo/core';
import { loadState, deserializeGraph, getCurrentStoryId } from '../state/store.js';
import { addCluster } from '../state/session.js';
import { CLIError, requireState, handleError } from '../utils/errors.js';
import { heading, formatMoveList, info } from '../utils/format.js';
import pc from 'picocolors';

export function clusterCommand(program: Command): void {
  program
    .command('cluster')
    .description('Generate move cluster for an open question')
    .argument('<oq_id>', 'The open question ID')
    .action(async (oqId: string) => {
      try {
        const storyId = await getCurrentStoryId();
        if (!storyId) {
          throw new CLIError(
            'No story selected.',
            'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
          );
        }

        const state = await loadState();
        requireState(state, 'Current story not found.');

        const graph = deserializeGraph(state.graph);
        const phase: OQPhase = state.metadata?.phase ?? 'OUTLINE';
        const questions = deriveOpenQuestions(graph, phase);

        // Find the question
        const oq = questions.find((q) => q.id === oqId);
        if (!oq) {
          throw new CLIError(
            `Open question "${oqId}" not found.`,
            'Run "project-apollo oqs" to see available questions.'
          );
        }

        info(`Generating moves for: ${oq.message}`);
        console.log();

        // Generate cluster
        const clusterResult = generateClusterForQuestion(
          oq,
          state.storyVersionId,
          phase
        );

        // Save to session
        await addCluster(clusterResult);

        // Display result
        heading(clusterResult.cluster.title);
        console.log(pc.dim('Cluster type:'), clusterResult.cluster.cluster_type);
        console.log(pc.dim('Scope:'), clusterResult.cluster.scope_budget.allowed_depth);
        console.log();

        console.log(pc.bold('Available Moves:'));
        console.log();
        console.log(formatMoveList(clusterResult.moves));

        console.log(
          'Run "project-apollo accept <move_id>" to apply a move.'
        );
      } catch (error) {
        handleError(error);
      }
    });
}
