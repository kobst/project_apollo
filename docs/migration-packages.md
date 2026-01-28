# Migration: Moves/Clusters → Packages/Sessions

Purpose: Replace legacy MoveCluster/NarrativeMove endpoints and concepts with NarrativePackage + Generation Session.

What changed
- Proposals are NarrativePackages staged in a Generation Session (not graph nodes).
- Legacy endpoints removed: `POST /stories/:id/clusters`, `GET /stories/:id/moves/:moveId/preview`, `POST /stories/:id/accept`.
- Structure pivots from PlotPoint to StoryBeat for outline realization.
- Lint/coverage rules renamed from `PP_*` to `SB_*`.

Endpoint mapping
- Generate alternatives: use `POST /stories/:id/propose*` (modes: story-beats, characters, scenes, expand).
- Inspect/preview: use `POST /stories/:id/validate-package` and UI overlay.
- Commit/merge: use `POST /stories/:id/propose/commit` with `packageId`.
- Save for later: use `/stories/:id/saved-packages*`.

Edge model changes
- Preferred: `StoryBeat -[ALIGNS_WITH]-> Beat`, `StoryBeat -[SATISFIED_BY]-> Scene`.
- Deprecated: `Scene -[FULFILLS]-> Beat` (derived), `Scene.beat_id` direct assignment.

Rule IDs
- Hard: `SB_DAG_NO_CYCLES`, `SB_ORDER_UNIQUE`, `SB_ACT_ALIGNMENT`.
- Soft: `SB_EVENT_REALIZATION`.
- Scenes: `SCENE_HAS_STORYBEAT` replaces `SCENE_HAS_PLOTPOINT`.

Data migration (optional)
- If MoveCluster/NarrativeMove data exists, export to JSON archive or convert NarrativeMove.patch → NarrativePackage and store via Saved Packages.

UI migration
- Remove Moves/Clusters views and API calls.
- Staging View surfaces NarrativePackages; Accept → `propose/commit`.
- Structure Board shows StoryBeats; Scenes nested under StoryBeats.

