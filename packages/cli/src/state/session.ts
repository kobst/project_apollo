/**
 * Session state for tracking seeds and other per-story state.
 * Stores in .apollo/session.json.
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';

// =============================================================================
// Types
// =============================================================================

export interface SessionState {
  /** Last seeds used per OQ ID (for --regenerate) */
  lastSeeds?: Record<string, number>;
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
    return {};
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
 * Clear entire session.
 */
export async function clearSession(): Promise<void> {
  try {
    await unlink(getSessionPath());
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Get the last seed used for an OQ.
 */
export async function getLastSeed(oqId: string): Promise<number | null> {
  const session = await loadSession();
  return session.lastSeeds?.[oqId] ?? null;
}

/**
 * Store the last seed used for an OQ.
 */
export async function setLastSeed(oqId: string, seed: number): Promise<void> {
  const session = await loadSession();
  session.lastSeeds = session.lastSeeds ?? {};
  session.lastSeeds[oqId] = seed;
  await saveSession(session);
}
