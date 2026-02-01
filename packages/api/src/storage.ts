/**
 * Storage operations with explicit context (dataDir).
 * Re-implements CLI's store functions with configurable data directory.
 */

import { readFile, writeFile, mkdir, access, readdir, rename } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import type { GraphState, KGNode, Edge, StoryContext } from '@apollo/core';
import { normalizeEdge, createDefaultStoryContext } from '@apollo/core';
import type { StorageContext } from './config.js';

// =============================================================================
// Per-story lock to prevent concurrent read-write race conditions
// =============================================================================

const storyLocks = new Map<string, Promise<unknown>>();

/**
 * Serialize async operations on a per-story basis.
 * Prevents concurrent file reads/writes from corrupting state.json.
 */
function withStoryLock<T>(storyId: string, fn: () => Promise<T>): Promise<T> {
  const previous = storyLocks.get(storyId) ?? Promise.resolve();
  const next = previous.then(fn, fn); // run fn after previous completes (even on error)
  storyLocks.set(storyId, next);
  // Clean up lock entry when chain settles
  next.then(
    () => { if (storyLocks.get(storyId) === next) storyLocks.delete(storyId); },
    () => { if (storyLocks.get(storyId) === next) storyLocks.delete(storyId); }
  );
  return next;
}

// =============================================================================
// Types (mirror CLI's store types)
// =============================================================================

export interface SerializedGraph {
  nodes: Record<string, KGNode>;
  edges: Edge[];
}

export interface StoryMetadata {
  name?: string;
  storyContext?: StoryContext;     // Structured story context
  storyContextModifiedAt?: string; // ISO timestamp for version tracking
}

export interface StoredVersion {
  id: string;
  parent_id: string | null;
  label: string;
  created_at: string;
  graph: SerializedGraph;
  enrichmentSummary?: string;
  packageTitle?: string;
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
  updatedAt: string;
}

export interface VersionInfo {
  id: string;
  label: string;
  parent_id: string | null;
  created_at: string;
  isCurrent: boolean;
  branch?: string;
  enrichmentSummary?: string;
  packageTitle?: string;
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

/**
 * Migrate legacy node types to current schema.
 * Handles renames like PlotPoint → StoryBeat.
 */
function migrateNodeType(node: KGNode): KGNode {
  // Migrate PlotPoint → StoryBeat (legacy data may have old type name)
  const nodeType = node.type as string;
  if (nodeType === 'PlotPoint') {
    return { ...node, type: 'StoryBeat' } as KGNode;
  }
  return node;
}

export function deserializeGraph(data: SerializedGraph): GraphState {
  // Migrate nodes to current schema (e.g., PlotPoint → StoryBeat)
  const nodes = new Map<string, KGNode>();
  for (const [id, node] of Object.entries(data.nodes)) {
    nodes.set(id, migrateNodeType(node));
  }

  return {
    nodes,
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
 * Migrate string-based storyContext to structured StoryContext.
 * Clean cutover: replace string with default empty structured context.
 */
function migrateStoryContext(state: VersionedState): VersionedState {
  if (!state.metadata?.storyContext) {
    return state;
  }

  // If storyContext is already an object (structured), no migration needed
  if (typeof state.metadata.storyContext === 'object') {
    return state;
  }

  // Clean cutover: replace string with default structured context
  // The old markdown content is discarded
  return {
    ...state,
    metadata: {
      ...state.metadata,
      storyContext: createDefaultStoryContext(),
    },
  };
}

/**
 * Migrate metadata.logline to constitution.logline.
 * If the old metadata had a logline and the constitution doesn't, copy it over.
 */
function migrateLoglineToConstitution(state: VersionedState): VersionedState {
  // Check if legacy logline exists on the raw metadata
  const rawMetadata = state.metadata as Record<string, unknown> | undefined;
  const legacyLogline = rawMetadata?.logline;
  if (typeof legacyLogline !== 'string' || !legacyLogline.trim()) {
    return state;
  }

  // Ensure storyContext exists
  const storyContext = state.metadata?.storyContext ?? createDefaultStoryContext();

  // Only copy if constitution.logline is empty
  if (storyContext.constitution.logline.trim()) {
    return state;
  }

  // Copy legacy logline to constitution and remove from metadata
  const { logline: _removed, ...cleanMetadata } = rawMetadata as Record<string, unknown>;

  return {
    ...state,
    metadata: {
      ...cleanMetadata,
      storyContext: {
        ...storyContext,
        constitution: {
          ...storyContext.constitution,
          logline: legacyLogline.trim(),
        },
      },
    } as StoryMetadata,
  };
}

/**
 * Load versioned state by story ID, auto-migrating if needed.
 * Wrapped in a per-story lock to prevent concurrent reads from seeing
 * a partially-written file during migration saves.
 */
export function loadVersionedStateById(
  storyId: string,
  ctx: StorageContext
): Promise<VersionedState | null> {
  return withStoryLock(storyId, () => loadVersionedStateByIdUnsafe(storyId, ctx));
}

async function loadVersionedStateByIdUnsafe(
  storyId: string,
  ctx: StorageContext
): Promise<VersionedState | null> {
  const state = await loadStateById(storyId, ctx);
  if (!state) return null;

  let needsSave = false;
  let current: VersionedState;

  // Migrate from V1 if needed
  if (!isVersionedState(state)) {
    current = migrateToVersioned(state);
    needsSave = true;
  } else {
    current = state;
  }

  // Migrate from V2 to V3 if needed
  if (!current.history.branches || Object.keys(current.history.branches).length === 0) {
    current = migrateV2ToV3(current);
    needsSave = true;
  }

  // Migrate string storyContext to structured StoryContext
  if (current.metadata?.storyContext && typeof current.metadata.storyContext === 'string') {
    current = migrateStoryContext(current);
    needsSave = true;
  }

  // Migrate metadata.logline to constitution.logline
  const rawMeta = current.metadata as Record<string, unknown> | undefined;
  if (rawMeta && typeof rawMeta.logline === 'string') {
    current = migrateLoglineToConstitution(current);
    needsSave = true;
  }

  // Backfill genre/setting fields on constitution (added in consolidation)
  const constitution = current.metadata?.storyContext?.constitution;
  if (constitution && (constitution.genre === undefined || constitution.setting === undefined)) {
    current = {
      ...current,
      metadata: {
        ...current.metadata,
        storyContext: {
          ...current.metadata!.storyContext!,
          constitution: {
            ...constitution,
            genre: constitution.genre ?? '',
            setting: constitution.setting ?? '',
          },
        },
      },
    };
    needsSave = true;
  }

  if (needsSave) {
    await saveVersionedStateById(storyId, current, ctx);
  }

  return current;
}

/**
 * Save versioned state by story ID.
 * Uses atomic write (temp file + rename) to prevent concurrent reads
 * from seeing a partially-written file.
 */
export async function saveVersionedStateById(
  storyId: string,
  state: VersionedState,
  ctx: StorageContext
): Promise<void> {
  const dir = getStoryDir(storyId, ctx);
  await mkdir(dir, { recursive: true });
  const statePath = getStatePath(storyId, ctx);
  const tmpPath = join(dir, `.state.${randomBytes(4).toString('hex')}.tmp`);
  await writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  await rename(tmpPath, statePath);
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
      ...(v.enrichmentSummary !== undefined && { enrichmentSummary: v.enrichmentSummary }),
      ...(v.packageTitle !== undefined && { packageTitle: v.packageTitle }),
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
 * Update metadata on an existing version (enrichment summary, package title).
 */
export async function updateVersionMeta(
  storyId: string,
  versionId: string,
  meta: { enrichmentSummary?: string; packageTitle?: string },
  ctx: StorageContext
): Promise<void> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state) {
    throw new Error(`Story "${storyId}" not found`);
  }

  const version = state.history.versions[versionId];
  if (!version) {
    throw new Error(`Version "${versionId}" not found`);
  }

  const updatedVersion: StoredVersion = { ...version };
  if (meta.enrichmentSummary !== undefined) {
    updatedVersion.enrichmentSummary = meta.enrichmentSummary;
  }
  if (meta.packageTitle !== undefined) {
    updatedVersion.packageTitle = meta.packageTitle;
  }

  const updatedState: VersionedState = {
    ...state,
    history: {
      ...state.history,
      versions: {
        ...state.history.versions,
        [versionId]: updatedVersion,
      },
    },
  };

  await saveVersionedStateById(storyId, updatedState, ctx);
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
