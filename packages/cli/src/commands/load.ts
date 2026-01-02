/**
 * apollo load <file> - Load state from JSON file
 */

import type { Command } from 'commander';
import { readFile } from 'fs/promises';
import { validateGraph } from '@apollo/core';
import {
  stateExists,
  saveState,
  deserializeGraph,
  type PersistedState,
} from '../state/store.js';
import { clearSession } from '../state/session.js';
import { CLIError, ValidationError, handleError } from '../utils/errors.js';
import { success } from '../utils/format.js';

export function loadCommand(program: Command): void {
  program
    .command('load')
    .description('Load story from a JSON file')
    .argument('<file>', 'Input file path')
    .option('-f, --force', 'Overwrite existing story')
    .action(async (file: string, options: { force?: boolean }) => {
      try {
        // Check for existing state
        if ((await stateExists()) && !options.force) {
          throw new CLIError(
            'A story already exists in this directory.',
            'Use --force to overwrite, or run commands in a different directory.'
          );
        }

        // Read file
        let content: string;
        try {
          content = await readFile(file, 'utf-8');
        } catch {
          throw new CLIError(`Could not read file: ${file}`);
        }

        // Parse JSON
        let data: {
          version?: string;
          storyVersionId?: string;
          metadata?: PersistedState['metadata'];
          graph?: PersistedState['graph'];
        };
        try {
          data = JSON.parse(content);
        } catch {
          throw new CLIError('Invalid JSON file');
        }

        // Validate structure
        if (!data.version || !data.storyVersionId || !data.graph) {
          throw new CLIError(
            'Invalid export file: missing required fields (version, storyVersionId, graph)'
          );
        }

        // Validate graph
        const graph = deserializeGraph(data.graph);
        const validation = validateGraph(graph);

        if (!validation.success) {
          throw new ValidationError(
            'Invalid graph state',
            validation.errors.map((e) => e.message)
          );
        }

        // Save state
        const now = new Date().toISOString();
        const state: PersistedState = {
          version: data.version,
          storyVersionId: data.storyVersionId,
          createdAt: now,
          updatedAt: now,
          graph: data.graph,
          ...(data.metadata !== undefined && { metadata: data.metadata }),
        };

        await saveState(state);

        // Clear any existing session
        await clearSession();

        success(`Story loaded from: ${file}`);
      } catch (error) {
        handleError(error);
      }
    });
}
