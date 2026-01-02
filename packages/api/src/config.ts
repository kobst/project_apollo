/**
 * API configuration
 */

import path from 'path';
import os from 'os';

/**
 * Storage context for data directory.
 * Passed to all storage operations to avoid module-level state.
 */
export interface StorageContext {
  dataDir: string;
}

/**
 * Create a storage context from environment or defaults.
 */
export function createStorageContext(): StorageContext {
  return {
    dataDir: process.env.APOLLO_DATA_DIR || path.join(os.homedir(), '.apollo'),
  };
}

/**
 * Server configuration.
 */
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
};
