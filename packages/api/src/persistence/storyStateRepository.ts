import type { StorageContext } from '../config.js';
import type { StoredState, VersionedState } from './storyStateTypes.js';

export interface StoryStateRepository {
  storyExists(storyId: string, ctx: StorageContext): Promise<boolean>;
  listStoryIds(ctx: StorageContext): Promise<string[]>;
  loadState(storyId: string, ctx: StorageContext): Promise<StoredState | null>;
  saveVersionedState(storyId: string, state: VersionedState, ctx: StorageContext): Promise<void>;
}
