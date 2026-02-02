/**
 * Session state for tracking extraction proposals and generation sessions per-story.
 * Stores in ~/.apollo/stories/<story-id>/session.json
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import type { Patch } from '@apollo/core';
import type { ai } from '@apollo/core';
import type { StorageContext } from './config.js';

// =============================================================================
// Types
// =============================================================================

export interface ExtractionProposal {
  id: string;
  title: string;
  description: string;
  confidence: number;
  extractedEntities: Array<{
    type: string;
    name: string;
    id: string;
  }>;
  patch: Patch;
}

export interface SessionState {
  lastSeeds?: Record<string, number>;
  extractionProposals?: ExtractionProposal[];
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
    return {};
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

// =============================================================================
// Generation Session Types
// =============================================================================

export type GenerationEntryPointType = 'beat' | 'storyBeat' | 'character' | 'gap' | 'idea' | 'naked';

export interface GenerationEntryPoint {
  type: GenerationEntryPointType;
  targetId?: string;
  targetData?: Record<string, unknown>;
}

export interface GenerationSessionParams {
  depth: ai.GenerationDepth;
  count: ai.GenerationCount;
  direction?: string;
}

export interface GenerationSession {
  id: string;
  storyId: string;
  createdAt: string;
  updatedAt: string;

  // Entry point context
  entryPoint: GenerationEntryPoint;
  initialParams: GenerationSessionParams;

  // Version anchoring - track which story version packages were generated against
  sourceVersionId?: string;
  sourceVersionLabel?: string;

  // Package tree
  packages: ai.NarrativePackage[];

  // Context per package (e.g., included idea IDs used in prompting)
  packageContext?: Record<string, { includedIdeaIds?: string[] }>;

  // Navigation state
  currentPackageId?: string;

  // Status
  status: 'active' | 'accepted' | 'abandoned';
  acceptedPackageId?: string;

  // Archive tracking - set when session is auto-archived by new generation
  archivedAt?: string;
}

// =============================================================================
// Idea Refinement Sessions
// =============================================================================

export interface IdeaRefinementVariant {
  id: string;
  kind?: 'proposal' | 'question' | 'direction' | 'constraint' | 'note';
  title: string;
  description: string;
  resolution?: string;
  confidence?: number;
  suggestedArtifacts?: Array<{
    type: 'StoryBeat' | 'Scene';
    title: string;
    summary?: string;
    rationale?: string;
  }>;
}

export interface IdeaRefinementSession {
  id: string;
  storyId: string;
  ideaId: string;
  guidance: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'committed' | 'abandoned';
  variants: IdeaRefinementVariant[];
  committedVariantIndex?: number;
}

const IDEA_REFINEMENT_DIR = 'idea-refine';

function getIdeaRefineDir(storyId: string, ctx: StorageContext): string {
  return join(ctx.dataDir, 'stories', storyId, IDEA_REFINEMENT_DIR);
}

function getIdeaRefineSessionPath(storyId: string, ideaId: string, ctx: StorageContext): string {
  return join(getIdeaRefineDir(storyId, ctx), `${ideaId}.json`);
}

export async function saveIdeaRefinementSession(
  storyId: string,
  session: IdeaRefinementSession,
  ctx: StorageContext
): Promise<void> {
  await mkdir(getIdeaRefineDir(storyId, ctx), { recursive: true });
  await writeFile(getIdeaRefineSessionPath(storyId, session.ideaId, ctx), JSON.stringify(session, null, 2), 'utf-8');
}

export async function loadIdeaRefinementSession(
  storyId: string,
  ideaId: string,
  ctx: StorageContext
): Promise<IdeaRefinementSession | null> {
  try {
    const content = await readFile(getIdeaRefineSessionPath(storyId, ideaId, ctx), 'utf-8');
    return JSON.parse(content) as IdeaRefinementSession;
  } catch {
    return null;
  }
}

export async function deleteIdeaRefinementSession(
  storyId: string,
  ideaId: string,
  ctx: StorageContext
): Promise<void> {
  try {
    await unlink(getIdeaRefineSessionPath(storyId, ideaId, ctx));
  } catch {
    // ignore
  }
}

// =============================================================================
// Generation Session Operations
// =============================================================================

const GENERATION_SESSION_FILE = 'generation-session.json';

function getGenerationSessionPath(storyId: string, ctx: StorageContext): string {
  return join(ctx.dataDir, 'stories', storyId, GENERATION_SESSION_FILE);
}

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
 * Handles renames like PlotPoint → StoryBeat.
 */
function migrateGenerationSession(session: GenerationSession): GenerationSession {
  for (const pkg of session.packages) {
    for (const nodeChange of pkg.changes.nodes) {
      if (nodeChange.node_type === 'PlotPoint') {
        nodeChange.node_type = 'StoryBeat';
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
  try {
    const content = await readFile(getGenerationSessionPath(storyId, ctx), 'utf-8');
    const session = JSON.parse(content) as GenerationSession;
    return migrateGenerationSession(session);
  } catch {
    return null;
  }
}

/**
 * Save generation session.
 */
export async function saveGenerationSession(
  storyId: string,
  session: GenerationSession,
  ctx: StorageContext
): Promise<void> {
  const storyDir = join(ctx.dataDir, 'stories', storyId);
  await mkdir(storyDir, { recursive: true });
  await writeFile(
    getGenerationSessionPath(storyId, ctx),
    JSON.stringify(session, null, 2),
    'utf-8'
  );
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
  try {
    await unlink(getGenerationSessionPath(storyId, ctx));
  } catch {
    // Ignore if file doesn't exist
  }
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
