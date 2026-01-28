# Apollo Contract UI - User Guide

A comprehensive guide to using the Apollo Contract UI for screenplay development.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Stories Tab](#stories-tab)
4. [Workspace Tab](#workspace-tab)
5. [Generation Tab](#generation-tab)
6. [Story Map Navigation](#story-map-navigation)
7. [Foundations Categories](#foundations-categories)
8. [Outline Categories](#outline-categories)
9. [Node Editing](#node-editing)
10. [Edge Editing](#edge-editing)
11. [Input Panel & Extraction](#input-panel--extraction)
12. [Lint Panel & Pre-Commit Validation](#lint-panel--pre-commit-validation)
13. [Feature Catalog](#feature-catalog)
14. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Starting the Servers

The UI requires two servers running:

```bash
# Terminal 1: Start the API server (port 3000)
cd packages/api && npm start

# Terminal 2: Start the UI dev server (port 5173)
cd packages/ui && npm run dev
```

### Accessing the UI

Open your browser to: **http://localhost:5173**

The UI proxies all `/api/*` requests to the API server automatically.

---

## Interface Overview

The application uses a **tabbed interface** with three main views:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Apollo Contract UI                                 │
├─────────────────────────────────────────────────────────────┤
│  [Stories]  [Workspace]  [Generation]   ← View Tabs         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              View-specific content                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### View Tabs

| Tab | Purpose |
|-----|---------|
| **Stories** | Story selection, branching, and version history management |
| **Workspace** | Unified story editing with StoryMap navigation |
| **Generation** | AI-assisted story development with compose/review workflow |

---

## Stories Tab

The Stories tab provides story management capabilities:

### Layout (2-Column)

```
┌─────────────────────────┬───────────────────────────────────┐
│ STORY LIST              │ STORY DETAILS                     │
│                         │                                   │
│ ┌─────────────────────┐ │ Story Name                        │
│ │ My Story      [sel] │ │ Logline text here...              │
│ └─────────────────────┘ │                                   │
│ ┌─────────────────────┐ │ Stats: 5 Scenes | 15 Beats | ...  │
│ │ Another Story       │ │                                   │
│ └─────────────────────┘ │ Branch: [main ▼] [+ New Branch]   │
│                         │                                   │
│ [+ New]                 │ Version History:                  │
│                         │ ┌─────────────────────────────┐   │
│                         │ │ v3 - Added character ★      │   │
│                         │ │ v2 - Initial structure      │   │
│                         │ │ v1 - Created               │   │
│                         │ └─────────────────────────────┘   │
└─────────────────────────┴───────────────────────────────────┘
```

### Features

| Feature | Description |
|---------|-------------|
| **Story List** | Click to select a story; shows all available stories |
| **Create Story** | Click "+ New" to create a new story with name and logline |
| **Branch Selector** | Switch between branches or create new ones |
| **Version History** | Timeline of versions with restore functionality |

### Creating a New Story

1. Click **"+ New"** button in the Story List
2. Fill in the form:
   - **Name** (optional): A short identifier for the story
   - **Logline** (required): A one-sentence description of your story
3. Click **"Create Story"** to create the story

### Branch Management

- **Switch Branch**: Use the dropdown to select a different branch
- **Create Branch**: Click "+ New Branch", enter name and optional description
- **Current Branch**: Shown with a checkmark in the dropdown

### Version History

- Shows recent versions with labels
- **Current**: Marked with a star (★)
- **Restore**: Click "Restore" to checkout a previous version

---

## Workspace Tab

The Workspace tab is the main editing environment. It combines coverage tracking, node browsing, and outline viewing into a unified interface with a **Story Map** navigation panel.

### Layout

```
┌──────────────┬──────────────────────────────────────────────┐
│ STORY MAP    │ MAIN CONTENT                                 │
│              │                                              │
│ Foundations  │ (Changes based on Story Map selection)       │
│ ├─ Story Ctx │ ┌─────────┬─────────────────┬──────────────┐ │
│ ├─ Chars     │ │ Node    │ Node Detail     │ Input Panel  │ │
│ ├─ Locations │ │         │                 │ [Extract]    │ │
│ └─ Objects   │ │         │                 │              │ │
│              │ │         │ [Edit] [Delete] │              │ │
│ Outline      │ │         │                 │              │ │
│ ├─ Board     │ ├─────────┴─────────────────┴──────────────┤ │
│ ├─ PlotPts   │ │ Gaps (filtered to category)              │ │
│ └─ Scenes    │ └──────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

### Key Features

- **Story Context Editor**: Structured editing for constitution and guidelines
- **Elements Board**: Card-based UI for Characters, Locations, and Objects
- **Relationship Display**: Human-readable node names in edge visualization
- **Inline Editing**: Direct field editing with cascading name updates

---

## Generation Tab

The Generation tab provides AI-assisted story development with four specialized generation modes.

### Layout

The Generation Panel is integrated into the Workspace as a slide-out panel on the right side.

```
┌──────────────────────────────────────────────────────────────┐
│ AI GENERATION                                           [×]  │
├──────────────────────────────────────────────────────────────┤
│ MODE                                                         │
│ [Story Beats] [Characters] [Scenes] [Expand]                 │
│                                                              │
│ SCOPE                                                        │
│ ○ Constrained    ● Flexible                                  │
│                                                              │
│ [MODE-SPECIFIC OPTIONS]                                      │
│                                                              │
│ DIRECTION (optional)                                         │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Additional guidance...                                 │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│                                           [Generate]         │
│                                                              │
│ Saved Packages (N)                                       [▶] │
└──────────────────────────────────────────────────────────────┘
```

### Generation Modes

| Mode | Endpoint | Primary Output | Use Case |
|------|----------|----------------|----------|
| **Story Beats** | `/propose/story-beats` | StoryBeat nodes | Fill in narrative structure |
| **Characters** | `/propose/characters` | Character nodes | Develop the cast |
| **Scenes** | `/propose/scenes` | Scene nodes | Create scenes for story beats |
| **Expand** | `/propose/expand` | Varies | Develop any existing node |

### Expansion Scope

| Scope | Description |
|-------|-------------|
| **Constrained** | Generate only primary output type, reference existing nodes |
| **Flexible** | Generate primary + supporting nodes (characters, locations, ideas) |

### Compose Form

- **Mode Selection**: Four-mode tabs (Story Beats, Characters, Scenes, Expand)
- **Scope Toggle**: Constrained or Flexible expansion
- **Mode-Specific Options**:
  - Story Beats: Focus type (all/act/priority beats), beat selection
  - Characters: Focus type, character selection for develop_existing, include arcs toggle
  - Scenes: Story beat selection (committed only), scenes per beat
  - Expand: Target selection (node or Story Context section), depth
- **Direction**: Freeform guidance text
- **Advanced Options** (collapsible):
  - Creativity slider (0-1)
  - Package count (1-10)

### Package Review

Packages display elements organized by sections:
- **Primary**: The main output type (e.g., StoryBeats, Characters, Scenes)
- **Supporting**: Additional nodes created when scope is Flexible
- **Suggestions**: Context additions and stashed ideas (can be included or dismissed)

### Element Operations

| Action | Description |
|--------|-------------|
| **Edit** | Inline editing with cascading name updates |
| **Regenerate** | Get alternative options for single element |
| **Remove** | Mark element for exclusion (can restore) |

### Package Actions

| Action | Effect |
|--------|--------|
| **Accept** | Apply package to story graph |
| **Reject** | Discard package |
| **Save for Later** | Store for future use |
| **Refine** | Generate variations |
| **← Edit inputs** | Return to compose with preserved form state |

### Saved Packages

- Persist across sessions
- Compatibility checking (outdated/conflicting warnings)
- Can apply saved packages with "Apply Anyway" for conflicts

---

## Stash Section

The Stash Section appears at the bottom of the Structure Board and provides a unified view of unassigned items.

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│ STASH                                                           │
├─────────────────────────────────────────────────────────────────┤
│ Unassigned Story Beats (2)                              [▼]     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ "The revelation"                              [Assign] [×]  │ │
│ │ "Character moment"                            [Assign] [×]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Unassigned Scenes (1)                                   [▼]     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ INT. WAREHOUSE - NIGHT                        [Assign] [×]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Ideas (3)                                               [▼]     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ "Consider a B-story romance..."               [Develop] [×] │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Item Types

| Type | Description | Actions |
|------|-------------|---------|
| **Unassigned Story Beats** | Story beats without ALIGNS_WITH edge to a Beat | Assign, Delete |
| **Unassigned Scenes** | Scenes without SATISFIED_BY edge from a StoryBeat | Assign, Delete |
| **Ideas** | Stashed concepts from AI generation | Develop, Delete |

### Actions

- **Assign**: Opens modal to select which Beat (for StoryBeats) or StoryBeat (for Scenes) to assign to
- **Develop**: Opens Generation Panel in Expand mode with the idea as direction
- **Delete**: Removes the item (with confirmation)

---

## Story Map Navigation

The **Story Map** is the left navigation panel in the Workspace. It shows all story categories with progress indicators.

### Structure

```
Story Map
├── Foundations
│   ├── Story Context   [====      ] updated
│   ├── Characters      [======    ] 3/5
│   ├── Locations       [====      ] 2/4
│   └── Objects         [===       ] 1/3
│
└── Outline
    ├── Structure Board [==========] 15/15 ✓
    ├── Story Beats     [          ] 0/3
    └── Scenes          [==        ] 3/40
```

### Progress Indicators

| Element | Description |
|---------|-------------|
| **Progress Bar** | Visual fill showing completion percentage |
| **Count** | `covered/total` for the category |
| **Status Badge** | Gap count indicator |

### Progress Bar Colors

| Color | Meaning |
|-------|---------|
| **Green** | >= 80% complete |
| **Orange** | >= 50% complete |
| **Red** | < 50% complete |
| **Gray** | 0% (empty) |

### Status Indicators

| Indicator | Meaning |
|-----------|---------|
| **✓** (green) | Category is complete |
| **Gap count** | Number of gaps in category |
| (none) | No issues |

### Navigation

- **Click** any category to view its contents in the main panel
- **Selected** category is highlighted with a border
- Progress updates automatically when you make changes

---

## Foundations Categories

The Foundations section contains the core creative direction and key elements of your story.

### Story Context

Single source of truth for creative direction.

- **Constitution**: logline, premise, genre, setting, thematicPillars, hardRules, toneEssence, banned
- **Operational**: softGuidelines (tagged per task), workingNotes
- **Editing**: Use the StoryContext Editor to update constitution and guidelines; changes to constitution update the cached system prompt

### Characters

The people in your story.

 - **Fields**: name, description, archetype, status
 - **Progress**: Based on character completeness
 - **Gaps**: Character-specific issues from lint rules

### Locations

Specific places where scenes occur.

- **Fields**: name, description, parent_location_id, tags
- **Hierarchy**: Optional parent/child relationships
- **Note**: Global Setting lives in StoryContext; there is no Setting node

### Objects

Significant items and props in your story.

- **Fields**: name, description
- **Related**: Scenes connect to Objects via FEATURES_OBJECT edges

**Note**: Themes, conflicts, and motifs are captured in Story Context as prose rather than as formal graph nodes.

---

## Outline Categories

The Outline section provides structure and timeline views.

### Structure Board

The beat-by-beat structure view (same as previous Outline tab).

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ACT 1 - SETUP                                      5 beats, 2 scenes   │
│  ┌──────────────┬──────────────┬──────────────┐                        │
│  │ Opening      │ Theme Stated │ Setup        │                        │
│  │ Image      ? │            ? │            ? │                        │
│  ├──────────────┼──────────────┼──────────────┤                        │
│  │              │              │ ▼ Hero's     │                        │
│  │   + (empty)  │   + (empty)  │   call  PLOT │                        │
│  │              │              │ ┌──────────┐ │                        │
│  │              │              │ │INT. DINER│ │                        │
│  │              │              │ └──────────┘ │                        │
│  │ + Story Beat │ + Story Beat │ + Story Beat │                        │
│  └──────────────┴──────────────┴──────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Beats**: 15 Save the Cat beats organized by act
- **Story Beats**: Aligned to beats via ALIGNS_WITH edges, shown as collapsible containers
- **Scenes**: Nested under story beats they satisfy via SATISFIED_BY edges
- **Stash Section**: Shows unassigned story beats, scenes, and stashed ideas at bottom

### Story Beats

List view of all story beats (narrative milestones that align to structural beats).

- **Fields**: title, summary, intent, priority, stakes_change
- **Intent Types**: PLOT, CHARACTER, TONE
- **Progress**: Based on SATISFIED_BY edges from scenes

### Scenes

List view of all scenes.

- **Fields**: heading, scene_overview, mood, int_ext, time_of_day
- **Progress**: Complete if has both HAS_CHARACTER and LOCATED_AT edges
- **Gaps**: "Scene Without Character", "Scene Without Location"

---

## Node Editing

The **Node Editor** allows direct modification of committed graph nodes within the Workspace.

### Entering Edit Mode

1. Select a node from the node list in any Foundations or Outline category
2. Click **Edit Node** in the detail panel
3. The panel switches to edit mode

### Edit Mode Components

| Component | Purpose |
|-----------|---------|
| **NodeEditor** | Form with editable fields for the node type |
| **PatchBuilder** | Preview of UPDATE_NODE operations |
| **LintPanel** | Real-time validation of changes |
| **CommitPanel** | Validation status and commit button |

### Editable Fields by Node Type

| Node Type | Editable Fields |
|-----------|-----------------|
| **Beat** | guidance, notes, status |
| **Scene** | title, heading, scene_overview, mood, int_ext, time_of_day, status |
| **Character** | name, description, archetype, status |
| **Location** | name, description, atmosphere |
| **StoryBeat** | title, summary, intent, priority, stakes_change, status |
| **Object** | name, description |
| **CharacterArc** | arc_type, start_state, end_state, turn_refs, status |

### PatchBuilder Preview

Shows pending changes as UPDATE_NODE operations:
- Field name being modified
- Old value (with red indicator)
- New value (with green indicator)

### Committing Changes

1. Make edits in the form fields
2. Click **Save Changes** to stage your edits (PatchBuilder and validation panels appear)
3. Review changes in PatchBuilder (shows old → new values)
4. Check validation status in CommitPanel (must show "Ready to commit")
5. Click **Commit Changes** to apply to the graph
6. A new version is created with the updates
7. Edit mode closes and node detail refreshes

### Canceling Edits

Click **Cancel** to:
- Discard all pending changes
- Exit edit mode
- Return to read-only detail view

### Node Deletion

The **Delete** button in the Node Detail Panel allows you to remove nodes from the graph.

#### Delete Confirmation Modal

When you click Delete, a modal appears showing:

1. **Node Info**: The type and label of the node being deleted
2. **Connection Summary**: Number of edges that will be removed
3. **Orphan Warning**: Nodes that will become orphaned (lose all connections)
4. **Connected Nodes**: List of nodes that will lose their connection to this node

#### Deletion Workflow

1. Click **Delete** on a node
2. Review the deletion impact in the modal
3. Check which nodes (if any) will become orphaned
4. Click **Delete** to confirm or **Cancel** to abort
5. A new version is created with the node and its edges removed

---

## Edge Editing

The **Relations** section in the Node Detail Panel supports interactive edge editing, allowing you to create, modify, and delete relationships between nodes.

### Relations Section

When viewing a node, the Relations section shows:

```
┌─────────────────────────────────────────────────────────┐
│ RELATIONS                                    [+ Add]    │
├─────────────────────────────────────────────────────────┤
│ OUTGOING (2)                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ HAS_CHARACTER → char_john  Character  [✎] [×]      │ │
│ │ LOCATED_AT → loc_primary  Location    [✎] [×]      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ INCOMING (1)                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Hero's Call  StoryBeat → SATISFIED_BY  [✎] [×]     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Edge Actions

| Button | Action |
|--------|--------|
| **+ Add** | Open the Add Relation modal to create a new edge |
| **✎ (Edit)** | Open the Edit Edge modal to modify properties/status |
| **× (Delete)** | Add edge deletion to pending changes |

### Adding a New Relation

Click **+ Add** to open the Add Relation modal with a guided 3-step flow:

#### Step 1: Select Edge Type

Choose the relationship type based on the current node:

| Edge Type | Source → Target |
|-----------|-----------------|
| **PARENT_OF** | Location → Location (hierarchy) |
| **SATISFIED_BY** | StoryBeat → Scene |
| **ALIGNS_WITH** | StoryBeat → Beat |
| **HAS_CHARACTER** | Scene → Character |
| **LOCATED_AT** | Scene → Location |
| **FEATURES_OBJECT** | Scene → Object |
| **PRECEDES** | StoryBeat → StoryBeat |
| **ADVANCES** | StoryBeat → CharacterArc |
| **HAS_ARC** | Character → CharacterArc |
| **HAS_TURN_IN** | CharacterArc → Beat/Scene |

*Only valid edge types for the current node type are shown.*

#### Step 2: Select Target Node

- Use the searchable dropdown to find the target node
- Filtered by allowed target types for the selected edge type
- Shows node label and type badge

#### Step 3: Configure Properties

Set optional properties based on the edge type:

| Property | Description | Edge Types |
|----------|-------------|------------|
| **Order** | Sequence number (≥1) | SATISFIED_BY, HAS_CHARACTER |
| **Confidence** | AI confidence score (0-1) | ALIGNS_WITH |
| **Notes** | Human-readable annotation | All types |

### Editing an Existing Edge

Click the **✎** button on any edge to open the Edit Edge modal:

- **Read-only fields**: Type, From, To (cannot be changed)
- **Editable fields**: Properties and Status
- **Status options**: Proposed, Approved, Rejected

### Edge Status

| Status | Meaning |
|--------|---------|
| **Proposed** | AI-suggested, awaiting human review |
| **Approved** | Confirmed by human (default for manual edits) |
| **Rejected** | Marked as invalid |

### Pending Edge Changes

Edge operations are batched before committing. The **Edge Patch Builder** shows pending changes:

```
┌─────────────────────────────────────────────────────────┐
│ Pending Edge Changes (2)                                │
├─────────────────────────────────────────────────────────┤
│ 1. ADD_EDGE                                             │
│    HAS_CHARACTER: scene_001 → char_new                  │
│                                                         │
│ 2. UPDATE_EDGE                                          │
│    edge_abc123                                          │
│    set: { order: 5 }                                    │
├─────────────────────────────────────────────────────────┤
│ [Discard All]                              [Commit All] │
└─────────────────────────────────────────────────────────┘
```

### Edge Editing Workflow

1. **Make changes**: Add, edit, or delete edges
2. **Review pending**: Check the Edge Patch Builder
3. **Commit or discard**: Apply all changes atomically or cancel

---

## Input Panel & Extraction

The **Input Panel** in the Workspace allows freeform text extraction to create story elements.

### Location

Found in the right column of the FoundationsPanel, visible when any category is selected.

### Components

| Element | Purpose |
|---------|---------|
| **Textarea** | Enter freeform text (character descriptions, scene ideas, etc.) |
| **Target Type** | Dropdown to specify extraction type |
| **Extract Button** | Process input and generate proposals |

### Target Types

| Type | Result |
|------|--------|
| **Auto-detect** | System determines best extraction type |
| **Story Context** | Extract constitution fields and guidelines |
| **Character** | Extract character nodes |
| **Location** | Extract location nodes |
| **Scene** | Extract scene nodes |
| **StoryBeat** | Extract story beat nodes |
| **Object** | Extract significant props/items |

### Extraction Workflow

1. Enter text describing a story element
2. Select target type (or use auto-detect)
3. Click **Extract**
4. Review generated proposals
5. Click **Accept** on proposals you want to apply

**Note:** Extracted scenes will appear in the Stash section of the Structure Board until they are connected to a StoryBeat via SATISFIED_BY edge.

### Proposal Cards

Each proposal shows:
- Title describing the extraction
- Confidence score
- List of entities that will be created
- Number of patch operations

---

## Lint Panel & Pre-Commit Validation

The **Lint Panel** validates your story graph for structural integrity and completeness, appearing in edit mode below the pending changes preview.

### Understanding Lint Rules

The lint system has two types of rules:

| Type | Severity | Commit Behavior |
|------|----------|-----------------|
| **Hard Rules** | Error (red) | Block commit until fixed |
| **Soft Rules** | Warning (orange) | Allow commit with confirmation |

### Hard Rules (Errors)

Hard rules protect structural integrity. Violations must be fixed before committing.

| Rule | Description | Auto-Fix |
|------|-------------|----------|
| **Scene Order Unique** | Two scenes in same beat cannot share the same order | Re-indexes scenes sequentially (1, 2, 3...) |
| **Scene-Act Boundary** | Scene's beat must have the correct act for its beat type | Corrects the beat's act field |
| **STC Beat Ordering** | Beat's position must match Save The Cat canonical order | Corrects the position index |

### Soft Rules (Warnings)

Soft rules check completeness. They warn but don't block commits.

| Rule | Description |
|------|-------------|
| **Story Has Logline** | StoryContext.constitution.logline should be set |
| **Location Tagged** | Locations should include a descriptive tag or parent |
| **Scene Has Character** | Scene should have at least one character assigned |
| **Scene Has Location** | Scene should have a location assigned |
| **Scene Has StoryBeat** | Scene should be connected to a StoryBeat |
| **StoryBeat Has Intent** | StoryBeat should have intent specified |
| **StoryBeat Event Realization** | Approved StoryBeat should have scenes satisfying it |
| **StoryBeat Has Criteria** | StoryBeat should have satisfaction criteria |

### Lint Panel Display

When in edit mode, the Lint Panel shows:

```
┌─────────────────────────────────────────────────────────────┐
│ LINT                                    [All Clear] ✓       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ No violations found                                         │
│                                                             │
│                                [Run Full Lint]              │
└─────────────────────────────────────────────────────────────┘
```

Or with violations:

```
┌─────────────────────────────────────────────────────────────┐
│ LINT                           [1 Error] [2 Warnings]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ! Scene order conflict in beat_Catalyst                     │
│   2 scenes have order_index 1                               │
│                          [Re-index 2 scenes in beat...]     │
│                                                             │
│ ^ Scene "INT. CAFE - DAY" has no characters assigned        │
│                                                             │
│ ^ Scene "INT. CAFE - DAY" has no location assigned          │
│                                                             │
│ [Apply All Fixes (1)]                  [Run Full Lint]      │
└─────────────────────────────────────────────────────────────┘
```

### Lint Badge Colors

| Badge | Meaning |
|-------|---------|
| **All Clear** (green) | No violations |
| **N Errors** (red) | Hard rule violations that block commit |
| **N Warnings** (orange) | Soft rule violations (informational) |

### Auto-Lint Behavior

- Lint runs automatically ~600ms after you stop editing
- Only checks the edited node and related nodes (touched scope)
- Use "Run Full Lint" for a complete graph check

### Applying Fixes

For violations with auto-fixes:

1. Click the blue **fix button** on the violation to apply that fix
2. Or click **Apply All Fixes** to fix all fixable violations at once
3. The panel updates to show remaining violations

### Pre-Commit Modal

When you click **Commit Changes**, the system checks for violations:

#### Scenario 1: Hard Errors Present

```
┌─────────────────────────────────────────────────────────────┐
│ Commit Blocked                                        [x]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ There is 1 error that must be fixed before committing.      │
│                                                             │
│ Errors (1)                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ! Scene order conflict in beat_Catalyst                 │ │
│ │                        [Re-index 2 scenes in beat...]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│            [Cancel]                    [Apply All Fixes]    │
└─────────────────────────────────────────────────────────────┘
```

- **Cannot proceed** until errors are fixed
- Use fix buttons or "Apply All Fixes"
- After fixing, the modal updates and allows commit

#### Scenario 2: Warnings Only

```
┌─────────────────────────────────────────────────────────────┐
│ Review Before Commit                                  [x]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Warnings (2)                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ^ Scene "INT. CAFE - DAY" has no characters assigned    │ │
│ │ ^ Scene "INT. CAFE - DAY" has no location assigned      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│   [Cancel]                         [Proceed with Warnings]  │
└─────────────────────────────────────────────────────────────┘
```

- Warnings are shown for awareness
- Click **Proceed with Warnings** to commit anyway
- Or click **Cancel** to go back and address them

#### Scenario 3: No Violations

- No modal appears
- Commit proceeds immediately

### Lint Workflow Summary

1. **Edit a node** → Auto-lint runs after you stop typing
2. **Review violations** → See errors (red) and warnings (orange)
3. **Apply fixes** → Click fix buttons for auto-fixable issues
4. **Commit** → If errors exist, fix them first; warnings can be bypassed

---

## Feature Catalog

### Complete Component List

#### Layout Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Header** | Top | Application title and branding |
| **ViewTabs** | Below header | Switch between Stories and Workspace views |

#### Stories Tab Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **StoriesView** | Main | Container for story management |
| **StoryCard** | Left column | Clickable card for each story |
| **BranchSelector** | Right column | Branch dropdown and creation |
| **VersionHistory** | Right column | Timeline of versions with restore |

#### Workspace Tab Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **WorkspaceView** | Main | Container for unified editing |
| **StoryMap** | Left panel | Navigation with progress indicators |
| **FoundationsPanel** | Main panel | List+editor for foundation categories |
| **OutlineView** | Main panel | Beat board for Structure Board category |

#### FoundationsPanel Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **NodeList** | Left pane | List of nodes for selected category |
| **NodeDetailPanel** | Center pane | Full node properties and relations |
| **NodeRelations** | Center pane | Incoming/outgoing edges with edit/delete buttons |
| **NodeEditor** | Center pane | Edit form for node fields |
| **PatchBuilder** | Center pane | Preview of pending UPDATE_NODE ops |
| **CommitPanel** | Center pane | Validation and commit button |
| **GapList** | Left pane (below list) | Gaps filtered to selected category |
| **InputPanel** | Right pane | Freeform text extraction |
| **LintPanel** | Center pane | Lint violations and fix buttons |

#### Modal Components

| Component | Purpose |
|-----------|---------|
| **AddRelationModal** | 3-step guided form for creating edges |
| **EditEdgeModal** | Form for editing edge properties/status |
| **EdgePropertiesForm** | Schema-aware property inputs per edge type |
| **NodePicker** | Searchable dropdown for target node selection |
| **PreCommitModal** | Blocking modal for commit validation |
| **DeleteNodeModal** | Confirmation dialog for node deletion with orphan detection |
| **BulkAttachModal** | Bulk edge creation with ordering support |

#### Outline View Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **OutlineView** | Main | Container for outline grid |
| **ActRow** | Main | Horizontal row for each act |
| **BeatColumn** | Within ActRow | Column for each beat |
| **SceneCard** | Within BeatColumn | Scene display within StoryBeat |
| **EmptyBeatSlot** | Within BeatColumn | Visual indicator for beats with no StoryBeats |

### All User Interactions

#### Stories Tab

| Interaction | Component | Effect |
|-------------|-----------|--------|
| Select story | StoryCard click | Loads story details and sets current story |
| Create story | "+ New" button | Opens form, creates new story |
| Switch branch | BranchSelector dropdown | Switches to selected branch |
| Create branch | "+ New Branch" button | Creates branch at current version |
| Restore version | VersionHistory "Restore" | Checks out selected version |

#### Workspace Tab

| Interaction | Component | Effect |
|-------------|-----------|--------|
| Select category | StoryMap click | Switches main panel content |
| View progress | StoryMap | See completion % and gap indicators |
| Select node | NodeList click | Shows node details in center pane |
| Edit node | NodeDetailPanel button | Enters edit mode |
| Delete node | NodeDetailPanel button | Opens DeleteNodeModal |
| Generate moves | NodeDetailPanel button | Creates cluster scoped to node |
| Modify field | NodeEditor form | Updates pending changes |
| Commit changes | CommitPanel button | Applies edits, creates version |
| Cancel edit | CommitPanel button | Discards changes, exits edit mode |
| Add relation | NodeRelations "+ Add" button | Opens AddRelationModal |
| Edit edge | NodeRelations edit button | Opens EditEdgeModal |
| Delete edge | NodeRelations delete button | Adds deletion to pending changes |
| Commit edge changes | EdgePatchBuilder button | Applies all pending edge ops |
| Enter text | InputPanel textarea | Prepares text for extraction |
| Extract | InputPanel button | Generates proposals from text |
| Accept proposal | ProposalCard button | Applies proposal to graph |
| Run full lint | LintPanel button | Checks entire graph for violations |
| Apply fix | ViolationItem button | Applies fix for one violation |

### Loading States

| State | Indicator |
|-------|-----------|
| Story loading | "Loading..." in story list |
| Nodes loading | "Loading..." in node list |
| Gaps loading | "Updating..." in StoryMap |
| Committing | "Committing..." button text |

---

## Troubleshooting

### Common Issues

#### "No stories available"
- Ensure the API server is running on port 3000
- Check that the data directory exists and is accessible

#### Cluster generation fails
- Verify an open question is selected
- Check API server logs for errors
- Ensure the AI service is configured

#### Move validation fails
- Review the error messages for specifics
- The suggested fix may indicate the issue
- Try a different move from the cluster

#### UI not loading
- Verify both servers are running
- Check browser console for errors
- Ensure ports 3000 and 5173 are available

### Server Commands

```bash
# Kill processes on ports (if stuck)
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Restart servers
cd packages/api && npm start
cd packages/ui && npm run dev
```

---

## Design Philosophy

### Key Principles

1. **Preview Before Commit**: Always see what changes will be made before accepting
2. **No Editing in Clusters**: Clusters are for selection only; edits happen on committed state
3. **Single Move Selection**: Focus on one change at a time for clarity
4. **Validation First**: Cannot accept invalid moves
5. **Transparent Diffs**: See exactly what changed after each acceptance

### Intended Workflow

```
Select Story → Review OQs → Select OQ → Generate Cluster
     ↓
Review Moves → Select Move → Preview Patch → Validate
     ↓
Accept (creates version) OR Reject (try again)
     ↓
Review Diff → Continue with next OQ
```

---

## Appendix: Data Types Reference

### Open Question Fields
- `id`: Unique identifier
- `message`: Human-readable question text
- `domain`: STRUCTURE | SCENE | CHARACTER
- `group_key`: Grouping key for clustering
- `target_node_id`: Related graph node (optional)

### Move Fields
- `id`: Unique identifier
- `title`: Short description
- `rationale`: Explanation
- `confidence`: 0.0 - 1.0

### Patch Operation Fields
- `op`: ADD_NODE | DELETE_NODE | UPDATE_NODE | ADD_EDGE | DELETE_EDGE
- `type`: Node or edge type
- `id`: Target node ID
- `data`: Node data (for ADD/UPDATE)
- `edge`: { type, source, target } (for edge operations)

### Validation Error Fields
- `code`: Error type code
- `node_id`: Affected node (optional)
- `field`: Affected field (optional)
- `suggested_fix`: Resolution hint (optional)
