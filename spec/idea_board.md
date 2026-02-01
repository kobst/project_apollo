Intent Board – Product Spec (Markdown)

A planning-first surface for shaping StoryBeats before Scenes exist—so you can state what must happen (intent) and how we’ll recognize it (criteria), then realize it with scenes when ready.

1) Purpose

Give writers a macro planning layer between structural beats (STC) and concrete scenes.

Let users declare intent (“this must happen”) + criteria (what makes it true), track status/risks, and wire causal order—without committing to locations/dialogue yet.

Provide a clear path from intent → realization, with coverage and rule checks built in.

2) Scope & Placement

New main tab: Intent

Sits alongside: Coverage, Explore, Outline

Complements:

Outline (timeline/realization view)

Coverage (completeness & gaps)

Explore (raw node lists)

3) Information Architecture
3.1 Columns

Two interchangeable column modes:

Mode A: STC Columns
Columns = STC beats (grouped by Act rows). Each column houses StoryBeats aligned to that STC beat.

Mode B: Act Columns
Columns = Act I–V. Cards can be grouped/sorted by position_index or intent.

Toggle persists per story.

3.2 Cards (StoryBeat)

Each card represents a StoryBeat (the “what must happen” unit):

Required fields

title — short, imperative (“Establish Cain’s retired stasis”)

intent — plot | character | reveal | reversal | setup | payoff | tension

criteria — up to 3 checklist items (“Shows X”, “Sets up Y”)

Optional fields

status — draft | approved | deprecated

priority — 0–1 slider or Low/Med/High

act, position_index — canonical placement (auto-filled by column)

risk — free text (“Might undercut tone if too comedic”)

notes — freeform

tags — e.g., theme:loyalty, motif:rain

Edge summaries on the card

Aligned STCBeat (ALIGNS_WITH)

Realization count (SATISFIED_BY Scenes): “0 scenes” / “2 scenes”

Causal markers (PRECEDES/PRECEDED_BY): small arrows with counts

Coverage chip: green (realized), yellow (no scenes yet), gray (draft)

4) Layout & Interactions
4.1 Board Layout

Left rail: Filters (intent, status, tags), search, sort (priority, position)

Main: Columns (STC or Acts), draggable StoryBeat cards

Right panel: Selected card details + actions

4.2 Core Actions

Add StoryBeat
From column header (“+ StoryBeat”) → prefilled act/position_index/ALIGNS_WITH

Edit
Inline (title/intent/priority) + full detail in right panel (criteria, risks, tags)

Reorder
Drag card within column (adjust position_index)

Move
Drag card to another STC/Act column (updates ALIGNS_WITH + act)

Causality (PRECEDES)
Quick-link: shift-drag from one card to another or use “Link” action → creates PRECEDES

Realize
“+ Scene” from card → opens Scene creation prefilled to SATISFIED_BY this beat

Bulk attach scenes
From the card’s “Manage Realizations” → multi-select Scenes, order them (uses existing bulk attach)

4.3 AI Assist (optional; feature-flag)

Generate StoryBeats for a selected column (2–4 proposals): title + intent + criteria
→ proposed state with status=proposed, confidence, rationale

Refine Beat from natural language (“Make this a ‘reversal’ and add criteria about X”)
→ preview patch → commit

5) Data Model (recap)

Node: StoryBeat

type StoryBeat = {
  id: string;
  type: 'StoryBeat';
  title: string;
  intent: 'plot'|'character'|'reveal'|'reversal'|'setup'|'payoff'|'tension';
  criteria: string[];        // ≤3
  act?: 1|2|3|4|5;
  position_index?: number;   // ordering within act/column
  status: 'draft'|'approved'|'deprecated';
  priority?: number;         // 0..1
  risk?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

Edges

ALIGNS_WITH : StoryBeat → STCBeat

SATISFIED_BY : StoryBeat → Scene (ordered; properties.order)

PRECEDES : StoryBeat → StoryBeat

All edges are first-class: id, properties{order, weight, confidence, notes}, provenance, status.

6) Rule Engine Hooks (MVP)

Hard rules (block commit):

SB_DAG_NO_CYCLES: PRECEDES forms a DAG

SB_ORDER_UNIQUE: SATISFIED_BY order unique per beat (auto-reindex fix)

SB_ACT_ALIGNMENT: StoryBeat.act matches aligned STCBeat’s act (auto-fix)

Soft rules (warn):

SB_HAS_INTENT: missing intent

SB_REALIZED: approved StoryBeat with no Scenes

SCENE_DIRECT_TO_STC: Scene attached to STC without intermediary StoryBeat → suggest “Create StoryBeat & rewire”

Board surfaces violations inline on cards (icon + tooltip); panel on the right lists all violations with Apply Fix buttons.

7) Coverage Signals

Column header badge:
N StoryBeats • M realized

Card chip colors:

Green: ≥1 realizing Scene

Yellow: 0 Scenes but status=approved

Gray: draft

Optional density stripe: lighter → heavier as Scenes accrue (visual flow)

8) Workflows
8.1 Top-down (structure → intent → scenes)

Pick STC column (e.g., “Catalyst”)

+ StoryBeat (intent + criteria)

Link causal order with other StoryBeats

Realize as Scene(s) when ready

8.2 Bottom-up (existing scenes → intent)

Select Scene(s) lacking a StoryBeat

“Create StoryBeat from Scene(s)”
→ creates a StoryBeat with criteria extracted from the scenes
→ rewires edges (SATISFIED_BY)

8.3 Refactor

Drag StoryBeat to a different STC column → act/position auto-updated with guardrails

Merge beats (select 2 → “Merge”) → combines criteria; rewires Scenes

9) API Additions

GET /stories/:id/intent-board?mode=stc|act → pre-grouped StoryBeats + summaries

POST /stories/:id/story-beats → create

PATCH /stories/:id/story-beats/:id → update fields

POST /stories/:id/edges:upsert → manage ALIGNS_WITH, PRECEDES, SATISFIED_BY

POST /stories/:id/lint + .../lint/apply → board-scoped lint

(If you already have generic nodes/edges endpoints, these are thin orchestrations over them.)

10) Permissions & Versioning

Draft vs Approved gating on StoryBeats (only approved appear in client-facing exports).

Board edits produce patch sets; commit uses your existing Pre-Commit Lint Gate.

Branch-aware: board shows current branch; diffs highlight added/changed/removed StoryBeats and edges.

11) Telemetry (light)

Events: intent.add, intent.edit, intent.move, intent.link_precedes, intent.realize_scene

Funnel: “Beat created → realized within 24h”

Quality: average criteria count, % approved beats realized

12) Acceptance Criteria (MVP)

Create/edit/move StoryBeats within columns

Drag ordering with persisted position_index

Quick causal linking (PRECEDES) with DAG guard

One-click “Realize as Scene” and bulk attach existing Scenes

Inline lint chips + Pre-Commit modal (hard rules block)

Column/board coverage summaries

Mode toggle (STC vs Act) with persistent preference

13) Future Extensions

AI Beat Proposer (per column; proposed status with confidence/rationale)

Beat Templates (genre-biased checklists for criteria)

What-if sandbox (branch off a subset of StoryBeats and simulate different PRECEDES chains)

Beat-to-Theme heatmap (show which themes each beat serves)

14) Quick Wireframe (ASCII)
┌─────────────── Intent Board (STC mode) ───────────────┐   Filters: [intent ▼][status ▼][tags]  Search: [   ]
│ Act I                                                 │
│ ┌──── Opening Image ────┐  ┌──── Theme Stated ────┐   │
│ │ [Beat Card]           │  │ [Beat Card]          │   │
│ │ title, chips          │  │ title, chips         │   │
│ │ criteria (1–2)        │  │ criteria (1–2)       │   │
│ └───────────────────────┘  └──────────────────────┘   │
│ ┌──── Catalyst ─────────┐  ┌──── Debate ──────────┐   │
│ │ [Beat Card]           │  │ [Beat Card]          │   │
│ │ + Realize   ↗Link     │  │ + Realize   ↗Link    │   │
│ └───────────────────────┘  └──────────────────────┘   │
│ Act II                                                │
│ ...                                                   │
└───────────────────────────────────────────────────────┘


Right Panel (selected card)
┌───────────────────────────────┐
│ Title [.....................] │
│ Intent [plot▼]  Status [draft]│
│ Criteria                      │
│  - [ ] .....................  │
│  - [ ] .....................  │
│ Risk/Notes                    │
│ PRECEDES: [ + link ]          │
│ Realization: Scenes (0) [ + ] │
│ Lint: [✓] / [!] show details  │
└───────────────────────────────┘

Summary:
The Intent Board is your planning-first canvas: you capture StoryBeat intent & criteria, arrange causality, and only then realize them as Scenes. It clarifies intent, improves coverage, enforces structure with guardrails, and keeps the writer in the loop while paving the way for AI assistance where it actually helps.
