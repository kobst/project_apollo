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

### A. WORKFLOW / META NODES (2)

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

// Legacy MoveCluster/NarrativeMove removed. Proposals are handled as NarrativePackages in staging.

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

## B. CONTEXT LAYER (consolidated)

These foundational context concepts have been consolidated into the structured `StoryContext` type. They are no longer separate graph nodes. See Section G and `storyContext.md` for full details.

---

### 5) `Premise`

**Premise** — REMOVED. Logline, premise, genre, and setting are now fields on `StoryContext.constitution`. See `storyContext.md` for details.

---

### 6) `Setting`

**Setting** — REMOVED. Setting is now a string field on `StoryContext.constitution.setting`. Locations still exist as graph nodes.

---

### 7) `GenreTone`

**GenreTone** — REMOVED. Genre is `StoryContext.constitution.genre` and tone is `StoryContext.constitution.toneEssence`.

---

## C. STRUCTURE (1)

---

### 8) `Beat`
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

## D. STORY CONTENT (5)

---

### 9) `Scene`
**Purpose:** Core unit of narrative realization

**Required:**
- `id`
- `heading`
- `scene_overview`
- `order_index`

**Deprecated:**
- `beat_id` *(use SATISFIED_BY edge to StoryBeat instead)*

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

### 10) `Character`
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

### 11) `Location`
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

### 12) `Object`
**Purpose:** Props and significant items

**Required:**
- `id`
- `name`

**Optional:**
- `description`
- `introduced_in_scene_id`
- `tags[]`

**Active Phase:** Draft (earlier if user-provided)

**Notes:**
- Significance is inferred by AI from narrative context and `FEATURES_OBJECT` edges

---

### 13) `StoryBeat`
**Purpose:** Writer-declared "this must happen" unit of story causality

**Required:**
- `id`
- `title`
- `createdAt`
- `updatedAt`

**Optional:**
- `summary`
- `intent` (enum: `plot`, `character`, `tone`) – *AI can infer from context*
- `priority` (enum: `low`, `medium`, `high`)
- `urgency` (enum: `low`, `medium`, `high`)
- `stakes_change` (enum: `up`, `down`, `steady`)
- `status` (enum: `proposed`, `approved`, `deprecated`)
- `act` (1–5)
- `weight` (0–1)
- `confidence` (0–1)
- `tags[]`
- `ownerId`

**Notes:**
- Story beats can exist before scenes are created
- They represent narrative promises that must be fulfilled
- Align to STC beats via `ALIGNS_WITH` edge
- Fulfilled by one or more scenes via `SATISFIED_BY` edge
- Form causal chains via `PRECEDES` edge (must be DAG)

---

## E. ABSTRACT / MEANING (1)

---

### 14) `CharacterArc`
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

**Notes:**
- Conflicts and themes are now captured in Story Context as prose rather than as formal nodes
- These interpretive concepts are *about* the story, not entities *in* the story

---

## F. STAGING (1)

---

### 15) `Idea`
**Purpose:** Unassigned creative concept awaiting promotion to a concrete node type

**Required:**
- `id`
- `title` *(short label, e.g., "Max's betrayal reveal")*
- `description` *(1-3 sentences explaining the idea)*
- `source` (`user`, `ai`)
- `createdAt`

**Optional:**
- `suggestedType` (`StoryBeat`, `Scene`, `Character`, `Location`, `Object`)

**Notes:**
- Ideas live in the "Unassigned" area of the Outline view
- Can be promoted to a concrete node type (StoryBeat, Scene, etc.)
- Allows capturing creative thoughts without immediately committing to structure
- When promoted, the Idea is deleted and a new node of the target type is created

---

## G. STORY CONTEXT (Structured Type)

**Story Context** is a structured type (not a graph node and no longer a markdown string) that captures both stable identity and dynamic guidance for the story. It has two parts:

### Constitution (stable, cached in system prompt)
The immutable creative identity of the story. Cached in the AI system prompt for every request.

**Fields:**
- `logline` — one-sentence story summary
- `premise` — extended concept / hook
- `genre` — primary genre string
- `setting` — world, time period, atmosphere
- `thematicPillars` — array of core themes (max 4)
- `hardRules` — array of inviolable constraints
- `toneEssence` — short tonal description (max 20 words)
- `banned` — array of elements to never include
- `version` — integer, incremented on any constitution edit

### Operational (dynamic, filtered per-task)
Evolving guidance that the AI receives selectively based on the current task.

**Fields:**
- `softGuidelines` — array of guidelines, each with `text` and `tags[]` for filtering
- `workingNotes` — freeform scratchpad for the writer

**Purpose:**
- Provides structured context for AI during generation
- Captures concepts that are *about* the story, not entities *in* it
- Serves as the "claude.md" equivalent for the story
- Constitution replaces the former Premise, Setting, and GenreTone graph nodes

**Location:** `state.metadata.storyContext` (structured `StoryContext` type)

**Notes:**
- Constitution is included in the system prompt and benefits from prompt caching
- Operational guidelines are filtered by tag and injected into the user message per task
- See `storyContext.md` for full type definitions and usage details

---

## 3. Relationships (Edges)

### Structure & Realization
- `Scene -[FULFILLS]-> Beat` *(deprecated - use StoryBeat edges instead)*
- `Beat -[REALIZED_BY]-> Scene` *(derived, deprecated)*

**Preferred hierarchy (v1.1+):**
- `StoryBeat -[ALIGNS_WITH]-> Beat` *(StoryBeat aligns to structural beat)*
- `StoryBeat -[SATISFIED_BY]-> Scene` *(Scene realizes the StoryBeat)*

### Participation & Setting
- `Scene -[HAS_CHARACTER]-> Character`
- `Scene -[LOCATED_AT]-> Location`
- `Scene -[FEATURES_OBJECT]-> Object`

### Meaning & Arcs
- `CharacterArc -[HAS_TURN_IN]-> Beat`
- `CharacterArc -[HAS_TURN_IN]-> Scene`
- `Character -[HAS_ARC]-> CharacterArc`

### StoryBeat
- `StoryBeat -[ALIGNS_WITH]-> Beat` *(optional alignment to STC beat)*
- `StoryBeat -[SATISFIED_BY]-> Scene` *(with order property)*
- `StoryBeat -[PRECEDES]-> StoryBeat` *(causal chain, must be DAG)*
- `StoryBeat -[ADVANCES]-> CharacterArc`

### Workflow
- `StoryVersion -[HAS]-> Beat/Scene/Character/...`
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
  → `MissingCharacterArc(character_id)`
- **CharacterArc exists, no turn_refs**
  → `ArcUngrounded(character_arc_id)`

### StoryBeat (hard rules - block commit)
- **PRECEDES edges form a cycle**
  → `SB_DAG_NO_CYCLES` *(no auto-fix)*
- **Multiple SATISFIED_BY edges have same order**
  → `SB_ORDER_UNIQUE` *(auto-fix: reindex)*
- **StoryBeat.act mismatches aligned Beat.act**
  → `SB_ACT_ALIGNMENT` *(auto-fix: update act)*

### StoryBeat (soft rules - warnings)
- **Approved StoryBeat has no SATISFIED_BY scenes**
  → `SB_EVENT_REALIZATION` *(Draft)*

### Context Layer (soft rules - warnings)
- **StoryContext.constitution is missing required fields (logline, premise, genre)**
  → `STORY_HAS_CONTEXT` *(Outline)*

---

## 5. Notes & Known v1 Limitations

- No explicit `StateChange` node (deferred to v2)
- Causality captured via `StoryBeat` nodes and `PRECEDES` edges
- StoryBeats represent writer intent; scenes realize that intent via `SATISFIED_BY`
- DialogueLine deferred; notable dialogue stored on Scene
- Conflicts, themes, and motifs are captured as prose in Story Context, not as graph nodes
- Structure is enforced as an attractor, not a gate

---

## 6. Summary

This v1 taxonomy supports:
- exploratory narrative search
- rapid alternative generation
- explicit structural grounding
- reversible branching

**Story Elements** include only concrete entities in the story:
- Characters (people/entities with agency)
- Locations (physical spaces)
- Objects (significant items)

Interpretive concepts like conflicts, themes, and motifs are captured in **Story Context** as prose rather than as formal graph nodes.

It intentionally favors **flexibility and human judgment** over rigid theory encoding.
