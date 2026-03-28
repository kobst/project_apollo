/**
 * Session state for tracking extraction proposals and generation sessions per-story.
 * Stores in ~/.apollo/stories/<story-id>/session.json
 */

import type { ai } from '@apollo/core';
import type { StorageContext } from './config.js';
import { getSessionRepository } from './persistence/index.js';
import type {
  ExtractionProposal,
  SessionState,
  GenerationSessionParams,
  GenerationSession,
  GenerationEntryPoint,
  IdeaRefinementSession,
} from './persistence/sessionTypes.js';

export type {
  ExtractionProposal,
  SessionState,
  GenerationEntryPointType,
  GenerationEntryPoint,
  GenerationSessionParams,
  GenerationSession,
  IdeaRefinementVariant,
  IdeaRefinementSession,
} from './persistence/sessionTypes.js';

const sessionRepository = getSessionRepository();

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
  return sessionRepository.loadSession(storyId, ctx);
}

/**
 * Save session for a story.
 */
export async function saveSessionById(
  storyId: string,
  session: SessionState,
  ctx: StorageContext
): Promise<void> {
  await sessionRepository.saveSession(storyId, session, ctx);
}

/**
 * Clear entire session for a story.
 */
export async function clearSessionById(
  storyId: string,
  ctx: StorageContext
): Promise<void> {
  await sessionRepository.clearSession(storyId, ctx);
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

// =============================================================================
// Extraction Proposals
// =============================================================================

/**
 * Set extraction proposals for a story (replaces existing).
 */
export async function setExtractionProposalsById(
  storyId: string,
  proposals: ExtractionProposal[],
  ctx: StorageContext
): Promise<void> {
  const session = await loadSessionById(storyId, ctx);
  session.extractionProposals = proposals;
  await saveSessionById(storyId, session, ctx);
}

/**
 * Get extraction proposals for a story.
 */
export async function getExtractionProposalsById(
  storyId: string,
  ctx: StorageContext
): Promise<ExtractionProposal[]> {
  const session = await loadSessionById(storyId, ctx);
  return session.extractionProposals ?? [];
}

/**
 * Find a specific extraction proposal.
 */
export async function findExtractionProposalById(
  storyId: string,
  proposalId: string,
  ctx: StorageContext
): Promise<ExtractionProposal | null> {
  const proposals = await getExtractionProposalsById(storyId, ctx);
  return proposals.find((p) => p.id === proposalId) ?? null;
}

/**
 * Remove an extraction proposal.
 */
export async function removeExtractionProposalById(
  storyId: string,
  proposalId: string,
  ctx: StorageContext
): Promise<void> {
  const session = await loadSessionById(storyId, ctx);
  session.extractionProposals = (session.extractionProposals ?? []).filter(
    (p) => p.id !== proposalId
  );
  await saveSessionById(storyId, session, ctx);
}

export async function saveIdeaRefinementSession(
  storyId: string,
  session: IdeaRefinementSession,
  ctx: StorageContext
): Promise<void> {
  await sessionRepository.saveIdeaRefinementSession(storyId, session, ctx);
}

export async function loadIdeaRefinementSession(
  storyId: string,
  ideaId: string,
  ctx: StorageContext
): Promise<IdeaRefinementSession | null> {
  return sessionRepository.loadIdeaRefinementSession(storyId, ideaId, ctx);
}

export async function deleteIdeaRefinementSession(
  storyId: string,
  ideaId: string,
  ctx: StorageContext
): Promise<void> {
  await sessionRepository.deleteIdeaRefinementSession(storyId, ideaId, ctx);
}

// =============================================================================
// Generation Session Operations
// =============================================================================

/**
 * Create a new generation session.
 */
export async function createGenerationSession(
  storyId: string,
  entryPoint: GenerationEntryPoint,
  params: GenerationSessionParams,
  ctx: StorageContext,
  versionInfo?: { versionId: string; versionLabel: string }
): Promise<GenerationSession> {
  const now = new Date().toISOString();
  const sessionId = `gs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const session: GenerationSession = {
    id: sessionId,
    storyId,
    createdAt: now,
    updatedAt: now,
    entryPoint,
    initialParams: params,
    packages: [],
    packageContext: {},
    status: 'active',
  };

  // Only set optional properties if they have values
  if (versionInfo?.versionId) {
    session.sourceVersionId = versionInfo.versionId;
  }
  if (versionInfo?.versionLabel) {
    session.sourceVersionLabel = versionInfo.versionLabel;
  }

  await saveGenerationSession(storyId, session, ctx);
  return session;
}

/**
 * Mark session as archived (when replaced by new generation).
 */
export async function markSessionArchived(
  storyId: string,
  ctx: StorageContext
): Promise<void> {
  const session = await loadGenerationSession(storyId, ctx);
  if (!session || session.status !== 'active') {
    return; // Nothing to archive
  }

  session.archivedAt = new Date().toISOString();
  session.updatedAt = new Date().toISOString();
  await saveGenerationSession(storyId, session, ctx);
}

/**
 * Migrate a generation session to current schema.
 * Handles renames like StoryBeat → PlotPoint.
 */
function migrateGenerationSession(session: GenerationSession): GenerationSession {
  for (const pkg of session.packages) {
    for (const nodeChange of pkg.changes.nodes) {
      if (nodeChange.node_type === 'StoryBeat') {
        nodeChange.node_type = 'PlotPoint';
      }
    }
  }
  return session;
}

/**
 * Load generation session for a story.
 */
export async function loadGenerationSession(
  storyId: string,
  ctx: StorageContext
): Promise<GenerationSession | null> {
  const session = await sessionRepository.loadGenerationSession(storyId, ctx);
  return session ? migrateGenerationSession(session) : null;
}

/**
 * Save generation session.
 */
export async function saveGenerationSession(
  storyId: string,
  session: GenerationSession,
  ctx: StorageContext
): Promise<void> {
  await sessionRepository.saveGenerationSession(storyId, session, ctx);
}

/**
 * Add packages to a generation session.
 */
export async function addPackagesToSession(
  storyId: string,
  packages: ai.NarrativePackage[],
  ctx: StorageContext,
  contextByPackageId?: Record<string, { includedIdeaIds?: string[] }>
): Promise<GenerationSession> {
  const session = await loadGenerationSession(storyId, ctx);
  if (!session) {
    throw new Error(`No active generation session for story ${storyId}`);
  }

  session.packages.push(...packages);
  session.updatedAt = new Date().toISOString();

  // Merge package context (if provided)
  if (contextByPackageId) {
    session.packageContext = session.packageContext ?? {};
    for (const [pkgId, ctxObj] of Object.entries(contextByPackageId)) {
      session.packageContext[pkgId] = {
        ...(session.packageContext[pkgId] || {}),
        ...ctxObj,
      };
    }
  }

  // Set current to first package if not set
  if (!session.currentPackageId && packages.length > 0 && packages[0]) {
    session.currentPackageId = packages[0].id;
  }

  await saveGenerationSession(storyId, session, ctx);
  return session;
}

/**
 * Set the current package being viewed.
 */
export async function setCurrentPackage(
  storyId: string,
  packageId: string,
  ctx: StorageContext
): Promise<void> {
  const session = await loadGenerationSession(storyId, ctx);
  if (!session) {
    throw new Error(`No active generation session for story ${storyId}`);
  }

  const pkg = session.packages.find((p) => p.id === packageId);
  if (!pkg) {
    throw new Error(`Package ${packageId} not found in session`);
  }

  session.currentPackageId = packageId;
  session.updatedAt = new Date().toISOString();
  await saveGenerationSession(storyId, session, ctx);
}

/**
 * Find a package by ID in the session.
 */
export async function findPackageInSession(
  storyId: string,
  packageId: string,
  ctx: StorageContext
): Promise<ai.NarrativePackage | null> {
  const session = await loadGenerationSession(storyId, ctx);
  if (!session) {
    return null;
  }

  return session.packages.find((p) => p.id === packageId) ?? null;
}

/**
 * Update a package in the session.
 */
export async function updatePackageInSession(
  storyId: string,
  packageId: string,
  updatedPackage: ai.NarrativePackage,
  ctx: StorageContext
): Promise<void> {
  const session = await loadGenerationSession(storyId, ctx);
  if (!session) {
    throw new Error(`No active generation session for story ${storyId}`);
  }

  const packageIndex = session.packages.findIndex((p) => p.id === packageId);
  if (packageIndex === -1) {
    throw new Error(`Package ${packageId} not found in session`);
  }

  session.packages[packageIndex] = updatedPackage;
  session.updatedAt = new Date().toISOString();
  await saveGenerationSession(storyId, session, ctx);
}

/**
 * Mark session as accepted with the chosen package.
 */
export async function markSessionAccepted(
  storyId: string,
  packageId: string,
  ctx: StorageContext
): Promise<void> {
  const session = await loadGenerationSession(storyId, ctx);
  if (!session) {
    throw new Error(`No active generation session for story ${storyId}`);
  }

  session.status = 'accepted';
  session.acceptedPackageId = packageId;
  session.updatedAt = new Date().toISOString();
  await saveGenerationSession(storyId, session, ctx);
}

/**
 * Mark session as abandoned.
 */
export async function markSessionAbandoned(
  storyId: string,
  ctx: StorageContext
): Promise<void> {
  const session = await loadGenerationSession(storyId, ctx);
  if (!session) {
    return; // Nothing to abandon
  }

  session.status = 'abandoned';
  session.updatedAt = new Date().toISOString();
  await saveGenerationSession(storyId, session, ctx);
}

/**
 * Delete generation session file.
 */
export async function deleteGenerationSession(
  storyId: string,
  ctx: StorageContext
): Promise<void> {
  await sessionRepository.deleteGenerationSession(storyId, ctx);
}

/**
 * Get package tree structure (parent-child relationships).
 */
export function getPackageTree(session: GenerationSession): Map<string, string[]> {
  const tree = new Map<string, string[]>();

  // Initialize with root packages (no parent)
  for (const pkg of session.packages) {
    if (!pkg.parent_package_id) {
      const existing = tree.get('root') ?? [];
      existing.push(pkg.id);
      tree.set('root', existing);
    } else {
      const existing = tree.get(pkg.parent_package_id) ?? [];
      existing.push(pkg.id);
      tree.set(pkg.parent_package_id, existing);
    }
  }

  return tree;
}
