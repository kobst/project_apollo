# Agentic Workflow in GenerationPanel

Status: Implemented (staging-first, human-in-the-loop)
Owner: Apollo team (AI/UX)
Scope: Documents the integrated agentic workflow inside the existing GenerationPanel, replacing the separate Staging tab.

## Overview

- Keep GenerationPanel; extend it with agentic capabilities.
- Retire the standalone Staging tab. Proposals stage directly and overlay on the Workspace.
- Remove Agent Jobs UI from user-facing surfaces. Agent orchestration runs behind the scenes when enabled.
- Unify “Interpreter” with the Direction field via an AI-assisted toggle:
  - Describe (Interpreter): Enable AI-assisted, type Direction, then Generate.
  - Configure (ComposeForm): Disable AI-assisted; use configured fields and Generate.
- Remove hardcoded Generator preset buttons.

## Key Endpoints

- `POST /stories/:id/agents/run` + SSE `GET /stories/:id/agents/jobs/:jobId/events`
  - Orchestrates Interpreter/Generator jobs; always stages results (never live).
- `POST /stories/:id/lint/staged`
  - Runs Critic against the hypothetical graph computed from the staged package.
- `GET /stories/:id/propose/overlay-diff/:packageId`
  - Returns compact overlay summary: created/modified/deleted nodes and edges.
- `POST /stories/:id/ideas/from-package`
  - Promotes any package element to an Idea with `source='ai'`.

## UI Integration

- Hook: `useAgentJobs(storyId, { onJobDone })`
  - Provides `runInterpreter(prompt)`; subscribes to SSE for job progress; refreshes session on completion.
- GenerationPanel
  - AI-assisted toggle: runs Interpreter behind Direction when enabled.
  - ComposeForm remains for configured generation (four modes).
  - PackageCarousel: select to stage and preview overlays on the Workspace.
  - Review section (contextual under carousel):
    - Critic: “Run Critic” triggers staged lint and renders inline violations. Hidden until run.
    - Impact: summary is shown only when non-empty (fulfills/creates/conflicts).
    - Refine: prompt + button invokes `refinePackage`; variations append to the session lineage.
    - Lineage breadcrumbs: Parent · Siblings · Children navigation within panel; clicking stages that package.
    - Accept banner: Shows compact overlay diff counts and actions (Accept/Reject/Save) in-panel.
  - Saved Packages: View, Apply, Discard, with overlay preview when viewing a saved package.
- Structure overlays
  - “Send to Ideas” buttons on proposed StoryBeats and Scenes cards (mirrors Elements behavior).

## How To Use

1. Toggle AI-assisted to use Interpreter with the Direction field; leave off to use ComposeForm directly.
2. Click “Generate Proposals”. Packages appear in the carousel; select one to stage overlay previews.
3. In Review:
   - Run Critic to inspect violations.
   - Check Impact if present.
   - Use Refine to add guided variations; navigate via lineage breadcrumbs.
   - Accept/Reject/Save from the Accept banner; compact diff counts provide a quick overview.
4. Use “Send to Ideas” on proposed Structure (StoryBeats/Scenes) and Elements to stash content as Ideas.

## Crash Fixes

- Staging utils now guard against malformed changes:
  - Skip StoryContext items without a string `operation.type`.
  - Skip node additions missing `node_id`.
  - Avoid `startsWith` on `undefined` in older saved packages.

## Implementation Notes

- Overlay diff auto-loads when the staged package changes.
- Accept returns a version; panel shows a brief accepted-version banner.
- No Agent Jobs UI is exposed; orchestration is handled in `useAgentJobs` with a lightweight toggle in panel.

## What’s Next (Proposals)

- Diff details: Expandable “View details” under the compact overlay diff to list a few example IDs/edges.
- Auto-critic heuristic: Option to auto-run Critic upon staging if the package exceeds a change threshold.
- Interpreter heuristics: Auto-enable AI-assisted when Direction is sufficiently complex or non-empty.
- Lineage polish: Add quick metadata (confidence, short summary) to breadcrumbs tooltips.
- Ideas enrichment: Allow tagging/category selection when sending to Ideas from Structure cards.
- Metrics: Show basic job timing/acceptance percent in a small footer once jobs complete.

## Related Files

- UI
  - `packages/ui/src/components/workspace/GenerationPanel.tsx`
  - `packages/ui/src/components/workspace/PackageCarousel.tsx`
  - `packages/ui/src/components/workspace/ProposedElementCard.tsx`
  - `packages/ui/src/components/outline/ProposedStoryBeatCard.tsx`
  - `packages/ui/src/components/outline/ProposedSceneCard.tsx`
  - `packages/ui/src/hooks/useAgentJobs.ts`
  - `packages/ui/src/utils/stagingUtils.ts`
- API
  - `packages/api/src/handlers/agents.ts`
  - `packages/api/src/handlers/lint.ts`
  - `packages/api/src/handlers/overlay.ts`
  - `packages/api/src/routes/stories.ts`

