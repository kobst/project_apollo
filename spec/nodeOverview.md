# Narrative Knowledge Graph – Node Catalog (v1)

This document catalogs the node types used to represent narrative structure, causality, and workflow state in the system.

## 1. Core Structural Nodes (Story-Level)

### Story

**Purpose:** Root container for a single narrative project

**Abstraction:** Global

**Notes:** Holds references to all major artifacts

### Premise

**Purpose:** Encodes the core story idea

**Abstraction:** Level 0 (Story Intent)

**Examples:** Logline, core setup

### GenreTone

**Purpose:** Declares genre and tonal expectations

**Abstraction:** Level 0

**Notes:** Acts as a constraint, not content

### Theme

**Purpose:** Represents an inferred or explicit thematic concern

**Abstraction:** Level 0–1 (Derived)

**Requirement:** Must be grounded in ≥1 Scene via evidence links

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

### StateChange (formerly "Outcome")

**Purpose:** Encodes what is now true that wasn't before

**Abstraction:** Level-agnostic (scoped)

**Scopes:** Beat, Sequence, Scene

**Examples:**
- Knowledge gained
- Relationship altered
- Stakes escalated

**Notes:** Core causal primitive of the system

## 6. World & Evidence Nodes

### Location

**Purpose:** Physical setting

**Abstraction:** Level 3–4

### Prop

**Purpose:** Significant object with narrative relevance

**Abstraction:** Level 3–4

### Motif

**Purpose:** Repeating narrative or visual element

**Abstraction:** Level 0–1 (Derived)

**Requirement:** Must recur across scenes

### Symbol

**Purpose:** Represents abstract meaning embodied by an element

**Abstraction:** Level 0–1 (Derived)

**Requirement:** Must be grounded in evidence

## 7. Workflow & Reasoning Nodes (Meta)

### OpenQuestion

**Purpose:** Explicitly represents missing or unresolved structure

**Derived From:** Schema–graph mismatches

**Examples:**
- MissingGoal
- MissingStateChange
- UnanchoredTheme

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