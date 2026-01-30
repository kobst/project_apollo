# Staging View UI Contract

Version: 0.1.0
Date: 2026-01-29
Status: Draft

Purpose: Define the UI contracts (components, props, events, payloads) for the Staging-first review workflow that manages AI-generated NarrativePackages before merge. Complements `aiIntegration.md`, `apiGuide.md`, and `agentic-workflow-proposal.md`.

---

## Concepts & Scope

- Staging is a dedicated review surface for packages produced by agents (Interpreter, Generator, Refiner) before commit.
- It presents a lineage tree, Critic and Impact lenses, element-level triage (Send to Ideas), and bulk-fix tools.
- It does not modify the live graph until the user accepts a package (commit).

---

## Components Overview

- StagingView
- PackagesPane (tree + filters)
- PackageDetail (tabs: Overview | Critic | Impact)
  - Implementation note (M1): Impact panel uses package.impact (fulfills/creates/conflicts) and lineage is shown as parent/siblings/children navigation.
- PackageActions (Accept | Refine | Reject | Send to Ideas)
- ElementEditors (nodes/edges/storyContext) with regenerate/apply/update
  - Implementation note (M1): initial UI supports basic inline JSON edit for node data and "Send to Ideas" for nodes/edges/storyContext.
- WorkspaceOverlay (diff preview in Structure/Elements)

---

## Types (Frontend)

References `NarrativePackage` and `RefinementRequest` from `aiIntegration.md`. Frontend-friendly shapes below (subset + additions for UI state).

```ts
export type PackageStatus = 'proposed' | 'refined' | 'fixed' | 'accepted' | 'rejected';

export interface UIPackageSummary {
  id: string;
  title: string;
  confidence?: number; // 0..1
  status: PackageStatus;
  parent_package_id?: string;
  children?: string[]; // derived for tree rendering
  createdAt?: string;
}

export interface UILintResult {
  hardErrors: UILintItem[]; // block commit
  softWarnings: UILintItem[]; // advisory
}

export interface UILintItem {
  code: string; // e.g., ORDER_UNIQUE
  message: string;
  scope: 'package' | 'node' | 'edge' | 'storyContext';
  target?: { type: 'node'|'edge'|'storyContext'; id?: string; index?: number };
  fixId?: string; // link to a specific fix
}

export interface UIFixSuggestion {
  fixId: string;
  label: string; // human-readable, e.g., "Reindex scenes in beat"
  description?: string;
  applicability: 'safe'|'review'|'manual';
}

export interface UIImpact {
  fulfills_gaps: string[]; // gap IDs
  creates_gaps: string[];  // gap IDs
  conflicts: Array<{ type: 'contradicts'|'duplicates'|'interferes'; existing_node_id: string; description: string }>;
}

export interface UIOverlayDiff {
  nodes: {
    created: string[];
    modified: string[];
    deleted: string[];
  };
  edges: {
    created: Array<{ type: string; from: string; to: string }>;
    modified: Array<{ type: string; from: string; to: string }>;
    deleted: Array<{ type: string; from: string; to: string }>;
  };
}

export interface UIAgentJob {
  id: string;
  agent: 'interpreter'|'generator'|'critic'|'gapScout'|'refiner'|'merger';
  status: 'queued'|'running'|'succeeded'|'failed'|'canceled';
  metrics?: { tokensPrompt?: number; tokensCompletion?: number; latencyMs?: number };
}

// Refinement
export interface UIRefinementRequest {
  base_package_id: string;
  keep_elements: string[]; // node/edge ids inside the package context
  regenerate_elements: string[];
  guidance?: string;
  depth?: 'narrow'|'medium'|'wide';
  count?: 'few'|'standard'|'many';
}
```

---

## Component Contracts

### StagingView

Props

```ts
interface StagingViewProps {
  storyId: string;
  sessionId?: string; // active proposal session
  packages: UIPackageSummary[]; // tree-ready list
  activePackageId?: string;
  jobs?: UIAgentJob[]; // agent runs related to this session
  featureFlags?: {
    enableAutoFixes?: boolean;
    showConfidence?: boolean;
  };
  // Data providers (lifting fetch into host app if desired)
  loadPackageDetail: (packageId: string) => Promise<NarrativePackage>;
  loadLint: (packageId: string) => Promise<UILintResult & { fixes?: UIFixSuggestion[] }>;
  loadImpact: (packageId: string) => Promise<UIImpact>;
  loadOverlayDiff: (packageId: string) => Promise<UIOverlayDiff>;
}
```

Events / Callbacks

```ts
interface StagingViewEvents {
  onNavigatePackage: (packageId: string) => void;
  onAccept: (packageId: string) => Promise<{ newVersionId: string }>; // commit
  onReject: (packageId: string) => Promise<void>;
  onRefine: (request: UIRefinementRequest) => Promise<{ childPackageIds: string[] }>; // adds children
  onSendToIdeas: (packageId: string, element: { kind: 'node'|'edge'|'storyContext'; index?: number; id?: string }) => Promise<{ ideaId: string }>;
  onApplyFix: (packageId: string, fixId: string) => Promise<void>;
  onApplyAllFixes: (packageId: string) => Promise<void>;
  onRegenElement: (args: { packageId: string; elementType: 'node'|'edge'|'storyContext'; elementIndex: number; guidance?: string; count?: 'few'|'standard'|'many' }) => Promise<{ options: any[] }>;
  onApplyElementOption: (args: { packageId: string; elementType: 'node'|'edge'|'storyContext'; elementIndex: number; newElement: any }) => Promise<void>;
  onUpdatePackageElement: (args: { packageId: string; elementType: 'node'|'edge'|'storyContext'; elementIndex: number; updatedElement: any }) => Promise<void>;
  onReLint: (packageId: string) => Promise<UILintResult & { fixes?: UIFixSuggestion[] }>;
  onOpenWorkspacePreview: (packageId: string) => void; // toggles overlay
  onRunAgent?: (job: { agent: UIAgentJob['agent']; params: any }) => Promise<{ jobId: string }>; // optional
}
```

### PackagesPane

- Displays tree (parent/children) with status badges and confidence.
- Filters: by agent, by status (proposed/refined/fixed), by lint severity, by impact (fulfills/creates gaps).
- Emits: `onNavigatePackage(packageId)`.

### PackageDetail

- Tabs
  - Overview: show changes grouped by hierarchy; inline element actions (regen/apply/update; send to ideas).
  - Critic: lint results + fix suggestions; apply fix / apply all; re-lint.
  - Impact: fulfilled/created gaps; conflicts; simple counts. Lineage controls: parent/siblings/children.
- Emits: `onApplyFix`, `onApplyAllFixes`, `onRegenElement`, `onApplyElementOption`, `onUpdatePackageElement`, `onSendToIdeas`, `onReLint`.

### PackageActions

- Buttons: Accept, Refine..., Reject, Preview in Workspace.
- Emits: `onAccept`, `onRefine`, `onReject`, `onOpenWorkspacePreview`.

### WorkspaceOverlay

- Input: `UIOverlayDiff`.
- Behavior: highlight created (green), modified (yellow), deleted (red) nodes/edges over Structure/Elements views.

---

## Event → API Mapping

- onAccept(packageId)
  - `POST /stories/:id/propose/commit` → `{ newVersionId }`
- onReject(packageId)
  - Local: remove package from session (server-side may prune). Optionally `DELETE /stories/:id/propose/packages/:packageId` if added.
- onRefine(request)
  - `POST /stories/:id/regenerate-element` (per-element) for keep/regenerate flows, or a dedicated `POST /stories/:id/propose/refine` (future) to return child packages.
  - Current viable approach: call unified `POST /stories/:id/propose` with `entryPoint` and embed lineage `{ parent_package_id, refinement_prompt }` in provider layer; backend associates as children.
- onSendToIdeas(packageId, element)
  - Endpoint: `POST /stories/:id/ideas/from-package` with `{ packageId, elementType, elementIndex|id }` → creates `Idea` with `source='ai'` and `status='active'`.
- onApplyFix(packageId, fixId)
  - Proposed endpoint: `POST /stories/:id/lint/apply` with scope=`staged`, `{ packageId, fixId }` → returns updated package; then `onReLint`.
- onApplyAllFixes(packageId)
  - Same endpoint with `{ packageId, applyAll: true }`.
- onRegenElement(args)
  - `POST /stories/:id/regenerate-element`
- onApplyElementOption(args)
  - `POST /stories/:id/apply-element-option`
- onUpdatePackageElement(args)
  - `POST /stories/:id/update-package-element`
- onReLint(packageId)
  - `POST /stories/:id/lint/staged` with `{ packageId }`
- onOpenWorkspacePreview(packageId)
  - Local UI behavior: request `loadOverlayDiff(packageId)` and show overlay.
- onRunAgent(job)
  - `POST /stories/:id/agents/run` (see `agentic-workflow-proposal.md`), then subscribe to SSE for status.

Notes

- Where proposed endpoints are noted, the UI can still function with existing endpoints by performing client-side mutations followed by `update-package-element` calls; adding the endpoints simplifies server authority over fixes/ideas.

---

## UX Behaviors & Edge Cases

- Apply Fix
  - After applying, immediately re-run lint and refresh Impact; if remaining hard errors exist, disable Accept.
- Accept Package
  - Disable if any hardErrors; surface softWarnings but allow override.
  - After commit, refresh `/stories/:id/log` and prompt to view diff.
- Lineage Navigation
  - Breadcrumbs: `Pkg X → Pkg X.2 → Pkg X.2.1`; sibling tabs for children.
- Confidence & Highlighting
  - If `showConfidence`, weight visual emphasis on elements; pre-check “safe” fixes.
- Bulk Tools
  - For ORDER_UNIQUE and attach/align warnings, provide quick actions that call `update-package-element` with computed changes. (Planned post-M1.)

---

## Minimal Data Fetch Plan

- Initial
  - `GET /stories/:id/propose/active` → packages for the session (or source from `/propose` response)
- Per package
  - `loadPackageDetail(packageId)` → provider transforms stored staged package to `NarrativePackage` shape
  - `loadLint(packageId)` → `POST /stories/:id/lint` (scope `staged`)
  - `loadImpact(packageId)` → from `NarrativePackage.impact` or recompute server-side
  - `loadOverlayDiff(packageId)` → server computes diff visualization data

---

## Open Questions

- Should “Reject” remove packages server-side or only hide locally until session cleanup?
- Canonical API for Refiner: unify into a `/propose/refine` endpoint vs element-level regeneration loops?
- Do we persist overlay diffs or always compute on-demand?
- Finalize `lint/apply` and `ideas/from-package` endpoints for authoritative server-side mutations of staged packages.
