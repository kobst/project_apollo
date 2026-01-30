# Agentic Workflow Proposal & Plan

Version: 0.1.0
Date: 2026-01-29
Status: Draft

## Summary

Introduce a thin agentic layer that orchestrates Apollo’s existing AI and graph endpoints into reliable, review-first playbooks. Each agent (Interpreter, Generator, Critic, Gap Scout, Refiner, Merger) speaks the same data contract (NarrativePackage in Staging, Patch out via commit), enabling staging-first UX, lint-based guardrails, and targeted, repeatable assistance — without replacing any current endpoints.

This document complements `spec/aiIntegration.md` (phases, package schema) and `spec/apiGuide.md` (endpoints). It focuses on how to wire agents to existing APIs, add a minimal orchestration endpoint, and roll out UX and milestones.

---

## Why Agents vs Single LLM Calls

- Reliability: Standardized prompts, schema validation, and deterministic staging.
- Safety: Lint + auto-fix as a pre-commit gate; StoryContext alignment.
- Exploration: Multi-variant packages with refinement lineage.
- Targeting: Gap Scout focuses cost/effort where impact is highest.
- Observability: Sessions, acceptance rates, fix application, token budgets.

Raw LLM calls remain available; agents simply orchestrate them with guardrails and review UX.

---

## Agent Roles (Thin Playbooks)

Each agent takes structured input, calls the LLM (server-side), validates/normalizes to `NarrativePackage`, stages via `/propose`, and (optionally) runs Critic. No agent writes to the live graph; only Merger commits.

- Interpreter
  - Input: Free text + current state + filtered guidelines/ideas/gaps.
  - Output: 1–N `NarrativePackage` to Staging with rationale.
- Generator
  - Input: Entry point (Beat/PlotPoint/Character/Gap/Idea/Global), direction, scope (depth/count).
  - Output: N `NarrativePackage` alternatives.
- Critic
  - Input: One staged package.
  - Output: Lint results (hard blocks + soft warnings) and auto-fix suggestions.
- Gap Scout
  - Input: Coverage/Open-Questions/Outline.
  - Output: Enqueued Generator tasks (no auto-apply).
- Refiner
  - Input: Selected package + keep/regenerate lists + guidance; lineage fields.
  - Output: K child packages linked to the parent.
- Merger
  - Input: Accepted package.
  - Output: Patch → `/propose/commit` → `StoryVersion` + audit.

---

## Data Contracts

Re-use and extend the contracts in `aiIntegration.md`.

- NarrativePackage: As defined (id, title, rationale, confidence, `changes{storyContext/premise/storyElements/outline}`, edges, impact, lineage fields).
- RefinementRequest
  - `base_package_id: string`
  - `keep_elements: string[]`
  - `regenerate_elements: string[]`
  - `guidance: string`
  - `depth: 'narrow' | 'medium' | 'wide'`
  - `count: 'few' | 'standard' | 'many'`
- AgentRun (orchestration job)
  - `id, story_id, agent, params, status: 'queued'|'running'|'succeeded'|'failed'|'canceled'`
  - `startedAt, endedAt, metrics{tokens, latencyMs, packagesCount, fixesApplied}`
  - `outputs` (agent-specific; commonly `packages` or `lint`)

---

## Mapping Agents to Existing Endpoints

- Read Context
  - `GET /stories/:id/status`, `GET /stories/:id/outline`, `GET /stories/:id/open-questions`
- Stage Packages
  - Unified: `POST /stories/:id/propose`
  - Specializations: `POST /stories/:id/propose/story-beats | /characters | /scenes | /expand`
  - Inspect: `GET /stories/:id/propose/active`
- Refine/Edit Package
  - `POST /stories/:id/regenerate-element`
  - `POST /stories/:id/apply-element-option`
  - `POST /stories/:id/update-package-element`
- Guardrails (Critic)
  - `POST /stories/:id/lint` (+ fixer mapping to staged patch scope)
- Commit (Merger)
  - `POST /stories/:id/propose/commit`
  - History: `GET /stories/:id/log`, Diff: `GET /stories/:id/diff`

---

## Orchestration Endpoint (Minimal Viable)

Add a lightweight runner that invokes an agent’s playbook and streams progress.

Endpoint: `POST /stories/:id/agents/run`

Request Body (union by `agent`):

```json
{
  "agent": "interpreter" | "generator" | "critic" | "gapScout" | "refiner" | "merger",
  "params": {
    // interpreter
    "prompt?: string",
    // generator
    "mode?: "add"|"expand"|"explore",
    "entryPoint?: { type: "auto"|"beat"|"gap"|"character"|"plotPoint"|"idea"|"global", targetId?: string },
    "direction?: string",
    "packageCount?: number",
    "nodesPerPackage?: number",
    // critic
    "packageId?: string",
    // gapScout
    "budget?: { maxJobs?: number, maxTokens?: number }",
    // refiner
    "refinement?: { base_package_id: string, keep_elements: string[], regenerate_elements: string[], guidance?: string, depth?: string, count?: string },
    // merger
    "commit?: { packageId: string }}
}
```

Response:

```json
{ "success": true, "data": { "jobId": "job_123", "sse": "/stories/:id/agents/jobs/job_123/events" } }
```

SSE Events (server-sent events):

- `status`: `{ status: 'queued'|'running'|'succeeded'|'failed'|'canceled' }`
- `progress`: `{ step: 'readContext'|'llmCall'|'validate'|'stage'|'lint'|'complete', detail?: string }`
- `packages`: `{ packages: NarrativePackage[] }` (if applicable)
- `lint`: `{ results: LintResult, fixes?: FixSuggestion[] }`
- `metrics`: `{ tokensPrompt, tokensCompletion, latencyMs }`
- `error`: `{ message, suggestion? }`

Optional control endpoints (future):

- `POST /stories/:id/agents/jobs/:jobId/cancel`
- `GET /stories/:id/agents/jobs/:jobId` (snapshot)

Implementation: in-memory queue with persistence to `~/.apollo/agents/jobs.json`.

---

## Critic Auto-Fixes (Initial Set)

Map lint codes to fixers on a staged package (not live graph):

- `ORDER_UNIQUE`: Reindex order within beat.
- `PP_DAG_NO_CYCLES`: Suggest edge removals/reorders to preserve DAG.
- `ACT_ALIGNMENT`: Add/adjust `ALIGNS_WITH` for StoryBeats.
- `HAS_CHARACTER`/`LOCATED_AT`: Attach prominent characters/location from context.
- `ID_HYGIENE`: Normalize temp IDs; ensure uniqueness.

UI affordances: “Apply All”, per-fix apply, re-run lint.

---

## Staging-First UX (Overview)

- Packages Pane (Staging View): Tree of packages with lineage; actions: Accept / Refine / Reject / Send to Ideas.
- Critic Tab: Hard blocks, soft warnings, and one-click fixes; re-lint.
- Impact Tab: Fulfilled and created gaps; conflicts; DAG warnings.
- Workspace Preview: Overlay proposed nodes/edges in Structure/Elements; highlight creates/modifies/deletes.

Note: Detailed UI contracts can be added as a follow-up (`props`, events like `onAccept`, `onReject`, `onRefine`, `onSendToIdeas`, `onApplyFix`).

---

## Prompt Layer Enhancements

- System prompt = StoryContext constitution (cached when present).
- User prompt = filtered ideas/guidelines/gaps per task + entry-point scoping.
- Strict output schema & parser → `NarrativePackage`.
- Budget knobs: depth/count map to token ceilings per agent.

---

## Telemetry & Ops

- Log per agent run: model, tokens, latency, acceptance %, conflicts/run, auto-fixes applied.
- Session analytics: acceptance by package type, lineage depth distribution.
- Feature flags: creativity default, expansionScope default, idea inclusion caps.

---

## Testing Strategy

- Contract tests: `NarrativePackage`, `RefinementRequest`, fixer functions.
- Mock LLM provider: golden prompt-output tests.
- Graph invariants: DAG, ordering, required edges on synthetic fixtures.

---

## Minimal Roadmap

Milestone 1 — Human-in-the-loop, end-to-end

- Wire Interpreter + Generator to produce packages via `/propose`.
- Add `/stories/:id/agents/run` orchestration with SSE.
- Staging View (Accept/Reject/Send-to-Ideas) + basic Package Browser.
- Critic pass: run `/lint`, implement 2–3 auto-fixers, re-lint.
- Merge via `/propose/commit`; show version and diff.

Milestone 2 — Targeted assistance

- Gap Scout: compute opportunities from `/open-questions`/outline; queue Generator tasks.
- Refiner: keep/regenerate lists; lineage tree navigation.

Milestone 3 — Power tools

- Bulk attach/order in review; pre-checked fixes by confidence.
- Confidence-weighted highlighting; session telemetry dashboard.

---

## Open Questions

- Scope of “apply fixes” endpoint for staged patches vs live graph.
- Persistence/cleanup policy for agent jobs and abandoned sessions.
- Default budgets for token usage per agent and per session.

