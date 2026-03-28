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

export type StorageBackend = 'file' | 'postgres';

/**
 * Create a storage context from environment or defaults.
 */
export function createStorageContext(): StorageContext {
  return {
    dataDir: process.env.APOLLO_DATA_DIR || path.join(os.homedir(), '.apollo'),
  };
}

export function getStorageBackend(): StorageBackend {
  return process.env.APOLLO_STORAGE_BACKEND === 'postgres' ? 'postgres' : 'file';
}

/**
 * Server configuration.
 */
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  storageBackend: getStorageBackend(),
  databaseUrl: process.env.DATABASE_URL || '',
};
