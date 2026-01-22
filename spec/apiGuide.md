# Apollo API Guide

HTTP API for Project Apollo screenplay knowledge graph. Wraps CLI functionality for frontend integration.

## Quick Start

```bash
# Build and start
cd packages/api
npm run build
npm start

# Server runs on http://localhost:3000
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | Server port |
| `APOLLO_DATA_DIR` | `~/.apollo` | Data directory (shared with CLI) |
| `APOLLO_AI_PROVIDER` | `anthropic` | AI provider: `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | - | Anthropic API key (required for anthropic provider) |
| `OPENAI_API_KEY` | - | OpenAI API key (required for openai provider) |
| `APOLLO_AI_MODEL` | (provider default) | Model override |
| `APOLLO_AI_MAX_TOKENS` | `16384` | Max response tokens |

```bash
# Custom configuration
PORT=3001 APOLLO_DATA_DIR=/var/data/apollo npm start

# With AI provider configuration
APOLLO_AI_PROVIDER=openai OPENAI_API_KEY=sk-... npm start
```

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message",
  "suggestion": "How to fix it"
}
```

### Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "validationErrors": [
    {
      "code": "MISSING_REQUIRED_FIELD",
      "node_id": "char_001",
      "field": "name",
      "suggested_fix": "Add a name to the character"
    }
  ]
}
```

---

## Endpoints

### Health Check

```
GET /health
```

Returns server status and data directory.

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "dataDir": "/Users/you/.apollo"
}
```

---

## Story Management

### Create Story

```
POST /stories/init
```

Creates a new story with optional logline.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Story name (used as ID slug) |
| `logline` | string | No* | Story premise (*required if no name) |

```bash
curl -X POST http://localhost:3000/stories/init \
  -H 'Content-Type: application/json' \
  -d '{"name": "My Story", "logline": "A detective solves an impossible crime"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "storyId": "my-story",
    "name": "My Story",
    "logline": "A detective solves an impossible crime",
    "versionId": "sv_1234567890",
    "stats": {
      "scenes": 0,
      "beats": 15,
      "characters": 1,
      "locations": 1,
      "edges": 1
    }
  }
}
```

---

### Get Story Status (Bootstrap)

```
GET /stories/:id/status
```

Returns complete story state. **Use this as the primary frontend bootstrap endpoint.**

```bash
curl http://localhost:3000/stories/my-story/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "storyId": "my-story",
    "name": "My Story",
    "logline": "A detective solves an impossible crime",
    "currentVersionId": "sv_1234567890",
    "currentBranch": "main",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "stats": {
      "scenes": 0,
      "beats": 15,
      "characters": 1,
      "locations": 1,
      "edges": 1
    },
    "openQuestions": {
      "total": 15
    }
  }
}
```

---

### Get Story Outline

```
GET /stories/:id/outline
```

Returns the story structure organized by acts and beats, with PlotPoints and Scenes nested appropriately. Also returns unassigned items that haven't been placed in the structure yet.

```bash
curl http://localhost:3000/stories/my-story/outline
```

**Response:**
```json
{
  "success": true,
  "data": {
    "storyId": "my-story",
    "acts": [
      {
        "act": 1,
        "beats": [
          {
            "id": "beat_OpeningImage",
            "beatType": "OpeningImage",
            "act": 1,
            "positionIndex": 1,
            "guidance": "Visual snapshot of the hero's world...",
            "status": "REALIZED",
            "plotPoints": [
              {
                "id": "pp_1234",
                "title": "Establish detective's lonely life",
                "intent": "character",
                "status": "approved",
                "scenes": [
                  {
                    "id": "scene_001",
                    "heading": "INT. DETECTIVE'S APARTMENT - NIGHT",
                    "overview": "Detective sits alone..."
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "unassignedPlotPoints": [
      {
        "id": "pp_5678",
        "title": "Car chase through downtown",
        "intent": "plot",
        "status": "proposed",
        "scenes": []
      }
    ],
    "unassignedScenes": [
      {
        "id": "scene_loose",
        "heading": "EXT. ROOFTOP - NIGHT",
        "overview": "Confrontation scene..."
      }
    ],
    "summary": {
      "totalBeats": 15,
      "totalScenes": 5,
      "totalPlotPoints": 8,
      "unassignedPlotPointCount": 2,
      "unassignedSceneCount": 1
    }
  }
}
```

**Notes:**
- `unassignedPlotPoints`: PlotPoints without an `ALIGNS_WITH` edge to any Beat
- `unassignedScenes`: Scenes without a `SATISFIED_BY` edge from any PlotPoint
- Use the Edges API (`POST /stories/:id/edges`) to assign items to the structure

---

## Open Questions

### List Open Questions

```
GET /stories/:id/open-questions
```

Returns all open questions for the story.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `domain` | string | Filter by domain: `STRUCTURE`, `SCENE`, `CHARACTER` |

```bash
# All questions
curl http://localhost:3000/stories/my-story/open-questions

# Filter by domain
curl "http://localhost:3000/stories/my-story/open-questions?domain=STRUCTURE"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "id": "oq_beat_beat_Catalyst",
        "message": "Beat \"Catalyst\" has no scenes assigned",
        "type": "BeatUnrealized",
        "domain": "STRUCTURE",
        "group_key": "STRUCTURE:BEAT:Catalyst",
        "target_node_id": "beat_Catalyst"
      }
    ]
  }
}
```

---

## Move Generation

### Generate Move Cluster

```
POST /stories/:id/clusters
```

Generates a cluster of possible moves for an open question.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `oqId` | string | Yes | Open question ID |
| `count` | number | No | Number of moves (1-12, default: 4) |
| `seed` | number | No | Seed for reproducible generation |

```bash
curl -X POST http://localhost:3000/stories/my-story/clusters \
  -H 'Content-Type: application/json' \
  -d '{"oqId": "oq_beat_beat_Catalyst", "count": 4}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clusterId": "cluster_abc123",
    "title": "Realize Beat: Catalyst",
    "clusterType": "STRUCTURE",
    "scope": "OUTLINE",
    "seed": 1234567890,
    "moves": [
      {
        "id": "mv_abc123_0",
        "title": "Add scene for Catalyst beat",
        "rationale": "Creates a scene to realize this structural beat",
        "confidence": 0.85
      }
    ]
  }
}
```

---

### Preview Move

```
GET /stories/:id/moves/:moveId/preview
```

Returns detailed preview of a move's patch before accepting.

```bash
curl http://localhost:3000/stories/my-story/moves/mv_abc123_0/preview
```

**Response:**
```json
{
  "success": true,
  "data": {
    "move": {
      "id": "mv_abc123_0",
      "title": "Add scene for Catalyst beat",
      "rationale": "Creates a scene to realize this structural beat",
      "confidence": 0.85
    },
    "patch": {
      "id": "patch_mv_abc123_0",
      "baseVersionId": "sv_1234567890",
      "ops": [
        {
          "op": "ADD_NODE",
          "type": "Scene",
          "id": "scene_catalyst_001",
          "data": { ... }
        }
      ]
    },
    "validation": {
      "valid": true
    }
  }
}
```

---

### Accept Moves

```
POST /stories/:id/accept
```

Applies one or more moves to the story. Creates a new version.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `moveIds` | string[] | Yes | Array of move IDs to accept |

```bash
curl -X POST http://localhost:3000/stories/my-story/accept \
  -H 'Content-Type: application/json' \
  -d '{"moveIds": ["mv_abc123_0"]}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accepted": [
      {
        "moveId": "mv_abc123_0",
        "title": "Add scene for Catalyst beat"
      }
    ],
    "newVersionId": "sv_1234567891",
    "patchOpsApplied": 3
  }
}
```

---

## Direct Input

### Add Node

```
POST /stories/:id/input
```

Adds a node directly to the story graph.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Node type: `character`, `location`, `scene` |
| `name` | string | Yes | Node name |
| `description` | string | No | Description text |

**Additional fields by type:**

**Character:**
| Field | Type | Description |
|-------|------|-------------|
| `archetype` | string | Character archetype (Hero, Mentor, etc.) |
| `traits` | string[] | Character traits |

**Location:**
| Field | Type | Description |
|-------|------|-------------|
| `parent` | string | Parent location ID |
| `tags` | string[] | Location tags |

**Scene:**
| Field | Type | Description |
|-------|------|-------------|
| `beatId` | string | Required: Beat ID |
| `overview` | string | Required (min 20 chars): Scene overview |
| `heading` | string | Scene heading (default: "INT. LOCATION - DAY") |
| `characters` | string[] | Character IDs |
| `location` | string | Location ID |
| `order` | number | Order index within beat |

```bash
# Add character
curl -X POST http://localhost:3000/stories/my-story/input \
  -H 'Content-Type: application/json' \
  -d '{"type": "character", "name": "Detective Smith", "archetype": "Hero"}'

# Add location
curl -X POST http://localhost:3000/stories/my-story/input \
  -H 'Content-Type: application/json' \
  -d '{"type": "location", "name": "Crime Scene", "description": "A locked room with no apparent way in or out"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nodeId": "char_detective_smith_abc123",
    "type": "character",
    "name": "Detective Smith",
    "newVersionId": "sv_1234567892"
  }
}
```

---

## Version History

### Get Version Log

```
GET /stories/:id/log
```

Returns version history for the story.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Max versions to return |

```bash
curl http://localhost:3000/stories/my-story/log
curl "http://localhost:3000/stories/my-story/log?limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "versions": [
      {
        "id": "sv_1234567892",
        "label": "Add character: Detective Smith",
        "parentId": "sv_1234567891",
        "createdAt": "2024-01-15T10:35:00.000Z",
        "isCurrent": true,
        "branch": "main"
      },
      {
        "id": "sv_1234567891",
        "label": "Accept: Add scene for Catalyst beat",
        "parentId": "sv_1234567890",
        "createdAt": "2024-01-15T10:32:00.000Z",
        "isCurrent": false
      }
    ],
    "currentBranch": "main"
  }
}
```

---

### Checkout Version/Branch

```
POST /stories/:id/checkout
```

Switches to a specific version or branch.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target` | string | Yes | Version ID or branch name |

```bash
# Checkout branch
curl -X POST http://localhost:3000/stories/my-story/checkout \
  -H 'Content-Type: application/json' \
  -d '{"target": "main"}'

# Checkout specific version (detached)
curl -X POST http://localhost:3000/stories/my-story/checkout \
  -H 'Content-Type: application/json' \
  -d '{"target": "sv_1234567890"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currentVersionId": "sv_1234567890",
    "currentBranch": "main",
    "detached": false
  }
}
```

---

### Compare Versions (Diff)

```
GET /stories/:id/diff
```

Compares two versions or branches.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `from` | string | Source version/branch (default: parent of current) |
| `to` | string | Target version/branch (default: current) |

```bash
# Current vs parent
curl http://localhost:3000/stories/my-story/diff

# Specific versions
curl "http://localhost:3000/stories/my-story/diff?from=sv_001&to=sv_002"

# Compare branches
curl "http://localhost:3000/stories/my-story/diff?from=main&to=experiment"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fromVersion": "sv_1234567890",
    "toVersion": "sv_1234567891",
    "nodes": {
      "added": [
        {"id": "scene_001", "type": "Scene", "label": "INT. CAFE - DAY"}
      ],
      "removed": [],
      "modified": [
        {
          "id": "char_001",
          "nodeType": "Character",
          "changes": [
            {"field": "name", "oldValue": "John", "newValue": "Jonathan"}
          ]
        }
      ]
    },
    "edges": {
      "added": [
        {"type": "HAS_CHARACTER", "source": "scene_001", "target": "char_001"}
      ],
      "removed": []
    },
    "summary": {
      "nodesAdded": 1,
      "nodesRemoved": 0,
      "nodesModified": 1,
      "edgesAdded": 1,
      "edgesRemoved": 0
    }
  }
}
```

---

## Branch Management

### Create Branch

```
POST /stories/:id/branch
```

Creates a new branch at the current version.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Branch name |
| `description` | string | No | Branch description |

```bash
curl -X POST http://localhost:3000/stories/my-story/branch \
  -H 'Content-Type: application/json' \
  -d '{"name": "experiment", "description": "Testing alternate story direction"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "experiment",
    "headVersionId": "sv_1234567892",
    "createdAt": "2024-01-15T10:40:00.000Z",
    "description": "Testing alternate story direction"
  }
}
```

---

### List Branches

```
GET /stories/:id/branches
```

Returns all branches for the story.

```bash
curl http://localhost:3000/stories/my-story/branches
```

**Response:**
```json
{
  "success": true,
  "data": {
    "branches": [
      {
        "name": "main",
        "headVersionId": "sv_1234567892",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "isCurrent": true
      },
      {
        "name": "experiment",
        "headVersionId": "sv_1234567892",
        "createdAt": "2024-01-15T10:40:00.000Z",
        "description": "Testing alternate story direction",
        "isCurrent": false
      }
    ]
  }
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (init, input, branch) |
| `400` | Bad request (invalid input) |
| `404` | Not found (story, version, move) |
| `409` | Conflict (story/branch already exists) |
| `500` | Server error |

---

## Lint & Rule Engine

The lint system validates story graph integrity with hard rules (block commit) and soft rules (warnings).

### Run Lint

```
POST /stories/:id/lint
```

Runs lint rules against the story graph.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scope` | string | No | `full` (default) or `touched` |
| `touchedNodeIds` | string[] | No | Node IDs to check (for touched scope) |
| `touchedEdgeIds` | string[] | No | Edge IDs to check (for touched scope) |

```bash
# Full lint
curl -X POST http://localhost:3000/stories/my-story/lint \
  -H 'Content-Type: application/json' \
  -d '{"scope": "full"}'

# Touched scope (faster, for edit-time linting)
curl -X POST http://localhost:3000/stories/my-story/lint \
  -H 'Content-Type: application/json' \
  -d '{"scope": "touched", "touchedNodeIds": ["scene_001"]}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "violations": [
      {
        "id": "v_abc123",
        "ruleId": "SCENE_HAS_CHARACTER",
        "severity": "soft",
        "category": "completeness",
        "message": "Scene 'INT. CAFE - DAY' has no characters assigned",
        "nodeId": "scene_001"
      }
    ],
    "fixes": [
      {
        "id": "fix_abc123",
        "violationId": "v_abc123",
        "label": "Re-index 3 scenes in beat_Catalyst",
        "affectedNodeIds": ["scene_001", "scene_002", "scene_003"]
      }
    ],
    "summary": {
      "errorCount": 0,
      "warningCount": 1,
      "hasBlockingErrors": false
    },
    "lastCheckedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Apply Fixes

```
POST /stories/:id/lint/apply
```

Applies one or more lint fixes to the story graph.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fixIds` | string[] | No* | Specific fix IDs to apply |
| `applyAll` | boolean | No* | Apply all available fixes |
| `categories` | string[] | No | Filter by category when using applyAll |

*One of `fixIds` or `applyAll` is required.

```bash
# Apply specific fixes
curl -X POST http://localhost:3000/stories/my-story/lint/apply \
  -H 'Content-Type: application/json' \
  -d '{"fixIds": ["fix_abc123", "fix_def456"]}'

# Apply all fixes
curl -X POST http://localhost:3000/stories/my-story/lint/apply \
  -H 'Content-Type: application/json' \
  -d '{"applyAll": true}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "applied": ["fix_abc123"],
    "skipped": [],
    "newVersionId": "sv_1234567893",
    "revalidation": {
      "errorCount": 0,
      "warningCount": 0,
      "hasBlockingErrors": false
    }
  }
}
```

---

### Pre-Commit Check

```
GET /stories/:id/lint/precommit
```

Runs a full lint and returns whether commit is allowed.

```bash
curl http://localhost:3000/stories/my-story/lint/precommit
```

**Response:**
```json
{
  "success": true,
  "data": {
    "canCommit": true,
    "errorCount": 0,
    "warningCount": 2,
    "violations": [...],
    "fixes": [...]
  }
}
```

---

### Lint Rules Reference

#### Hard Rules (Block Commit)

| Rule ID | Description | Auto-Fix |
|---------|-------------|----------|
| `SCENE_ORDER_UNIQUE` | Two scenes in same beat cannot share order_index | Re-index scenes sequentially |
| `SCENE_ACT_BOUNDARY` | Scene's beat must have correct act for its beat_type | Correct beat's act field |
| `STC_BEAT_ORDERING` | Beat's position_index must match STC canonical order | Correct position_index |

#### Soft Rules (Warnings)

| Rule ID | Description | Auto-Fix |
|---------|-------------|----------|
| `SCENE_HAS_CHARACTER` | Scene should have ≥1 character assigned | None (manual) |
| `SCENE_HAS_LOCATION` | Scene should have a location assigned | None (manual) |
| `LOCATION_HAS_SETTING` | Location should be part of a Setting | None (manual) |
| `STORY_HAS_PREMISE` | Story should have a Premise node | None (manual) |

---

## AI Generation Endpoints

### Generate Narrative Packages

```
POST /stories/:id/propose
```

Generates narrative packages using the unified propose pipeline.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | Yes | Generation mode: `add`, `expand`, `explore` |
| `entryPoint` | object | No | Entry point configuration |
| `direction` | string | No | Freeform guidance text |
| `creativity` | number | No | 0-1 creativity level (overrides mode default) |
| `packageCount` | number | No | Number of packages (1-10) |
| `nodesPerPackage` | number | No | Nodes per package (3-15) |

**Entry Point Object:**
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Entry type: `auto`, `beat`, `gap`, `character`, `plotPoint` |
| `targetId` | string | Target node ID (required for non-auto types) |

```bash
curl -X POST http://localhost:3000/stories/my-story/propose \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "add",
    "direction": "Focus on character development",
    "entryPoint": { "type": "beat", "targetId": "beat_Midpoint" }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "packages": [
      {
        "id": "pkg_abc123",
        "title": "The Revelation",
        "rationale": "Creates a pivotal moment...",
        "confidence": 0.85,
        "changes": {
          "nodes": [...],
          "edges": [...]
        },
        "impact": {
          "fulfills_gaps": ["gap_123"],
          "creates_gaps": [],
          "conflicts": []
        }
      }
    ],
    "sessionId": "session_xyz"
  }
}
```

---

## AI Package Editing

These endpoints allow fine-grained editing and regeneration of individual elements within AI-generated packages.

### Regenerate Element

```
POST /stories/:id/regenerate-element
```

Regenerates a single element within a package, returning multiple options to choose from.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `packageId` | string | Yes | The package containing the element |
| `elementType` | string | Yes | `node`, `edge`, or `storyContext` |
| `elementIndex` | number | Yes | Index of the element within its array |
| `guidance` | string | No | Optional guidance for regeneration |
| `count` | string | No | Number of options: `few` (3), `standard` (5), `many` (7) |

```bash
curl -X POST http://localhost:3000/stories/my-story/regenerate-element \
  -H 'Content-Type: application/json' \
  -d '{
    "packageId": "pkg_abc123",
    "elementType": "node",
    "elementIndex": 0,
    "guidance": "Make the character more sympathetic",
    "count": "few"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "options": [
      {
        "operation": "add",
        "node_type": "Character",
        "node_id": "char_123",
        "data": { "name": "Agent Torres", "role": "Reluctant investigator", ... }
      },
      {
        "operation": "add",
        "node_type": "Character",
        "node_id": "char_123",
        "data": { "name": "Agent Torres", "role": "Former friend", ... }
      },
      ...
    ]
  }
}
```

---

### Apply Element Option

```
POST /stories/:id/apply-element-option
```

Applies a selected regeneration option to replace an element in a package.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `packageId` | string | Yes | The package to update |
| `elementType` | string | Yes | `node`, `edge`, or `storyContext` |
| `elementIndex` | number | Yes | Index of the element to replace |
| `newElement` | object | Yes | The selected element option |

```bash
curl -X POST http://localhost:3000/stories/my-story/apply-element-option \
  -H 'Content-Type: application/json' \
  -d '{
    "packageId": "pkg_abc123",
    "elementType": "node",
    "elementIndex": 0,
    "newElement": { "operation": "add", "node_type": "Character", ... }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "package": { ... }
  }
}
```

---

### Update Package Element

```
POST /stories/:id/update-package-element
```

Updates a single element within a package (for manual edits).

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `packageId` | string | Yes | The package to update |
| `elementType` | string | Yes | `node`, `edge`, or `storyContext` |
| `elementIndex` | number | Yes | Index of the element to update |
| `updatedElement` | object | Yes | The updated element data |

```bash
curl -X POST http://localhost:3000/stories/my-story/update-package-element \
  -H 'Content-Type: application/json' \
  -d '{
    "packageId": "pkg_abc123",
    "elementType": "node",
    "elementIndex": 0,
    "updatedElement": {
      "operation": "add",
      "node_type": "Character",
      "node_id": "char_123",
      "data": { "name": "Agent Torres (updated)", "role": "Lead Investigator" }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "package": { ... }
  }
}
```

---

### Validate Package

```
POST /stories/:id/validate-package
```

Validates a package against the current graph state.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `package` | object | Yes | The complete NarrativePackage to validate |

```bash
curl -X POST http://localhost:3000/stories/my-story/validate-package \
  -H 'Content-Type: application/json' \
  -d '{"package": { "id": "pkg_abc123", ... }}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "errors": [
      {
        "type": "edge",
        "index": 0,
        "field": "from",
        "message": "Source node \"char_nonexistent\" does not exist"
      }
    ]
  }
}
```

---

## CLI Interoperability

The API shares storage with the CLI by default (`~/.apollo`). You can:

1. Create a story with CLI, manage it via API
2. Create a story with API, continue with CLI
3. Use both tools simultaneously on different stories

```bash
# CLI creates story
project-apollo init "A hero's journey" --name "Epic Tale"

# API reads it
curl http://localhost:3000/stories/epic-tale/status

# API makes changes
curl -X POST http://localhost:3000/stories/epic-tale/input \
  -H 'Content-Type: application/json' \
  -d '{"type": "character", "name": "The Hero"}'

# CLI sees changes
project-apollo open epic-tale
project-apollo status
```
