import type { StorageContext } from '../config.js';
import type { AgentJobRecord } from './agentJobTypes.js';

export interface AgentJobRepository {
  loadJobs(ctx: StorageContext): Promise<AgentJobRecord[]>;
  saveJobs(jobs: AgentJobRecord[], ctx: StorageContext): Promise<void>;
}
