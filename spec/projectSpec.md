# Screenplay Knowledge Graph v1.0.0 — Reference Contract

**Version:** 1.0.0  
**Date:** 2026-01-01  
**Status:** LOCKED FOR MVP  

**Purpose:** This is the authoritative v1 contract for all downstream implementation:
- Agents / MCP tools
- Neo4j schema (labels, properties, constraints)
- Validation rules (pre-commit checks)
- Patch ops format
- OpenQuestion catalog

This spec is **implementable** and intentionally **unambiguous**.

---

## 0) Global Conventions

### 0.1 IDs
- All nodes use string `id` as primary identifier.
- Recommended format: `<type_prefix>_<ULID|UUID>`.
- IDs are globally unique across node types.

### 0.2 Timestamps
- Use ISO-8601 strings (UTC), e.g. `"2026-01-01T03:21:00Z"`.

### 0.3 Modes / Phases
Phases appear in OpenQuestions and tooling decisions:
- `OUTLINE` — Beat structure and scene placement
- `DRAFT` — Scene content, characters, locations fleshed out
- `REVISION` — Polish, thematic grounding, arc completion

### 0.4 Severity Levels
Used in OpenQuestions to prioritize surfacing:
- `BLOCKING` — Must resolve before commit; prevents forward progress
- `IMPORTANT` — Surfaced prominently; should resolve before phase transition
- `SOFT` — Background suggestion; may remain unresolved

### 0.5 Node Labels (Neo4j)
Use node type names as labels: `(:Scene)`, `(:Beat)`, etc.

### 0.6 Edge Uniqueness
Edges are unique by (type, from, to). Duplicate edges with identical type/from/to are not permitted.

---

# 1) Node Definitions (14)

For each node:
- **Fields:** name, type, required/optional, description
- **Constraints:** keys, enums, ranges
- **Example:** concrete JSON

---

## 1.1 StoryVersion

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Unique version id |
| parent_story_version_id | string \\| null | ✅ | Parent version id; null for root |
| created_at | string (ISO-8601) | ✅ | Creation time |
| label | string | ✅ | Short human-readable label |
| summary | string | ❌ | Summary of changes |
| logline | string | ❌ | Optional stored logline |
| premise | string | ❌ | Optional premise/synopsis |
| genre_tone | string | ❌ | Optional tone/genre notes |
| tags | string[] | ❌ | Version tags |
| author_notes | string | ❌ | Notes |

### Constraints
- `id` unique.
- `parent_story_version_id` must reference an existing StoryVersion (except null root).
- `label` length 1–120.
- No cycles in StoryVersion ancestry (DAG enforced).

### Example
```json
{
  "type": "StoryVersion",
  "id": "sv_01J0XYZABC",
  "parent_story_version_id": null,
  "created_at": "2026-01-01T03:21:00Z",
  "label": "Initial premise",
  "summary": "Seeded beats + extracted protagonist/conflict/location.",
  "logline": "A disgraced surgeon must save the president aboard Air Force One during a coup.",
  "tags": ["outline_mode"]
}
```

---

## 1.2 MoveCluster

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Cluster id |
| base_story_version_id | string | ✅ | StoryVersion used as base |
| created_at | string | ✅ | Generation time |
| title | string | ✅ | Cluster display title |
| description | string | ❌ | Optional description |
| cluster_type | string (enum) | ❌ | Category of cluster |
| primary_open_question_id | string | ❌ | Primary OQ id (if generated from OQs) |
| supporting_open_question_ids | string[] | ❌ | Supporting OQs |
| scope_budget | object | ✅ | Scope budget controlling move size |
| status | string (enum) | ❌ | PROPOSED/ARCHIVED |

### Enums
- `cluster_type`: STRUCTURE, SCENE_LIST, SCENE_QUALITY, CONFLICT, CHARACTER, THEME, MOTIF
- `status`: PROPOSED, ARCHIVED

### ScopeBudget Schema (required)
```json
{
  "max_ops_per_move": "integer (1..20)",
  "max_new_nodes_per_move": "integer (0..10)",
  "allowed_node_types": "string[] (subset of node types)",
  "allowed_depth": "OUTLINE | DRAFT | REVISION"
}
```

### Constraints
- `id` unique.
- `base_story_version_id` must exist.
- `title` length 1–120.
- `scope_budget.max_ops_per_move` 1–20.
- `scope_budget.max_new_nodes_per_move` 0–10.

### Example
```json
{
  "type": "MoveCluster",
  "id": "mc_01J0XYZDEF",
  "base_story_version_id": "sv_01J0XYZABC",
  "created_at": "2026-01-01T03:25:00Z",
  "title": "Catalyst options: Medical crisis",
  "cluster_type": "STRUCTURE",
  "primary_open_question_id": "oq_01J0OQCATA",
  "supporting_open_question_ids": [],
  "scope_budget": {
    "max_ops_per_move": 6,
    "max_new_nodes_per_move": 2,
    "allowed_node_types": ["Scene"],
    "allowed_depth": "OUTLINE"
  },
  "status": "PROPOSED"
}
```

---

## 1.3 NarrativeMove

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Move id |
| cluster_id | string | ✅ | Parent MoveCluster id |
| patch_id | string | ✅ | Patch id |
| title | string | ✅ | Short title |
| rationale | string | ✅ | Why this move helps |
| created_at | string | ✅ | Creation time |
| expected_effects | string[] | ❌ | UX-facing expected impact |
| move_style_tags | string[] | ❌ | Diversity enforcement tags |
| resolves_open_question_ids | string[] | ❌ | OQs this move resolves |
| introduces_open_question_ids | string[] | ❌ | OQs introduced |
| confidence | number | ❌ | 0..1 |
| status | string (enum) | ❌ | PROPOSED/ACCEPTED/REJECTED |
| human_edits | string | ❌ | Freeform notes from user |

### Enums
- `status`: PROPOSED, ACCEPTED, REJECTED

### Constraints
- `cluster_id` must exist.
- `patch_id` must exist.
- `title` length 1–140.
- `confidence` if present: 0.0–1.0.

### Example
```json
{
  "type": "NarrativeMove",
  "id": "mv_01J0XYZGHI",
  "cluster_id": "mc_01J0XYZDEF",
  "patch_id": "patch_01J0XYZP01",
  "title": "Catalyst: President collapses; surgeon is only qualified doctor",
  "rationale": "Creates immediate necessity and forces the protagonist into action under pressure.",
  "created_at": "2026-01-01T03:25:30Z",
  "expected_effects": ["Resolves BeatUnrealized(Catalyst)", "Introduces protagonist agency"],
  "move_style_tags": ["medical-crisis", "protagonist-driven", "ticking-clock"],
  "status": "PROPOSED",
  "confidence": 0.72
}
```

---

## 1.4 Patch

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Patch id |
| base_story_version_id | string | ✅ | Version patch applies to |
| created_at | string | ✅ | Created time |
| ops | object[] | ✅ | Ordered ops list |
| metadata | object | ❌ | Generator metadata |
| notes | string | ❌ | Notes |

### Constraints
- `base_story_version_id` must exist.
- `ops.length` 1–200 (MVP typical ≤ 20).
- Each op must match one of the op schemas (see §5).

### Example
```json
{
  "type": "Patch",
  "id": "patch_01J0XYZP01",
  "base_story_version_id": "sv_01J0XYZABC",
  "created_at": "2026-01-01T03:25:20Z",
  "ops": [
    {
      "op": "ADD_NODE",
      "node": {
        "type": "Scene",
        "id": "scene_01J0SC001",
        "heading": "INT. AIR FORCE ONE – MEDICAL BAY – DAY",
        "scene_overview": "The president collapses mid-flight. Guards suspect sabotage. The disgraced surgeon is forced to stabilize him as panic spreads.",
        "beat_id": "beat_CATALYST",
        "order_index": 1,
        "scene_tags": ["INTRO_CHARACTER", "ESCALATION"]
      }
    },
    {
      "op": "ADD_EDGE",
      "edge": { "type": "LOCATED_AT", "from": "scene_01J0SC001", "to": "loc_01J0LOC001" }
    },
    {
      "op": "ADD_EDGE",
      "edge": { "type": "HAS_CHARACTER", "from": "scene_01J0SC001", "to": "char_01J0CHAR01" }
    }
  ]
}
```

---

## 1.5 Beat

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Beat id |
| beat_type | string (enum) | ✅ | STC beat type |
| act | integer (1..5) | ✅ | Film Crit Hulk act |
| position_index | integer (1..15) | ✅ | 1–15 order |
| guidance | string | ❌ | Optional guidance text |
| status | string (enum) | ❌ | EMPTY/PLANNED/REALIZED |
| notes | string | ❌ | Notes |

### Enums
- `beat_type` (15): OpeningImage, ThemeStated, Setup, Catalyst, Debate, BreakIntoTwo, BStory, FunAndGames, Midpoint, BadGuysCloseIn, AllIsLost, DarkNightOfSoul, BreakIntoThree, Finale, FinalImage
- `status`: EMPTY, PLANNED, REALIZED

### Constraints
- Exactly 15 beats per StoryVersion.
- Within a StoryVersion: `position_index` unique 1..15.
- Within a StoryVersion: `beat_type` unique.

### Example
```json
{
  "type": "Beat",
  "id": "beat_CATALYST",
  "beat_type": "Catalyst",
  "act": 1,
  "position_index": 4,
  "status": "EMPTY",
  "guidance": "The event that launches the story problem and forces motion."
}
```

---

## 1.6 Scene

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Scene id |
| heading | string | ✅ | Raw scene heading |
| scene_overview | string | ✅ | Narrative summary (v1 causal carrier) |
| beat_id | string | ⚠️ | **DEPRECATED** - Use PlotPoint attachment instead |
| order_index | integer (>=1) | ❌ | Auto-computed screenplay order (see Ordering) |
| int_ext | string (enum) | ❌ | INT/EXT/OTHER |
| time_of_day | string | ❌ | DAY/NIGHT/UNKNOWN/freeform |
| mood | string | ❌ | Mood |
| key_actions | string[] | ❌ | Bullet actions |
| notable_dialogue | string[] | ❌ | Notable lines (v1; no DialogueLine nodes) |
| scene_tags | string[] (enum) | ❌ | Lightweight outcome tags |
| status | string (enum) | ❌ | DRAFT/REVISED |
| source_provenance | string (enum) | ❌ | USER/AI/MIXED |

### Enums
- `int_ext`: INT, EXT, OTHER
- `scene_tags` (MVP set): SETUP, PAYOFF, REVEAL, REVERSAL, DECISION, ESCALATION, LOSS, VICTORY, INTRO_CHARACTER, INTRO_OBJECT, TURNING_POINT
- `status`: DRAFT, REVISED
- `source_provenance`: USER, AI, MIXED

### Constraints
- `beat_id` (**deprecated**): Previously required to reference a Beat. Now optional; prefer using PlotPoint attachment via SATISFIED_BY edge.
- `order_index`: Optional integer ≥ 1. Auto-computed when Scene is attached to a PlotPoint via SATISFIED_BY edge. Undefined for unattached scenes.
- `scene_overview` length 20–2000 (recommended).

### Scene Ordering (Auto-computed)
Scenes get their `order_index` automatically based on their PlotPoint attachment:
1. Scene is attached to PlotPoint via `SATISFIED_BY` edge
2. PlotPoint is attached to Beat via `ALIGNS_WITH` edge
3. Order is computed: Beat position → PlotPoint order → Scene order within PlotPoint
4. Unattached scenes have `order_index = undefined`

### Note on FULFILLS Edge (Deprecated)
The `beat_id` field implicitly creates the FULFILLS relationship. This approach is **deprecated**.
New implementations should use PlotPoints with SATISFIED_BY edges instead.

### Example
```json
{
  "type": "Scene",
  "id": "scene_01J0SC001",
  "heading": "INT. AIR FORCE ONE – MEDICAL BAY – DAY",
  "scene_overview": "The president collapses mid-flight. Guards suspect sabotage. The disgraced surgeon is forced to stabilize him as panic spreads.",
  "beat_id": "beat_CATALYST",
  "order_index": 1,
  "int_ext": "INT",
  "time_of_day": "DAY",
  "scene_tags": ["INTRO_CHARACTER", "ESCALATION"],
  "status": "DRAFT",
  "source_provenance": "AI"
}
```

---

## 1.7 Character

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Character id |
| name | string | ✅ | Name |
| description | string | ❌ | Brief description |
| archetype | string | ❌ | Archetype label |
| traits | string[] | ❌ | Traits list |
| notes | string | ❌ | Notes |
| status | string (enum) | ❌ | ACTIVE/INACTIVE |

### Enums
- `status`: ACTIVE, INACTIVE

### Constraints
- Within a StoryVersion: `name` should be unique (case-insensitive) recommended.
- `name` length 1–80.

### Example
```json
{
  "type": "Character",
  "id": "char_01J0CHAR01",
  "name": "THE SURGEON",
  "description": "A disgraced surgeon seeking redemption.",
  "archetype": "Reluctant Hero",
  "traits": ["skilled", "haunted", "stubborn"],
  "status": "ACTIVE"
}
```

---

## 1.8 Location

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Location id |
| name | string | ✅ | Name |
| parent_location_id | string \\| null | ❌ | Parent location |
| description | string | ❌ | Description |
| tags | string[] | ❌ | Tags |

### Constraints
- `parent_location_id` must reference an existing Location if not null.
- Within a StoryVersion: `name` unique recommended.

### Example
```json
{
  "type": "Location",
  "id": "loc_01J0LOC001",
  "name": "Air Force One",
  "parent_location_id": null,
  "description": "A flying fortress with tight security and limited medical resources."
}
```

---

## 1.9 Object

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Object id |
| name | string | ✅ | Object name |
| description | string | ❌ | Description |
| significance | string | ❌ | Why it matters |
| introduced_in_scene_id | string | ❌ | Scene id |
| tags | string[] | ❌ | Tags |

### Constraints
- `introduced_in_scene_id` must reference an existing Scene if present.
- Within a StoryVersion: `name` unique recommended.

### Example
```json
{
  "type": "Object",
  "id": "obj_01J0OBJ001",
  "name": "Defibrillator",
  "description": "Portable defibrillator in the medical bay.",
  "significance": "Critical tool during emergency treatment.",
  "tags": ["medical"]
}
```

---

## 1.10 Theme

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Theme id |
| statement | string | ✅ | Thematic statement |
| notes | string | ❌ | Notes |
| priority | string (enum) | ❌ | HIGH/MED/LOW |
| status | string (enum) | ❌ | FLOATING/GROUNDED |

### Enums
- `priority`: HIGH, MED, LOW
- `status`: FLOATING, GROUNDED

### Constraints
- `statement` length 5–240.

### Example
```json
{
  "type": "Theme",
  "id": "theme_01J0TH001",
  "statement": "Redemption through duty under pressure.",
  "priority": "HIGH",
  "status": "FLOATING"
}
```

---

## 1.11 Motif

**Note:** Motif encompasses recurring patterns, images, and symbols. Explicit "Symbol" nodes are not separated in v1; symbolic elements should be modeled as Motifs with appropriate description.

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Motif id |
| name | string | ✅ | Motif label |
| description | string | ❌ | Description |
| motif_type | string (enum) | ❌ | PATTERN/IMAGE/SYMBOL |
| status | string (enum) | ❌ | FLOATING/GROUNDED |

### Enums
- `motif_type`: PATTERN, IMAGE, SYMBOL
- `status`: FLOATING, GROUNDED

### Constraints
- `name` length 1–80.

### Example
```json
{
  "type": "Motif",
  "id": "motif_01J0M001",
  "name": "Heartbeat alarms",
  "description": "Recurring medical beeps that punctuate tension.",
  "motif_type": "PATTERN",
  "status": "FLOATING"
}
```

---

## 1.12 CharacterArc

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Arc id |
| character_id | string | ✅ | Character id (FK) |
| arc_type | string | ❌ | Transformation/Fall/etc |
| start_state | string | ❌ | Starting condition |
| end_state | string | ❌ | Ending condition |
| turn_refs | object[] | ❌ | Beat/Scene references |
| status | string (enum) | ❌ | FLOATING/PARTIAL/GROUNDED |

### turn_refs Schema
```json
{
  "beat_id": "string (optional)",
  "scene_id": "string (optional)",
  "note": "string (optional)"
}
```
**Constraint:** At least one of `beat_id` or `scene_id` must be present per turn_ref entry.

### Enums
- `status`: FLOATING, PARTIAL, GROUNDED

### Constraints
- `character_id` must exist.
- Recommended: max 20 turn_refs.

### Example
```json
{
  "type": "CharacterArc",
  "id": "arc_01J0A001",
  "character_id": "char_01J0CHAR01",
  "arc_type": "Transformation",
  "start_state": "Disgraced, avoids responsibility.",
  "end_state": "Redeemed by choosing duty over fear.",
  "turn_refs": [
    { "beat_id": "beat_CATALYST", "note": "Forced back into medicine under threat." },
    { "beat_id": "beat_ALL_IS_LOST", "note": "Failure seems inevitable; must choose to persist." }
  ],
  "status": "FLOATING"
}
```

---

## 1.13 Conflict

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | Conflict id |
| name | string | ✅ | Short display name |
| conflict_type | string (enum) | ✅ | Conflict category |
| description | string | ✅ | What the conflict is |
| stakes | string | ❌ | Stakes |
| intensity | integer (1..5) | ❌ | Intensity |
| status | string (enum) | ❌ | FLOATING/ACTIVE/RESOLVED |
| start_beat_id | string | ❌ | Beat id |
| end_beat_id | string | ❌ | Beat id |
| notes | string | ❌ | Notes |

### Enums
- `conflict_type`: interpersonal, internal, societal, ideological, systemic, nature, technological
- `status`: FLOATING, ACTIVE, RESOLVED

### Constraints
- `description` length 20–2000.
- `intensity` 1–5.
- `start_beat_id`/`end_beat_id` must reference Beats if present.

### Example
```json
{
  "type": "Conflict",
  "id": "conf_01J0C001",
  "name": "Save the president during a coup",
  "conflict_type": "societal",
  "description": "A coup unfolds aboard Air Force One; the surgeon must keep the president alive while traitors seize control.",
  "stakes": "If he fails, the president dies and the country destabilizes.",
  "intensity": 5,
  "status": "ACTIVE",
  "start_beat_id": "beat_CATALYST"
}
```

---

## 1.14 PlotPoint

PlotPoints are intermediate narrative units that bridge Beats and Scenes. They represent specific story points or events that must be satisfied by one or more Scenes.

### Fields
| Field | Type | Req? | Description |
|---|---|:---:|---|
| id | string | ✅ | PlotPoint id |
| title | string | ✅ | Short descriptive title |
| description | string | ❌ | Detailed description of the plot point |
| order_index | integer (>=1) | ❌ | Auto-computed based on Beat attachment |
| status | string (enum) | ❌ | UNSATISFIED/SATISFIED |
| notes | string | ❌ | Notes |

### Enums
- `status`: UNSATISFIED, SATISFIED

### Constraints
- `title` length 1–120.
- `order_index`: Optional integer ≥ 1. Auto-computed when attached to a Beat via ALIGNS_WITH edge. Undefined for unattached PlotPoints.

### PlotPoint Ordering (Auto-computed)
PlotPoints get their `order_index` automatically based on Beat attachment:
1. PlotPoint is attached to Beat via `ALIGNS_WITH` edge
2. Order is determined by Beat's `position_index` (1-15 for STC beats)
3. Multiple PlotPoints on the same Beat are ordered by: edge createdAt → PlotPoint createdAt → ID
4. Unattached PlotPoints have `order_index = undefined`

### Example
```json
{
  "type": "PlotPoint",
  "id": "pp_01J0PP001",
  "title": "President collapses",
  "description": "The president suddenly collapses during the flight, creating the inciting incident.",
  "order_index": 4,
  "status": "SATISFIED"
}
```

---

# 2) Edge Type Vocabulary (MVP)

### Edge Object Schema
```json
{
  "type": "<EDGE_TYPE>",
  "from": "<node_id>",
  "to": "<node_id>"
}
```

**Global constraint:** Edges are unique by (type, from, to). No duplicates.

---

## 2.1 FULFILLS (Deprecated)
| Property | Value |
|---|---|
| Source → Target | Scene → Beat |
| Cardinality | many-to-one |
| Required | ⚠️ Deprecated - use PlotPoint hierarchy instead |
| Meaning | Scene is assigned to and realizes that Beat |

**Note:** This edge is *derived* from Scene.beat_id. This approach is **deprecated**.
New implementations should use PlotPoints with ALIGNS_WITH and SATISFIED_BY edges.

---

## 2.2 ALIGNS_WITH
| Property | Value |
|---|---|
| Source → Target | PlotPoint → Beat |
| Cardinality | many-to-one |
| Required | ❌ Optional (PlotPoints may be unattached) |
| Meaning | PlotPoint aligns with this Beat in the story structure |

**Note:** When a PlotPoint has an ALIGNS_WITH edge to a Beat, its `order_index` is auto-computed based on the Beat's `position_index`.

---

## 2.3 SATISFIED_BY
| Property | Value |
|---|---|
| Source → Target | PlotPoint → Scene |
| Cardinality | one-to-many |
| Required | ❌ Optional |
| Meaning | Scene satisfies/realizes this PlotPoint |

**Note:** When a Scene is attached via SATISFIED_BY, its `order_index` is auto-computed based on the PlotPoint's order and position within the PlotPoint.

---

## 2.5 HAS_CHARACTER
| Property | Value |
|---|---|
| Source → Target | Scene → Character |
| Cardinality | many-to-many |
| Required | ✅ Recommended (enforced in DRAFT) |
| Meaning | Character appears/participates in Scene |

---

## 2.6 LOCATED_AT
| Property | Value |
|---|---|
| Source → Target | Scene → Location |
| Cardinality | many-to-one |
| Required | ✅ Recommended (enforced in DRAFT) |
| Meaning | Scene's primary location |

---

## 2.7 FEATURES_OBJECT
| Property | Value |
|---|---|
| Source → Target | Scene → Object |
| Cardinality | many-to-many |
| Required | ❌ Optional |
| Meaning | Object/prop appears meaningfully in Scene |

---

## 2.8 INVOLVES
| Property | Value |
|---|---|
| Source → Target | Conflict → Character |
| Cardinality | many-to-many |
| Required | ❌ Optional in OUTLINE, ✅ Required in DRAFT |
| Meaning | Character is a party to the conflict |

---

## 2.9 MANIFESTS_IN
| Property | Value |
|---|---|
| Source → Target | Conflict → Scene |
| Cardinality | many-to-many |
| Required | ❌ Optional in OUTLINE, ✅ Expected in DRAFT |
| Meaning | Scene shows the conflict in action |

---

## 2.10 HAS_ARC
| Property | Value |
|---|---|
| Source → Target | Character → CharacterArc |
| Cardinality | one-to-many |
| Required | ❌ Optional (rule-based after threshold) |
| Meaning | This arc belongs to the character |

---

## 2.11 EXPRESSED_IN
| Property | Value |
|---|---|
| Source → Target | Theme → Scene OR Theme → Beat |
| Cardinality | many-to-many |
| Required | ❌ Optional (Themes may float) |
| Meaning | Theme is evidenced by a beat or scene |

---

## 2.12 APPEARS_IN
| Property | Value |
|---|---|
| Source → Target | Motif → Scene |
| Cardinality | many-to-many |
| Required | ❌ Optional (Motifs may float) |
| Meaning | Motif appears in the Scene |

---

# 3) Structural Constraints

## 3.1 Beat Structure (Save the Cat)
- Exactly **15 Beat nodes** per StoryVersion.
- Each beat has a unique `position_index` 1..15 and unique `beat_type`.

## 3.2 Act Assignments (Film Crit Hulk 5-Act)

| STC Beat | position_index | Act |
|---|:---:|:---:|
| OpeningImage | 1 | 1 |
| ThemeStated | 2 | 1 |
| Setup | 3 | 1 |
| Catalyst | 4 | 1 |
| Debate | 5 | 1 |
| BreakIntoTwo | 6 | 2 |
| BStory | 7 | 2 |
| FunAndGames | 8 | 2 |
| Midpoint | 9 | 3 |
| BadGuysCloseIn | 10 | 3 |
| AllIsLost | 11 | 4 |
| DarkNightOfSoul | 12 | 4 |
| BreakIntoThree | 13 | 5 |
| Finale | 14 | 5 |
| FinalImage | 15 | 5 |

## 3.3 Scene–Beat Rules
- Each Scene **MUST** be assigned to exactly one Beat via `Scene.beat_id`.
- A Beat **MAY** have:
  - Zero scenes (early outline)
  - One scene (typical MVP)
  - Multiple scenes (allowed)

## 3.4 Floating Nodes (Theme / Motif)
- Themes and Motifs may exist unattached (`status=FLOATING`).
- Grounding edges are optional:
  - Theme → EXPRESSED_IN → Scene/Beat
  - Motif → APPEARS_IN → Scene
- Validation does **not** fail due to unattached Theme/Motif.

---

# 4) Validation Rules (Pre-Commit)

Validation runs on a staged graph after applying a Patch. A Patch may be committed only if all checks pass.

## 4.1 Universal Checks (all patches)
- All referenced node IDs exist (FK integrity) after applying ops.
- No duplicate node IDs.
- No edges with unknown types.
- Edge endpoints match allowed source/target node types.
- No duplicate edges (same type, from, to).

## 4.2 Node-Type Checks

### StoryVersion
- Required fields present
- Parent exists if non-null
- No cycles in ancestry (DAG)

### Beat
- `beat_type` valid enum
- `act` 1..5
- `position_index` 1..15
- Within StoryVersion: (beat_type, position_index) unique
- StoryVersion must contain exactly 15 beats

### Scene
- Required fields: id, heading, scene_overview, beat_id, order_index
- `beat_id` references existing Beat
- `order_index` ≥ 1
- Exactly one Beat per Scene
- **DRAFT enforcement:** at least one HAS_CHARACTER edge, exactly one LOCATED_AT edge

### Character
- Required: id, name

### Location
- Required: id, name
- `parent_location_id` references existing Location if present

### Object
- Required: id, name
- `introduced_in_scene_id` references Scene if present

### Theme
- Required: id, statement
- `statement` length 5–240

### Motif
- Required: id, name

### CharacterArc
- Required: id, character_id
- `character_id` references Character
- For each turn_ref: at least one of beat_id/scene_id; referenced nodes must exist

### Conflict
- Required: id, name, conflict_type, description
- `conflict_type` valid enum
- `intensity` (if present) 1..5
- `start_beat_id`/`end_beat_id` reference Beats if present

## 4.3 Business Rules (MVP)
- If a Scene has HAS_CHARACTER edges, each Character must exist.
- If a Conflict has MANIFESTS_IN edges, each Scene must exist.
- If a Character has HAS_ARC edge, the referenced CharacterArc.character_id must match.

## 4.4 Validation Error Response Schema

When validation fails, return:
```json
{
  "success": false,
  "errors": [
    {
      "code": "FK_INTEGRITY",
      "message": "Referenced node does not exist",
      "node_id": "char_INVALID",
      "field": "beat_id",
      "op_index": 2
    },
    {
      "code": "MISSING_REQUIRED",
      "message": "Required field missing",
      "node_type": "Scene",
      "field": "scene_overview",
      "op_index": 0
    }
  ]
}
```

### Error Codes
| Code | Description |
|---|---|
| FK_INTEGRITY | Foreign key reference to non-existent node |
| MISSING_REQUIRED | Required field not provided |
| INVALID_ENUM | Value not in allowed enum set |
| DUPLICATE_ID | Node ID already exists |
| DUPLICATE_EDGE | Edge with same (type, from, to) exists |
| CONSTRAINT_VIOLATION | Business rule or structural constraint failed |
| INVALID_TYPE | Field type mismatch |
| OUT_OF_RANGE | Numeric value outside allowed range |

---

# 5) Patch Operations Reference

## 5.1 Common Op Envelope
```json
{
  "op": "<OP_NAME>",
  ...
}
```

## 5.2 ADD_NODE

### Schema
```json
{
  "op": "ADD_NODE",
  "node": {
    "type": "<NodeType>",
    "id": "<string>",
    "...": "fields"
  }
}
```

### Example
```json
{
  "op": "ADD_NODE",
  "node": {
    "type": "Theme",
    "id": "theme_01J0TH001",
    "statement": "Redemption through duty under pressure.",
    "status": "FLOATING"
  }
}
```

## 5.3 UPDATE_NODE

### Schema
```json
{
  "op": "UPDATE_NODE",
  "id": "<node_id>",
  "set": {
    "<field>": "<value>"
  },
  "unset": ["<field>"]
}
```

### Constraints
- Cannot update `id` or `type`.
- Values must respect node field types/enums.

### Example
```json
{
  "op": "UPDATE_NODE",
  "id": "scene_01J0SC001",
  "set": {
    "mood": "claustrophobic",
    "status": "REVISED"
  },
  "unset": []
}
```

## 5.4 DELETE_NODE

### Schema
```json
{
  "op": "DELETE_NODE",
  "id": "<node_id>"
}
```

### Constraints
- Deleting a node must also remove incident edges OR fail validation unless edges are deleted in same patch.

### Example
```json
{
  "op": "DELETE_NODE",
  "id": "obj_01J0OBJ001"
}
```

## 5.5 ADD_EDGE

### Schema
```json
{
  "op": "ADD_EDGE",
  "edge": {
    "type": "<EDGE_TYPE>",
    "from": "<node_id>",
    "to": "<node_id>"
  }
}
```

### Example
```json
{
  "op": "ADD_EDGE",
  "edge": {
    "type": "MANIFESTS_IN",
    "from": "conf_01J0C001",
    "to": "scene_01J0SC001"
  }
}
```

## 5.6 DELETE_EDGE

### Schema
```json
{
  "op": "DELETE_EDGE",
  "edge": {
    "type": "<EDGE_TYPE>",
    "from": "<node_id>",
    "to": "<node_id>"
  }
}
```

### Example
```json
{
  "op": "DELETE_EDGE",
  "edge": {
    "type": "HAS_CHARACTER",
    "from": "scene_01J0SC001",
    "to": "char_01J0CHAR01"
  }
}
```

---

# 6) OpenQuestion Type Catalog (v1)

OpenQuestions are derived deterministically from the current StoryVersion graph state.

Each type includes:
- **Trigger:** Condition that generates the question
- **Severity:** BLOCKING / IMPORTANT / SOFT
- **Phase:** When typically surfaced
- **Group key:** Canonical grouping identifier

---

## 6.1 STRUCTURE Domain

### BeatUnrealized
| Property | Value |
|---|---|
| Trigger | Beat exists with 0 Scenes fulfilling it |
| Severity | IMPORTANT (BLOCKING if "lock outline" enabled) |
| Phase | OUTLINE |
| Group key | `STRUCTURE:BEAT:<beat_type>` |

### ActImbalance
| Property | Value |
|---|---|
| Trigger | Total scenes in an act == 0 while neighboring acts have ≥ 2 |
| Severity | IMPORTANT |
| Phase | OUTLINE |
| Group key | `STRUCTURE:ACT:<act>` |

### SceneUnplaced
| Property | Value |
|---|---|
| Trigger | Scene exists with missing/invalid beat assignment |
| Severity | BLOCKING |
| Phase | OUTLINE |
| Group key | `SCENE:UNPLACED` |

---

## 6.2 SCENE Domain

### SceneNeedsOverview
| Property | Value |
|---|---|
| Trigger | Scene.scene_overview missing or < 20 chars |
| Severity | BLOCKING |
| Phase | DRAFT |
| Group key | `SCENE:QUALITY:<scene_id>` |

### SceneHasNoCast
| Property | Value |
|---|---|
| Trigger | Scene has 0 HAS_CHARACTER edges |
| Severity | IMPORTANT (BLOCKING in DRAFT_MODE) |
| Phase | DRAFT |
| Group key | `SCENE:QUALITY:<scene_id>` |

### SceneNeedsLocation
| Property | Value |
|---|---|
| Trigger | Scene has 0 LOCATED_AT edges |
| Severity | IMPORTANT |
| Phase | DRAFT |
| Group key | `SCENE:QUALITY:<scene_id>` |

---

## 6.3 CHARACTER Domain

### CharacterUnderspecified
| Property | Value |
|---|---|
| Trigger | Character has no description and appears in ≥ 2 scenes |
| Severity | SOFT |
| Phase | OUTLINE/DRAFT |
| Group key | `CHARACTER:DETAIL:<character_id>` |

### MissingCharacterArc
| Property | Value |
|---|---|
| Trigger | Character appears in ≥ 3 scenes and has no HAS_ARC edge |
| Severity | IMPORTANT |
| Phase | DRAFT |
| Group key | `CHARACTER:ARC:<character_id>` |

### ArcUngrounded
| Property | Value |
|---|---|
| Trigger | CharacterArc exists with 0 turn_refs |
| Severity | SOFT |
| Phase | REVISION |
| Group key | `CHARACTER:ARC:<character_id>` |

---

## 6.4 CONFLICT Domain

### ConflictNeedsParties
| Property | Value |
|---|---|
| Trigger | Conflict exists with 0 INVOLVES edges |
| Severity | IMPORTANT |
| Phase | DRAFT |
| Group key | `CONFLICT:SETUP:<conflict_id>` |

### ConflictNeedsManifestation
| Property | Value |
|---|---|
| Trigger | Conflict exists with 0 MANIFESTS_IN edges |
| Severity | IMPORTANT |
| Phase | DRAFT |
| Group key | `CONFLICT:SHOW:<conflict_id>` |

---

## 6.5 THEME_MOTIF Domain

### ThemeUngrounded
| Property | Value |
|---|---|
| Trigger | Theme has status FLOATING and 0 EXPRESSED_IN edges |
| Severity | SOFT |
| Phase | REVISION |
| Group key | `THEME:GROUND:<theme_id>` |

### MotifUngrounded
| Property | Value |
|---|---|
| Trigger | Motif has status FLOATING and 0 APPEARS_IN edges |
| Severity | SOFT |
| Phase | REVISION |
| Group key | `MOTIF:GROUND:<motif_id>` |

---

# Appendix A — MVP Minimum Valid State