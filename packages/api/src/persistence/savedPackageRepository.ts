import type { StorageContext } from '../config.js';
import type { SavedPackagesState } from './savedPackageTypes.js';

export interface SavedPackageRepository {
  loadSavedPackages(storyId: string, ctx: StorageContext): Promise<SavedPackagesState>;
  saveSavedPackages(storyId: string, state: SavedPackagesState, ctx: StorageContext): Promise<void>;
  deleteSavedPackages(storyId: string, ctx: StorageContext): Promise<void>;
}
