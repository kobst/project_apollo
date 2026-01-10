# Narrative Knowledge Graph – Node Catalog (v1)

This document catalogs the node types used to represent narrative structure, causality, and workflow state in the system.

## 1. Core Structural Nodes (Story-Level)

### Story

**Purpose:** Root container for a single narrative project

**Abstraction:** Global

**Notes:** Holds references to all major artifacts

### Premise

**Purpose:** The core story concept (one per story)

**Abstraction:** Level 0 (Story Intent)

**Required Fields:** logline

**Optional Fields:** concept, hook, notes

**Notes:**
- Top of the pyramid - everything else serves the premise
- Typically only one Premise node per story

**Examples:** Logline, core setup

### Setting

**Purpose:** Generalized world/time period container

**Abstraction:** Level 0-1

**Required Fields:** name

**Optional Fields:** description, time_period, atmosphere, notes

**Notes:**
- Can represent: "1920s Chicago", "Post-apocalyptic wasteland", "Victorian London"
- Locations connect to Settings via PART_OF edge
- Scenes can be SET_IN a Setting for broader context

**Examples:** "Victorian London", "Near-future dystopia", "1950s suburban America"

### GenreTone

**Purpose:** Combined genre and tonal declaration

**Abstraction:** Level 0

**Optional Fields:** genre, secondary_genre, tone, tone_description, conventions, notes

**Notes:**
- Combined node because genre and tone are deeply intertwined
- Some stories have tone without clear genre (art films)
- Some genres imply tone (noir → dark/cynical)
- Typically only one GenreTone node per story

**Examples:** "noir / cynical", "comedy / light", "thriller / tense"

## 2. Structural Planning Nodes (Macro / Meso)

### StructureModel

**Purpose:** Declares the structural paradigm in use

**Abstraction:** Level 1

**Examples:** Save the Cat, 5-Act, Episodic

### Beat

**Purpose:** Structural classification of a narrative moment

**Abstraction:** Level 1–2

**Examples:** Inciting Incident, Midpoint Reversal, Climax

**Notes:** Schema-level abstraction, reused across stories

### Sequence

**Purpose:** Groups multiple scenes into a mini-arc

**Abstraction:** Level 2

**Notes:** Optional but useful for pacing and escalation

## 3. Scene-Level Narrative Nodes

### Scene

**Purpose:** Atomic unit of narrative realization

**Abstraction:** Level 3–4

**Notes:** Describes where and when events occur

### ScenePlan

**Purpose:** Internal beat structure within a scene

**Abstraction:** Level 4

**Notes:** Optional early, required for drafting

## 4. Character & Agency Nodes

### Character

**Purpose:** Represents an agent in the story

**Abstraction:** Level 0–3

**Notes:** Does not encode conflict directly

### Goal

**Purpose:** Represents an objective pursued by a character

**Abstraction:** Level 2–3

**Notes:** Primary location of conflict dynamics

### Blocker

**Purpose:** Impediment to a goal

**Abstraction:** Level 2–3

**Types:** Interpersonal, Moral, Physical, Systemic, Internal

### ArcMilestone

**Purpose:** Captures a significant change in a character's arc

**Abstraction:** Level 1–2

**Notes:** Must be grounded in specific scenes

## 5. Causality Nodes (Critical)

### PlotPoint

**Purpose:** Writer-declared "this must happen" unit of story causality

**Abstraction:** Level 1–3

**Examples:**
- "Hero must discover the truth about their father"
- "The romance must reach a breaking point"
- "Theme of redemption must be paid off"

**Notes:**
- Exists before scenes; scenes fulfill plot points
- Forms causal DAG via PRECEDES edges
- Can align to STC beats for structural grounding

### StateChange (formerly "Outcome")

**Purpose:** Encodes what is now true that wasn't before

**Abstraction:** Level-agnostic (scoped)

**Scopes:** Beat, Sequence, Scene

**Examples:**
- Knowledge gained
- Relationship altered
- Stakes escalated

**Notes:** Core causal primitive of the system (deferred to v2)

## 6. World & Evidence Nodes

### Location

**Purpose:** Physical setting / specific place

**Abstraction:** Level 3–4

**Notes:**
- Can be connected to a Setting via PART_OF edge
- Scenes are LOCATED_AT a Location
- Supports hierarchical locations via parent_location_id

### Object

**Purpose:** Significant item or prop with narrative relevance

**Abstraction:** Level 3–4

**Notes:**
- Connected to Scenes via FEATURES_OBJECT edge
- Can track where items are introduced and reappear

## 7. Workflow & Reasoning Nodes (Meta)

### OpenQuestion

**Purpose:** Explicitly represents missing or unresolved structure

**Derived From:** Schema–graph mismatches

**Examples:**
- BeatUnrealized
- SceneUnplaced
- MissingCharacterArc

**Notes:** Mechanically generated, not invented

### NarrativeMove

**Purpose:** Proposed incremental change to the graph

**Type:** Patch / delta

**Actions:** add, modify, deprecate nodes or edges

**Notes:** Subject to validation before canonization

### Constraint

**Purpose:** Records learned or user-defined restrictions

**Examples:** "No coincidence-based resolutions"

**Notes:** Accumulates over time

### Decision

**Purpose:** Records a human resolution of alternatives

**Notes:** Supports traceability and synthesis

## 8. Optional / Extension Nodes (Later Phases)

### DialogueBlock

**Purpose:** Dialogue text tied to scenes

**Abstraction:** Level 5

### StyleConstraint

**Purpose:** Enforces stylistic consistency

**Examples:** Pacing, realism, tone

**Notes:** Acts as validator input