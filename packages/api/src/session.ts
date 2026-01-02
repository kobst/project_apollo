/**
 * Session state for tracking active clusters and moves per-story.
 * Stores in ~/.apollo/stories/<story-id>/session.json
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import type { MoveCluster, NarrativeMove, Patch } from '@apollo/core';
import type { StorageContext } from './config.js';

// =============================================================================
// Types
// =============================================================================

export interface ClusterResult {
  cluster: MoveCluster;
  moves: Array<{
    move: NarrativeMove;
    patch: Patch;
  }>;
}

export interface SessionState {
  activeClusters: ClusterResult[];
  recentMoves: NarrativeMove[];
  lastSeeds?: Record<string, number>;
}

// =============================================================================
// Paths
// =============================================================================

const SESSION_FILE = 'session.json';

function getSessionPath(storyId: string, ctx: StorageContext): string {
  return join(ctx.dataDir, 'stories', storyId, SESSION_FILE);
}

function getStoryDir(storyId: string, ctx: StorageContext): string {
  return join(ctx.dataDir, 'stories', storyId);
}

// =============================================================================
// Session Operations
// =============================================================================

/**
 * Load session for a story.
 */
export async function loadSessionById(
  storyId: string,
  ctx: StorageContext
): Promise<SessionState> {
  try {
    const content = await readFile(getSessionPath(storyId, ctx), 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch {
    return { activeClusters: [], recentMoves: [] };
  }
}

/**
 * Save session for a story.
 */
export async function saveSessionById(
  storyId: string,
  session: SessionState,
  ctx: StorageContext
): Promise<void> {
  await mkdir(getStoryDir(storyId, ctx), { recursive: true });
  await writeFile(
    getSessionPath(storyId, ctx),
    JSON.stringify(session, null, 2),
    'utf-8'
  );
}

/**
 * Add a cluster result to a story's session.
 */
export async function addClusterById(
  storyId: string,
  result: ClusterResult,
  ctx: StorageContext
): Promise<void> {
  const session = await loadSessionById(storyId, ctx);
  session.activeClusters.push(result);
  await saveSessionById(storyId, session, ctx);
}

/**
 * Find a move by ID in a story's session.
 */
export async function findMoveById(
  storyId: string,
  moveId: string,
  ctx: StorageContext
): Promise<{ move: NarrativeMove; patch: Patch; clusterIndex: number } | null> {
  const session = await loadSessionById(storyId, ctx);

  for (let i = 0; i < session.activeClusters.length; i++) {
    const cluster = session.activeClusters[i];
    if (!cluster) continue;

    for (const moveData of cluster.moves) {
      if (moveData.move.id === moveId) {
        return {
          move: moveData.move,
          patch: moveData.patch,
          clusterIndex: i,
        };
      }
    }
  }

  return null;
}

/**
 * Accept a move: remove its cluster and add to recent moves.
 */
export async function acceptMoveById(
  storyId: string,
  moveId: string,
  ctx: StorageContext
): Promise<{ move: NarrativeMove; patch: Patch } | null> {
  const session = await loadSessionById(storyId, ctx);
  const found = await findMoveById(storyId, moveId, ctx);

  if (!found) return null;

  // Remove the cluster
  session.activeClusters.splice(found.clusterIndex, 1);

  // Add to recent moves (keep last 10)
  session.recentMoves.push(found.move);
  if (session.recentMoves.length > 10) {
    session.recentMoves = session.recentMoves.slice(-10);
  }

  await saveSessionById(storyId, session, ctx);

  return { move: found.move, patch: found.patch };
}

/**
 * Clear all active clusters for a story.
 */
export async function clearClustersById(
  storyId: string,
  ctx: StorageContext
): Promise<void> {
  const session = await loadSessionById(storyId, ctx);
  session.activeClusters = [];
  await saveSessionById(storyId, session, ctx);
}

/**
 * Clear entire session for a story.
 */
export async function clearSessionById(
  storyId: string,
  ctx: StorageContext
): Promise<void> {
  try {
    await unlink(getSessionPath(storyId, ctx));
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Get the last seed used for an OQ.
 */
export async function getLastSeedById(
  storyId: string,
  oqId: string,
  ctx: StorageContext
): Promise<number | null> {
  const session = await loadSessionById(storyId, ctx);
  return session.lastSeeds?.[oqId] ?? null;
}

/**
 * Store the last seed used for an OQ.
 */
export async function setLastSeedById(
  storyId: string,
  oqId: string,
  seed: number,
  ctx: StorageContext
): Promise<void> {
  const session = await loadSessionById(storyId, ctx);
  session.lastSeeds = session.lastSeeds ?? {};
  session.lastSeeds[oqId] = seed;
  await saveSessionById(storyId, session, ctx);
}
