# Apollo Contract UI - User Guide

A comprehensive guide to using the Apollo Contract UI for screenplay development.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Story Management](#story-management)
4. [Working with Open Questions](#working-with-open-questions)
5. [Generating Move Clusters](#generating-move-clusters)
6. [Previewing Moves](#previewing-moves)
7. [Accepting or Rejecting Moves](#accepting-or-rejecting-moves)
8. [Understanding Diffs](#understanding-diffs)
9. [Explore View](#explore-view)
10. [Edge Editing](#edge-editing)
11. [Outline View](#outline-view)
12. [Input Panel & Extraction](#input-panel--extraction)
13. [Node Editing](#node-editing)
14. [Lint Panel & Pre-Commit Validation](#lint-panel--pre-commit-validation)
15. [Feature Catalog](#feature-catalog)
16. [Troubleshooting](#troubleshooting)

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
│  [Contract]  [Explore]  [Outline]   ← View Tabs             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              View-specific content                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### View Tabs

| Tab | Purpose |
|-----|---------|
| **Contract** | Open questions workflow with cluster generation (original view) |
| **Explore** | Node browser with detail panel, input extraction, and editing |
| **Outline** | Beat-by-beat structure view with scenes organized by act |

### Contract View Layout (3-Column)

```
┌─────────────┬─────────────────────────┬─────────────────────┐
│ LEFT COLUMN │ CENTER COLUMN           │ RIGHT COLUMN        │
│             │                         │                     │
│ Story State │ Exploration             │ Inspection          │
│ & Questions │ & Cluster Generation    │ & Validation        │
├─────────────┴─────────────────────────┴─────────────────────┤
│  Footer: Action Buttons (Accept / Reject / Regenerate)      │
└─────────────────────────────────────────────────────────────┘
```

| Column | Purpose |
|--------|---------|
| **Left** | Story selection, status display, and open questions list |
| **Center** | Cluster generation controls and move cards |
| **Right** | Patch preview, validation status, and diff visualization |
| **Footer** | Primary action buttons for the current workflow |

---

## Story Management

### Creating a New Story

1. Click **"+ New"** button in the Story Selector
2. Fill in the form:
   - **Name** (optional): A short identifier for the story
   - **Logline** (required): A one-sentence description of your story
3. Click **"Create"** to create the story
4. Click **"Cancel"** to dismiss the form

### Selecting an Existing Story

1. Use the **dropdown menu** in the Story Selector
2. Click on any story ID to select it
3. The story's status and open questions will load automatically

### Understanding Story Status

Once a story is selected, the **Story Status** panel displays:

| Field | Description |
|-------|-------------|
| **Name** | The story's display name |
| **Logline** | The one-sentence description |
| **Phase** | Current development phase: `OUTLINE`, `DRAFT`, or `REVISION` |
| **Branch** | Current branch name (or "detached" if not on a branch) |
| **Version** | Current version ID (first 8 characters shown) |
| **Stats** | Counts of Scenes, Beats, Characters, and Conflicts in the graph |

---

## Working with Open Questions

### What are Open Questions?

Open Questions (OQs) are AI-identified gaps, inconsistencies, or opportunities in your story's knowledge graph. They guide the creative development process by highlighting areas that need attention.

### Severity Levels

| Severity | Color | Meaning |
|----------|-------|---------|
| **BLOCKING** | Red | Critical issues that prevent story progression |
| **IMPORTANT** | Yellow | Significant issues that should be addressed |
| **SOFT** | Blue | Minor improvements or optional enhancements |

### Domain Categories

| Domain | Scope |
|--------|-------|
| **STRUCTURE** | Overall story architecture (acts, sequences) |
| **SCENE** | Individual scene issues (missing beats, unclear goals) |
| **CHARACTER** | Character-related gaps (motivation, arc, relationships) |
| **CONFLICT** | Conflict and tension issues |
| **THEME_MOTIF** | Thematic consistency and motif tracking |

### Selecting a Question

1. Review the **Open Questions** list in the left column
2. Note the severity badge and domain for each question
3. **Click on a question** to select it
4. The selected question will be highlighted
5. The center column will display the question text and enable cluster generation

---

## Generating Move Clusters

### What is a Cluster?

A **cluster** is a set of AI-generated "moves" that address a selected open question. Each move is a proposed change to your story's knowledge graph.

### Cluster Controls

Located at the top of the center column:

| Control | Description |
|---------|-------------|
| **Selected Question** | Displays the OQ you're working on |
| **Count Slider** | Adjust how many moves to generate (1-12) |
| **Show Seed** | Toggle to display/hide the random seed value |
| **Generate/Regenerate** | Button to create a new cluster |

### Adjusting Move Count

- **Default**: 4 moves
- **Range**: 1 to 12 moves
- **Tip**: Start with 4-6 moves, increase if you want more variety

### Using Seeds for Reproducibility

1. Enable **"Show seed"** checkbox
2. After generating, the seed value will be displayed
3. The same seed + question + count produces identical results
4. Use this for debugging or sharing specific generations

### Generating a Cluster

1. **Select an Open Question** (left column)
2. **Adjust the count** if desired (default: 4)
3. Click **"Generate Cluster"** button
4. Wait for generation to complete
5. Move cards will appear below the controls

### Regenerating

Click **"Regenerate"** to:
- Generate a new set of moves
- Uses the same count setting
- Produces different results (new seed)

---

## Previewing Moves

### Understanding Move Cards

Each generated move appears as a card displaying:

| Element | Description |
|---------|-------------|
| **Title** | Short description of what the move does |
| **Confidence** | AI's confidence score (percentage) |
| **Rationale** | Explanation of why this move addresses the OQ |
| **Move ID** | Unique identifier for the move |

### Confidence Score Colors

| Score | Color | Meaning |
|-------|-------|---------|
| **80%+** | Green | High confidence - likely a good fit |
| **50-79%** | Yellow | Medium confidence - review carefully |
| **< 50%** | Red | Low confidence - may need alternatives |

### Selecting a Move for Preview

1. **Click on a Move Card** in the center column
2. The card will show a "Selected" badge
3. The **right column** will display:
   - Patch Preview (all operations)
   - Validation Status

### Understanding Patch Operations

The **Patch Preview** panel shows all graph operations:

| Operation | Color | Description |
|-----------|-------|-------------|
| **ADD_NODE** | Green | Creates a new node (scene, character, etc.) |
| **DELETE_NODE** | Red | Removes an existing node |
| **UPDATE_NODE** | Gray | Modifies properties of an existing node |
| **ADD_EDGE** | Green | Creates a relationship between nodes |
| **DELETE_EDGE** | Red | Removes a relationship |

#### Operation Details

- **Node operations** show: type, ID, and data fields
- **Edge operations** show: type and "source → target" nodes
- **Update operations** show: field name, old value → new value

### Validation Status

After selecting a move, the **Validation Status** panel shows:

| Status | Meaning |
|--------|---------|
| **Valid** (green checkmark) | Move can be safely applied |
| **Invalid** (red X) | Move has errors that prevent application |

#### Validation Errors

If invalid, you'll see error details:
- **Code**: Error type identifier
- **Node ID**: Which node is affected
- **Field**: Which field has the issue
- **Suggested Fix**: Recommended resolution

---

## Accepting or Rejecting Moves

### The Action Bar

Located in the footer, contains three buttons:

| Button | Action | When Enabled |
|--------|--------|--------------|
| **Reject All** | Clear cluster and start over | When cluster exists |
| **Regenerate** | Generate new cluster | When OQ is selected |
| **Accept Move** | Apply selected move | When valid move is selected |

### Accept Move Workflow

1. **Select a move** from the cluster
2. **Review the patch preview** to understand changes
3. **Verify validation** shows "Valid"
4. Click **"Accept Move"**
5. The system will:
   - Apply the patch to create a new version
   - Display the diff of changes
   - Refresh the story status
   - Refresh open questions (some may be resolved)
   - Clear the cluster

### Reject All Workflow

1. Click **"Reject All"**
2. The current cluster is discarded
3. All selections are cleared
4. You can now:
   - Select a different open question
   - Regenerate moves for the same question
   - Review story status

### Regenerate Workflow

1. Click **"Regenerate"**
2. A new cluster is generated with:
   - Same selected question
   - Same count setting
   - New random seed
3. Previous cluster is replaced
4. Review and select from new moves

---

## Understanding Diffs

After accepting a move, the **Diff Visualization** appears in the right column.

### Diff Summary

Shows the version transition and change counts:

```
abc123 → def456

+2 nodes  -1 nodes  ~1 nodes
+3 edges  -0 edges
```

### Node Changes

#### Added Nodes (Green "+")
- Shows node type and label
- New content added to the graph

#### Removed Nodes (Red "-")
- Shows node type and label
- Content removed from the graph

#### Modified Nodes (Gray "~")
- Shows node type and label
- Expandable to show field-level changes:
  - **Field name**: which property changed
  - **Old value**: previous content (strikethrough)
  - **New value**: updated content

### Edge Changes

#### Added Edges (Green "+")
- Shows edge type
- Shows relationship: "source → target"

#### Removed Edges (Red "-")
- Shows edge type
- Shows relationship: "source → target"

---

## Explore View

The **Explore** tab provides a node browser for directly viewing and editing story elements.

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Beats] [Scenes] [Characters] [Conflicts] [Locations] [Themes] ...     │
├─────────────────┬───────────────────────────┬───────────────────────────┤
│ Node List       │ Node Detail Panel         │ Input Panel + Clusters    │
│                 │                           │                           │
│ ┌─────────────┐ │ Name: John Smith          │ ┌───────────────────────┐ │
│ │ John Smith  │ │ Type: Character           │ │ Extract from Input    │ │
│ │ Character   │ │ Archetype: Protagonist    │ │                       │ │
│ └─────────────┘ │                           │ │ [textarea]            │ │
│ ┌─────────────┐ │ Relations:                │ │                       │ │
│ │ Jane Doe    │ │   → Scene: Opening        │ │ [Target] [Beat]       │ │
│ │ Character   │ │   → Conflict: Internal    │ │ [Extract]             │ │
│ └─────────────┘ │                           │ └───────────────────────┘ │
│                 │ [Edit Node] [Generate]    │                           │
└─────────────────┴───────────────────────────┴───────────────────────────┘
```

### Node Type Filter

Click the tabs at the top to filter nodes by type:

| Type | Description |
|------|-------------|
| **Premise** | Story concept/logline (typically one per story) |
| **Settings** | World/time period containers (e.g., "1920s Chicago") |
| **Genre/Tone** | Combined genre and tonal declaration |
| **Themes** | Theme nodes |
| **Motifs** | Recurring symbolic elements |
| **Conflicts** | Conflict nodes |
| **Beats** | The 15 Save the Cat beats |
| **Plot Points** | Story beats that must happen |
| **Scenes** | Scene nodes linked to plot points |
| **Characters** | Character nodes |
| **Locations** | Location nodes (can be part of a Setting) |
| **Props** | Significant objects/items |

### Node List

- Shows all nodes of the selected type
- Click a node to view its details
- Displays node label and type badge

### Node Detail Panel

When a node is selected, shows:

| Section | Content |
|---------|---------|
| **Header** | Node label and type |
| **ID** | Unique node identifier |
| **Properties** | All node data fields |
| **Relations** | Incoming and outgoing edges with related nodes |
| **Actions** | "Edit Node" and "Generate Moves" buttons |

### Actions

| Button | Action |
|--------|--------|
| **Edit Node** | Enter edit mode to modify node properties |
| **Generate Moves** | Generate cluster moves scoped to this node |
| **Delete** | Open deletion confirmation modal |

---

## Node Deletion

The **Delete** button in the Node Detail Panel allows you to remove nodes from the graph.

### Delete Confirmation Modal

When you click Delete, a modal appears showing:

1. **Node Info**: The type and label of the node being deleted
2. **Connection Summary**: Number of edges that will be removed
3. **Orphan Warning**: Nodes that will become orphaned (lose all connections)
4. **Connected Nodes**: List of nodes that will lose their connection to this node

### Orphan Detection

The modal distinguishes between:

| Category | Description |
|----------|-------------|
| **Will be orphaned** | Nodes whose only connection is to the node being deleted |
| **Connections to remove** | Nodes with other connections that will remain connected to the graph |

### Deletion Workflow

1. Click **Delete** on a node
2. Review the deletion impact in the modal
3. Check which nodes (if any) will become orphaned
4. Click **Delete** to confirm or **Cancel** to abort
5. A new version is created with the node and its edges removed

**Note:** Deleting a node removes all its incident edges but does not delete connected nodes. Connected nodes that lose all their connections will appear as orphans.

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

## Outline View

The **Outline** tab displays the story structure as a beat-by-beat grid with scenes nested under PlotPoints.

### Hierarchy

The Outline enforces the **Beat → PlotPoint → Scene** hierarchy:
- **Beats** are structural templates (Save the Cat)
- **PlotPoints** align to Beats and represent "what must happen"
- **Scenes** are connected to PlotPoints via SATISFIED_BY edges

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ACT 1                                                                  │
│  ┌──────────────┬──────────────┬──────────────┐                        │
│  │ Opening      │ Theme Stated │ Setup        │                        │
│  │ Image      ? │            ? │            ? │                        │
│  ├──────────────┼──────────────┼──────────────┤                        │
│  │              │              │ ▼ Hero's     │                        │
│  │   + (empty)  │   + (empty)  │   call  PLOT │                        │
│  │              │              │ ┌──────────┐ │                        │
│  │              │              │ │INT. DINER│ │                        │
│  │              │              │ │Dawn scene│ │                        │
│  │              │              │ └──────────┘ │                        │
│  │              │              │              │                        │
│  │ + Plot Point │ + Plot Point │ + Plot Point │                        │
│  └──────────────┴──────────────┴──────────────┘                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ⚠ UNASSIGNED SCENES (2)                                         │   │
│  │ These scenes need to be connected to a PlotPoint aligned to Beat│   │
│  │ ┌─────────────┐ ┌─────────────┐                                 │   │
│  │ │INT. CAFE    │ │EXT. PARK    │                                 │   │
│  │ │No plot point│ │Orphaned     │                                 │   │
│  │ └─────────────┘ └─────────────┘                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Structure

- **Acts**: Horizontal sections grouping related beats
- **Beats**: Columns within each act showing the beat type
- **PlotPoints**: Collapsible containers within beats showing aligned plot points
- **Scenes**: Cards nested under their PlotPoints
- **Empty Slots**: Visual indicators for beats with no PlotPoints
- **Unassigned Section**: Global section at bottom for orphaned scenes

### Beat Information

Each beat column header shows:
- Beat type name (e.g., "Catalyst", "Midpoint")
- Guidance tooltip (?)

### PlotPoint Containers

Each PlotPoint container shows:
- PlotPoint title
- Intent badge (PLOT, CHARACTER, THEME, TONE)
- Nested scene cards that satisfy this PlotPoint

### Scene Cards

Each scene card displays:
- Scene heading (e.g., "INT. CAFE - DAY")
- Brief overview excerpt
- Optional mood/time badges

### Unassigned Scenes Section

A global section at the bottom shows scenes that are not properly connected:
- Scenes with no SATISFIED_BY edge to a PlotPoint
- Scenes connected to a PlotPoint that has no ALIGNS_WITH edge to a Beat

These scenes should be connected to PlotPoints to appear in the beat structure.

---

## Input Panel & Extraction

The **Input Panel** in the Explore view allows freeform text extraction to create story elements.

### Location

Found in the right column of the Explore view, above any cluster results.

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

**Note:** Extracted scenes will appear in the "Unassigned" section of the Outline view until they are connected to a PlotPoint via SATISFIED_BY edge.

### Proposal Cards

Each proposal shows:
- Title describing the extraction
- Confidence score
- List of entities that will be created
- Number of patch operations

---

## Node Editing

The **Node Editor** allows direct modification of committed graph nodes.

### Entering Edit Mode

1. Select a node in the Explore view
2. Click **Edit Node** in the detail panel
3. The panel switches to edit mode

### Edit Mode Components

| Component | Purpose |
|-----------|---------|
| **NodeEditor** | Form with editable fields for the node type |
| **PatchBuilder** | Preview of UPDATE_NODE operations |
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

### Validation

The CommitPanel validates changes before allowing commit:

| Check | Description |
|-------|-------------|
| **Required fields** | Ensures required fields aren't emptied |
| **Minimum lengths** | Validates description fields have sufficient content |

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
| **ViewTabs** | Below header | Switch between Contract, Explore, and Outline views |

#### Contract View Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **StorySelector** | Left column | Create/select stories |
| **StoryStatus** | Left column | Display story metadata and stats |
| **OpenQuestionsList** | Left column | List and select open questions |
| **OpenQuestionItem** | Left column | Individual question with severity/domain |
| **ClusterControls** | Center column | Count slider, seed toggle, generate button |
| **ClusterCard** | Center column | Container for generated moves |
| **MoveCard** | Center column | Individual move with confidence and rationale |
| **PatchPreview** | Right column | List of patch operations |
| **PatchOpItem** | Right column | Individual operation visualization |
| **ValidationStatus** | Right column | Valid/invalid status with errors |
| **DiffVisualization** | Right column | Version diff summary |
| **NodeChangeList** | Right column | Node additions/removals/modifications |
| **EdgeChangeList** | Right column | Edge additions/removals |
| **ActionBar** | Footer | Accept/Reject/Regenerate buttons |

#### Explore View Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **NodeTypeFilter** | Top | Tabs to filter nodes by type |
| **NodeList** | Left pane | List of nodes of selected type |
| **NodeCard** | Left pane | Individual node in list |
| **NodeDetailPanel** | Center pane | Full node properties and relations |
| **NodeRelations** | Center pane | Incoming/outgoing edges with edit/delete buttons |
| **NodeEditor** | Center pane | Edit form for node fields |
| **PatchBuilder** | Center pane | Preview of pending UPDATE_NODE ops |
| **CommitPanel** | Center pane | Validation and commit button |
| **AddRelationModal** | Modal | 3-step guided form for creating edges |
| **EditEdgeModal** | Modal | Form for editing edge properties/status |
| **EdgePropertiesForm** | Modal | Schema-aware property inputs per edge type |
| **NodePicker** | Modal | Searchable dropdown for target node selection |
| **EdgePatchBuilder** | Center pane | Preview of pending edge operations |
| **InputPanel** | Right pane | Freeform text extraction |
| **ProposalCard** | Right pane | Extraction proposal display |
| **LintPanel** | Center pane | Lint violations and fix buttons |
| **ViolationItem** | Center pane | Single violation with fix button |
| **PreCommitModal** | Modal | Blocking modal for commit validation |
| **DeleteNodeModal** | Modal | Confirmation dialog for node deletion with orphan detection |

#### Outline View Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **OutlineView** | Main | Container for outline grid |
| **ActRow** | Main | Horizontal row for each act |
| **BeatColumn** | Within ActRow | Column for each beat |
| **PlotPointContainer** | Within BeatColumn | Collapsible container for a PlotPoint with nested scenes |
| **SceneCard** | Within PlotPointContainer | Scene display within PlotPoint |
| **EmptyBeatSlot** | Within BeatColumn | Visual indicator for beats with no PlotPoints |
| **UnassignedSection** | Bottom of OutlineView | Global section for unconnected scenes |

### All User Interactions

#### Contract View

| Interaction | Component | Effect |
|-------------|-----------|--------|
| Select story | StorySelector dropdown | Loads story status and OQs |
| Create story | StorySelector form | Creates new story, selects it |
| Select OQ | OpenQuestionItem click | Enables cluster generation |
| Adjust count | ClusterControls slider | Sets move count for generation |
| Toggle seed | ClusterControls checkbox | Shows/hides seed value |
| Generate cluster | ClusterControls button | Creates moves for selected OQ |
| Select move | MoveCard click | Loads preview and validation |
| Deselect move | MoveCard click (selected) | Clears preview |
| Accept move | ActionBar button | Applies move, creates version |
| Reject all | ActionBar button | Clears cluster and selections |
| Regenerate | ActionBar button | Creates new cluster |

#### Explore View

| Interaction | Component | Effect |
|-------------|-----------|--------|
| Switch view | ViewTabs | Changes between Contract/Explore/Outline |
| Filter by type | NodeTypeFilter tabs | Shows nodes of selected type |
| Select node | NodeCard click | Shows node details in center pane |
| Edit node | NodeDetailPanel button | Enters edit mode |
| Delete node | NodeDetailPanel button | Opens DeleteNodeModal |
| Generate moves | NodeDetailPanel button | Creates cluster scoped to node |
| Modify field | NodeEditor form | Updates pending changes |
| Commit changes | CommitPanel button | Applies edits, creates version |
| Cancel edit | CommitPanel button | Discards changes, exits edit mode |
| Add relation | NodeRelations "+ Add" button | Opens AddRelationModal |
| Edit edge | NodeRelations "✎" button | Opens EditEdgeModal |
| Delete edge | NodeRelations "×" button | Adds deletion to pending changes |
| Select edge type | AddRelationModal step 1 | Filters available target nodes |
| Select target node | AddRelationModal step 2 | Sets edge destination |
| Set edge properties | AddRelationModal step 3 | Configures order/weight/notes |
| Save edge edits | EditEdgeModal button | Adds update to pending changes |
| Commit edge changes | EdgePatchBuilder button | Applies all pending edge ops |
| Discard edge changes | EdgePatchBuilder button | Clears pending edge ops |
| Enter text | InputPanel textarea | Prepares text for extraction |
| Select target | InputPanel dropdown | Sets extraction target type |
| Extract | InputPanel button | Generates proposals from text |
| Confirm delete | DeleteNodeModal button | Deletes node and creates new version |
| Accept proposal | ProposalCard button | Applies proposal to graph |
| Run full lint | LintPanel button | Checks entire graph for violations |
| Apply single fix | ViolationItem button | Applies fix for one violation |
| Apply all fixes | LintPanel button | Applies all available fixes |
| Proceed with warnings | PreCommitModal button | Commits despite soft rule warnings |
| Fix from modal | PreCommitModal button | Applies fixes before committing |

#### Outline View

| Interaction | Component | Effect |
|-------------|-----------|--------|
| View outline | ViewTabs | Shows beat-by-beat structure |
| Scroll acts | OutlineView | Navigate through acts horizontally |

### Loading States

| State | Indicator |
|-------|-----------|
| Story loading | "Loading..." in selector |
| Cluster generating | "Generating..." button text |
| Preview loading | Disabled move cards |
| Move accepting | "Accepting..." button text |

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
