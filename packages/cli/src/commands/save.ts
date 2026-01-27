/**
 * project-apollo save <file> - Export state to JSON file
 */

import type { Command } from 'commander';
import { writeFile } from 'fs/promises';
import { loadState, getCurrentStoryId } from '../state/store.js';
import { requireState, handleError, CLIError } from '../utils/errors.js';
import { success } from '../utils/format.js';

export function saveCommand(program: Command): void {
  program
    .command('save')
    .description('Export story to a JSON file')
    .argument('<file>', 'Output file path')
    .action(async (file: string) => {
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

        // Prepare export data with v1-aligned storyVersion object
        const exportData = {
          version: state.version,
          exportedAt: new Date().toISOString(),
          storyId: state.storyId,
          // Full StoryVersion object per v1 spec
          storyVersion: {
            id: state.storyVersionId,
            parent_story_version_id: null, // Linear history for now
            created_at: state.createdAt,
            label: state.metadata?.name ?? state.storyId,
            tags: [],
          },
          // Keep storyVersionId for backward compatibility
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
