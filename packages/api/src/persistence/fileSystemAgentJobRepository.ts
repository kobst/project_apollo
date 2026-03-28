import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { StorageContext } from '../config.js';
import type { AgentJobRepository } from './agentJobRepository.js';
import type { AgentJobRecord } from './agentJobTypes.js';

function jobsDir(ctx: StorageContext): string {
  return join(ctx.dataDir, 'agents');
}

function jobsPath(ctx: StorageContext): string {
  return join(jobsDir(ctx), 'jobs.json');
}

export class FileSystemAgentJobRepository implements AgentJobRepository {
  async loadJobs(ctx: StorageContext): Promise<AgentJobRecord[]> {
    try {
      const data = await readFile(jobsPath(ctx), 'utf-8');
      return JSON.parse(data) as AgentJobRecord[];
    } catch {
      return [];
    }
  }

  async saveJobs(jobs: AgentJobRecord[], ctx: StorageContext): Promise<void> {
    await mkdir(jobsDir(ctx), { recursive: true });
    await writeFile(jobsPath(ctx), JSON.stringify(jobs, null, 2), 'utf-8');
  }
}
