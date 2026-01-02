/**
 * State persistence for the CLI.
 * Stores stories centrally in ~/.apollo/stories/<story-id>/
 */

import { readFile, writeFile, mkdir, access, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
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

export interface StoryMetadata {
  name?: string;
  logline?: string;
  phase?: OQPhase;
}

/**
 * A single story version with its graph state.
 */
export interface StoredVersion {
  id: string;
  parent_id: string | null;
  label: string;
  created_at: string;
  graph: SerializedGraph;
}

/**
 * Version history for a story.
 */
export interface VersionHistory {
  versions: Record<string, StoredVersion>;
  currentVersionId: string;
}

/**
 * V1 format - flat state without version history (for backward compatibility).
 */
export interface PersistedState {
  version: string;
  storyId: string;
  storyVersionId: string;
  createdAt: string;
  updatedAt: string;
  graph: SerializedGraph;
  metadata?: StoryMetadata;
}

/**
 * V2 format - state with version history.
 */
export interface VersionedState {
  version: string;
  storyId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: StoryMetadata;
  history: VersionHistory;
}

/**
 * Union of both state formats for loading.
 */
export type StoredState = PersistedState | VersionedState;

/**
 * Check if state has version history.
 */
export function isVersionedState(state: StoredState): state is VersionedState {
  return 'history' in state && state.history !== undefined;
}

export interface StoryInfo {
  id: string;
  name?: string;
  logline?: string;
  updatedAt: string;
  isCurrent: boolean;
}

export interface VersionInfo {
  id: string;
  label: string;
  parent_id: string | null;
  created_at: string;
  isCurrent: boolean;
}

// =============================================================================
// Paths
// =============================================================================

const STATE_FILE = 'state.json';
const CURRENT_FILE = 'current';
const STATE_VERSION = '1.0.0';

function getApolloCentralDir(): string {
  return join(homedir(), '.apollo');
}

function getStoriesDir(): string {
  return join(getApolloCentralDir(), 'stories');
}

function getStoryDir(storyId: string): string {
  return join(getStoriesDir(), storyId);
}

function getStatePath(storyId: string): string {
  return join(getStoryDir(storyId), STATE_FILE);
}

function getCurrentStoryPath(): string {
  return join(getApolloCentralDir(), CURRENT_FILE);
}

// =============================================================================
// Slugify
// =============================================================================

/**
 * Convert a name to a URL-safe slug.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens from ends
}

/**
 * Generate a story ID from a name, or create a timestamp-based one.
 */
export function generateStoryId(name?: string, logline?: string): string {
  if (name) {
    return slugify(name);
  }
  if (logline) {
    // Take first few words of logline
    const words = logline.split(/\s+/).slice(0, 4).join(' ');
    return slugify(words) || `story-${Date.now()}`;
  }
  return `untitled-${Date.now()}`;
}

// =============================================================================
// Current Story
// =============================================================================

/**
 * Get the current story ID.
 */
export async function getCurrentStoryId(): Promise<string | null> {
  try {
    const content = await readFile(getCurrentStoryPath(), 'utf-8');
    return content.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Set the current story.
 */
export async function setCurrentStory(storyId: string): Promise<void> {
  await mkdir(getApolloCentralDir(), { recursive: true });
  await writeFile(getCurrentStoryPath(), storyId, 'utf-8');
}

/**
 * Clear the current story selection.
 */
export async function clearCurrentStory(): Promise<void> {
  try {
    await writeFile(getCurrentStoryPath(), '', 'utf-8');
  } catch {
    // Ignore if file doesn't exist
  }
}

// =============================================================================
// Story Listing
// =============================================================================

/**
 * Check if a story exists.
 */
export async function storyExists(storyId: string): Promise<boolean> {
  try {
    await access(getStatePath(storyId));
    return true;
  } catch {
    return false;
  }
}

/**
 * List all stories.
 */
export async function listStories(): Promise<StoryInfo[]> {
  const currentId = await getCurrentStoryId();
  const stories: StoryInfo[] = [];

  try {
    const dirs = await readdir(getStoriesDir());

    for (const dir of dirs) {
      try {
        const state = await loadStateById(dir);
        if (state) {
          stories.push({
            id: dir,
            ...(state.metadata?.name && { name: state.metadata.name }),
            ...(state.metadata?.logline && { logline: state.metadata.logline }),
            updatedAt: state.updatedAt,
            isCurrent: dir === currentId,
          });
        }
      } catch {
        // Skip invalid directories
      }
    }
  } catch {
    // Stories directory doesn't exist yet
  }

  // Sort by updatedAt (most recent first)
  stories.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return stories;
}

/**
 * Find a story by name or ID.
 */
export async function findStory(nameOrId: string): Promise<string | null> {
  // First try exact ID match
  if (await storyExists(nameOrId)) {
    return nameOrId;
  }

  // Try slugified version
  const slugged = slugify(nameOrId);
  if (slugged !== nameOrId && (await storyExists(slugged))) {
    return slugged;
  }

  // Search by name in metadata
  const stories = await listStories();
  const match = stories.find(
    (s) =>
      s.name?.toLowerCase() === nameOrId.toLowerCase() ||
      s.id === nameOrId ||
      s.id === slugged
  );

  return match?.id ?? null;
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
// State Operations (by story ID)
// =============================================================================

/**
 * Load state by story ID.
 */
export async function loadStateById(storyId: string): Promise<PersistedState | null> {
  try {
    const content = await readFile(getStatePath(storyId), 'utf-8');
    return JSON.parse(content) as PersistedState;
  } catch {
    return null;
  }
}

/**
 * Save state by story ID.
 */
export async function saveStateById(storyId: string, state: PersistedState): Promise<void> {
  await mkdir(getStoryDir(storyId), { recursive: true });
  await writeFile(getStatePath(storyId), JSON.stringify(state, null, 2), 'utf-8');
}

// =============================================================================
// State Operations (current story)
// =============================================================================

/**
 * Load state for the current story.
 * Returns null if no current story is set.
 */
export async function loadState(): Promise<PersistedState | null> {
  const storyId = await getCurrentStoryId();
  if (!storyId) return null;
  return loadStateById(storyId);
}

/**
 * Load and deserialize the graph from current story.
 */
export async function loadGraph(): Promise<GraphState | null> {
  const state = await loadState();
  if (!state) return null;
  return deserializeGraph(state.graph);
}

/**
 * Save state for the current story.
 */
export async function saveState(state: PersistedState): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new Error('No current story set');
  }
  await saveStateById(storyId, state);
}

/**
 * Create and save a new story.
 */
export async function createStory(
  storyId: string,
  graph: GraphState,
  storyVersionId: string,
  metadata?: StoryMetadata
): Promise<void> {
  const now = new Date().toISOString();
  const state: PersistedState = {
    version: STATE_VERSION,
    storyId,
    storyVersionId,
    createdAt: now,
    updatedAt: now,
    graph: serializeGraph(graph),
    ...(metadata !== undefined && { metadata }),
  };
  await saveStateById(storyId, state);
  await setCurrentStory(storyId);
}

/**
 * Update the graph in current story.
 */
export async function updateState(
  graph: GraphState,
  metadataUpdates?: Partial<StoryMetadata>
): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new Error('No current story set');
  }

  const existing = await loadStateById(storyId);
  if (!existing) {
    throw new Error('Current story state not found');
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
  await saveStateById(storyId, state);
}

// =============================================================================
// Legacy compatibility
// =============================================================================

/**
 * @deprecated Use createStory instead
 */
export async function saveNewState(
  graph: GraphState,
  storyVersionId: string,
  metadata?: StoryMetadata
): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new Error('No current story set');
  }
  const now = new Date().toISOString();
  const state: PersistedState = {
    version: STATE_VERSION,
    storyId,
    storyVersionId,
    createdAt: now,
    updatedAt: now,
    graph: serializeGraph(graph),
    ...(metadata !== undefined && { metadata }),
  };
  await saveStateById(storyId, state);
}

// =============================================================================
// Version History Operations
// =============================================================================

/**
 * Generate a new version ID.
 */
function generateVersionId(): string {
  return `sv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Migrate a V1 PersistedState to V2 VersionedState.
 */
export function migrateToVersioned(state: PersistedState): VersionedState {
  const version: StoredVersion = {
    id: state.storyVersionId,
    parent_id: null,
    label: 'Initial',
    created_at: state.createdAt,
    graph: state.graph,
  };

  const result: VersionedState = {
    version: '2.0.0',
    storyId: state.storyId,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    history: {
      versions: { [version.id]: version },
      currentVersionId: version.id,
    },
  };

  if (state.metadata) {
    result.metadata = state.metadata;
  }

  return result;
}

/**
 * Load state and ensure it's in versioned format.
 */
export async function loadVersionedState(): Promise<VersionedState | null> {
  const storyId = await getCurrentStoryId();
  if (!storyId) return null;

  const state = await loadStateById(storyId);
  if (!state) return null;

  // Migrate if needed
  if (!isVersionedState(state)) {
    const versioned = migrateToVersioned(state);
    // Save migrated state
    await saveVersionedState(storyId, versioned);
    return versioned;
  }

  return state;
}

/**
 * Save versioned state.
 */
export async function saveVersionedState(storyId: string, state: VersionedState): Promise<void> {
  await mkdir(getStoryDir(storyId), { recursive: true });
  await writeFile(getStatePath(storyId), JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Create a new version from the current state.
 */
export async function createVersion(
  graph: GraphState,
  label: string
): Promise<string> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new Error('No current story set');
  }

  let state = await loadVersionedState();
  if (!state) {
    throw new Error('Current story state not found');
  }

  const newVersionId = generateVersionId();
  const now = new Date().toISOString();

  const newVersion: StoredVersion = {
    id: newVersionId,
    parent_id: state.history.currentVersionId,
    label,
    created_at: now,
    graph: serializeGraph(graph),
  };

  state = {
    ...state,
    updatedAt: now,
    history: {
      versions: {
        ...state.history.versions,
        [newVersionId]: newVersion,
      },
      currentVersionId: newVersionId,
    },
  };

  await saveVersionedState(storyId, state);
  return newVersionId;
}

/**
 * Get all versions for the current story.
 */
export async function getVersionHistory(): Promise<VersionInfo[]> {
  const state = await loadVersionedState();
  if (!state) return [];

  const versions = Object.values(state.history.versions).map((v) => ({
    id: v.id,
    label: v.label,
    parent_id: v.parent_id,
    created_at: v.created_at,
    isCurrent: v.id === state.history.currentVersionId,
  }));

  // Sort by created_at (most recent first)
  versions.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return versions;
}

/**
 * Get the current version info.
 */
export async function getCurrentVersion(): Promise<StoredVersion | null> {
  const state = await loadVersionedState();
  if (!state) return null;

  return state.history.versions[state.history.currentVersionId] ?? null;
}

/**
 * Get a specific version by ID.
 */
export async function getVersion(versionId: string): Promise<StoredVersion | null> {
  const state = await loadVersionedState();
  if (!state) return null;

  return state.history.versions[versionId] ?? null;
}

/**
 * Checkout a specific version (switch to it).
 */
export async function checkoutVersion(versionId: string): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new Error('No current story set');
  }

  const state = await loadVersionedState();
  if (!state) {
    throw new Error('Current story state not found');
  }

  const version = state.history.versions[versionId];
  if (!version) {
    throw new Error(`Version "${versionId}" not found`);
  }

  const updatedState: VersionedState = {
    ...state,
    updatedAt: new Date().toISOString(),
    history: {
      ...state.history,
      currentVersionId: versionId,
    },
  };

  await saveVersionedState(storyId, updatedState);
}

/**
 * Update state with version tracking.
 * Creates a new version with the given label.
 */
export async function updateStateWithVersion(
  graph: GraphState,
  label: string,
  metadataUpdates?: Partial<StoryMetadata>
): Promise<string> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new Error('No current story set');
  }

  let state = await loadVersionedState();
  if (!state) {
    throw new Error('Current story state not found');
  }

  const newVersionId = generateVersionId();
  const now = new Date().toISOString();

  const newVersion: StoredVersion = {
    id: newVersionId,
    parent_id: state.history.currentVersionId,
    label,
    created_at: now,
    graph: serializeGraph(graph),
  };

  state = {
    ...state,
    updatedAt: now,
    metadata: {
      ...state.metadata,
      ...metadataUpdates,
    },
    history: {
      versions: {
        ...state.history.versions,
        [newVersionId]: newVersion,
      },
      currentVersionId: newVersionId,
    },
  };

  await saveVersionedState(storyId, state);
  return newVersionId;
}
