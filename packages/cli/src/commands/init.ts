/**
 * apollo init [logline] - Initialize a new story
 */

import type { Command } from 'commander';
import {
  createEmptyGraph,
  applyPatch,
  validatePatch,
  initializeStory,
  seedBeats,
  getGraphStats,
} from '@apollo/core';
import {
  storyExists,
  createStory,
  generateStoryId,
} from '../state/store.js';
import { clearSession } from '../state/session.js';
import { CLIError, handleError } from '../utils/errors.js';
import { success, heading, formatNodeCounts } from '../utils/format.js';
import pc from 'picocolors';

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new story (optionally from a logline)')
    .argument('[logline]', 'Optional story logline/premise')
    .option('-n, --name <name>', 'Story name (used as identifier)')
    .option('-f, --force', 'Overwrite existing story with same name')
    .action(
      async (
        logline: string | undefined,
        options: { name?: string; force?: boolean }
      ) => {
        try {
          // Generate story ID from name or logline
          const storyId = generateStoryId(options.name, logline);

          // Check if story already exists
          if ((await storyExists(storyId)) && !options.force) {
            throw new CLIError(
              `Story "${storyId}" already exists.`,
              'Use --force to overwrite, or choose a different --name.'
            );
          }

          // Create version ID
          const versionId = `sv_${Date.now()}`;

          // Create graph
          const graph = createEmptyGraph();

          // Use logline-based initialization or just seed beats
          const initPatch = logline
            ? initializeStory(logline, versionId)
            : seedBeats(versionId);

          // Validate before applying
          const validation = validatePatch(graph, initPatch);
          if (!validation.success) {
            throw new CLIError(
              'Failed to initialize story: ' +
                validation.errors.map((e) => e.message).join(', ')
            );
          }

          const initializedGraph = applyPatch(graph, initPatch);

          // Save story
          await createStory(storyId, initializedGraph, versionId, {
            name: options.name ?? storyId,
            ...(logline && { logline }),
          });

          // Clear any existing session
          await clearSession();

          // Display result
          heading('Story Initialized');
          console.log(pc.dim('ID:'), storyId);
          if (options.name) {
            console.log(pc.dim('Name:'), options.name);
          }
          if (logline) {
            console.log(pc.dim('Logline:'), `"${logline}"`);
          } else {
            console.log(pc.dim('Structure:'), 'Empty (no logline)');
          }
          console.log();

          const stats = getGraphStats(initializedGraph);
          console.log('Nodes:');
          console.log(formatNodeCounts(stats.nodeCountByType));
          console.log();

          success('Story created and set as current.');
          console.log('Run "project-apollo oqs" to see open questions.');
        } catch (error) {
          handleError(error);
        }
      }
    );
}
