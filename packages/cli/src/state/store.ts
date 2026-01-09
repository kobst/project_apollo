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
  storyContext?: string;           // Markdown content for creative guidance
  storyContextModifiedAt?: string; // ISO timestamp for version tracking
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
 * A named branch pointing to a version.
 */
export interface Branch {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
}

/**
 * Version history for a story.
 */
export interface VersionHistory {
  versions: Record<string, StoredVersion>;
  branches: Record<string, Branch>;
  currentBranch: string | null;  // null = detached state
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
  branch?: string;  // Branch name if this version is a branch head
}

export interface BranchInfo {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
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
 * @deprecated Use loadGraph() for graph data or loadVersionedState() for full state.
 * This function only works with non-versioned state and will be removed.
 */
export async function loadState(): Promise<PersistedState | null> {
  const storyId = await getCurrentStoryId();
  if (!storyId) return null;
  const state = await loadStateById(storyId);
  if (!state || isVersionedState(state)) return null;
  return state;
}

/**
 * Load and deserialize the graph from current story.
 * Works with both legacy (PersistedState) and versioned (VersionedState) formats.
 */
export async function loadGraph(): Promise<GraphState | null> {
  const storyId = await getCurrentStoryId();
  if (!storyId) return null;

  const state = await loadStateById(storyId);
  if (!state) return null;

  // Handle versioned state (V2+)
  if (isVersionedState(state)) {
    const currentVersion = state.history.versions[state.history.currentVersionId];
    if (!currentVersion) return null;
    return deserializeGraph(currentVersion.graph);
  }

  // Legacy format (V1)
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
 * Update the graph in current story. Creates a new version.
 */
export async function updateState(
  graph: GraphState,
  metadataUpdates?: Partial<StoryMetadata>
): Promise<void> {
  // Delegate to version-aware update with a generic label
  await updateStateWithVersion(graph, 'Update', metadataUpdates);
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
 * Auto-creates "main" branch pointing to the initial version.
 */
export function migrateToVersioned(state: PersistedState): VersionedState {
  const version: StoredVersion = {
    id: state.storyVersionId,
    parent_id: null,
    label: 'Initial',
    created_at: state.createdAt,
    graph: state.graph,
  };

  const mainBranch: Branch = {
    name: 'main',
    headVersionId: version.id,
    createdAt: state.createdAt,
  };

  const result: VersionedState = {
    version: '3.0.0',  // V3 includes branches
    storyId: state.storyId,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    history: {
      versions: { [version.id]: version },
      branches: { main: mainBranch },
      currentBranch: 'main',
      currentVersionId: version.id,
    },
  };

  if (state.metadata) {
    result.metadata = state.metadata;
  }

  return result;
}

/**
 * Migrate V2 state (no branches) to V3 (with branches).
 */
function migrateV2ToV3(state: VersionedState): VersionedState {
  // Already has branches
  if (state.history.branches && Object.keys(state.history.branches).length > 0) {
    return state;
  }

  const mainBranch: Branch = {
    name: 'main',
    headVersionId: state.history.currentVersionId,
    createdAt: state.createdAt,
  };

  return {
    ...state,
    version: '3.0.0',
    history: {
      ...state.history,
      branches: { main: mainBranch },
      currentBranch: 'main',
    },
  };
}

/**
 * Load state and ensure it's in versioned format with branches.
 */
export async function loadVersionedState(): Promise<VersionedState | null> {
  const storyId = await getCurrentStoryId();
  if (!storyId) return null;

  const state = await loadStateById(storyId);
  if (!state) return null;

  // Migrate from V1 if needed
  if (!isVersionedState(state)) {
    const versioned = migrateToVersioned(state);
    await saveVersionedState(storyId, versioned);
    return versioned;
  }

  // Migrate from V2 (no branches) to V3 if needed
  if (!state.history.branches || Object.keys(state.history.branches).length === 0) {
    const upgraded = migrateV2ToV3(state);
    await saveVersionedState(storyId, upgraded);
    return upgraded;
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
 * If on a branch, also updates the branch head.
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

  // Update branch head if on a branch
  const updatedBranches = { ...state.history.branches };
  if (state.history.currentBranch) {
    const currentBranchData = updatedBranches[state.history.currentBranch];
    if (currentBranchData) {
      updatedBranches[state.history.currentBranch] = {
        name: currentBranchData.name,
        headVersionId: newVersionId,
        createdAt: currentBranchData.createdAt,
        ...(currentBranchData.description !== undefined && { description: currentBranchData.description }),
      };
    }
  }

  state = {
    ...state,
    updatedAt: now,
    history: {
      ...state.history,
      versions: {
        ...state.history.versions,
        [newVersionId]: newVersion,
      },
      branches: updatedBranches,
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

  // Build a map of version ID -> branch name (for branch heads)
  const branchHeads = new Map<string, string>();
  for (const [branchName, branch] of Object.entries(state.history.branches)) {
    branchHeads.set(branch.headVersionId, branchName);
  }

  const versions: VersionInfo[] = Object.values(state.history.versions).map((v) => {
    const branchName = branchHeads.get(v.id);
    return {
      id: v.id,
      label: v.label,
      parent_id: v.parent_id,
      created_at: v.created_at,
      isCurrent: v.id === state.history.currentVersionId,
      ...(branchName !== undefined && { branch: branchName }),
    };
  });

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
 * If the version is a branch head, switch to that branch.
 * Otherwise, enter detached state.
 */
export async function checkoutVersion(versionId: string): Promise<{ branch: string | null }> {
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

  // Check if this version is a branch head
  let targetBranch: string | null = null;
  for (const [branchName, branch] of Object.entries(state.history.branches)) {
    if (branch.headVersionId === versionId) {
      targetBranch = branchName;
      break;
    }
  }

  const updatedState: VersionedState = {
    ...state,
    updatedAt: new Date().toISOString(),
    history: {
      ...state.history,
      currentBranch: targetBranch,
      currentVersionId: versionId,
    },
  };

  await saveVersionedState(storyId, updatedState);
  return { branch: targetBranch };
}

/**
 * Update state with version tracking.
 * Creates a new version with the given label.
 * If on a branch, also updates the branch head.
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

  // Update branch head if on a branch
  const updatedBranches = { ...state.history.branches };
  if (state.history.currentBranch) {
    const currentBranchData = updatedBranches[state.history.currentBranch];
    if (currentBranchData) {
      updatedBranches[state.history.currentBranch] = {
        name: currentBranchData.name,
        headVersionId: newVersionId,
        createdAt: currentBranchData.createdAt,
        ...(currentBranchData.description !== undefined && { description: currentBranchData.description }),
      };
    }
  }

  state = {
    ...state,
    updatedAt: now,
    metadata: {
      ...state.metadata,
      ...metadataUpdates,
    },
    history: {
      ...state.history,
      versions: {
        ...state.history.versions,
        [newVersionId]: newVersion,
      },
      branches: updatedBranches,
      currentVersionId: newVersionId,
    },
  };

  await saveVersionedState(storyId, state);
  return newVersionId;
}

// =============================================================================
// Branch Operations
// =============================================================================

/**
 * Get all branches for the current story.
 */
export async function listBranches(): Promise<BranchInfo[]> {
  const state = await loadVersionedState();
  if (!state) return [];

  return Object.values(state.history.branches).map((b): BranchInfo => ({
    name: b.name,
    headVersionId: b.headVersionId,
    createdAt: b.createdAt,
    ...(b.description !== undefined && { description: b.description }),
    isCurrent: b.name === state.history.currentBranch,
  }));
}

/**
 * Get current branch name.
 */
export async function getCurrentBranch(): Promise<string | null> {
  const state = await loadVersionedState();
  if (!state) return null;
  return state.history.currentBranch;
}

/**
 * Create a new branch at the current version.
 */
export async function createBranch(
  name: string,
  description?: string
): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new Error('No current story set');
  }

  const state = await loadVersionedState();
  if (!state) {
    throw new Error('Current story state not found');
  }

  // Check if branch already exists
  if (state.history.branches[name]) {
    throw new Error(`Branch "${name}" already exists`);
  }

  const newBranch: Branch = {
    name,
    headVersionId: state.history.currentVersionId,
    createdAt: new Date().toISOString(),
    ...(description && { description }),
  };

  const updatedState: VersionedState = {
    ...state,
    updatedAt: new Date().toISOString(),
    history: {
      ...state.history,
      branches: {
        ...state.history.branches,
        [name]: newBranch,
      },
      currentBranch: name,
    },
  };

  await saveVersionedState(storyId, updatedState);
}

/**
 * Switch to a different branch.
 */
export async function switchBranch(name: string): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new Error('No current story set');
  }

  const state = await loadVersionedState();
  if (!state) {
    throw new Error('Current story state not found');
  }

  const branch = state.history.branches[name];
  if (!branch) {
    throw new Error(`Branch "${name}" not found`);
  }

  const updatedState: VersionedState = {
    ...state,
    updatedAt: new Date().toISOString(),
    history: {
      ...state.history,
      currentBranch: name,
      currentVersionId: branch.headVersionId,
    },
  };

  await saveVersionedState(storyId, updatedState);
}

/**
 * Delete a branch.
 */
export async function deleteBranch(name: string): Promise<void> {
  const storyId = await getCurrentStoryId();
  if (!storyId) {
    throw new Error('No current story set');
  }

  const state = await loadVersionedState();
  if (!state) {
    throw new Error('Current story state not found');
  }

  if (!state.history.branches[name]) {
    throw new Error(`Branch "${name}" not found`);
  }

  if (name === 'main') {
    throw new Error('Cannot delete the main branch');
  }

  if (state.history.currentBranch === name) {
    throw new Error('Cannot delete the current branch. Switch to another branch first.');
  }

  const { [name]: _deleted, ...remainingBranches } = state.history.branches;

  const updatedState: VersionedState = {
    ...state,
    updatedAt: new Date().toISOString(),
    history: {
      ...state.history,
      branches: remainingBranches,
    },
  };

  await saveVersionedState(storyId, updatedState);
}

/**
 * Get branch by name.
 */
export async function getBranch(name: string): Promise<Branch | null> {
  const state = await loadVersionedState();
  if (!state) return null;
  return state.history.branches[name] ?? null;
}
