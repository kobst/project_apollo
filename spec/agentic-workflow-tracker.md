# Agentic Workflow — Tracker

Status: Living document
Owner: Apollo team (AI/UX)
Scope: Tracks milestones, decisions, open questions, and task checklists for the agentic workflow.

Links
- Proposal: spec/agentic-workflow-proposal.md
- Staging View UI Contract: spec/staging-view-contract.md
- API Guide: spec/apiGuide.md
- AI Integration: spec/aiIntegration.md

---

## Milestones & Status

- [x] M0: Author proposal and UI contract specs
  - [x] spec/agentic-workflow-proposal.md
  - [x] spec/staging-view-contract.md
- [ ] M1: Human-in-the-loop end-to-end
  - Backend
    - [x] Add agent runner endpoints (POST /stories/:id/agents/run, events, cancel)
    - [x] Critic staged-scope integration (lint on staged)
    - [x] Overlay diff provider for staged vs live
    - [ ] Interpreter agent prompt+parser hardening (edge cases, errors)
  - Frontend
    - [x] Integrate agentic workflow into existing GenerationPanel
    - [x] Remove separate Staging tab; overlays preview directly on Workspace
    - [x] AI-assisted toggle merges Interpreter with Direction
    - [x] Review section: Critic (staged lint), Impact (non-empty only), Refine, Lineage
    - [x] Accept banner with compact overlay diff + actions
    - [x] “Send to Ideas” on Elements, StoryBeats, and Scenes proposed cards
- [ ] M2: Targeted assistance
  - [ ] Gap Scout agent + UI (list opportunities → enqueue)
  - [ ] Refiner: keep/regenerate list UI + lineage nav
  - [ ] Jobs Drawer (SSE) with cancel/retry and metrics
- [ ] M3: Power tools
  - [ ] Bulk order/attach tools in review
  - [ ] Confidence-weighted highlighting + pre-checked fixes
  - [ ] Telemetry dashboards (acceptance %, time-to-merge)

---

## Decisions Log (light ADR)

- D001 — Coexistence: Keep Generator (direct) and Interpreter (agent)
  - Decision: Approved
  - Rationale: Different entry styles; share staging/guardrails.
  - Implications: Toggle for “Use Agent Orchestration” in Generator UI.
- D002 — Human-directed default
  - Decision: Approved
  - Rationale: No autonomous merges or runs by default; explicit user action required.
  - Implications: All agents stage only; Accept is gated by lint hard errors.
- D003 — Orchestration endpoint
  - Decision: Approved; minimal MVP implemented
  - Endpoint: POST /stories/:id/agents/run + SSE events.

- D004 — Retire Staging tab; unify in GenerationPanel
  - Decision: Approved; implemented
  - Rationale: Reduce context switching; keep human-in-the-loop within Workspace.
  - Implications: Overlays used for staged preview; accept/reject in-panel.

Add new decisions as: ID, Decision, Status, Rationale, Implications.

---

## Open Questions

- Q001 — Lint/apply for staged scope
  - Prompt: Should we add server support to apply fixes to staged packages (vs live graph)?
  - Options: (A) server endpoint `/stories/:id/lint/apply-staged` with `{ packageId, fixIds }`; (B) client-side transforms + `update-package-element`.
  - Owner: Backend
  - Status: Pending
- Q002 — Ideas from package elements
  - Prompt: Add `POST /stories/:id/ideas/from-package`?
  - Owner: Backend
  - Status: Pending
- Q003 — Session cleanup policy
  - Prompt: When to auto-archive/cleanup abandoned sessions/jobs?
  - Owner: Backend
  - Status: Pending
- Q004 — Default UX toggles
  - Prompt: Defaults for “Run Critic after generation” and “Apply safe fixes”.
  - Owner: Product/UX
  - Status: Pending

- Q005 — Overlay diff details
  - Prompt: Should we add an inline "View details" to show a short list of created/modified/deleted IDs?
  - Owner: UI
  - Status: Proposed (see docs/agentic-generation-panel.md)

Add more with: ID, Prompt, Options (if any), Owner, Status.

---

## Task Checklist (Backend)

- [x] Agents runner stubs (interpreter, generator) + SSE
- [ ] Critic staged-scope lint/apply
- [ ] Overlay diff provider (`UIOverlayDiff` for preview)
- [ ] Ideas-from-package endpoint
- [ ] Cancel job improvement (abort in-flight LLM call)
- [ ] Extend runner: critic, gapScout, refiner, merger

## Task Checklist (Frontend)

- [ ] StagingView shell (props/events per contract)
- [ ] PackagesPane (tree, filters, lineage)
- [ ] PackageDetail (Overview/Critic/Impact tabs)
- [ ] PackageActions (Accept/Refine/Reject/Preview)
- [ ] Element actions wiring (regen/apply/update)
- [ ] Jobs Drawer (subscribe to SSE)
- [ ] Settings toggles (manual/assisted; critic/fixes)

---

## Acceptance Criteria (M1)

- User triggers Interpreter/Generator; packages appear in Staging.
- Critic tab runs lint; at least two auto-fixes can be applied before Accept.
- Workspace preview overlays created/modified/deleted nodes and edges.
- Accept creates a new version and offers a diff link.
- No agent runs automatically; all merges require explicit Accept.

---

## Notes & How To Update

- Keep this doc concise and factual; link to commits/specs.
- Prefer small, frequent updates (check off tasks, add decisions, clarify questions).
- PRs that touch agent workflow should reference Q/D IDs from this tracker.
 - See also: docs/agentic-generation-panel.md for current UI/usage.
