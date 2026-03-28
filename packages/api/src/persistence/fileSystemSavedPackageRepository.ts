import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import type { StorageContext } from '../config.js';
import type { SavedPackagesState } from './savedPackageTypes.js';
import type { SavedPackageRepository } from './savedPackageRepository.js';

const SAVED_PACKAGES_FILE = 'saved-packages.json';

function getStoryDir(storyId: string, ctx: StorageContext): string {
  return join(ctx.dataDir, 'stories', storyId);
}

function getSavedPackagesPath(storyId: string, ctx: StorageContext): string {
  return join(getStoryDir(storyId, ctx), SAVED_PACKAGES_FILE);
}

export class FileSystemSavedPackageRepository implements SavedPackageRepository {
  async loadSavedPackages(storyId: string, ctx: StorageContext): Promise<SavedPackagesState> {
    try {
      const content = await readFile(getSavedPackagesPath(storyId, ctx), 'utf-8');
      return JSON.parse(content) as SavedPackagesState;
    } catch {
      return { version: '1.0.0', packages: [] };
    }
  }

  async saveSavedPackages(
    storyId: string,
    state: SavedPackagesState,
    ctx: StorageContext
  ): Promise<void> {
    await mkdir(getStoryDir(storyId, ctx), { recursive: true });
    await writeFile(getSavedPackagesPath(storyId, ctx), JSON.stringify(state, null, 2), 'utf-8');
  }

  async deleteSavedPackages(storyId: string, ctx: StorageContext): Promise<void> {
    try {
      await unlink(getSavedPackagesPath(storyId, ctx));
    } catch {
      // ignore
    }
  }
}
