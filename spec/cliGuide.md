# Project Apollo CLI Guide

## Overview

Project Apollo is a screenplay knowledge graph system that helps writers develop stories using a structured, graph-based approach. The system uses the **Save the Cat** 15-beat structure as its foundation and tracks story elements (characters, conflicts, locations, scenes) as nodes in a knowledge graph.

The CLI provides an interactive way to:
- Initialize stories with or without a logline
- Track open questions (gaps in your story)
- Generate move options to address those gaps
- Apply changes and iterate on your story

## Current System Architecture

### Packages

```
packages/
├── core/       # @apollo/core - Types, validation, graph operations
├── cli/        # @apollo/cli - Command-line interface
└── web/        # @apollo/web - Web frontend (placeholder)
```

### Core Concepts

| Concept | Description |
|---------|-------------|
| **GraphState** | The in-memory knowledge graph containing all story nodes and edges |
| **Nodes** | Story elements: Beat, Scene, Character, Conflict, Location, Theme, Motif, CharacterArc |
| **Edges** | Relationships between nodes: HAS_CHARACTER, LOCATED_AT, FULFILLS, INVOLVES, etc. |
| **Patch** | A set of operations (ADD_NODE, UPDATE_NODE, DELETE_NODE, ADD_EDGE, DELETE_EDGE) |
| **Open Question (OQ)** | A gap or issue in the story that needs attention |
| **Move Cluster** | A set of possible moves (patches) to address an open question |
| **Phase** | Story development phase: OUTLINE → DRAFT → REVISION |

### Edge Types (Relationships)

Edges connect nodes to form the knowledge graph. The system uses 9 edge types:

| Edge Type | Source → Target | Required | Description |
|-----------|-----------------|----------|-------------|
| **FULFILLS** | Scene → Beat | Implicit | Scene realizes/delivers the beat. Created automatically from `Scene.beat_id`. |
| **HAS_CHARACTER** | Scene → Character | DRAFT | Character appears in the scene. |
| **LOCATED_AT** | Scene → Location | DRAFT | Scene's primary location. |
| **FEATURES_OBJECT** | Scene → Object | Optional | Significant prop/object in scene. |
| **INVOLVES** | Conflict → Character | DRAFT | Character is party to the conflict. |
| **MANIFESTS_IN** | Conflict → Scene | DRAFT | Scene shows the conflict in action. |
| **HAS_ARC** | Character → CharacterArc | Optional | Arc belongs to this character. |
| **EXPRESSED_IN** | Theme → Scene/Beat | REVISION | Theme is evidenced by scene or beat. |
| **APPEARS_IN** | Motif → Scene | REVISION | Motif appears in the scene. |

**Notes:**
- FULFILLS edges are derived from `Scene.beat_id` — never create them manually via patches.
- Edges are unique by `(type, from, to)` — no duplicates allowed.
- "Required" column indicates when validation enforces the edge (by phase).

### The 15-Beat Structure

The system uses Save the Cat's 15 beats as the structural backbone:

| Act | Beats |
|-----|-------|
| Act 1 | Opening Image, Theme Stated, Setup, Catalyst, Debate |
| Act 2A | Break Into Two, B Story, Fun and Games |
| Act 2B | Midpoint, Bad Guys Close In |
| Act 3 | All Is Lost, Dark Night of Soul |
| Act 4 | Break Into Three, Finale, Final Image |

## Installation

### Prerequisites
- Node.js >= 20.0.0
- npm

### Setup

```bash
# Clone and install
cd /path/to/Apollo
npm install

# Build all packages
npm run build

# Link CLI globally
cd packages/cli
npm link
```

### Verify Installation

```bash
project-apollo --help
```

## CLI Commands

### `project-apollo init [logline]`

Initialize a new story with optional name and logline.

**With name and logline** (recommended):
```bash
project-apollo init --name "Detective Story" "A detective solves an impossible crime"
```
Creates: 15 beats + 1 character + 1 conflict + 1 location

**With logline only** (ID derived from logline):
```bash
project-apollo init "A detective solves an impossible crime in a locked room"
```

**Without logline** (empty structure):
```bash
project-apollo init --name "My Story"
```
Creates: 15 beats only

**Options:**
- `-n, --name <name>` - Story name (used to generate ID)
- `-f, --force` - Overwrite existing story with same ID

**Output:**
```
Story Initialized
─────────────────
ID: detective-story
Name: Detective Story
Logline: "A detective solves an impossible crime"

Nodes:
  Beat           15
  Character      1
  Conflict       1
  Location       1

✓ Story created and set as current.
Run "project-apollo oqs" to see open questions.
```

---

### `project-apollo list`

List all stories in the central registry.

```bash
project-apollo list
project-apollo ls    # Alias
```

**Output:**
```
Stories
───────
* detective-story  (Detective Story) "A detective solves an impossible..." (current)
  wizard-tale      (Wizard Tale) "A young wizard discovers..."
  untitled-123     (no logline)

3 stories total
```

---

### `project-apollo open <name-or-id>`

Switch to a different story.

```bash
project-apollo open detective-story    # By ID
project-apollo open "Detective Story"  # By original name
```

**Output:**
```
✓ Switched to story: detective-story
Name: Detective Story
Logline: "A detective solves an impossible crime"
```

---

### `project-apollo current`

Show the currently active story.

```bash
project-apollo current
```

**Output:**
```
Current Story
─────────────
ID: detective-story
Name: Detective Story
Logline: "A detective solves an impossible crime"
Phase: OUTLINE
Updated: 2026-01-02T12:00:00.000Z
```

---

### `project-apollo status`

Show current story summary.

```bash
project-apollo status
```

**Output:**
```
Story Status
────────────
Story: detective-story
Name: Detective Story
Logline: A detective solves an impossible crime in a locked room
Phase: OUTLINE
Updated: 2026-01-02T12:00:00.000Z

Nodes:
  Beat           15
  Scene          2
  Character      1
  Conflict       1
  Location       1

Edges: 3

Open Questions:
  13 important
  2 soft
```

---

### `project-apollo oqs [options]`

List open questions that need attention.

```bash
project-apollo oqs
project-apollo oqs --phase DRAFT
project-apollo oqs --severity BLOCKING
project-apollo oqs --domain STRUCTURE
```

**Options:**
- `-p, --phase <phase>` - Filter by phase: OUTLINE, DRAFT, REVISION
- `-s, --severity <severity>` - Filter by severity: BLOCKING, IMPORTANT, SOFT
- `-d, --domain <domain>` - Filter by domain: STRUCTURE, SCENE, CHARACTER, etc.

**Output:**
```
Open Questions (OUTLINE)
────────────────────────
Total: 15

IMPORTANT (15):
  [oq_beat_beat_OpeningImage] IMPORTANT STRUCTURE    Beat "OpeningImage" has no scenes assigned
  [oq_beat_beat_Catalyst] IMPORTANT STRUCTURE    Beat "Catalyst" has no scenes assigned
  ...

Run "project-apollo cluster <oq_id>" to generate moves for a question.
```

---

### `project-apollo cluster <oq_id> [options]`

Generate move options to address an open question.

```bash
project-apollo cluster oq_beat_beat_Catalyst
project-apollo cluster oq_beat_beat_Catalyst --count 6      # Generate 6 moves
project-apollo cluster oq_beat_beat_Catalyst --regenerate   # Try different options
project-apollo cluster oq_beat_beat_Catalyst --seed 12345   # Reproducible generation
```

**Options:**
- `-c, --count <n>` - Number of moves to generate (default: 4, max: 12)
- `-s, --seed <n>` - Seed for reproducible generation
- `-r, --regenerate` - Generate new moves with a fresh seed (implicit rejection)

**Output:**
```
ℹ Generating 4 moves for: Beat "Catalyst" has no scenes assigned

Realize beat: Catalyst
──────────────────────
Cluster ID: mc_1234567890_abc
Cluster type: STRUCTURE
Scope: OUTLINE
Seed: 1234567890

Available Moves (4):

1. [mv_1234567890_abc_0] Catalyst: Dramatic confrontation (88% confidence)
   A high-tension scene that delivers the beat through conflict.

2. [mv_1234567890_abc_1] Catalyst: Quiet revelation (75% confidence)
   A contemplative scene that delivers the beat through internal discovery.

3. [mv_1234567890_abc_2] Catalyst: Action sequence (60% confidence)
   A kinetic scene that delivers the beat through physical action.

4. [mv_1234567890_abc_3] Catalyst: Dramatic confrontation (Alt 2) (72% confidence)
   A high-tension scene that delivers the beat through conflict.

Commands:
  project-apollo preview <move_id>  - Preview a move before accepting
  project-apollo accept <move_id>   - Apply a move
  project-apollo cluster oq_beat_beat_Catalyst --regenerate - Try different options
```

**Reject All / Try Again:**
To reject all current moves and generate new options, simply run the cluster command again with `--regenerate`. This is the canonical "try again" flow—rejection is implicit when you generate a new cluster.

---

### `project-apollo preview <move_id>`

Preview a move's patch operations before accepting it.

```bash
project-apollo preview mv_1234567890_0
```

**Output:**
```
Move Preview: Catalyst: Dramatic confrontation
────────────────────────────────────────────

Confidence: 88%
Rationale: A high-tension scene that delivers the beat through conflict.

Patch Operations (3 ops):

1. ADD_NODE Scene
   id: scene_001
   heading: "INT. WIZARD TOWER - NIGHT"
   overview: "The young wizard accidentally unleashes a powerful spell..."
   beat_id: beat_Catalyst

2. ADD_EDGE HAS_CHARACTER
   scene_001 → char_protagonist

3. ADD_EDGE LOCATED_AT
   scene_001 → loc_001

Expected Effects:
  • Resolves BeatUnrealized(Catalyst)
  • Introduces protagonist agency

Style tags: dramatic, confrontation, high-tension

ℹ Patch validation: PASS

To apply this move, run:
  project-apollo accept mv_1234567890_0
```

---

### `project-apollo accept <move_id> [options]`

Apply a move's patch to the story. By default, shows a preview and asks for confirmation.

```bash
project-apollo accept mv_1234567890_0         # Shows preview, asks for confirmation
project-apollo accept mv_1234567890_0 --yes   # Skip confirmation, apply immediately
```

**Options:**
- `-y, --yes` - Skip confirmation and apply immediately

**Output (with confirmation):**
```
Accept Move: Catalyst: Dramatic confrontation
─────────────────────────────────────────────

Confidence: 88%
Rationale: A high-tension scene that delivers the beat through conflict.

Patch Operations (3 ops):

1. ADD_NODE Scene
   id: scene_001
   heading: "INT. WIZARD TOWER - NIGHT"
   overview: "The young wizard accidentally unleashes..."
   beat_id: beat_Catalyst

2. ADD_EDGE HAS_CHARACTER
   scene_001 → char_protagonist

3. ADD_EDGE LOCATED_AT
   scene_001 → loc_001

Apply this patch? [y/N] y
✓ Move accepted: Catalyst: Dramatic confrontation
Patch applied: 3 operations
```

**Validation Failure:**
If the patch fails validation, the command shows structured errors with suggested fixes:
```
Validation Failed: 2 errors

1. FK_INTEGRITY
   Scene "scene_001" references non-existent Beat "beat_INVALID"
   node: scene_001
   field: beat_id
   fix: Ensure the beat exists before creating the scene

2. CONSTRAINT_VIOLATION
   Scene "scene_001" has scene_overview shorter than 20 characters
   node: scene_001
   field: scene_overview
   fix: Scene overview must be at least 20 characters

Next Actions:
  • Regenerate moves: project-apollo cluster <oq_id> --regenerate
  • Add missing nodes: project-apollo add <type> --name "..."
```
The command exits with code 1 on validation failure.

---

### `project-apollo save <file>`

Export story to a JSON file.

```bash
project-apollo save mystory.json
project-apollo save backup    # Adds .json automatically
```

---

### `project-apollo load <file>`

Load story from a JSON file into the central registry.

```bash
project-apollo load mystory.json
project-apollo load mystory.json --name "My Imported Story"  # Custom name
project-apollo load mystory.json --force  # Overwrite existing
```

**Options:**
- `-n, --name <name>` - Story name (overrides name from file)
- `-f, --force` - Overwrite existing story with same ID

---

### `project-apollo add <type> [options]`

Add nodes directly to the story graph. Supports characters, locations, conflicts, and scenes.

#### Add Character

```bash
project-apollo add character "John Smith"
project-apollo add character "John Smith" --description "A mysterious stranger"
project-apollo add character "John Smith" --archetype "Hero" --traits "brave,loyal"
project-apollo add character "John Smith" -y  # Skip confirmation
```

**Options:**
- `-d, --description <text>` - Character description
- `-a, --archetype <type>` - Character archetype (e.g., Hero, Mentor, Threshold Guardian)
- `-t, --traits <list>` - Comma-separated traits (e.g., "brave,loyal,stubborn")
- `-y, --yes` - Skip confirmation

#### Add Location

```bash
project-apollo add location "Paris"
project-apollo add location "Eiffel Tower" --parent loc_paris_abc
project-apollo add location "Cafe" --description "A cozy corner cafe" --tags "romantic,quiet"
```

**Options:**
- `-d, --description <text>` - Location description
- `-p, --parent <id>` - Parent location ID (for nested locations)
- `-t, --tags <list>` - Comma-separated tags
- `-y, --yes` - Skip confirmation

#### Add Conflict

```bash
project-apollo add conflict "Save the President" \
  --type societal \
  --description "A coup unfolds aboard Air Force One while the president tries to survive."
```

**Required options:**
- `--type <type>` - Conflict type: `interpersonal`, `internal`, `societal`, `ideological`, `systemic`, `nature`, `technological`
- `--description <text>` - Conflict description (min 20 chars)

**Optional:**
- `--stakes <text>` - Stakes description
- `--intensity <n>` - Intensity level 1-5
- `-y, --yes` - Skip confirmation

#### Add Scene

```bash
project-apollo add scene \
  --beat Catalyst \
  --overview "The detective discovers the locked room crime scene for the first time."

project-apollo add scene \
  --beat Midpoint \
  --heading "INT. WAREHOUSE - NIGHT" \
  --overview "A tense confrontation where the protagonist faces the antagonist." \
  --characters "char_john_abc,char_mary_xyz" \
  --location "loc_warehouse_123"
```

**Required options:**
- `--beat <beatType>` - Beat type (e.g., Catalyst, Midpoint, Finale)
- `--overview <text>` - Scene overview (min 20 chars)

**Optional:**
- `--heading <text>` - Scene heading (e.g., "INT. CAFE - DAY")
- `--characters <ids>` - Comma-separated character IDs
- `--location <id>` - Location ID
- `--order <n>` - Order index within beat (default: 1)
- `-y, --yes` - Skip confirmation

**Output:**
```
Add Character: John Smith
─────────────────────────

Patch Operations (1 ops):

1. ADD_NODE Character
   id: char_john_smith_abc123
   name: "John Smith"
   description: "A mysterious stranger"
   archetype: "Hero"

Apply this change? [y/N] y
✓ Add Character: John Smith
ID: char_john_smith_abc123
```

---

### `project-apollo edit <node_id> [options]`

Edit a node's properties in the story graph.

```bash
project-apollo edit char_john_abc --set name="Jonathan"
project-apollo edit char_john_abc --set archetype="Mentor" --set traits="wise,patient"
project-apollo edit scene_001 --set mood="tense" --set scene_overview="Updated overview text..."
project-apollo edit char_john_abc --unset traits --unset notes
project-apollo edit char_john_abc --set name="John" -y  # Skip confirmation
```

**Options:**
- `--set <key=value>` - Set field value (repeatable for multiple fields)
- `--unset <field>` - Remove a field (repeatable)
- `-y, --yes` - Skip confirmation

**Notes:**
- For array fields (traits, tags, scene_tags), use comma-separated values: `--set traits="brave,loyal"`
- Values are auto-parsed: numbers become numbers, `["a","b"]` becomes arrays
- Use quotes for values with spaces: `--set description="A tall stranger"`

**Output:**
```
Edit: char_john_abc
───────────────────

Current node type: Character

Current values:
  name: "John"
  archetype: "Hero"

Changes:
  set name = "Jonathan"
  set archetype = "Mentor"

Apply these changes? [y/N] y
✓ Updated: char_john_abc
```

---

### `project-apollo delete <node_id> [options]`

Delete a node from the story graph.

```bash
project-apollo delete char_john_abc
project-apollo delete char_john_abc --force    # Skip confirmation
project-apollo delete char_john_abc --cascade  # Also delete connected edges
```

**Options:**
- `-f, --force` - Skip confirmation
- `--cascade` - Explicitly delete connected edges (edges are always removed for consistency)

**Output:**
```
Delete: char_john_abc
─────────────────────

Type: Character
Name: John Smith
Description: A mysterious stranger

Connected edges (2):
  DELETE HAS_CHARACTER → scene_001
  DELETE HAS_CHARACTER → scene_003

This action cannot be undone.

Delete this node? [y/N] y
✓ Deleted: char_john_abc
Also removed 2 connected edge(s).
```

**Warning:** Deletion is permanent. Connected edges are automatically removed to maintain graph consistency.

---

### `project-apollo log [options]`

Show version history for the current story.

```bash
project-apollo log
project-apollo log --all      # Show all versions
project-apollo log -n 20      # Show last 20 versions
```

**Options:**
- `-a, --all` - Show all versions (default: last 10)
- `-n, --limit <n>` - Limit number of versions shown

**Output:**
```
Version History
───────────────

* sv_1735789234_abc123 (current)
  Added Catalyst scene - just now
  parent: sv_1735789000_xyz789

  sv_1735789000_xyz789
  Initial - 2 hours ago
  parent: (none)

Commands:
  project-apollo checkout <version_id> - Switch to a version
```

---

### `project-apollo checkout <version_id>`

Switch to a specific version of the story.

```bash
project-apollo checkout sv_1735789000_xyz789
```

**Output:**
```
✓ Switched to version: sv_1735789000_xyz789
Label: Initial

⚠ You are in detached state.
Any changes will create a new branch from this version.

Run "project-apollo status" to see the story at this version.
Run "project-apollo log" to see version history.
```

**Notes:**
- Checking out a non-latest version puts you in "detached state"
- Any new changes (accepting moves, adding nodes) create a new branch
- Use `project-apollo log` to see all versions and their relationships

---

## Typical Workflow

### 1. Start a New Story

```bash
project-apollo init --name "Wizard Tale" "A young wizard discovers their true powers"
```

This creates the story with ID `wizard-tale` and sets it as current.

### 2. Check Open Questions

```bash
project-apollo oqs
```

You'll see 15 `BeatUnrealized` questions - one for each beat that needs scenes.

### 3. Address an Open Question

Pick a beat to work on (e.g., Catalyst):

```bash
project-apollo cluster oq_beat_beat_Catalyst
```

Review the generated move options.

### 4. Accept a Move

```bash
project-apollo accept mv_1234567890_0
```

### 5. Iterate

```bash
project-apollo status   # See progress
project-apollo oqs      # See remaining questions (now 14)
```

Repeat steps 3-5 until your outline is complete.

### 6. Save Your Work

```bash
project-apollo save screenplay-v1.json
```

### 7. Work on Multiple Stories

```bash
# Create another story
project-apollo init --name "Detective Case" "A detective solves an impossible crime"

# List all stories
project-apollo list

# Switch between stories
project-apollo open wizard-tale
project-apollo open "Detective Case"

# Check which story is active
project-apollo current
```

## State Storage

The CLI stores all stories in a central location at `~/.apollo/`:

```
~/.apollo/
├── current              # Text file containing current story ID
└── stories/
    ├── wizard-tale/
    │   ├── state.json   # Graph state with version history
    │   └── session.json # Active clusters and recent moves
    └── detective-case/
        ├── state.json
        └── session.json
```

**Key points:**
- Stories are identified by slugified IDs (e.g., "Wizard Tale" → `wizard-tale`)
- One story is "current" at a time - all commands operate on it
- You can work from any directory - stories are stored centrally
- Use `project-apollo list` to see all stories
- Use `project-apollo open <id>` to switch stories

### Version History

Each story maintains a complete version history. Every change (accepting moves, adding/editing/deleting nodes) creates a new version with a parent link:

```json
{
  "history": {
    "versions": {
      "sv_123": { "id": "sv_123", "parent_id": null, "label": "Initial", "graph": {...} },
      "sv_456": { "id": "sv_456", "parent_id": "sv_123", "label": "Added scene", "graph": {...} }
    },
    "currentVersionId": "sv_456"
  }
}
```

**Commands:**
- `project-apollo log` - View version history
- `project-apollo checkout <version_id>` - Switch to a previous version

**Notes:**
- Old stories (V1 format) are automatically migrated to V2 with version history
- Branching is supported: checking out an old version and making changes creates a new branch

## Open Question Types

Open questions are derived automatically from graph state. They're organized by domain and surfaced based on the current phase.

### STRUCTURE Domain

| Type | Severity | Phase | Trigger |
|------|----------|-------|---------|
| `BeatUnrealized` | IMPORTANT | OUTLINE | Beat has 0 scenes fulfilling it |
| `ActImbalance` | IMPORTANT | OUTLINE | Act has 0 scenes while neighbors have 2+ |
| `SceneUnplaced` | BLOCKING | OUTLINE | Scene has invalid/missing beat assignment |

### SCENE Domain

| Type | Severity | Phase | Trigger |
|------|----------|-------|---------|
| `SceneNeedsOverview` | BLOCKING | DRAFT | Scene overview missing or < 20 chars |
| `SceneHasNoCast` | IMPORTANT | DRAFT | Scene has 0 HAS_CHARACTER edges |
| `SceneNeedsLocation` | IMPORTANT | DRAFT | Scene has 0 LOCATED_AT edges |

### CHARACTER Domain

| Type | Severity | Phase | Trigger |
|------|----------|-------|---------|
| `CharacterUnderspecified` | SOFT | DRAFT | Character in 2+ scenes with no description |
| `MissingCharacterArc` | IMPORTANT | DRAFT | Character in 3+ scenes with no HAS_ARC edge |
| `ArcUngrounded` | SOFT | REVISION | CharacterArc has 0 turn_refs |

### CONFLICT Domain

| Type | Severity | Phase | Trigger |
|------|----------|-------|---------|
| `ConflictNeedsParties` | IMPORTANT | DRAFT | Conflict has 0 INVOLVES edges |
| `ConflictNeedsManifestation` | IMPORTANT | DRAFT | Conflict has 0 MANIFESTS_IN edges |

### THEME_MOTIF Domain

| Type | Severity | Phase | Trigger |
|------|----------|-------|---------|
| `ThemeUngrounded` | SOFT | REVISION | Theme is FLOATING with 0 EXPRESSED_IN edges |
| `MotifUngrounded` | SOFT | REVISION | Motif is FLOATING with 0 APPEARS_IN edges |

**Severity Levels:**
- **BLOCKING** — Must resolve before proceeding; prevents phase transition
- **IMPORTANT** — Should resolve before phase transition
- **SOFT** — Suggestion; may remain unresolved

## Current Limitations

### Stub-Based Generation

The current system uses **deterministic stubs** instead of real LLM integration. This means:

- `initializeStory()` creates placeholder character/conflict/location from logline
- `generateClusterForQuestion()` creates template scenes with generic content
- Move titles and rationales are pre-defined templates

**Real LLM integration would:**
- Generate contextually-aware scene descriptions
- Create meaningful character names and backgrounds
- Produce story-specific conflict descriptions
- Offer creative, diverse move options

### Manual Commands

The CLI now supports direct node manipulation:

```bash
# Add nodes
project-apollo add character "John" --description "..."
project-apollo add location "Paris" --description "..."
project-apollo add conflict "Save the world" --type societal --description "..."
project-apollo add scene --beat Catalyst --overview "..."

# Edit nodes
project-apollo edit char_john_abc --set name="Jonathan"

# Delete nodes
project-apollo delete char_john_abc

# Version history
project-apollo log
project-apollo checkout sv_123
```

See the command reference above for full documentation.

### Single-Phase Focus

The CLI currently works best in the OUTLINE phase. DRAFT and REVISION phases have open questions defined but the cluster generation is optimized for structural (beat/scene) work.

## File Formats

### Export Format (save/load)

The export format includes a full `storyVersion` object per the v1 spec:

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-01-02T12:00:00.000Z",
  "storyId": "wizard-tale",
  "storyVersion": {
    "id": "sv_1234567890",
    "parent_story_version_id": null,
    "created_at": "2026-01-02T10:00:00.000Z",
    "label": "Wizard Tale",
    "logline": "A young wizard discovers their true powers",
    "tags": []
  },
  "storyVersionId": "sv_1234567890",
  "metadata": {
    "name": "Wizard Tale",
    "logline": "A young wizard discovers their true powers",
    "phase": "OUTLINE"
  },
  "graph": {
    "nodes": {
      "beat_Catalyst": {
        "type": "Beat",
        "id": "beat_Catalyst",
        "beat_type": "Catalyst",
        "act": 1,
        "position_index": 4,
        "status": "REALIZED"
      },
      "scene_001": {
        "type": "Scene",
        "id": "scene_001",
        "heading": "INT. WIZARD TOWER - NIGHT",
        "scene_overview": "The young wizard accidentally unleashes...",
        "beat_id": "beat_Catalyst",
        "order_index": 1,
        "status": "DRAFT"
      }
    },
    "edges": [
      { "type": "FULFILLS", "from": "scene_001", "to": "beat_Catalyst" }
    ]
  }
}
```

**Notes:**
- `storyVersion.parent_story_version_id` is `null` for linear history (branching support coming later)
- `storyVersionId` is kept for backward compatibility with older exports
- The `load` command accepts both old format (just `storyVersionId`) and new format (`storyVersion` object)

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run core tests only
cd packages/core && npm test

# Watch mode
npm run test:watch
```

### Building

```bash
# Build all packages
npm run build

# Build CLI only
cd packages/cli && npm run build
```

### Project Structure

```
Apollo/
├── package.json          # Workspace root
├── tsconfig.base.json    # Shared TypeScript config
├── spec/                 # Specification documents
│   ├── projectSpec.md
│   ├── implementationGuide.md
│   ├── mvpLoop.md
│   └── cliGuide.md       # This file
└── packages/
    ├── core/
    │   ├── src/
    │   │   ├── types/    # Node, Edge, Patch, OpenQuestion types
    │   │   ├── core/     # Graph, validator, applyPatch, deriveOQs
    │   │   └── stubs/    # Placeholder LLM functions
    │   └── tests/        # 135 contract tests
    └── cli/
        └── src/
            ├── index.ts      # Entry point
            ├── commands/     # CLI commands
            ├── state/        # Persistence (store.ts, session.ts)
            └── utils/        # Formatting, errors
```

## Next Steps

Potential future development:

1. **LLM Integration** - Replace stubs with Claude API calls for real content generation
2. **Interactive Mode** - Guided story building with prompts
3. **Web UI** - Visual graph editor in the browser
4. **Collaboration** - Multi-user story development
5. **Export Formats** - Final Draft, Fountain, PDF screenplay export
6. **Branch Management** - Named branches, merge support, diff between versions
