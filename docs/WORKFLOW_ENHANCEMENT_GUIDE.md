# Workflow Enhancement Guide

This document describes the workflow enhancements added to the Apollo generation pipeline, covering problem framing, impact diffing, critique, clarification, and the unified workflow endpoint.

## Overview

The generation pipeline now supports a structured workflow inspired by obligation-management principles: instead of just producing story artifacts, the system helps identify narrative problems, generate candidate solutions with tradeoff analysis, and review them with human taste in control.

### Pipeline Flow

```
User Input → Interpret → (Clarify?) → Generate → Impact Diff → (Critique?) → Stage for Review
```

Each step is optional and skippable. The workflow endpoint (`POST /stories/:id/workflows/run`) composes all steps behind a single request.

---

## 1. Problem Statements

### What

Every generation request can now include a `problemStatement` field — a human-readable description of what narrative problem the generation should solve.

### Why

Previously, generation was entry-point-driven ("generate for this beat"). Problem statements reorient the AI from "fill this slot" to "solve this problem," producing more purposeful content.

### Usage

```typescript
// In orchestration requests
{
  direction: "...",
  problemStatement: "The Midpoint beat has no scenes realizing it — this story moment is undefined."
}
```

### Auto-population from Gaps

The `gapToStatement()` function converts coverage gaps into problem statements automatically:

```typescript
import { gapToStatement } from '@apollo/core';

const gap = coverage.gaps.find(g => g.title.includes('Catalyst'));
const statement = gapToStatement(gap);
// → "The Catalyst beat has no scenes realizing it — this story moment is undefined and needs creative development."
```

Every gap type has a specific, actionable statement. The function covers:
- Beat unrealized gaps (per beat type)
- Act imbalance
- Scene without characters / location
- Unlinked scenes (no PlotPoint connection)
- Missing objects
- Underspecified characters
- Missing character arcs
- Ungrounded arcs
- Unrealized plot points

### Prompt Injection

When `problemStatement` is provided, a `## Narrative Problem` section is injected into the prompt before the story state, instructing the AI to directly address the problem. This works across all prompt builders: generation, plot point, scene, and expand.

---

## 2. Mechanical Impact Diffing

### What

Before/after coverage comparison that shows exactly which gaps a package would resolve and which new ones it would create.

### Why

Replaces heuristic impact analysis with deterministic diffing. Instead of guessing what a package does, we apply it speculatively and measure the actual coverage change.

### How It Works

1. Compute coverage on the original graph
2. Convert the package to a patch via `packageToPatch()`
3. Apply the patch to a cloned graph
4. Compute coverage on the modified graph
5. Diff the gap sets and tier percentages

### Usage

```typescript
import { computeImpactDiff } from '@apollo/core';

const diff = computeImpactDiff(graph, package);

// diff.dischargedGaps — gaps this package resolves
// diff.introducedGaps — new gaps this package creates
// diff.tierChanges — per-tier coverage percent changes
// diff.netGapDelta — negative = improvement
```

### Key Types

```typescript
interface ImpactDiff {
  dischargedGaps: Gap[];
  introducedGaps: Gap[];
  tierChanges: Array<{
    tier: GapTier;
    label: string;
    before: number;  // percent
    after: number;
    delta: number;
  }>;
  netGapDelta: number;
  before: CoverageResponse;
  after: CoverageResponse;
}
```

### Package-to-Patch Converter

The `packageToPatch()` utility converts a `NarrativePackage` (with its `changes.nodes` and `changes.edges` arrays) into a `Patch` that can be speculatively applied via `applyPatch()`. This handles:
- `NodeChange` with `operation: 'add'` → `ADD_NODE` ops
- `NodeChange` with `operation: 'modify'` → `UPDATE_NODE` ops
- `EdgeChange` with `operation: 'add'` → `ADD_EDGE` ops
- `EdgeChange` with `operation: 'delete'` → `DELETE_EDGE` ops

---

## 3. Critique Pass

### What

A post-generation LLM pass that evaluates packages against story context, thematic pillars, and structural fit.

### Why

The human reviewing packages needs to make tradeoff decisions. Raw package content shows *what* each option adds but not *why* one might be better than another. The critique surfaces strengths, weaknesses, thematic alignment, structural risks, and a one-line tradeoff summary.

### Prompt Design

The critique prompt includes:
- Story context (constitution, thematic pillars)
- Current coverage state
- Each package's content summary and impact diff
- Instructions to evaluate strengths, weaknesses, thematic fit, structural risks, and tradeoff profile
- Explicit instruction: "Do NOT restate what the package contains — surface insights the human might miss"

### Output Type

```typescript
interface PackageCritique {
  packageId: string;
  strengths: string[];
  weaknesses: string[];
  thematicFit: 'strong' | 'moderate' | 'weak';
  structuralRisks: string[];
  tradeoffProfile: string;  // one-line summary
}
```

The `critique` field is added directly to `NarrativePackage` so it travels with the package through staging and review.

### Parser

`parseCritiqueResponse()` handles JSON arrays, markdown-wrapped JSON, single objects, and partial/malformed responses with graceful fallbacks.

---

## 4. Clarification Pre-flight

### What

A conditional step in the interpretation phase that asks the user targeted questions when input is too ambiguous to generate effectively.

### Why

The system sometimes jumps to artifact generation when the user's intent is unclear ("Make Act 2 better"). Clarification prevents wasted generation by resolving ambiguity first, while always providing best-guess proposals as a fallback.

### How It Works

The interpretation prompt now includes a `clarification` field in its output schema:

```json
{
  "interpretation": { "summary": "...", "confidence": 0.85 },
  "clarification": {
    "needed": true,
    "questions": [
      { "question": "What aspect needs work?", "options": ["Pacing", "Character depth", "Plot"] }
    ],
    "reason": "The input is too vague to determine generation strategy."
  },
  "proposals": [...]
}
```

### Key Design Decisions

- **Options over open-ended questions**: Each question should have 2-4 suggested options when possible
- **Always provide proposals**: Even when clarification is requested, best-guess proposals are included (used if the user skips clarification)
- **Skip is always available**: The user can bypass clarification via `skipClarification: true`
- **Max 4 questions**: To prevent the clarification step from feeling like an interrogation

### Types

```typescript
interface ClarificationRequest {
  needed: boolean;
  questions: ClarificationQuestion[];
  reason: string;
}

interface ClarificationQuestion {
  question: string;
  options?: string[];
}
```

---

## 5. Workflow Endpoint

### What

A single endpoint that composes all the above steps into one request/response cycle.

### Endpoint

```
POST /stories/:id/workflows/run
```

### Request

```typescript
interface WorkflowRequest {
  type: 'generate';
  problemStatement?: string;
  entryPoint?: GenerationEntryPoint;
  direction?: string;
  clarificationAnswers?: Record<string, string>;
  skipClarification?: boolean;
  skipCritique?: boolean;
  packageCount?: number;
  creativity?: number;
}
```

### Response

```typescript
interface WorkflowResponse {
  status: 'needs_clarification' | 'packages_ready';
  clarification?: ClarificationRequest;
  packages?: WorkflowPackage[];      // includes critique + impactDiff
  coverageBefore?: TierSummary[];
}
```

### Flow

1. **Interpret** (if `direction` is freeform and no `entryPoint`)
2. **Clarify** (if interpretation detects ambiguity and `skipClarification` is false)
   - Returns `{ status: 'needs_clarification', clarification }` — user answers and re-submits
3. **Generate** via unified orchestrator
4. **Impact Diff** for each package (mechanical, no LLM)
5. **Critique** each package (LLM pass, skippable)
6. **Return** packages with critique and impact data attached

### Re-submission after Clarification

When the user answers clarification questions, re-submit the same request with `clarificationAnswers`:

```typescript
// First request
POST /stories/s1/workflows/run
{ type: 'generate', direction: 'Make Act 2 better' }
// Response: { status: 'needs_clarification', clarification: { questions: [...] } }

// Second request with answers
POST /stories/s1/workflows/run
{
  type: 'generate',
  direction: 'Make Act 2 better',
  clarificationAnswers: { 'What aspect?': 'Pacing and momentum' }
}
// Response: { status: 'packages_ready', packages: [...] }
```

### Error Handling

- Impact diff failure is non-fatal (packages are still returned without diff data)
- Critique failure is non-fatal (packages are still returned without critique)
- LLM not configured → 400 error with setup instructions

---

## Report Scripts

Each stage has a report script for manual review:

```bash
# Stage 1: Impact diffing
npx tsx packages/core/tests/coverage/impactDiff.report.ts

# Stage 2: Problem statements
npx tsx packages/core/tests/ai/problemStatement.report.ts

# Stage 3: Critique
npx tsx packages/core/tests/ai/critique.report.ts

# Stage 4: Clarification
npx tsx packages/core/tests/ai/clarification.report.ts
```

These print formatted output to stdout for human review. They are not test files — they produce no assertions and always exit successfully.

---

## Files Added/Modified

### New Files
- `packages/core/src/core/packageToPatch.ts` — NarrativePackage → Patch converter
- `packages/core/src/coverage/impactDiff.ts` — Before/after coverage diffing
- `packages/core/src/coverage/gapToStatement.ts` — Gap → problem statement
- `packages/core/src/ai/prompts/critiquePrompt.ts` — Critique prompt builder
- `packages/core/src/ai/critiqueParser.ts` — Critique response parser
- `packages/api/src/handlers/workflow.ts` — Workflow endpoint handler
- `docs/WORKFLOW_ENHANCEMENT_GUIDE.md` — This document

### Modified Files
- `packages/core/src/ai/types.ts` — Added `PackageCritique`, `ClarificationRequest`, `problemStatement` field
- `packages/core/src/ai/prompts/shared.ts` — Added `getProblemStatementSection()`
- `packages/core/src/ai/prompts/generationPrompt.ts` — Problem statement injection
- `packages/core/src/ai/prompts/storyBeatPrompt.ts` — Problem statement injection
- `packages/core/src/ai/prompts/scenePrompt.ts` — Problem statement injection
- `packages/core/src/ai/prompts/expandPrompt.ts` — Problem statement injection
- `packages/core/src/ai/prompts/interpretationPrompt.ts` — Clarification output schema
- `packages/core/src/ai/index.ts` — New exports
- `packages/core/src/coverage/index.ts` — New exports
- `packages/api/src/ai/unifiedOrchestrator.ts` — `problemStatement` on request
- `packages/api/src/ai/storyBeatOrchestrator.ts` — `problemStatement` passthrough
- `packages/api/src/ai/sceneOrchestrator.ts` — `problemStatement` passthrough
- `packages/api/src/ai/interpretOrchestrator.ts` — Clarification passthrough
- `packages/api/src/routes/stories.ts` — Workflow route registration
