import type { StorageContext } from '../config.js';
import type {
  GenerationSession,
  IdeaRefinementSession,
  SessionState,
} from './sessionTypes.js';

export interface SessionRepository {
  loadSession(storyId: string, ctx: StorageContext): Promise<SessionState>;
  saveSession(storyId: string, session: SessionState, ctx: StorageContext): Promise<void>;
  clearSession(storyId: string, ctx: StorageContext): Promise<void>;
  saveIdeaRefinementSession(
    storyId: string,
    session: IdeaRefinementSession,
    ctx: StorageContext
  ): Promise<void>;
  loadIdeaRefinementSession(
    storyId: string,
    ideaId: string,
    ctx: StorageContext
  ): Promise<IdeaRefinementSession | null>;
  deleteIdeaRefinementSession(storyId: string, ideaId: string, ctx: StorageContext): Promise<void>;
  loadGenerationSession(storyId: string, ctx: StorageContext): Promise<GenerationSession | null>;
  saveGenerationSession(
    storyId: string,
    session: GenerationSession,
    ctx: StorageContext
  ): Promise<void>;
  deleteGenerationSession(storyId: string, ctx: StorageContext): Promise<void>;
}
