/**
 * State persistence for the CLI.
 * Stores graph state in .apollo/state.json in the current working directory.
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import type { GraphState } from '@apollo/core';
import type { KGNode, Edge } from '@apollo/core';
import type { OQPhase } from '@apollo/core';

// =============================================================================
// Types
// =============================================================================

export interface SerializedGraph {
  nodes: Record<string, KGNode>;
  edges: Edge[];
}

export interface PersistedState {
  version: string;
  storyVersionId: string;
  createdAt: string;
  updatedAt: string;
  graph: SerializedGraph;
  metadata?: {
    logline?: string;
    phase?: OQPhase;
  };
}

// =============================================================================
// Paths
// =============================================================================

const APOLLO_DIR = '.apollo';
const STATE_FILE = 'state.json';
const STATE_VERSION = '1.0.0';

function getApolloDir(): string {
  return join(process.cwd(), APOLLO_DIR);
}

function getStatePath(): string {
  return join(getApolloDir(), STATE_FILE);
}

// =============================================================================
// Serialization
// =============================================================================

export function serializeGraph(graph: GraphState): SerializedGraph {
  return {
    nodes: Object.fromEntries(graph.nodes),
    edges: graph.edges,
  };
}

export function deserializeGraph(data: SerializedGraph): GraphState {
  return {
    nodes: new Map(Object.entries(data.nodes)),
    edges: data.edges,
  };
}

// =============================================================================
// State Operations
// =============================================================================

/**
 * Check if state exists in the current directory.
 */
export async function stateExists(): Promise<boolean> {
  try {
    await access(getStatePath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Load state from disk.
 * Returns null if no state exists.
 */
export async function loadState(): Promise<PersistedState | null> {
  try {
    const content = await readFile(getStatePath(), 'utf-8');
    return JSON.parse(content) as PersistedState;
  } catch {
    return null;
  }
}

/**
 * Load and deserialize the graph from state.
 * Returns null if no state exists.
 */
export async function loadGraph(): Promise<GraphState | null> {
  const state = await loadState();
  if (!state) return null;
  return deserializeGraph(state.graph);
}

/**
 * Save state to disk.
 */
export async function saveState(state: PersistedState): Promise<void> {
  await mkdir(getApolloDir(), { recursive: true });
  await writeFile(getStatePath(), JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Create and save a new state from a graph.
 */
export async function saveNewState(
  graph: GraphState,
  storyVersionId: string,
  metadata?: PersistedState['metadata']
): Promise<void> {
  const now = new Date().toISOString();
  const state: PersistedState = {
    version: STATE_VERSION,
    storyVersionId,
    createdAt: now,
    updatedAt: now,
    graph: serializeGraph(graph),
    ...(metadata !== undefined && { metadata }),
  };
  await saveState(state);
}

/**
 * Update the graph in existing state.
 */
export async function updateState(
  graph: GraphState,
  metadataUpdates?: Partial<PersistedState['metadata']>
): Promise<void> {
  const existing = await loadState();
  if (!existing) {
    throw new Error('No existing state to update');
  }

  const state: PersistedState = {
    ...existing,
    updatedAt: new Date().toISOString(),
    graph: serializeGraph(graph),
    metadata: {
      ...existing.metadata,
      ...metadataUpdates,
    },
  };
  await saveState(state);
}
