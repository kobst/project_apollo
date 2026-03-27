# Migration: Moves/Clusters → Packages/Sessions

Purpose: Replace legacy MoveCluster/NarrativeMove endpoints and concepts with NarrativePackage + Generation Session.

What changed
- Proposals are NarrativePackages staged in a Generation Session (not graph nodes).
- Legacy endpoints removed: `POST /stories/:id/clusters`, `GET /stories/:id/moves/:moveId/preview`, `POST /stories/:id/accept`.
- Structure pivots from PlotPoint to PlotPoint for outline realization.
- Lint/coverage rules renamed from `PP_*` to `PP_*`.

Endpoint mapping
- Generate alternatives: use `POST /stories/:id/propose*` (modes: plot-points, characters, scenes, expand).
- Inspect/preview: use `POST /stories/:id/validate-package` and UI overlay.
- Commit/merge: use `POST /stories/:id/propose/commit` with `packageId`.
- Save for later: use `/stories/:id/saved-packages*`.

Edge model changes
- Preferred: `PlotPoint -[alignedBeatId]-> Beat`, `PlotPoint -[REALIZED_BY]-> Scene`.
- Deprecated: `Scene -[FULFILLS]-> Beat` (derived), `Scene.beat_id` direct assignment.

Rule IDs
- Hard: `PP_DAG_NO_CYCLES`, `PP_ORDER_UNIQUE`, `PP_ACT_ALIGNMENT`.
- Soft: `PP_EVENT_REALIZATION`.
- Scenes: `SCENE_HAS_PLOTPOINT` replaces `SCENE_HAS_PLOTPOINT`.

Data migration (optional)
- If MoveCluster/NarrativeMove data exists, export to JSON archive or convert NarrativeMove.patch → NarrativePackage and store via Saved Packages.

UI migration
- Remove Moves/Clusters views and API calls.
- Staging View surfaces NarrativePackages; Accept → `propose/commit`.
- Structure Board shows PlotPoints; Scenes nested under PlotPoints.

