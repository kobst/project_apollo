import { access, mkdir, readFile, readdir, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import type { StorageContext } from '../config.js';
import type { StoredState, VersionedState } from './storyStateTypes.js';
import type { StoryStateRepository } from './storyStateRepository.js';

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

export class FileSystemStoryStateRepository implements StoryStateRepository {
  async storyExists(storyId: string, ctx: StorageContext): Promise<boolean> {
    try {
      await access(getStatePath(storyId, ctx));
      return true;
    } catch {
      return false;
    }
  }

  async listStoryIds(ctx: StorageContext): Promise<string[]> {
    try {
      return await readdir(getStoriesDir(ctx));
    } catch {
      return [];
    }
  }

  async loadState(storyId: string, ctx: StorageContext): Promise<StoredState | null> {
    try {
      const content = await readFile(getStatePath(storyId, ctx), 'utf-8');
      return JSON.parse(content) as StoredState;
    } catch {
      return null;
    }
  }

  async saveVersionedState(
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
}
