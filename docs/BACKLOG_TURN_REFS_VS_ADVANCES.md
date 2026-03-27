# Backlog: Resolve turn_refs vs ADVANCES Duality

## Problem

CharacterArc progression is represented in two independent ways that can drift apart:

1. **`turn_refs[]`** — An embedded array on the CharacterArc node containing `{beat_id, scene_id, notes}`. This is character-centric: "this arc progresses at these moments."

2. **`ADVANCES` edge** (PlotPoint → CharacterArc) — A first-class graph edge. This is PlotPoint-centric: "this plot point advances this character's arc."

3. **`HAS_TURN_IN`** — Referenced in the spec (nodeTaxonomy.md section 3) but never implemented in code.

## Why This Matters

- An AI generates a PlotPoint with an `ADVANCES` edge but doesn't update `turn_refs` on the CharacterArc.
- A user manually adds a `turn_ref` and no corresponding `ADVANCES` edge exists.
- No validation rule keeps them in sync.
- Queries give different answers depending on which representation is consulted.

## Recommended Resolution

Drop `turn_refs` in favor of `ADVANCES` edges. Rationale:

- Consistent with the graph-first model (edges are first-class entities with provenance, status, properties).
- Eliminates embedded FK arrays that bypass edge validation.
- `ADVANCES` edges can carry properties like `notes` (replacing `turn_ref.notes`).
- `turn_ref.beat_id` and `turn_ref.scene_id` can be derived by traversing from the PlotPoint's `alignedBeatId` and `REALIZED_BY` edges.

## Migration Steps (when implemented)

1. For each CharacterArc with `turn_refs`:
   - Find or create PlotPoints corresponding to the referenced beats/scenes
   - Create `ADVANCES` edges from those PlotPoints to the CharacterArc
   - Carry over `notes` as edge properties
2. Remove `turn_refs` field from CharacterArc interface
3. Remove `turn_refs` FK integrity checks from validator
4. Update AI prompts to use `ADVANCES` edges instead of `turn_refs`

## Priority

Medium — not blocking, but will cause subtle data inconsistencies over time if left unresolved.
