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

```bash
# Custom configuration
PORT=3001 APOLLO_DATA_DIR=/var/data/apollo npm start
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
      "conflicts": 1,
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
    "phase": "OUTLINE",
    "currentVersionId": "sv_1234567890",
    "currentBranch": "main",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "stats": {
      "scenes": 0,
      "beats": 15,
      "characters": 1,
      "conflicts": 1,
      "locations": 1,
      "edges": 1
    },
    "openQuestions": {
      "total": 15,
      "blocking": 0,
      "important": 15,
      "soft": 0
    }
  }
}
```

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
| `phase` | string | Filter by phase: `OUTLINE`, `DRAFT`, `REVISION` |
| `severity` | string | Filter by severity: `BLOCKING`, `IMPORTANT`, `SOFT` |
| `domain` | string | Filter by domain: `STRUCTURE`, `CHARACTER`, `CONFLICT`, etc. |

```bash
# All questions
curl http://localhost:3000/stories/my-story/open-questions

# Filter by severity
curl "http://localhost:3000/stories/my-story/open-questions?severity=BLOCKING"
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
        "phase": "OUTLINE",
        "severity": "IMPORTANT",
        "domain": "STRUCTURE",
        "target_node_id": "beat_Catalyst"
      }
    ],
    "phase": "OUTLINE"
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
| `type` | string | Yes | Node type: `character`, `location`, `conflict`, `scene` |
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

**Conflict:**
| Field | Type | Description |
|-------|------|-------------|
| `conflictType` | string | Required: `interpersonal`, `internal`, `societal`, `ideological`, `systemic`, `nature`, `technological` |
| `description` | string | Required (min 20 chars) |
| `stakes` | string | Stakes description |
| `intensity` | number | 1-5 intensity level |

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

# Add conflict
curl -X POST http://localhost:3000/stories/my-story/input \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "conflict",
    "name": "The Impossible Murder",
    "conflictType": "interpersonal",
    "description": "A murder occurs in a locked room with no apparent way in or out"
  }'
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
| `THEME_NOT_ORPHANED` | Theme should be expressed in ≥1 scene/beat | None (manual) |
| `MOTIF_NOT_ORPHANED` | Motif should appear in ≥1 scene | None (manual) |

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
