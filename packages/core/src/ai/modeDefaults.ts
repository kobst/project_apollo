/**
 * Mode-based default configurations for the propose pipeline.
 *
 * Each ProposalMode maps to a set of defaults for constraints and options.
 * These can be overridden by explicit values in the ProposeRequest.
 */

import type { ProposalMode, StructureRespect } from './types.js';

/**
 * Resolved constraints after applying mode defaults and overrides.
 */
export interface ResolvedConstraints {
  creativity: number;
  inventNewEntities: boolean;
  respectStructure: StructureRespect;
}

/**
 * Resolved options after applying mode defaults and overrides.
 */
export interface ResolvedOptions {
  packageCount: number;
  maxNodesPerPackage: number;
}

/**
 * Configuration for a proposal mode.
 */
export interface ModeConfig {
  constraints: ResolvedConstraints;
  options: ResolvedOptions;
}

/**
 * Default configurations for each proposal mode.
 *
 * - add: Create exactly what is described (low creativity, strict, 1 node)
 * - expand: Build out from a starting point (medium creativity, 4 nodes)
 * - explore: Generate creative options (high creativity, 6 nodes)
 */
export const MODE_DEFAULTS: Record<ProposalMode, ModeConfig> = {
  add: {
    constraints: {
      creativity: 0,
      inventNewEntities: false,
      respectStructure: 'strict',
    },
    options: {
      maxNodesPerPackage: 1,
      packageCount: 3,
    },
  },
  expand: {
    constraints: {
      creativity: 0.4,
      inventNewEntities: true,
      respectStructure: 'soft',
    },
    options: {
      maxNodesPerPackage: 4,
      packageCount: 3,
    },
  },
  explore: {
    constraints: {
      creativity: 0.75,
      inventNewEntities: true,
      respectStructure: 'soft',
    },
    options: {
      maxNodesPerPackage: 6,
      packageCount: 5,
    },
  },
};

/**
 * System-level defaults when no mode is specified.
 */
export const SYSTEM_DEFAULTS: ModeConfig = {
  constraints: {
    creativity: 0.5,
    inventNewEntities: true,
    respectStructure: 'soft',
  },
  options: {
    packageCount: 3,
    maxNodesPerPackage: 5,
  },
};
