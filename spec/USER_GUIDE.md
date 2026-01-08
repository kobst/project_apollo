# Apollo Contract UI - User Guide

A comprehensive guide to using the Apollo Contract UI for screenplay development.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Stories Tab](#stories-tab)
4. [Workspace Tab](#workspace-tab)
5. [Story Map Navigation](#story-map-navigation)
6. [Foundations Categories](#foundations-categories)
7. [Outline Categories](#outline-categories)
8. [Node Editing](#node-editing)
9. [Edge Editing](#edge-editing)
10. [Input Panel & Extraction](#input-panel--extraction)
11. [Lint Panel & Pre-Commit Validation](#lint-panel--pre-commit-validation)
12. [Feature Catalog](#feature-catalog)
13. [Troubleshooting](#troubleshooting)

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

The application uses a **tabbed interface** with two main views:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Apollo Contract UI                                 │
├─────────────────────────────────────────────────────────────┤
│  [Stories]  [Workspace]   ← View Tabs                       │
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
│ ├─ Premise   │                                              │
│ ├─ Genre/... │ ┌─────────┬─────────────────┬──────────────┐ │
│ ├─ Setting   │ │ Node    │ Node Detail     │ Input Panel  │ │
│ ├─ Chars     │ │ List    │ Panel           │              │ │
│ ├─ Conflicts │ │         │                 │ [Extract]    │ │
│ └─ Themes    │ │         │                 │              │ │
│              │ │         │ [Edit] [Delete] │              │ │
│ Outline      │ │         │                 │              │ │
│ ├─ Board     │ ├─────────┴─────────────────┴──────────────┤ │
│ ├─ PlotPts   │ │ Gaps (filtered to category)              │ │
│ └─ Scenes    │ └──────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

---

## Story Map Navigation

The **Story Map** is the left navigation panel in the Workspace. It shows all story categories with progress indicators.

### Structure

```
Story Map
├── Foundations
│   ├── Premise         [========  ] 1/1  ✓
│   ├── Genre/Tone      [          ] 0/1
│   ├── Setting         [====      ] 1/2
│   ├── Characters      [======    ] 3/5  !
│   ├── Conflicts       [==========] 3/3  ✓
│   └── Themes/Motifs   [===       ] 1/3
│
└── Outline
    ├── Structure Board [==========] 15/15 ✓
    ├── Plot Points     [          ] 0/3
    └── Scenes          [==        ] 3/40 !
```

### Progress Indicators

| Element | Description |
|---------|-------------|
| **Progress Bar** | Visual fill showing completion percentage |
| **Count** | `covered/total` for the category |
| **Status Badge** | Gap severity indicator |

### Progress Bar Colors

| Color | Meaning |
|-------|---------|
| **Green** | >= 80% complete |
| **Orange** | >= 50% complete |
| **Red** | < 50% complete |
| **Gray** | 0% (empty) |

### Status Badges

| Badge | Meaning |
|-------|---------|
| **!** (red) | Has blocker-level gaps |
| **?** (orange) | Has warning-level gaps |
| **i** (blue) | Has info-level gaps |
| (none) | No gaps |

### Navigation

- **Click** any category to view its contents in the main panel
- **Selected** category is highlighted with a border
- Progress updates automatically when you make changes

---

## Foundations Categories

The Foundations section contains the core building blocks of your story.

### Premise

The central concept of your story.

- **Expected**: 1 premise per story
- **Fields**: logline, concept, hook, notes
- **Gaps**: "Missing Premise" if none exists

### Genre/Tone

The genre classification and tonal qualities.

- **Expected**: 1 GenreTone node per story
- **Fields**: genre, secondary_genre, tone, tone_description, conventions
- **Gaps**: "Missing GenreTone" if none exists

### Setting

The world and time period of your story.

- **Expected**: At least 1 Setting
- **Fields**: name, description, time_period, atmosphere
- **Related**: Locations connect to Settings via PART_OF edges

### Characters

The people in your story.

- **Fields**: name, description, archetype, status
- **Progress**: Based on character completeness
- **Gaps**: Character-specific issues from lint rules

### Conflicts

The driving tensions and obstacles.

- **Fields**: name, description, conflict_type, status
- **Related**: Connect to Characters via INVOLVES edges
- **Gaps**: Conflict completeness issues

### Themes/Motifs

Thematic elements and recurring symbols.

- **Themes**: Abstract ideas (statement, notes)
- **Motifs**: Recurring symbols/imagery (name, description)
- **Gaps**: "Orphaned Theme" or "Orphaned Motif" if not connected to scenes

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
│  │ + Plot Point │ + Plot Point │ + Plot Point │                        │
│  └──────────────┴──────────────┴──────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Beats**: 15 Save the Cat beats organized by act
- **Plot Points**: Aligned to beats, shown as collapsible containers
- **Scenes**: Nested under plot points they satisfy
- **Unassigned Scenes**: Shown at bottom if not connected to plot points

### Plot Points

List view of all plot points.

- **Fields**: title, summary, intent, criteria_of_satisfaction, priority, urgency
- **Intent Types**: PLOT, CHARACTER, THEME, TONE
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
| **Premise** | logline, concept, hook, notes |
| **Setting** | name, description, time_period, atmosphere, notes |
| **GenreTone** | genre, secondary_genre, tone, tone_description, conventions, notes |
| **Beat** | guidance, notes, status |
| **Scene** | title, heading, scene_overview, mood, int_ext, time_of_day, status |
| **Character** | name, description, archetype, status |
| **Conflict** | name, description, conflict_type, status |
| **Location** | name, description, atmosphere |
| **Theme** | statement, notes |
| **Motif** | name, description |
| **PlotPoint** | title, summary, intent, criteria_of_satisfaction, priority, urgency, stakes_change, status, act |
| **Object** | name, description, significance |

### PatchBuilder Preview

Shows pending changes as UPDATE_NODE operations:
- Field name being modified
- Old value (with red indicator)
- New value (with green indicator)

### Committing Changes

1. Make edits in the form
2. Review changes in PatchBuilder
3. Check validation status (must show "Ready to commit")
4. Click **Commit Changes**
5. A new version is created with the updates
6. Edit mode closes and node detail refreshes

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
│ │ FULFILLS → beat_Catalyst  Beat     [✎] [×]         │ │
│ │ LOCATED_AT → loc_primary  Location [✎] [×]         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ INCOMING (1)                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Central Conflict  Conflict → INVOLVES  [✎] [×]     │ │
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
| **DEFINES** | Premise → Conflict |
| **PART_OF** | Location → Setting |
| **SET_IN** | Scene → Setting |
| **SATISFIED_BY** | PlotPoint → Scene |
| **ALIGNS_WITH** | PlotPoint → Beat |
| **HAS_CHARACTER** | Scene → Character |
| **LOCATED_AT** | Scene → Location |
| **INVOLVES** | Conflict → Character |
| **MANIFESTS_IN** | Conflict → Scene |
| **EXPRESSED_IN** | Theme → Scene/Beat |
| **APPEARS_IN** | Motif → Scene |
| **FEATURES_OBJECT** | Scene → Object |
| **PRECEDES** | PlotPoint → PlotPoint |
| **ADVANCES** | PlotPoint → CharacterArc/Theme |
| **SETS_UP** | PlotPoint → Motif |
| **PAYS_OFF** | PlotPoint → Motif |

*Only valid edge types for the current node type are shown.*

#### Step 2: Select Target Node

- Use the searchable dropdown to find the target node
- Filtered by allowed target types for the selected edge type
- Shows node label and type badge

#### Step 3: Configure Properties

Set optional properties based on the edge type:

| Property | Description | Edge Types |
|----------|-------------|------------|
| **Order** | Sequence number (≥1) | SATISFIED_BY, HAS_CHARACTER, MANIFESTS_IN, APPEARS_IN |
| **Weight** | Strength of relation (0-1) | INVOLVES, MANIFESTS_IN, EXPRESSED_IN |
| **Confidence** | AI confidence score (0-1) | EXPRESSED_IN, ALIGNS_WITH |
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
| **Premise** | Extract story premise/logline |
| **Setting** | Extract world/time period setting |
| **GenreTone** | Extract genre and tone |
| **Character** | Extract character nodes |
| **Location** | Extract location nodes |
| **Scene** | Extract scene nodes |
| **Conflict** | Extract conflict nodes |
| **PlotPoint** | Extract plot point nodes |
| **Theme** | Extract thematic elements |
| **Motif** | Extract recurring symbols/imagery |
| **Object** | Extract significant props/items |

### Extraction Workflow

1. Enter text describing a story element
2. Select target type (or use auto-detect)
3. Click **Extract**
4. Review generated proposals
5. Click **Accept** on proposals you want to apply

**Note:** Extracted scenes will appear in the "Unassigned" section of the Structure Board until they are connected to a PlotPoint via SATISFIED_BY edge.

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
| **Story Has Premise** | Story should have a Premise node with logline |
| **Location Has Setting** | Location should be part of a Setting |
| **Scene Has Character** | Scene should have at least one character assigned |
| **Scene Has Location** | Scene should have a location assigned |
| **Scene Has PlotPoint** | Scene should be connected to a PlotPoint |
| **Theme Not Orphaned** | Theme should be expressed in at least one scene or beat |
| **Motif Not Orphaned** | Motif should appear in at least one scene |
| **PlotPoint Has Intent** | PlotPoint should have intent specified |
| **PlotPoint Event Realization** | Approved PlotPoint should have scenes satisfying it |
| **PlotPoint Has Criteria** | PlotPoint should have satisfaction criteria |

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
| **SceneCard** | Within BeatColumn | Scene display within PlotPoint |
| **EmptyBeatSlot** | Within BeatColumn | Visual indicator for beats with no PlotPoints |

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
- `phase`: OUTLINE | DRAFT | REVISION
- `severity`: BLOCKING | IMPORTANT | SOFT
- `domain`: STRUCTURE | SCENE | CHARACTER | CONFLICT | THEME_MOTIF
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
