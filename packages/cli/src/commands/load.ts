/**
 * project-apollo load <file> - Load state from JSON file
 */

import type { Command } from 'commander';
import { readFile } from 'fs/promises';
import { validateGraph } from '@apollo/core';
import {
  storyExists,
  createStory,
  deserializeGraph,
  generateStoryId,
  type PersistedState,
} from '../state/store.js';
import { clearSession } from '../state/session.js';
import { CLIError, ValidationError, handleError } from '../utils/errors.js';
import { success } from '../utils/format.js';
import pc from 'picocolors';

export function loadCommand(program: Command): void {
  program
    .command('load')
    .description('Load story from a JSON file')
    .argument('<file>', 'Input file path')
    .option('-n, --name <name>', 'Story name (overrides name from file)')
    .option('-f, --force', 'Overwrite existing story with same ID')
    .action(async (file: string, options: { name?: string; force?: boolean }) => {
      try {
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
          storyId?: string;
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

        // Determine story ID
        const storyId = generateStoryId(
          options.name,
          data.storyId ?? data.metadata?.name ?? data.metadata?.logline
        );

        // Check if story already exists
        if ((await storyExists(storyId)) && !options.force) {
          throw new CLIError(
            `Story "${storyId}" already exists.`,
            'Use --force to overwrite, or choose a different --name.'
          );
        }

        // Create story
        await createStory(storyId, graph, data.storyVersionId, {
          name: options.name ?? data.metadata?.name ?? storyId,
          ...(data.metadata?.logline && { logline: data.metadata.logline }),
          phase: data.metadata?.phase ?? 'OUTLINE',
        });

        // Clear any existing session
        await clearSession();

        success(`Story loaded from: ${file}`);
        console.log(pc.dim('Story ID:'), storyId);
        console.log(pc.dim('Set as current story.'));
      } catch (error) {
        handleError(error);
      }
    });
}
