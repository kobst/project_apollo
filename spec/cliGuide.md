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

### `project-apollo cluster <oq_id>`

Generate move options to address an open question.

```bash
project-apollo cluster oq_beat_beat_Catalyst
```

**Output:**
```
ℹ Generating moves for: Beat "Catalyst" has no scenes assigned

Realize beat: Catalyst
──────────────────────
Cluster type: STRUCTURE
Scope: OUTLINE

Available Moves:

1. [mv_1234567890_0] Catalyst: Dramatic confrontation (88% confidence)
   A high-tension scene that delivers the beat through conflict.

2. [mv_1234567890_1] Catalyst: Quiet revelation (75% confidence)
   A contemplative scene that delivers the beat through internal discovery.

3. [mv_1234567890_2] Catalyst: Action sequence (60% confidence)
   A kinetic scene that delivers the beat through physical action.

Run "project-apollo accept <move_id>" to apply a move.
```

---

### `project-apollo accept <move_id>`

Apply a move's patch to the story.

```bash
project-apollo accept mv_1234567890_0
```

**Output:**
```
✓ Move accepted: Catalyst: Dramatic confrontation
Patch applied: 1 operations

Run "project-apollo status" to see updated story.
Run "project-apollo oqs" to see remaining open questions.
```

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
    │   ├── state.json   # Graph state (nodes, edges, metadata)
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

## Open Question Types

| Type | Phase | Description |
|------|-------|-------------|
| `BeatUnrealized` | OUTLINE+ | Beat has no scenes assigned |
| `ActImbalance` | OUTLINE+ | Act is empty while neighbors have 2+ scenes |
| `SceneHasNoCast` | DRAFT+ | Scene has no characters |
| `ConflictNeedsParties` | DRAFT+ | Conflict missing involved characters |
| `MissingCharacterArc` | DRAFT+ | Character in 3+ scenes but no arc defined |
| `ThemeUngrounded` | REVISION | Theme not expressed in any scene/beat |
| `MotifUngrounded` | REVISION | Motif not appearing in any scene |
| `ArcUngrounded` | REVISION | Character arc not grounded in scenes |

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

### Missing Manual Commands

Currently there's no way to manually add nodes. Planned commands:

```bash
# Not yet implemented
project-apollo add character --name "John" --role "antagonist"
project-apollo add conflict --description "..."
project-apollo add location --name "Paris"
project-apollo edit <node_id> --field value
project-apollo delete <node_id>
```

### Single-Phase Focus

The CLI currently works best in the OUTLINE phase. DRAFT and REVISION phases have open questions defined but the cluster generation is optimized for structural (beat/scene) work.

## File Formats

### Export Format (save/load)

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-01-02T12:00:00.000Z",
  "storyId": "wizard-tale",
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
2. **Manual Node Commands** - Add/edit/delete characters, conflicts, locations
3. **Interactive Mode** - Guided story building with prompts
4. **Web UI** - Visual graph editor in the browser
5. **Collaboration** - Multi-user story development
6. **Export Formats** - Final Draft, Fountain, PDF screenplay export
