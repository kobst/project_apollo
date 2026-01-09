# Minimal End-to-End MVP Loop (Revised v1.0.1)

This document defines the **smallest complete working pipeline** for the screenplay KG system, incorporating feedback on:
- Patch rejection / validation failure handling
- “None of the above / Try again” user flow
- Minimal edge vocabulary (MVP-locked)
- Theme/Motif handling clarity
- Whether CharacterArc can be extracted in MVP

The MVP demonstrates:

**User Input → Extraction → KG Update → OpenQuestion Derivation → Cluster Generation → User Acceptance → StoryVersion Commit**

---

## 0) Core Assumptions (Locked)

- Knowledge Graph (KG) is the **single source of truth**
- There is **no privileged starting input**; any user input is handled via the same extraction loop
- Extraction always outputs **proposed graph deltas (Patches)**, never silent mutations
- Structure is hardcoded: **15 STC beats + act mapping**
- No `StateChange` node (v1); causality via `Scene.scene_overview` + beat placement + optional `scene_tags`
- OpenQuestions are **signals**, clustered into options; user chooses directions

---

## 1) MVP-Locked Minimal Edge Vocabulary

For MVP, lock this edge/type set only:

- `INVOLVES` (Conflict → Character)
- `FULFILLS` (Scene → Beat) *(or implicit via Scene.beat_id; still define semantics)*
- `MANIFESTS_IN` (Conflict → Scene)
- `LOCATED_AT` (Scene → Location) *(alias of SET_IN)*
- `HAS_ARC` (Character → CharacterArc)

> Note: Additional edges (Theme EXPRESSED_IN, Motif APPEARS_IN) are supported by the taxonomy but **not required for MVP** unless theme extraction is enabled (see §2.4).

---

## 2) User Input (Any Time, Any Shape)

### Accepted MVP input types
- Logline / premise
- Character sketch
- Scene idea
- Conflict statement
- Theme/motif statement

**Example input used in walkthrough:**
> “A disgraced surgeon must save the president aboard Air Force One during a coup.”

---

## 3) Universal Extraction Process

### 3.1 Role of extraction
Extraction is a **proposal mechanism**:
- interpret the input
- propose nodes + edges
- package as a Patch
- provide a short human-readable summary
- do not assume the input is complete or consistent

### 3.2 MVP extraction targets (from a logline)
For MVP, the extractor *attempts*:
- Character (protagonist)
- Conflict (central)
- Location (if clear)
- Theme (optional; controlled by a toggle)
- CharacterArc (optional; controlled by a toggle)

MVP supports two extraction modes:
- **MVP-Strict:** Character + Conflict + Location only
- **MVP-Plus:** also allow Theme and/or CharacterArc when confidently detected

> Recommendation: implement **MVP-Strict** first; enable MVP-Plus behind a flag.

### 3.3 Extraction output schema
```json
ExtractionResult {
  patch: Patch,
  summary: {
    detected_entities: string[],
    notes: string,
    confidence?: number
  }
}
3.4 Theme/Motif handling in MVP (clarified)
Theme extraction is in scope only if MVP-Plus is enabled

If extracted, Theme remains FLOATING and does not need edges in MVP

Motif extraction is deferred (not necessary from a logline)

4) Initial KG State Creation
4.1 Always created at story start
StoryVersion sv_000 (root)

15 Beat nodes (beat_001..beat_015)

4.2 Nodes proposed from sample logline (MVP-Strict)
Character char_001 (“THE SURGEON”)

Conflict conf_001 (“Save the president during a coup”)

Location loc_001 (“Air Force One”)

Optional (MVP-Plus)
6. Theme theme_001 ("Redemption through duty under pressure") — ungrounded (no EXPRESSED_IN edges yet)
7. CharacterArc arc_001 linked to protagonist (redemption) — ungrounded (no turn_refs yet)

4.3 Example extraction patch (MVP-Strict)
json
Copy code
Patch patch_extract_001 {
  base_story_version_id: "sv_000",
  ops: [
    { "op": "ADD_NODE", "node": { "type": "Character", "id": "char_001", "name": "THE SURGEON",
      "description": "A disgraced surgeon seeking redemption." }},

    { "op": "ADD_NODE", "node": { "type": "Conflict", "id": "conf_001",
      "name": "Save the president during a coup",
      "conflict_type": "societal",
      "description": "A coup unfolds aboard Air Force One; the surgeon must keep the president alive.",
      "stakes": "If he fails, the president dies and the country destabilizes." }},

    { "op": "ADD_NODE", "node": { "type": "Location", "id": "loc_001", "name": "Air Force One" }},

    { "op": "ADD_EDGE", "from": "conf_001", "type": "INVOLVES", "to": "char_001" }
  ]
}
4.4 Commit extraction as canonical StoryVersion
After validation (see §6), commit:

sv_000 contains beats + extracted nodes/edges

5) OpenQuestion Derivation (First Pass)
5.1 Deterministic OpenQuestions from sparse KG
Because there are no Scenes, likely OQs include:

BeatUnrealized(Catalyst)

BeatUnrealized(BreakIntoTwo)

BeatUnrealized(Midpoint)

ConflictNeedsManifestation(conf_001) (no scenes show it yet)

5.2 Which OQ to surface first (OUTLINE_MODE policy)
MVP surfaces one OQ group to avoid overwhelm.

Selection:

Prefer STRUCTURE:BEAT:Catalyst if unrealized

Else next earliest beat unrealized

Else conflict manifestation

Chosen:

BeatUnrealized(Catalyst) → group_key STRUCTURE:BEAT:Catalyst

6) Cluster Generation (MVP)
6.1 Cluster count & “abundance” control
MVP defaults:

cluster_count_default = 4 (not 2–3)

user may request: “show me 8 clusters” (optional feature; easy parameter)

minimum displayed: 3; typical: 4–6

6.2 Scope budget (STRUCTURE / Catalyst)
json
Copy code
ScopeBudget {
  max_ops_per_move: 6,
  max_new_nodes_per_move: 2,
  allowed_node_types: ["Scene"],
  allowed_depth: "OUTLINE"
}
6.3 Clusters (example for Catalyst)
All clusters target the same OQ: BeatUnrealized(Catalyst) and differ in direction.

Cluster A: “Catalyst: Coup Ignites In-Flight”

Cluster B: “Catalyst: Medical Crisis”

Cluster C: “Catalyst: Betrayal Revealed”

Cluster D: “Catalyst: Public Crisis / Media Pressure” (optional extra)

Each cluster contains 2–4 moves in MVP.

7) User Decision Flow (Acceptance + Rejection)
7.1 User choices (MVP required)
User can:

Accept one or more moves

Reject individual moves

Reject all / None of the above

Try again (regenerate clusters)

(Optional) adjust cluster_count before regeneration

8) Patch Application + Validation (Success & Failure)
8.1 Staging
When user selects a move:

create staging workspace from current StoryVersion

apply patch ops in order

8.2 Deterministic validation (MVP checks)
Validate:

Node schemas minimally satisfied (required fields exist)

Edges reference existing node IDs

If Scene is added:

has scene_overview non-empty

has beat_id set

has at least one LOCATED_AT edge OR location parse is available

has at least one HAS_CHARACTER edge (optional to enforce in MVP; recommended)

8.3 Failure handling (NEW)
If validation fails:

do not commit

patch remains unapplied

return a structured error list:

json
Copy code
ValidationError {
  code: string,
  message: string,
  node_id?: string,
  field?: string,
  suggested_fix?: string
}
System then offers:

“Auto-fix patch” (generate 1–2 fix-moves)

“Let me edit manually”

“Discard patch”

Default MVP behavior: show errors + offer Regenerate or Auto-fix.

9) Commit Success Path
9.1 Commit
If staging + validation pass:

create StoryVersion sv_001 with parent = current version

persist KG snapshot or diff chain

record provenance:

which cluster/move created the patch

9.2 Example: Accepted Move adds Scene for Catalyst
Patch adds:

Scene scene_001

LOCATED_AT(scene_001 → loc_001)

HAS_CHARACTER(scene_001 → char_001)

FULFILLS(scene_001 → beat_catalyst) (or implicit via beat_id)

sv_001 summary:

“Catalyst established via medical crisis forcing protagonist into action.”

10) “None of the Above / Try Again” Flow (NEW)
If user rejects all:

KG does not change

system offers:

Regenerate clusters (same OQ, higher diversity)

Change target (pick a different OQ group)

Add more input (user provides another seed; run extraction again)

Increase cluster count (e.g., from 4 to 8)

MVP simplest implementation:

Regenerate clusters for same OQ with a new random seed + enforced diversity tags.

11) Loop Continuation (After One Cycle)
11.1 Next OQ selection
After commit, re-derive OQs deterministically.
OUTLINE_MODE selects:

next earliest unrealized beat (Debate or BreakIntoTwo)
OR

conflict manifestation if structure is progressing but conflict still “not shown”

11.2 OUTLINE → DRAFT transition
Remain in OUTLINE_MODE until:

Scenes exist for anchor beats:

Catalyst, BreakIntoTwo, Midpoint, AllIsLost, Finale

and total scenes ≥ ~8–12

Then enter DRAFT_MODE:

add scene quality OQs

add CharacterArc OQs more aggressively

allow Theme grounding clusters by default

12) MVP Walkthrough Summary (Implementable)
User provides any input (logline used here)

Extract → Patch (Character, Conflict, Location; optional Theme/Arc via flag)

Validate patch; if OK, commit sv_000 (beats + extracted nodes)

Derive OQs; select BeatUnrealized(Catalyst) group

Generate 4 clusters, 2–4 moves each (bounded patches adding 1 Catalyst scene)

User accepts a move:

stage patch

validate

commit sv_001

Re-derive OQs for next cycle (stop here for MVP demo)

If user rejects all:

regenerate clusters or accept more input and re-run extraction

13) MVP Success Criteria
The MVP is successful if it demonstrates:

universal extraction at any time (no “special start”)

patch-based updates with validation & failure reporting

“reject all / try again” regeneration

deterministic OpenQuestion derivation

cluster-based exploration

StoryVersion branching/commit semantics

One-Sentence Summary
Any user input becomes a proposed patch; the system surfaces structural gaps; the AI explores bounded options; the human selects or rejects; the story advances only through validated commits.

makefile
Copy code
::contentReference[oaicite:0]{index=0}