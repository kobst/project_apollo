export type AgentName = 'interpreter' | 'generator';

export interface AgentJobEvent {
  type: 'status' | 'progress' | 'packages' | 'error' | 'metrics';
  data: any;
}

export interface AgentJobRecord {
  id: string;
  storyId: string;
  agent: AgentName;
  params?: any;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  createdAt: string;
  updatedAt: string;
  events: AgentJobEvent[];
}
