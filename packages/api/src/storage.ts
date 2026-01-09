/**
 * Storage operations with explicit context (dataDir).
 * Re-implements CLI's store functions with configurable data directory.
 */

import { readFile, writeFile, mkdir, access, readdir } from 'fs/promises';
import { join } from 'path';
import type { GraphState, KGNode, Edge, OQPhase } from '@apollo/core';
import { normalizeEdge } from '@apollo/core';
import type { StorageContext } from './config.js';

// =============================================================================
// Types (mirror CLI's store types)
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

export interface StoredVersion {
  id: string;
  parent_id: string | null;
  label: string;
  created_at: string;
  graph: SerializedGraph;
}

export interface Branch {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
}

export interface VersionHistory {
  versions: Record<string, StoredVersion>;
  branches: Record<string, Branch>;
  currentBranch: string | null;
  currentVersionId: string;
}

export interface PersistedState {
  version: string;
  storyId: string;
  storyVersionId: string;
  createdAt: string;
  updatedAt: string;
  graph: SerializedGraph;
  metadata?: StoryMetadata;
}

export interface VersionedState {
  version: string;
  storyId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: StoryMetadata;
  history: VersionHistory;
}

export type StoredState = PersistedState | VersionedState;

export interface StoryInfo {
  id: string;
  name?: string;
  logline?: string;
  updatedAt: string;
}

export interface VersionInfo {
  id: string;
  label: string;
  parent_id: string | null;
  created_at: string;
  isCurrent: boolean;
  branch?: string;
}

export interface BranchInfo {
  name: string;
  headVersionId: string;
  createdAt: string;
  description?: string;
  isCurrent: boolean;
}

// =============================================================================
// Type Guards
// =============================================================================

export function isVersionedState(state: StoredState): state is VersionedState {
  return 'history' in state && state.history !== undefined;
}

// =============================================================================
// Path Utilities (context-aware)
// =============================================================================

const STATE_FILE = 'state.json';

function getStoriesDir(ctx: StorageContext): string {
  return join(ctx.dataDir, 'stories');
}

function getStoryDir(storyId: string, ctx: StorageContext): string {
  return join(getStoriesDir(ctx), storyId);
}

function getStatePath(storyId: string, ctx: StorageContext): string {
  return join(getStoryDir(storyId, ctx), STATE_FILE);
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
    // Normalize edges to ensure they have IDs (migration for old data)
    edges: data.edges.map(edge => normalizeEdge(edge)),
  };
}

// =============================================================================
// Slugify
// =============================================================================

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateStoryId(name?: string, logline?: string): string {
  if (name) {
    return slugify(name);
  }
  if (logline) {
    const words = logline.split(/\s+/).slice(0, 4).join(' ');
    return slugify(words) || `story-${Date.now()}`;
  }
  return `untitled-${Date.now()}`;
}

function generateVersionId(): string {
  return `sv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// Story Operations
// =============================================================================

/**
 * Check if a story exists.
 */
export async function storyExists(storyId: string, ctx: StorageContext): Promise<boolean> {
  try {
    await access(getStatePath(storyId, ctx));
    return true;
  } catch {
    return false;
  }
}

/**
 * List all stories.
 */
export async function listStories(ctx: StorageContext): Promise<StoryInfo[]> {
  const stories: StoryInfo[] = [];

  try {
    const dirs = await readdir(getStoriesDir(ctx));

    for (const dir of dirs) {
      try {
        const state = await loadStateById(dir, ctx);
        if (state) {
          stories.push({
            id: dir,
            ...(state.metadata?.name && { name: state.metadata.name }),
            ...(state.metadata?.logline && { logline: state.metadata.logline }),
            updatedAt: state.updatedAt,
          });
        }
      } catch {
        // Skip invalid directories
      }
    }
  } catch {
    // Stories directory doesn't exist yet
  }

  stories.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return stories;
}

/**
 * Find a story by name or ID.
 */
export async function findStory(nameOrId: string, ctx: StorageContext): Promise<string | null> {
  if (await storyExists(nameOrId, ctx)) {
    return nameOrId;
  }

  const slugged = slugify(nameOrId);
  if (slugged !== nameOrId && (await storyExists(slugged, ctx))) {
    return slugged;
  }

  const stories = await listStories(ctx);
  const match = stories.find(
    (s) =>
      s.name?.toLowerCase() === nameOrId.toLowerCase() ||
      s.id === nameOrId ||
      s.id === slugged
  );

  return match?.id ?? null;
}

// =============================================================================
// State Operations
// =============================================================================

/**
 * Load raw state by story ID.
 */
export async function loadStateById(storyId: string, ctx: StorageContext): Promise<StoredState | null> {
  try {
    const content = await readFile(getStatePath(storyId, ctx), 'utf-8');
    return JSON.parse(content) as StoredState;
  } catch {
    return null;
  }
}

/**
 * Migrate V1 to versioned format.
 */
function migrateToVersioned(state: PersistedState): VersionedState {
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
    version: '3.0.0',
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
 * Migrate V2 (no branches) to V3.
 */
function migrateV2ToV3(state: VersionedState): VersionedState {
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
 * Load versioned state by story ID, auto-migrating if needed.
 */
export async function loadVersionedStateById(
  storyId: string,
  ctx: StorageContext
): Promise<VersionedState | null> {
  const state = await loadStateById(storyId, ctx);
  if (!state) return null;

  // Migrate from V1 if needed
  if (!isVersionedState(state)) {
    const versioned = migrateToVersioned(state);
    await saveVersionedStateById(storyId, versioned, ctx);
    return versioned;
  }

  // Migrate from V2 to V3 if needed
  if (!state.history.branches || Object.keys(state.history.branches).length === 0) {
    const upgraded = migrateV2ToV3(state);
    await saveVersionedStateById(storyId, upgraded, ctx);
    return upgraded;
  }

  return state;
}

/**
 * Save versioned state by story ID.
 */
export async function saveVersionedStateById(
  storyId: string,
  state: VersionedState,
  ctx: StorageContext
): Promise<void> {
  await mkdir(getStoryDir(storyId, ctx), { recursive: true });
  await writeFile(getStatePath(storyId, ctx), JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Load and deserialize graph by story ID.
 */
export async function loadGraphById(storyId: string, ctx: StorageContext): Promise<GraphState | null> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) return null;

  const currentVersion = state.history.versions[state.history.currentVersionId];
  if (!currentVersion) return null;

  return deserializeGraph(currentVersion.graph);
}

// =============================================================================
// Create Story
// =============================================================================

/**
 * Create a new story.
 */
export async function createStory(
  storyId: string,
  graph: GraphState,
  storyVersionId: string,
  metadata: StoryMetadata | undefined,
  ctx: StorageContext
): Promise<void> {
  const now = new Date().toISOString();

  const version: StoredVersion = {
    id: storyVersionId,
    parent_id: null,
    label: 'Initial',
    created_at: now,
    graph: serializeGraph(graph),
  };

  const mainBranch: Branch = {
    name: 'main',
    headVersionId: storyVersionId,
    createdAt: now,
  };

  const state: VersionedState = {
    version: '3.0.0',
    storyId,
    createdAt: now,
    updatedAt: now,
    history: {
      versions: { [storyVersionId]: version },
      branches: { main: mainBranch },
      currentBranch: 'main',
      currentVersionId: storyVersionId,
    },
  };

  if (metadata) {
    state.metadata = metadata;
  }

  await saveVersionedStateById(storyId, state, ctx);
}

// =============================================================================
// Update Operations
// =============================================================================

/**
 * Update graph for a story, creating a new version.
 */
export async function updateGraphById(
  storyId: string,
  graph: GraphState,
  label: string,
  metadataUpdates: Partial<StoryMetadata> | undefined,
  ctx: StorageContext
): Promise<string> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" not found`);
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

  const updatedState: VersionedState = {
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

  await saveVersionedStateById(storyId, updatedState, ctx);
  return newVersionId;
}

// =============================================================================
// Version Operations
// =============================================================================

/**
 * Get version history for a story.
 */
export async function getVersionHistoryById(
  storyId: string,
  ctx: StorageContext
): Promise<VersionInfo[]> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) return [];

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

  versions.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return versions;
}

/**
 * Get a specific version.
 */
export async function getVersionById(
  storyId: string,
  versionId: string,
  ctx: StorageContext
): Promise<StoredVersion | null> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) return null;
  return state.history.versions[versionId] ?? null;
}

/**
 * Checkout a version.
 */
export async function checkoutVersionById(
  storyId: string,
  versionId: string,
  ctx: StorageContext
): Promise<{ branch: string | null }> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" not found`);
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

  await saveVersionedStateById(storyId, updatedState, ctx);
  return { branch: targetBranch };
}

// =============================================================================
// Branch Operations
// =============================================================================

/**
 * List branches for a story.
 */
export async function listBranchesById(
  storyId: string,
  ctx: StorageContext
): Promise<BranchInfo[]> {
  const state = await loadVersionedStateById(storyId, ctx);
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
 * Create a branch.
 */
export async function createBranchById(
  storyId: string,
  name: string,
  description: string | undefined,
  ctx: StorageContext
): Promise<void> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" not found`);
  }

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

  await saveVersionedStateById(storyId, updatedState, ctx);
}

/**
 * Switch to a branch.
 */
export async function switchBranchById(
  storyId: string,
  name: string,
  ctx: StorageContext
): Promise<void> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" not found`);
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

  await saveVersionedStateById(storyId, updatedState, ctx);
}

/**
 * Delete a branch.
 */
export async function deleteBranchById(
  storyId: string,
  name: string,
  ctx: StorageContext
): Promise<void> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" not found`);
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

  await saveVersionedStateById(storyId, updatedState, ctx);
}
