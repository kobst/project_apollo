/**
 * project-apollo cluster <oq_id> - Generate move cluster for an open question
 */

import type { Command } from 'commander';
import { deriveOpenQuestions, generateClusterForQuestion } from '@apollo/core';
import { loadGraph, loadVersionedState, getCurrentStoryId } from '../state/store.js';
import { addCluster, getLastSeed, setLastSeed, clearClusters } from '../state/session.js';
import { CLIError, handleError } from '../utils/errors.js';
import { heading, formatMoveList, info } from '../utils/format.js';
import pc from 'picocolors';

interface ClusterOptions {
  count?: string;
  seed?: string;
  regenerate?: boolean;
}

export function clusterCommand(program: Command): void {
  program
    .command('cluster')
    .description('Generate move cluster for an open question')
    .argument('<oq_id>', 'The open question ID')
    .option('-c, --count <n>', 'Number of moves to generate (default: 4, max: 12)')
    .option('-s, --seed <n>', 'Seed for reproducible generation')
    .option('-r, --regenerate', 'Generate new moves with a fresh seed')
    .action(async (oqId: string, options: ClusterOptions) => {
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
        if (!state) {
          throw new CLIError('Current story state not found.');
        }
        const questions = deriveOpenQuestions(graph);

        // Find the question
        const oq = questions.find((q) => q.id === oqId);
        if (!oq) {
          throw new CLIError(
            `Open question "${oqId}" not found.`,
            'Run "project-apollo oqs" to see available questions.'
          );
        }

        // Determine seed
        let seed: number;
        if (options.seed) {
          seed = parseInt(options.seed, 10);
          if (isNaN(seed)) {
            throw new CLIError('Invalid seed: must be a number');
          }
        } else if (options.regenerate) {
          // Get last seed and increment it to ensure different results
          const lastSeed = await getLastSeed(oqId);
          seed = lastSeed ? lastSeed + 1 : Date.now();
          info('Regenerating with new seed...');
        } else {
          seed = Date.now();
        }

        // Parse count
        const count = options.count ? parseInt(options.count, 10) : 4;
        if (isNaN(count) || count < 1 || count > 12) {
          throw new CLIError('Invalid count: must be 1-12');
        }

        info(`Generating ${count} moves for: ${oq.message}`);
        console.log();

        // Clear any existing clusters for this OQ (rejection is implicit)
        await clearClusters();

        // Generate cluster with options
        const clusterResult = generateClusterForQuestion(
          oq,
          state.history.currentVersionId,
          { count, seed }
        );

        // Save seed for regenerate
        await setLastSeed(oqId, seed);

        // Save to session
        await addCluster(clusterResult);

        // Display result
        heading(clusterResult.cluster.title);
        console.log(pc.dim('Cluster ID:'), clusterResult.cluster.id);
        console.log(pc.dim('Cluster type:'), clusterResult.cluster.cluster_type);
        console.log(pc.dim('Seed:'), seed);
        console.log();

        console.log(pc.bold(`Available Moves (${clusterResult.moves.length}):`));
        console.log();
        console.log(formatMoveList(clusterResult.moves));

        console.log(pc.dim('Commands:'));
        console.log(`  ${pc.cyan('project-apollo preview <move_id>')}  - Preview a move before accepting`);
        console.log(`  ${pc.cyan('project-apollo accept <move_id>')}   - Apply a move`);
        console.log(`  ${pc.cyan('project-apollo cluster ' + oqId + ' --regenerate')} - Try different options`);
      } catch (error) {
        handleError(error);
      }
    });
}
