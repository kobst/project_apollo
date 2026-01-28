# PR Plan: Remove MoveCluster/NarrativeMove + PlotPoint → StoryBeat

Objective
- Remove legacy clusters/moves endpoints and types; fully migrate outline to StoryBeat and package-first staging.

Scope
- API, core types/validators, UI, CLI, tests/fixtures, docs.

Tasks
- API
  - Remove routes: `POST /stories/:id/clusters`, `GET /stories/:id/moves/:moveId/preview`, `POST /stories/:id/accept`.
  - Replace any internal invocations with `/propose*`, `/validate-package`, `/propose/commit`.
  - Drop MoveCluster/NarrativeMove DTOs, controllers, serializers.
  - Edge validation: enforce `StoryBeat` on `ALIGNS_WITH` and `SATISFIED_BY`.
  - Rule IDs: map `PP_*` → `SB_*` (alias for one release), then remove.

- Core
  - Remove `PlotPoint` type in favor of `StoryBeat`.
  - Update compute-order logic and any helpers (ordering, dag check).
  - Update serializers/prompts to StoryBeat.

- UI
  - Remove Moves/Clusters UI and hooks.
  - Structure Board: replace PlotPoint cards with StoryBeat cards.
  - Staging View: ensure accept → `propose/commit`, save → Saved Packages.
  - Critic/Impact: show SB_* rules and StoryBeat coverage.

- CLI
  - Remove `accept` move command; add `commit-package`.
  - Update any generation commands to refer to StoryBeat + Packages.

- Tests
  - Replace fixtures containing PlotPoint/Moves with StoryBeat/Packages.
  - Update rule expectations to SB_*.
  - Ensure end-to-end uses proposal sessions.

- Docs
  - Link to `docs/migration-packages.md` from API README.
  - Verify spec/ references are clean (done).

Acceptance Criteria
- No references to MoveCluster/NarrativeMove/PlotPoint/Moves endpoints remain in code or docs.
- All tests green with SB_* rules and StoryBeat edges.
- UI flows function end-to-end with `/propose/commit`.

Rollout
- Release X.Y.0: include alias mapping for PP_* → SB_* and 410 for old endpoints.
- Release X.Y.1: remove aliases and 410 stubs.

