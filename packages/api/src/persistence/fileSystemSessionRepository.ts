import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import type { StorageContext } from '../config.js';
import type {
  GenerationSession,
  IdeaRefinementSession,
  SessionState,
} from './sessionTypes.js';
import type { SessionRepository } from './sessionRepository.js';

const SESSION_FILE = 'session.json';
const GENERATION_SESSION_FILE = 'generation-session.json';
const IDEA_REFINEMENT_DIR = 'idea-refine';

function getStoryDir(storyId: string, ctx: StorageContext): string {
  return join(ctx.dataDir, 'stories', storyId);
}

function getSessionPath(storyId: string, ctx: StorageContext): string {
  return join(getStoryDir(storyId, ctx), SESSION_FILE);
}

function getGenerationSessionPath(storyId: string, ctx: StorageContext): string {
  return join(getStoryDir(storyId, ctx), GENERATION_SESSION_FILE);
}

function getIdeaRefineDir(storyId: string, ctx: StorageContext): string {
  return join(getStoryDir(storyId, ctx), IDEA_REFINEMENT_DIR);
}

function getIdeaRefineSessionPath(storyId: string, ideaId: string, ctx: StorageContext): string {
  return join(getIdeaRefineDir(storyId, ctx), `${ideaId}.json`);
}

export class FileSystemSessionRepository implements SessionRepository {
  async loadSession(storyId: string, ctx: StorageContext): Promise<SessionState> {
    try {
      const content = await readFile(getSessionPath(storyId, ctx), 'utf-8');
      return JSON.parse(content) as SessionState;
    } catch {
      return {};
    }
  }

  async saveSession(storyId: string, session: SessionState, ctx: StorageContext): Promise<void> {
    await mkdir(getStoryDir(storyId, ctx), { recursive: true });
    await writeFile(getSessionPath(storyId, ctx), JSON.stringify(session, null, 2), 'utf-8');
  }

  async clearSession(storyId: string, ctx: StorageContext): Promise<void> {
    try {
      await unlink(getSessionPath(storyId, ctx));
    } catch {
      // ignore
    }
  }

  async saveIdeaRefinementSession(
    storyId: string,
    session: IdeaRefinementSession,
    ctx: StorageContext
  ): Promise<void> {
    await mkdir(getIdeaRefineDir(storyId, ctx), { recursive: true });
    await writeFile(
      getIdeaRefineSessionPath(storyId, session.ideaId, ctx),
      JSON.stringify(session, null, 2),
      'utf-8'
    );
  }

  async loadIdeaRefinementSession(
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

  async deleteIdeaRefinementSession(
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

  async loadGenerationSession(
    storyId: string,
    ctx: StorageContext
  ): Promise<GenerationSession | null> {
    try {
      const content = await readFile(getGenerationSessionPath(storyId, ctx), 'utf-8');
      return JSON.parse(content) as GenerationSession;
    } catch {
      return null;
    }
  }

  async saveGenerationSession(
    storyId: string,
    session: GenerationSession,
    ctx: StorageContext
  ): Promise<void> {
    await mkdir(getStoryDir(storyId, ctx), { recursive: true });
    await writeFile(
      getGenerationSessionPath(storyId, ctx),
      JSON.stringify(session, null, 2),
      'utf-8'
    );
  }

  async deleteGenerationSession(storyId: string, ctx: StorageContext): Promise<void> {
    try {
      await unlink(getGenerationSessionPath(storyId, ctx));
    } catch {
      // ignore
    }
  }
}
