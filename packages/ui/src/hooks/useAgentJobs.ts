import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export type AgentName = 'interpreter' | 'generator';

export interface AgentEvent {
  type: 'status' | 'progress' | 'packages' | 'error' | 'metrics';
  data: any;
}

export interface AgentJobItem {
  jobId: string;
  agent: AgentName;
  status: 'queued'|'running'|'succeeded'|'failed'|'canceled';
  events: AgentEvent[];
}

interface UseAgentJobsOptions {
  onJobDone?: (job: AgentJobItem) => void;
}

export function useAgentJobs(storyId?: string, opts?: UseAgentJobsOptions) {
  const [jobs, setJobs] = useState<AgentJobItem[]>([]);
  const sourcesRef = useRef<Map<string, EventSource>>(new Map());
  const onJobDoneRef = useRef<UseAgentJobsOptions['onJobDone']>(opts?.onJobDone);

  useEffect(() => { onJobDoneRef.current = opts?.onJobDone; }, [opts?.onJobDone]);

  const attachSSE = useCallback((jobId: string, agent: AgentName) => {
    if (!storyId) return;
    const es = api.openAgentEvents(storyId, jobId);
    sourcesRef.current.set(jobId, es);
    es.onmessage = (evt) => {
      try {
        const e = JSON.parse(evt.data) as AgentEvent;
        setJobs((prev) => prev.map((j) => j.jobId === jobId ? {
          ...j,
          status: e.type === 'status' ? (e.data.status as AgentJobItem['status']) : j.status,
          events: [...j.events, e],
        } : j));

        if (e.type === 'status' && (e.data.status === 'succeeded' || e.data.status === 'failed' || e.data.status === 'canceled')) {
          const doneJob = { jobId, agent, status: e.data.status, events: [] } as AgentJobItem;
          setTimeout(() => {
            onJobDoneRef.current?.(jobs.find(j => j.jobId === jobId) ?? doneJob);
          }, 0);
          es.close();
          sourcesRef.current.delete(jobId);
        }
      } catch {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      es.close();
      sourcesRef.current.delete(jobId);
    };
  }, [storyId, jobs]);

  const runInterpreter = useCallback(async (prompt: string) => {
    if (!storyId || !prompt.trim()) return;
    const result = await api.runAgent(storyId, { agent: 'interpreter', params: { userInput: prompt } });
    setJobs((prev) => [{ jobId: result.jobId, agent: 'interpreter', status: 'queued', events: [] }, ...prev]);
    attachSSE(result.jobId, 'interpreter');
    return result.jobId;
  }, [storyId, attachSSE]);

  const runGenerator = useCallback(async (request: any) => {
    if (!storyId) return;
    const result = await api.runAgent(storyId, { agent: 'generator', params: { proposeRequest: request } });
    setJobs((prev) => [{ jobId: result.jobId, agent: 'generator', status: 'queued', events: [] }, ...prev]);
    attachSSE(result.jobId, 'generator');
    return result.jobId;
  }, [storyId, attachSSE]);

  const runGeneratorQuick = useCallback(async (preset: 'midpointX2') => {
    if (!storyId) return;
    if (preset === 'midpointX2') {
      const req = { intent: 'add', scope: { entryPoint: 'beat', targetIds: ['beat_Midpoint'] }, options: { packageCount: 2 } };
      return runGenerator(req);
    }
  }, [storyId, runGenerator]);

  useEffect(() => () => {
    // cleanup
    for (const es of sourcesRef.current.values()) es.close();
    sourcesRef.current.clear();
  }, []);

  return {
    jobs,
    runInterpreter,
    runGenerator,
    runGeneratorQuick,
  } as const;
}

