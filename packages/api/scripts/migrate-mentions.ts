#!/usr/bin/env npx ts-node
/**
 * CLI script to migrate MENTIONS edges for all stories.
 *
 * Usage:
 *   npx ts-node scripts/migrate-mentions.ts [options]
 *
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --story=ID   Only migrate a specific story
 *   --verbose    Show detailed output for each story
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  migrateMentionsForStory,
  getMigrationStats,
  formatMigrationResult,
  formatBatchResult,
  type BatchMigrationResult,
  type MentionsMigrationResult
} from '../src/migrations/migrateMentions.js';
import type { GraphState } from '@apollo/core';

// =============================================================================
// Configuration
// =============================================================================

// Default data directory (can be overridden via env)
const DATA_DIR = process.env.APOLLO_DATA_DIR || path.join(process.cwd(), 'data');

// =============================================================================
// File Operations
// =============================================================================

interface VersionedState {
  metadata?: Record<string, unknown>;
  history: {
    currentVersionId: string;
    versions: Record<string, {
      graph: {
        nodes: Array<{ id: string; type: string; [key: string]: unknown }>;
        edges: Array<{ id: string; type: string; from: string; to: string; [key: string]: unknown }>;
      };
      updatedAt?: string;
    }>;
  };
}

function listStories(): string[] {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    return [];
  }

  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(name => !name.startsWith('.'));
}

function loadState(storyId: string): VersionedState | null {
  const statePath = path.join(DATA_DIR, storyId, 'state.json');
  if (!fs.existsSync(statePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    return JSON.parse(content) as VersionedState;
  } catch (error) {
    console.error(`Failed to load state for ${storyId}:`, error);
    return null;
  }
}

function saveState(storyId: string, state: VersionedState): void {
  const statePath = path.join(DATA_DIR, storyId, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function deserializeGraph(graphData: VersionedState['history']['versions'][string]['graph']): GraphState {
  const nodes = new Map<string, unknown>();
  for (const node of graphData.nodes) {
    nodes.set(node.id, node);
  }
  return {
    nodes: nodes as GraphState['nodes'],
    edges: graphData.edges as GraphState['edges']
  };
}

function serializeGraph(graph: GraphState): VersionedState['history']['versions'][string]['graph'] {
  return {
    nodes: Array.from(graph.nodes.values()) as Array<{ id: string; type: string; [key: string]: unknown }>,
    edges: graph.edges as Array<{ id: string; type: string; from: string; to: string; [key: string]: unknown }>
  };
}

// =============================================================================
// CLI
// =============================================================================

interface CliOptions {
  dryRun: boolean;
  storyId?: string;
  verbose: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dryRun: false,
    verbose: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg.startsWith('--story=')) {
      options.storyId = arg.replace('--story=', '');
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx ts-node scripts/migrate-mentions.ts [options]

Options:
  --dry-run    Show what would be migrated without making changes
  --story=ID   Only migrate a specific story
  --verbose    Show detailed output for each story
  --help       Show this help message
`);
      process.exit(0);
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs();
  
  console.log('=== MENTIONS Edge Migration ===');
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Get stories to process
  const storyIds = options.storyId ? [options.storyId] : listStories();
  
  if (storyIds.length === 0) {
    console.log('No stories found to migrate.');
    return;
  }

  console.log(`Found ${storyIds.length} stor${storyIds.length === 1 ? 'y' : 'ies'} to process.`);
  console.log('');

  const batchResult: BatchMigrationResult = {
    storiesProcessed: 0,
    storiesModified: 0,
    totalEdgesCreated: 0,
    totalEdgesRemoved: 0,
    results: new Map(),
    errors: []
  };

  for (const storyId of storyIds) {
    try {
      const state = loadState(storyId);
      if (!state) {
        console.log(`${storyId}: Skipped (no state file)`);
        continue;
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        console.log(`${storyId}: Skipped (no current version)`);
        continue;
      }

      const graph = deserializeGraph(currentVersion.graph);

      if (options.dryRun) {
        // Dry run - just show stats
        const stats = getMigrationStats(graph);
        if (options.verbose) {
          console.log(`${storyId}:`);
          console.log(`  Entities: ${stats.entityCount}`);
          console.log(`  Content nodes: ${stats.contentNodeCount}`);
          console.log(`  Existing MENTIONS: ${stats.existingMentionsCount}`);
          console.log(`  Needs migration: ${stats.needsMigration ? 'YES' : 'no'}`);
        } else {
          const status = stats.needsMigration ? 'NEEDS MIGRATION' : 'up to date';
          console.log(`${storyId}: ${status} (${stats.entityCount} entities, ${stats.existingMentionsCount} existing mentions)`);
        }
        
        batchResult.storiesProcessed++;
        if (stats.needsMigration) {
          batchResult.storiesModified++;
        }
      } else {
        // Live run - actually migrate
        const result = migrateMentionsForStory(graph);
        
        if (result.migrated) {
          // Save the updated graph
          currentVersion.graph = serializeGraph(graph);
          currentVersion.updatedAt = new Date().toISOString();
          saveState(storyId, state);
        }

        if (options.verbose || result.migrated) {
          console.log(formatMigrationResult(storyId, result));
        }

        batchResult.storiesProcessed++;
        if (result.migrated) {
          batchResult.storiesModified++;
        }
        batchResult.totalEdgesCreated += result.edgesCreated;
        batchResult.totalEdgesRemoved += result.edgesRemoved;
        batchResult.results.set(storyId, result);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`${storyId}: ERROR - ${errorMsg}`);
      batchResult.errors.push({ storyId, error: errorMsg });
    }
  }

  console.log('');
  console.log(formatBatchResult(batchResult));
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
