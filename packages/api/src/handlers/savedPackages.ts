/**
 * Saved Packages Handlers
 *
 * Handles persistent saved package operations:
 * - GET /stories/:id/saved-packages - List all saved packages with compatibility
 * - GET /stories/:id/saved-packages/:spId - Get single saved package
 * - POST /stories/:id/saved-packages - Save a package from session
 * - PATCH /stories/:id/saved-packages/:spId - Update user note
 * - DELETE /stories/:id/saved-packages/:spId - Delete saved package
 * - POST /stories/:id/saved-packages/:spId/apply - Apply saved package to graph
 */

import type { Request, Response, NextFunction } from 'express';
import {
  applyPatch,
  validatePatch,
  type Patch,
} from '@apollo/core';
import type { StorageContext } from '../config.js';
import {
  updateGraphById,
  loadVersionedStateById,
  deserializeGraph,
  updateVersionMeta,
} from '../storage.js';
import {
  savePackageToLibrary,
  getSavedPackageById,
  getSavedPackageWithCompatibility,
  listSavedPackagesWithCompatibility,
  updateSavedPackageNote,
  deleteSavedPackage,
  getCurrentVersionInfo,
  type SavedPackageWithCompatibility,
} from '../savedPackages.js';
import { loadGenerationSession } from '../session.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import type { APIResponse } from '../types.js';
import { packageToPatch } from './generate.js';

// =============================================================================
// Response Types
// =============================================================================

interface SavedPackageResponseData {
  savedPackage: SavedPackageWithCompatibility;
}

interface SavedPackagesListResponseData {
  packages: SavedPackageWithCompatibility[];
  totalCount: number;
}

interface ApplySavedPackageResponseData {
  success: boolean;
  newVersionId: string;
  patchOpsApplied: number;
}

// =============================================================================
// List Saved Packages Handler
// =============================================================================

export function createListSavedPackagesHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }>,
    res: Response<APIResponse<SavedPackagesListResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const packages = await listSavedPackagesWithCompatibility(id, ctx);

      res.json({
        success: true,
        data: {
          packages,
          totalCount: packages.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Get Saved Package Handler
// =============================================================================

export function createGetSavedPackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; spId: string }>,
    res: Response<APIResponse<SavedPackageResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, spId } = req.params;

      const savedPackage = await getSavedPackageWithCompatibility(id, spId, ctx);
      if (!savedPackage) {
        throw new NotFoundError(`Saved package ${spId}`);
      }

      res.json({
        success: true,
        data: { savedPackage },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Save Package Handler
// =============================================================================

interface SavePackageRequestBody {
  packageId?: string;      // Package ID from active session
  userNote?: string;       // Optional note
}

export function createSavePackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string }, unknown, SavePackageRequestBody>,
    res: Response<APIResponse<SavedPackageResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { packageId, userNote } = req.body;

      if (!packageId) {
        throw new BadRequestError('packageId is required');
      }

      // Find package in current session
      const session = await loadGenerationSession(id, ctx);
      if (!session) {
        throw new NotFoundError(
          'Generation session',
          'Generate some packages first before saving'
        );
      }

      const pkg = session.packages.find((p) => p.id === packageId);
      if (!pkg) {
        throw new NotFoundError(
          `Package ${packageId}`,
          'Package not found in current session'
        );
      }

      // Get current version info
      const versionInfo = await getCurrentVersionInfo(id, ctx);
      if (!versionInfo) {
        throw new BadRequestError(
          'Could not determine story version',
          'Story must have version history enabled'
        );
      }

      // Save to library
      const savedPackage = await savePackageToLibrary(
        id,
        pkg,
        versionInfo.versionId,
        versionInfo.versionLabel,
        ctx,
        userNote ? { userNote } : undefined
      );

      // Get with compatibility for response
      const savedPackageWithCompat = await getSavedPackageWithCompatibility(
        id,
        savedPackage.id,
        ctx
      );

      res.status(201).json({
        success: true,
        data: { savedPackage: savedPackageWithCompat! },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Update Saved Package Handler
// =============================================================================

interface UpdateSavedPackageRequestBody {
  userNote?: string;
}

export function createUpdateSavedPackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; spId: string }, unknown, UpdateSavedPackageRequestBody>,
    res: Response<APIResponse<SavedPackageResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, spId } = req.params;
      const { userNote } = req.body;

      const existing = await getSavedPackageById(id, spId, ctx);
      if (!existing) {
        throw new NotFoundError(`Saved package ${spId}`);
      }

      // Only update if userNote is provided (including empty string to clear)
      if (userNote !== undefined) {
        await updateSavedPackageNote(id, spId, userNote || undefined, ctx);
      }

      const savedPackage = await getSavedPackageWithCompatibility(id, spId, ctx);

      res.json({
        success: true,
        data: { savedPackage: savedPackage! },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Delete Saved Package Handler
// =============================================================================

export function createDeleteSavedPackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; spId: string }>,
    res: Response<APIResponse<{ deleted: boolean }>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, spId } = req.params;

      const existing = await getSavedPackageById(id, spId, ctx);
      if (!existing) {
        throw new NotFoundError(`Saved package ${spId}`);
      }

      await deleteSavedPackage(id, spId, ctx);

      res.json({
        success: true,
        data: { deleted: true },
      });
    } catch (error) {
      next(error);
    }
  };
}

// =============================================================================
// Apply Saved Package Handler
// =============================================================================

export function createApplySavedPackageHandler(ctx: StorageContext) {
  return async (
    req: Request<{ id: string; spId: string }>,
    res: Response<APIResponse<ApplySavedPackageResponseData>>,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id, spId } = req.params;

      const savedPackage = await getSavedPackageWithCompatibility(id, spId, ctx);
      if (!savedPackage) {
        throw new NotFoundError(`Saved package ${spId}`);
      }

      // Warn about conflicts but allow application
      if (savedPackage.compatibility.status === 'conflicting') {
        console.warn(
          `[applySavedPackage] Applying package with conflicts:`,
          savedPackage.compatibility.conflicts
        );
      }

      // Load current graph state
      const state = await loadVersionedStateById(id, ctx);
      if (!state) {
        throw new NotFoundError(`Story "${id}"`);
      }

      const currentVersion = state.history.versions[state.history.currentVersionId];
      if (!currentVersion) {
        throw new NotFoundError('Current version');
      }

      let graph = deserializeGraph(currentVersion.graph);
      const pkg = savedPackage.package;

      // Convert package to patch using existing function
      const patch: Patch = packageToPatch(pkg, state.history.currentVersionId);

      console.log(`[applySavedPackage] Converting package "${pkg.title}" to patch with ${patch.ops.length} ops`);
      for (const op of patch.ops.slice(0, 10)) { // Log first 10 ops for debugging
        console.log(`  - ${op.op}: ${JSON.stringify(op).substring(0, 200)}`);
      }
      if (patch.ops.length > 10) {
        console.log(`  ... and ${patch.ops.length - 10} more ops`);
      }

      if (patch.ops.length === 0) {
        res.json({
          success: true,
          data: {
            success: true,
            newVersionId: state.history.currentVersionId,
            patchOpsApplied: 0,
          },
        });
        return;
      }

      // Validate patch
      const validation = validatePatch(graph, patch);
      if (!validation.success) {
        console.error('[applySavedPackage] Validation failed:');
        for (const err of validation.errors) {
          console.error(`  - [${err.code}] ${err.message}${err.node_id ? ` (node: ${err.node_id})` : ''}${err.field ? ` (field: ${err.field})` : ''}`);
        }
        throw new BadRequestError(
          'Package validation failed',
          validation.errors.map((e) => e.message).join('; ')
        );
      }

      // Apply patch
      graph = applyPatch(graph, patch);

      // Save with version label
      const versionLabel = `Applied saved: ${pkg.title}`;
      const newVersionId = await updateGraphById(
        id,
        graph,
        versionLabel,
        undefined,
        ctx
      );

      // Attach enrichment metadata to the new version
      if (pkg.enrichment?.thematic_analysis) {
        await updateVersionMeta(id, newVersionId, {
          enrichmentSummary: pkg.enrichment.thematic_analysis,
          packageTitle: pkg.title,
        }, ctx);
      }

      res.json({
        success: true,
        data: {
          success: true,
          newVersionId,
          patchOpsApplied: patch.ops.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
