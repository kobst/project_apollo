# Removal Checklist: MoveCluster/NarrativeMove

API
- [ ] Delete routes: `POST /stories/:id/clusters`, `GET /stories/:id/moves/:moveId/preview`, `POST /stories/:id/accept`.
- [ ] Remove controllers/DTOs/schemas for MoveCluster/NarrativeMove.
- [ ] Remove types from unions/serialization; drop storage of legacy nodes.
- [ ] Add temporary 410 Gone for old routes (one release), respond with replacements.
- [ ] Update edge validation to expect PlotPoint on `alignedBeatId`/`REALIZED_BY`.
- [ ] Rename rule IDs `PP_*` → `PP_*`; keep alias mapping for one cycle, then remove.

Core/Types
- [ ] Remove PlotPoint node type; add PlotPoint type (id/title/summary/intent/priority/stakes_change/status).
- [ ] Update compute-order logic to use PlotPoints.
- [ ] Update serializers, prompt builders, and validators to PlotPoint.

UI
- [ ] Remove Moves/Clusters panels, routes, and hooks.
- [ ] Replace PlotPoint cards with PlotPoint cards; adjust nesting under Beats.
- [ ] Wire staging to `/propose*`, validation to `/validate-package`, merge to `/propose/commit`.

CLI
- [ ] Remove move acceptance commands; add `commit-package`.
- [ ] Update generation/extraction commands to show NarrativePackages.

Tests/Fixtures
- [ ] Remove MoveCluster/NarrativeMove fixtures.
- [ ] Update golden snapshots to PlotPoint edges and PP_* rule IDs.
- [ ] Replace PlotPoint graphs in fixtures with PlotPoint graphs.

Docs
- [ ] Replace PlotPoint with PlotPoint everywhere.
- [ ] Replace Moves/Clusters with Packages/Sessions; link to migration doc.

