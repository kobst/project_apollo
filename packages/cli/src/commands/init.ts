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
import { stateExists, saveNewState } from '../state/store.js';
import { clearSession } from '../state/session.js';
import { CLIError, handleError } from '../utils/errors.js';
import { success, heading, formatNodeCounts } from '../utils/format.js';

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new story (optionally from a logline)')
    .argument('[logline]', 'Optional story logline/premise')
    .option('-f, --force', 'Overwrite existing story')
    .action(async (logline: string | undefined, options: { force?: boolean }) => {
      try {
        // Check for existing state
        if ((await stateExists()) && !options.force) {
          throw new CLIError(
            'A story already exists in this directory.',
            'Use --force to overwrite, or run commands in a different directory.'
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

        // Save state
        await saveNewState(initializedGraph, versionId, {
          ...(logline && { logline }),
          phase: 'OUTLINE',
        });

        // Clear any existing session
        await clearSession();

        // Display result
        heading('Story Initialized');
        if (logline) {
          console.log(`Logline: "${logline}"`);
        } else {
          console.log('Empty story structure created (no logline).');
        }
        console.log();

        const stats = getGraphStats(initializedGraph);
        console.log('Nodes:');
        console.log(formatNodeCounts(stats.nodeCountByType));
        console.log();

        success('Story created. Run "apollo oqs" to see open questions.');
      } catch (error) {
        handleError(error);
      }
    });
}
