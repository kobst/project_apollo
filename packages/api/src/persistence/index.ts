import { getStorageBackend } from '../config.js';
import { FileSystemStoryStateRepository } from './fileSystemStoryStateRepository.js';
import { FileSystemSessionRepository } from './fileSystemSessionRepository.js';
import { FileSystemSavedPackageRepository } from './fileSystemSavedPackageRepository.js';
import { FileSystemAgentJobRepository } from './fileSystemAgentJobRepository.js';
import { PostgresStoryStateRepository } from './postgresStoryStateRepository.js';
import type { AgentJobRepository } from './agentJobRepository.js';
import type { SavedPackageRepository } from './savedPackageRepository.js';
import type { SessionRepository } from './sessionRepository.js';
import type { StoryStateRepository } from './storyStateRepository.js';

const fileStoryStateRepository: StoryStateRepository = new FileSystemStoryStateRepository();
let postgresStoryStateRepository: StoryStateRepository | null = null;
const sessionRepository: SessionRepository = new FileSystemSessionRepository();
const savedPackageRepository: SavedPackageRepository = new FileSystemSavedPackageRepository();
const agentJobRepository: AgentJobRepository = new FileSystemAgentJobRepository();

export function getStoryStateRepository(): StoryStateRepository {
  if (getStorageBackend() !== 'postgres') {
    return fileStoryStateRepository;
  }

  if (!postgresStoryStateRepository) {
    postgresStoryStateRepository = new PostgresStoryStateRepository();
  }

  return postgresStoryStateRepository;
}

export function getSessionRepository(): SessionRepository {
  return sessionRepository;
}

export function getSavedPackageRepository(): SavedPackageRepository {
  return savedPackageRepository;
}

export function getAgentJobRepository(): AgentJobRepository {
  return agentJobRepository;
}
