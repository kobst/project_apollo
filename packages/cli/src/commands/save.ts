/**
 * apollo save <file> - Export state to JSON file
 */

import type { Command } from 'commander';
import { writeFile } from 'fs/promises';
import { loadState } from '../state/store.js';
import { requireState, handleError } from '../utils/errors.js';
import { success } from '../utils/format.js';

export function saveCommand(program: Command): void {
  program
    .command('save')
    .description('Export story to a JSON file')
    .argument('<file>', 'Output file path')
    .action(async (file: string) => {
      try {
        const state = await loadState();
        requireState(state);

        // Prepare export data
        const exportData = {
          version: state.version,
          exportedAt: new Date().toISOString(),
          storyVersionId: state.storyVersionId,
          metadata: state.metadata,
          graph: state.graph,
        };

        // Ensure .json extension
        const outputPath = file.endsWith('.json') ? file : `${file}.json`;

        await writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

        success(`Story exported to: ${outputPath}`);
      } catch (error) {
        handleError(error);
      }
    });
}
