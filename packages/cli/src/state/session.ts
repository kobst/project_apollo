/**
 * Session state for tracking active clusters and moves.
 * Stores in .apollo/session.json.
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import type { MoveCluster, NarrativeMove, Patch } from '@apollo/core';

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
}

// =============================================================================
// Paths
// =============================================================================

const APOLLO_DIR = '.apollo';
const SESSION_FILE = 'session.json';

function getApolloDir(): string {
  return join(process.cwd(), APOLLO_DIR);
}

function getSessionPath(): string {
  return join(getApolloDir(), SESSION_FILE);
}

// =============================================================================
// Session Operations
// =============================================================================

/**
 * Load session from disk.
 * Returns empty session if none exists.
 */
export async function loadSession(): Promise<SessionState> {
  try {
    const content = await readFile(getSessionPath(), 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch {
    return { activeClusters: [], recentMoves: [] };
  }
}

/**
 * Save session to disk.
 */
export async function saveSession(session: SessionState): Promise<void> {
  await mkdir(getApolloDir(), { recursive: true });
  await writeFile(getSessionPath(), JSON.stringify(session, null, 2), 'utf-8');
}

/**
 * Add a cluster result to the session.
 */
export async function addCluster(result: ClusterResult): Promise<void> {
  const session = await loadSession();
  session.activeClusters.push(result);
  await saveSession(session);
}

/**
 * Find a move by ID across all active clusters.
 */
export async function findMove(
  moveId: string
): Promise<{ move: NarrativeMove; patch: Patch; clusterIndex: number } | null> {
  const session = await loadSession();

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
export async function acceptMove(
  moveId: string
): Promise<{ move: NarrativeMove; patch: Patch } | null> {
  const session = await loadSession();
  const found = await findMove(moveId);

  if (!found) return null;

  // Remove the cluster
  session.activeClusters.splice(found.clusterIndex, 1);

  // Add to recent moves (keep last 10)
  session.recentMoves.push(found.move);
  if (session.recentMoves.length > 10) {
    session.recentMoves = session.recentMoves.slice(-10);
  }

  await saveSession(session);

  return { move: found.move, patch: found.patch };
}

/**
 * Clear all active clusters.
 */
export async function clearClusters(): Promise<void> {
  const session = await loadSession();
  session.activeClusters = [];
  await saveSession(session);
}

/**
 * Clear entire session.
 */
export async function clearSession(): Promise<void> {
  try {
    await unlink(getSessionPath());
  } catch {
    // Ignore if file doesn't exist
  }
}
