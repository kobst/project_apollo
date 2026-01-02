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
9. [Feature Catalog](#feature-catalog)
10. [Troubleshooting](#troubleshooting)

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

The application uses a **3-column layout** with a footer action bar:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Apollo Contract UI                                 │
├─────────────┬─────────────────────────┬─────────────────────┤
│ LEFT COLUMN │ CENTER COLUMN           │ RIGHT COLUMN        │
│             │                         │                     │
│ Story State │ Exploration             │ Inspection          │
│ & Questions │ & Cluster Generation    │ & Validation        │
├─────────────┴─────────────────────────┴─────────────────────┤
│  Footer: Action Buttons (Accept / Reject / Regenerate)      │
└─────────────────────────────────────────────────────────────┘
```

### Column Purposes

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

## Feature Catalog

### Complete Component List

| Component | Location | Purpose |
|-----------|----------|---------|
| **Header** | Top | Application title and branding |
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

### All User Interactions

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
