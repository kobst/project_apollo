/**
 * Saved Packages - Persistent storage for packages with version anchoring.
 * Stores in ~/.apollo/stories/<story-id>/saved-packages.json
 *
 * Allows users to save interesting AI-generated packages for later,
 * track which story version they were generated against, and check
 * compatibility with the current graph state.
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import type { ai } from '@apollo/core';
import type { StorageContext } from './config.js';
import {
  loadVersionedStateById,
  loadGraphById,
  isVersionedState,
  type VersionedState,
  type StoredVersion,
} from './storage.js';

// =============================================================================
// Types
// =============================================================================

/**
 * A saved package with version anchoring metadata.
 */
export interface SavedPackage {
  id: string;                          // sp_${timestamp}_${random}
  storyId: string;
  package: ai.NarrativePackage;        // The original package data

  // Version anchoring
  sourceVersionId: string;             // Version ID when package was generated
  sourceVersionLabel: string;          // Human-readable version label

  // User metadata
  savedAt: string;                     // ISO timestamp
  userNote?: string;                   // Optional user annotation
}

/**
 * Compatibility status for a saved package against current graph.
 */
export interface PackageCompatibility {
  status: 'compatible' | 'outdated' | 'conflicting';
  currentVersionId: string;
  currentVersionLabel: string;
  versionsBehind: number;
  conflicts: CompatibilityConflict[];
}

/**
 * A specific conflict detected when checking compatibility.
 */
export interface CompatibilityConflict {
  type: 'node_deleted' | 'node_modified' | 'edge_deleted';
  nodeId?: string;
  edgeId?: string;
  description: string;
}

/**
 * Saved package with computed compatibility information.
 */
export interface SavedPackageWithCompatibility extends SavedPackage {
  compatibility: PackageCompatibility;
}

/**
 * Storage format for saved packages file.
 */
export interface SavedPackagesState {
  version: '1.0.0';
  packages: SavedPackage[];
}

// =============================================================================
// Path Utilities
// =============================================================================

const SAVED_PACKAGES_FILE = 'saved-packages.json';

function getSavedPackagesPath(storyId: string, ctx: StorageContext): string {
  return join(ctx.dataDir, 'stories', storyId, SAVED_PACKAGES_FILE);
}

function getStoryDir(storyId: string, ctx: StorageContext): string {
  return join(ctx.dataDir, 'stories', storyId);
}

// =============================================================================
// ID Generation
// =============================================================================

function generateSavedPackageId(): string {
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// =============================================================================
// Storage Operations
// =============================================================================

/**
 * Load saved packages for a story.
 */
export async function loadSavedPackages(
  storyId: string,
  ctx: StorageContext
): Promise<SavedPackagesState> {
  try {
    const content = await readFile(getSavedPackagesPath(storyId, ctx), 'utf-8');
    return JSON.parse(content) as SavedPackagesState;
  } catch {
    // Return empty state if file doesn't exist
    return { version: '1.0.0', packages: [] };
  }
}

/**
 * Save the saved packages state.
 */
export async function saveSavedPackagesState(
  storyId: string,
  state: SavedPackagesState,
  ctx: StorageContext
): Promise<void> {
  await mkdir(getStoryDir(storyId, ctx), { recursive: true });
  await writeFile(
    getSavedPackagesPath(storyId, ctx),
    JSON.stringify(state, null, 2),
    'utf-8'
  );
}

/**
 * Save a package to the library with version anchoring.
 */
export async function savePackageToLibrary(
  storyId: string,
  pkg: ai.NarrativePackage,
  sourceVersionId: string,
  sourceVersionLabel: string,
  ctx: StorageContext,
  options?: { userNote?: string }
): Promise<SavedPackage> {
  const state = await loadSavedPackages(storyId, ctx);

  const savedPackage: SavedPackage = {
    id: generateSavedPackageId(),
    storyId,
    package: pkg,
    sourceVersionId,
    sourceVersionLabel,
    savedAt: new Date().toISOString(),
  };

  // Only set optional properties if they have values
  if (options?.userNote) {
    savedPackage.userNote = options.userNote;
  }

  state.packages.push(savedPackage);
  await saveSavedPackagesState(storyId, state, ctx);

  return savedPackage;
}

/**
 * Get a saved package by ID.
 */
export async function getSavedPackageById(
  storyId: string,
  savedPackageId: string,
  ctx: StorageContext
): Promise<SavedPackage | null> {
  const state = await loadSavedPackages(storyId, ctx);
  return state.packages.find((p) => p.id === savedPackageId) ?? null;
}

/**
 * Update a saved package's user note.
 */
export async function updateSavedPackageNote(
  storyId: string,
  savedPackageId: string,
  userNote: string | undefined,
  ctx: StorageContext
): Promise<SavedPackage> {
  const state = await loadSavedPackages(storyId, ctx);
  const pkg = state.packages.find((p) => p.id === savedPackageId);

  if (!pkg) {
    throw new Error(`Saved package ${savedPackageId} not found`);
  }

  if (userNote !== undefined) {
    pkg.userNote = userNote;
  }

  await saveSavedPackagesState(storyId, state, ctx);
  return pkg;
}

/**
 * Delete a saved package.
 */
export async function deleteSavedPackage(
  storyId: string,
  savedPackageId: string,
  ctx: StorageContext
): Promise<void> {
  const state = await loadSavedPackages(storyId, ctx);
  state.packages = state.packages.filter((p) => p.id !== savedPackageId);
  await saveSavedPackagesState(storyId, state, ctx);
}

/**
 * Delete the entire saved packages file.
 */
export async function deleteSavedPackagesFile(
  storyId: string,
  ctx: StorageContext
): Promise<void> {
  try {
    await unlink(getSavedPackagesPath(storyId, ctx));
  } catch {
    // Ignore if file doesn't exist
  }
}

// =============================================================================
// Compatibility Checking
// =============================================================================

/**
 * Count versions between two version IDs.
 */
function countVersionsBetween(
  state: VersionedState,
  fromVersionId: string,
  toVersionId: string
): number {
  if (fromVersionId === toVersionId) {
    return 0;
  }

  // Walk back from current version to count distance
  let count = 0;
  let currentId: string | null = toVersionId;

  while (currentId && currentId !== fromVersionId && count < 1000) {
    const ver: StoredVersion | undefined = state.history.versions[currentId];
    if (!ver) break;
    currentId = ver.parent_id;
    count++;
  }

  // If we found the source version, return count; otherwise estimate
  if (currentId === fromVersionId) {
    return count;
  }

  // Version not in direct lineage (could be on different branch)
  // Just return the count we found as approximation
  return count;
}

/**
 * Get the label for a version ID.
 */
function getVersionLabel(state: VersionedState, versionId: string): string {
  const versionEntry: StoredVersion | undefined = state.history.versions[versionId];
  return versionEntry?.label ?? 'Unknown';
}

/**
 * Check compatibility of a saved package against current graph state.
 */
export async function checkPackageCompatibility(
  storyId: string,
  savedPackage: SavedPackage,
  ctx: StorageContext
): Promise<PackageCompatibility> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state || !isVersionedState(state)) {
    return {
      status: 'conflicting',
      currentVersionId: 'unknown',
      currentVersionLabel: 'Unknown',
      versionsBehind: 0,
      conflicts: [{
        type: 'node_deleted',
        description: 'Story state not found or not versioned',
      }],
    };
  }

  const currentVersionId = state.history.currentVersionId;
  const currentVersionLabel = getVersionLabel(state, currentVersionId);
  const versionsBehind = countVersionsBetween(
    state,
    savedPackage.sourceVersionId,
    currentVersionId
  );

  // Load current graph to check references
  const graph = await loadGraphById(storyId, ctx);
  if (!graph) {
    return {
      status: 'conflicting',
      currentVersionId,
      currentVersionLabel,
      versionsBehind,
      conflicts: [{
        type: 'node_deleted',
        description: 'Could not load current graph',
      }],
    };
  }

  const conflicts: CompatibilityConflict[] = [];

  // Check node references in the package
  for (const nodeChange of savedPackage.package.changes.nodes) {
    // For modify/delete operations, the node must exist
    if (nodeChange.operation === 'modify' || nodeChange.operation === 'delete') {
      if (!graph.nodes.has(nodeChange.node_id)) {
        conflicts.push({
          type: 'node_deleted',
          nodeId: nodeChange.node_id,
          description: `Node "${nodeChange.node_id}" no longer exists`,
        });
      }
    }
  }

  // Check edge references in the package
  for (const edgeChange of savedPackage.package.changes.edges) {
    if (edgeChange.operation === 'add') {
      // For add operations, check that from/to nodes exist
      if (!graph.nodes.has(edgeChange.from)) {
        conflicts.push({
          type: 'node_deleted',
          nodeId: edgeChange.from,
          description: `Edge source node "${edgeChange.from}" no longer exists`,
        });
      }
      if (!graph.nodes.has(edgeChange.to)) {
        conflicts.push({
          type: 'node_deleted',
          nodeId: edgeChange.to,
          description: `Edge target node "${edgeChange.to}" no longer exists`,
        });
      }
    } else if (edgeChange.operation === 'delete') {
      // For delete, verify the edge exists
      const edgeExists = graph.edges.some(
        (e) => e.from === edgeChange.from && e.to === edgeChange.to
      );
      if (!edgeExists) {
        conflicts.push({
          type: 'edge_deleted',
          description: `Edge from "${edgeChange.from}" to "${edgeChange.to}" no longer exists`,
        });
      }
    }
  }

  // Determine status
  let status: 'compatible' | 'outdated' | 'conflicting';
  if (conflicts.length > 0) {
    status = 'conflicting';
  } else if (savedPackage.sourceVersionId === currentVersionId) {
    status = 'compatible';
  } else {
    status = 'outdated';
  }

  return {
    status,
    currentVersionId,
    currentVersionLabel,
    versionsBehind,
    conflicts,
  };
}

/**
 * Get a saved package with its compatibility status.
 */
export async function getSavedPackageWithCompatibility(
  storyId: string,
  savedPackageId: string,
  ctx: StorageContext
): Promise<SavedPackageWithCompatibility | null> {
  const pkg = await getSavedPackageById(storyId, savedPackageId, ctx);
  if (!pkg) {
    return null;
  }

  const compatibility = await checkPackageCompatibility(storyId, pkg, ctx);
  return { ...pkg, compatibility };
}

/**
 * List all saved packages with compatibility status.
 */
export async function listSavedPackagesWithCompatibility(
  storyId: string,
  ctx: StorageContext
): Promise<SavedPackageWithCompatibility[]> {
  const state = await loadSavedPackages(storyId, ctx);
  const results: SavedPackageWithCompatibility[] = [];

  for (const pkg of state.packages) {
    const compatibility = await checkPackageCompatibility(storyId, pkg, ctx);
    results.push({ ...pkg, compatibility });
  }

  return results;
}

// =============================================================================
// Session Integration
// =============================================================================

/**
 * Get current version info for saving packages.
 * Returns the current version ID and label from the story state.
 */
export async function getCurrentVersionInfo(
  storyId: string,
  ctx: StorageContext
): Promise<{ versionId: string; versionLabel: string } | null> {
  const state = await loadVersionedStateById(storyId, ctx);
  if (!state || !isVersionedState(state)) {
    return null;
  }

  const versionId = state.history.currentVersionId;
  const version = state.history.versions[versionId];
  const versionLabel = version?.label ?? 'Unknown';

  return { versionId, versionLabel };
}
