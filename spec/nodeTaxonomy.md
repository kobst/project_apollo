# Screenplay Knowledge Graph – v1 Taxonomy Specification

This document defines the **v1 node taxonomy, relationships, and schema rules** for an AI-assisted, human-in-the-loop screenplay creation system.

The system prioritizes **structural scaffolding (Save the Cat + Film Crit Hulk 5-Act)** while enabling exploratory, branchable narrative development.

---

## 1. Core Principles (v1)

- Human-AI co-creation (AI proposes, human selects)
- Branching + version control are first-class
- Structural beats are hardcoded
- Causality is implicit via scene overviews + beat placement
- Abstract meaning nodes may float ungrounded
- Validation produces **OpenQuestions**, not hard errors

---

## 2. Node Types

### A. WORKFLOW / META NODES (4)

---

### 1) `StoryVersion`
**Purpose:** Immutable snapshot of the story graph (branch/commit)

**Required:**
- `id`
- `parent_story_version_id` (nullable)
- `created_at`
- `label`

**Optional:**
- `summary`
- `logline`
- `premise`
- `genre_tone`
- `tags`
- `author_notes`
- `schema_version`

**Active Phase:** Outline

---

### 2) `MoveCluster`
**Purpose:** A batch of alternative narrative proposals generated from a base version

**Required:**
- `id`
- `base_story_version_id`
- `created_at`
- `title`

**Optional:**
- `description`
- `cluster_type` (`STRUCTURE`, `SCENE_LIST`, `CHARACTER`, `CONFLICT`, `THEME`)
- `target_open_question_ids[]`
- `status` (`PROPOSED`, `ARCHIVED`)

**Active Phase:** Outline

---

### 3) `NarrativeMove`
**Purpose:** A single candidate narrative change

**Required:**
- `id`
- `cluster_id`
- `patch_id`
- `title`
- `rationale`
- `created_at`

**Optional:**
- `expected_effects[]`
- `resolves_open_question_ids[]`
- `introduces_open_question_ids[]`
- `confidence`
- `status` (`PROPOSED`, `ACCEPTED`, `REJECTED`)
- `human_edits`

**Active Phase:** Outline

---

### 4) `Patch`
**Purpose:** Declarative diff applied to the graph

**Required:**
- `id`
- `base_story_version_id`
- `ops[]`
  - `ADD_NODE`
  - `UPDATE_NODE`
  - `ADD_EDGE`
  - `REMOVE_EDGE`
  - `DEPRECATE_NODE`

**Optional:**
- `metadata`
- `notes`

**Active Phase:** Outline

---

## B. STRUCTURE (1)

---

### 5) `Beat`
**Purpose:** Hardcoded Save-the-Cat structural beat, mapped to Film Crit Hulk 5-Act

**Required:**
- `id`
- `beat_type` (enum: OpeningImage … FinalImage)
- `act` (1–5)
- `position_index` (1–15)

**Optional:**
- `guidance`
- `status` (`EMPTY`, `PLANNED`, `REALIZED`)
- `notes`

**Active Phase:** Outline  
*(Typically all 15 beats instantiated immediately)*

---

## C. STORY CONTENT (4)

---

### 6) `Scene`
**Purpose:** Core unit of narrative realization

**Required:**
- `id`
- `heading`
- `scene_overview`
- `beat_id`
- `order_index`

**Optional:**
- `int_ext`
- `time_of_day`
- `mood`
- `key_actions[]`
- `notable_dialogue[]`
- `scene_tags[]` *(lightweight outcome tags)*
- `status`
- `source_provenance`

**Active Phase:** Outline → Draft

---

### 7) `Character`
**Purpose:** Human story agents

**Required:**
- `id`
- `name`

**Optional:**
- `description`
- `archetype`
- `traits[]`
- `notes`
- `status`

**Active Phase:** Outline

---

### 8) `Location`
**Purpose:** Hierarchical setting representation

**Required:**
- `id`
- `name`

**Optional:**
- `parent_location_id`
- `description`
- `tags[]`

**Active Phase:** Outline

---

### 9) `Object`
**Purpose:** Props and significant items

**Required:**
- `id`
- `name`

**Optional:**
- `description`
- `significance`
- `introduced_in_scene_id`
- `tags[]`

**Active Phase:** Draft (earlier if user-provided)

---

## D. ABSTRACT / MEANING (4)

---

### 10) `Theme`
**Purpose:** Soft attractor for meaning

**Required:**
- `id`
- `statement`

**Optional:**
- `notes`
- `priority`
- `status` (`FLOATING`, `GROUNDED`)

**Active Phase:** Outline

---

### 11) `Motif`
**Purpose:** Recurring symbolic element

**Required:**
- `id`
- `name`

**Optional:**
- `description`
- `status` (`FLOATING`, `GROUNDED`)

**Active Phase:** Outline

---

### 12) `CharacterArc`
**Purpose:** Trajectory of character transformation

**Required:**
- `id`
- `character_id`

**Optional:**
- `arc_type`
- `start_state`
- `end_state`
- `turn_refs[]`  
  *(references to Beat and/or Scene IDs with optional notes)*
- `status` (`FLOATING`, `PARTIAL`, `GROUNDED`)

**Active Phase:** Draft

---

### 13) `Conflict`
**Purpose:** Tension between characters, groups, or abstract forces

**Required:**
- `id`
- `name`
- `conflict_type`
- `description`

**Optional:**
- `stakes`
- `intensity`
- `status` (`FLOATING`, `ACTIVE`, `RESOLVED`)
- `start_beat_id`
- `end_beat_id`
- `notes`

**Active Phase:** Outline → Draft

---

## 3. Relationships (Edges)

### Structure & Realization
- `Scene -[FULFILLS]-> Beat`
- `Beat -[REALIZED_BY]-> Scene` *(derived)*

### Participation & Setting
- `Scene -[HAS_CHARACTER]-> Character`
- `Scene -[SET_IN]-> Location`
- `Scene -[FEATURES_OBJECT]-> Object`

### Meaning & Arcs
- `Theme -[EXPRESSED_IN]-> Beat`
- `Theme -[EXPRESSED_IN]-> Scene`
- `Motif -[APPEARS_IN]-> Scene`
- `CharacterArc -[HAS_TURN_IN]-> Beat`
- `CharacterArc -[HAS_TURN_IN]-> Scene`

### Conflict
- `Conflict -[INVOLVES]-> Character`
- `Conflict -[MANIFESTS_IN]-> Scene`
- `Conflict -[SPANS_BEATS]-> Beat`

### Workflow
- `StoryVersion -[HAS]-> Beat/Scene/Character/...`
- `MoveCluster -[BASED_ON]-> StoryVersion`
- `NarrativeMove -[PART_OF]-> MoveCluster`
- `NarrativeMove -[HAS_PATCH]-> Patch`
- `Patch -[APPLIES_TO]-> StoryVersion`

---

## 4. Schema Rules → OpenQuestions

### Structural
- **Beat exists, no Scene**  
  → `BeatUnrealized(beat_id)` *(Outline)*
- **Scene exists, no Beat**  
  → `SceneUnplaced(scene_id)` *(Outline)*

### Scene Quality
- **Scene exists, missing overview**  
  → `SceneNeedsOverview(scene_id)` *(Draft)*
- **Scene has no characters**  
  → `SceneHasNoCast(scene_id)` *(Draft)*
- **Scene has no location**  
  → `SceneNeedsLocation(scene_id)` *(Draft)*

### Character & Arc
- **Character appears in ≥3 scenes, no CharacterArc**  
  → `MissingCharacterArc(character_id)` *(Draft)*
- **CharacterArc exists, no turn_refs**  
  → `ArcUngrounded(character_arc_id)` *(Revision)*

### Theme / Motif (soft)
- **Theme exists, no EXPRESSED_IN links**  
  → `ThemeUngrounded(theme_id)` *(Revision)*
- **Motif exists, no APPEARS_IN links**  
  → `MotifUngrounded(motif_id)` *(Revision)*

### Conflict
- **Conflict exists, no INVOLVES relationships**  
  → `ConflictNeedsParties(conflict_id)` *(Draft)*
- **Conflict exists, no MANIFESTS_IN scenes**  
  → `ConflictNeedsManifestation(conflict_id)` *(Draft/Revision)*

---

## 5. Notes & Known v1 Limitations

- No explicit `StateChange` node (deferred to v2)
- Causality inferred via `scene_overview`, `scene_tags`, and beat position
- DialogueLine deferred; notable dialogue stored on Scene
- Abstract meaning nodes allowed to float intentionally
- Structure is enforced as an attractor, not a gate

---

## 6. Summary

This v1 taxonomy supports:
- exploratory narrative search
- rapid alternative generation
- explicit structural grounding
- reversible branching
- progressive refinement from outline → draft → revision

It intentionally favors **flexibility and human judgment** over rigid theory encoding.
