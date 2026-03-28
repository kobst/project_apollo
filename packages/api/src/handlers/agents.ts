/**
 * Agents runner handlers
 *
 * Minimal in-memory job runner with optional persistence under
 *   ~/.apollo/agents/jobs.json
 * Provides:
 *   - POST /stories/:id/agents/run
 *   - GET  /stories/:id/agents/jobs/:jobId/events  (SSE)
 */

import type { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import type { StorageContext } from '../config.js';
import type { APIResponse } from '../types.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';
import { createLLMClient } from '../ai/index.js';
import { propose } from '../ai/proposeOrchestrator.js';
import { interpretUserInput, proposalToPackage } from '../ai/interpretOrchestrator.js';
import {
  createGenerationSession,
  addPackagesToSession,
  markSessionArchived,
} from '../session.js';
import { loadVersionedStateById } from '../storage.js';
import { ai } from '@apollo/core';
import { getAgentJobRepository } from '../persistence/index.js';
import type {
  AgentName,
  AgentJobEvent,
  AgentJobRecord,
} from '../persistence/agentJobTypes.js';

// =============================================================================
// Types
// =============================================================================

interface RunAgentRequest {
  agent: AgentName;
  params?: any; // Agent-specific params; see spec/agentic-workflow-proposal.md
}

interface RunAgentResponse {
  jobId: string;
  eventsUrl: string;
}

// =============================================================================
// Simple Job Store (in-memory + optional persistence)
// =============================================================================

const jobEvents = new EventEmitter();
const jobs = new Map<string, AgentJobRecord>();
const agentJobRepository = getAgentJobRepository();

async function loadJobs(ctx: StorageContext): Promise<void> {
  const arr = await agentJobRepository.loadJobs(ctx);
  for (const j of arr) jobs.set(j.id, j);
}

async function saveJobs(ctx: StorageContext): Promise<void> {
  const arr = Array.from(jobs.values());
  await agentJobRepository.saveJobs(arr, ctx);
}

function emitJobEvent(jobId: string, event: AgentJobEvent): void {
  const rec = jobs.get(jobId);
  if (!rec) return;
  rec.events.push(event);
  rec.updatedAt = new Date().toISOString();
  jobEvents.emit(jobId, event);
}

// =============================================================================
// Runner
// =============================================================================

async function runInterpreter(
  job: AgentJobRecord,
  ctx: StorageContext
): Promise<void> {
  const llm = createLLMClient();
  const { storyId } = job;
  const { userInput, targetType } = job.params ?? {};

  if (!userInput || typeof userInput !== 'string') {
    throw new BadRequestError('Missing or invalid "userInput" for interpreter');
  }

  emitJobEvent(job.id, { type: 'progress', data: { step: 'llmCall' } });

  const interp = await interpretUserInput(
    storyId,
    { userInput, targetType },
    ctx,
    llm
  );

  // Convert proposals → NarrativePackages
  const packages: ai.NarrativePackage[] = (interp.proposals ?? []).map((p) =>
    proposalToPackage(p)
  );

  // Start a new generation session and add packages
  await markSessionArchived(storyId, ctx);
  await createGenerationSession(
    storyId,
    { type: 'naked' },
    { depth: 'medium', count: 'few', direction: 'Interpreter' },
    ctx
  );
  await addPackagesToSession(storyId, packages, ctx);

  emitJobEvent(job.id, { type: 'packages', data: { packages } });
}

async function runGenerator(
  job: AgentJobRecord,
  ctx: StorageContext
): Promise<void> {
  const llm = createLLMClient();
  const { storyId } = job;
  const request = job.params?.proposeRequest as ai.ProposeRequest | undefined;

  if (!request) {
    throw new BadRequestError('Missing "proposeRequest" for generator');
  }

  emitJobEvent(job.id, { type: 'progress', data: { step: 'propose' } });

  const result = await propose(storyId, request, ctx, llm);

  emitJobEvent(job.id, { type: 'packages', data: { packages: result.packages, sessionId: result.sessionId } });
}

async function executeJob(job: AgentJobRecord, ctx: StorageContext): Promise<void> {
  jobs.set(job.id, job);
  await saveJobs(ctx);

  try {
    job.status = 'running';
    emitJobEvent(job.id, { type: 'status', data: { status: 'running' } });

    if (job.agent === 'interpreter') {
      await runInterpreter(job, ctx);
    } else if (job.agent === 'generator') {
      await runGenerator(job, ctx);
    } else {
      throw new BadRequestError(`Unsupported agent: ${job.agent}`);
    }

    job.status = 'succeeded';
    emitJobEvent(job.id, { type: 'status', data: { status: 'succeeded' } });
  } catch (err: any) {
    job.status = 'failed';
    emitJobEvent(job.id, { type: 'error', data: { message: err?.message || 'Agent failed' } });
    emitJobEvent(job.id, { type: 'status', data: { status: 'failed' } });
  } finally {
    job.updatedAt = new Date().toISOString();
    await saveJobs(ctx);
  }
}

// =============================================================================
// Handlers
// =============================================================================

/**
 * POST /stories/:id/agents/run
 */
export function createRunAgentHandler(ctx: StorageContext) {
  // Load persisted jobs once per process
  void loadJobs(ctx);

  return async (
    req: Request<{ id: string }, unknown, RunAgentRequest>,
    res: Response<APIResponse<RunAgentResponse>>,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const story = await loadVersionedStateById(id, ctx);
      if (!story) throw new NotFoundError(`Story "${id}"`, 'Use POST /stories/init to create a story');

      const { agent, params } = req.body || {} as RunAgentRequest;
      if (!agent) throw new BadRequestError('Missing "agent"');

      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const job: AgentJobRecord = {
        id: jobId,
        storyId: id,
        agent: agent as AgentName,
        params,
        status: 'queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: [{ type: 'status', data: { status: 'queued' } }],
      };

      // Kick off asynchronously
      void executeJob(job, ctx);

      res.json({
        success: true,
        data: {
          jobId,
          eventsUrl: `/stories/${id}/agents/jobs/${jobId}/events`,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * GET /stories/:id/agents/jobs/:jobId/events (SSE)
 */
export function createAgentEventsHandler(_ctx: StorageContext) {
  return async (
    req: Request<{ id: string; jobId: string }>,
    res: Response,
    _next: NextFunction
  ) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    function send(e: AgentJobEvent) {
      res.write(`data: ${JSON.stringify(e)}\n\n`);
    }

    // Send existing events
    if (job) {
      for (const e of job.events) send(e);
    }

    // Subscribe to new events
    const listener = (e: AgentJobEvent) => send(e);
    jobEvents.on(jobId, listener);

    // Cleanup
    req.on('close', () => {
      jobEvents.off(jobId, listener);
      res.end();
    });
  };
}

/**
 * POST /stories/:id/agents/jobs/:jobId/cancel
 * (stub) Marks job as canceled; does not abort running LLM call in this MVP.
 */
export function createCancelAgentJobHandler(_ctx: StorageContext) {
  return async (
    req: Request<{ id: string; jobId: string }>,
    res: Response<APIResponse<{ status: string }>>,
    _next: NextFunction
  ) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    job.status = 'canceled';
    emitJobEvent(jobId, { type: 'status', data: { status: 'canceled' } });
    res.json({ success: true, data: { status: 'canceled' } });
  };
}
