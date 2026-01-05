# Phase D: First-Class Edges with Schema-Aware Editing

## Overview

Transform edges from simple `{type, from, to}` tuples into first-class entities with IDs, properties, provenance, and status. Add two editing modes (guided + AI-assisted) and a rule engine for structural constraints.

**Scope**: Ship D.1-D.3 first. D.4-D.6 gated behind feature flag.

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| Edge ID format | UUID (stable, opaque). Use uniqueKey for deduplication |
| Provenance granularity | Per-edge (store patchId for grouping) |
| Rule config | TypeScript DSL; optional YAML for user-tunable soft rules later |
| Batch/upsert | Add now (tiny lift, huge leverage) |
| Edge storage | Keep Edge[] array + add edgeIndex Map for O(1) lookups |
| Testing | Critical paths (core CRUD, rule violations); backfill edge cases later |

---

## Current State

### Edges Today
- **Storage**: Separate array in `GraphState.edges[]`
- **Fields**: Only `type`, `from`, `to` - no ID, properties, metadata
- **Operations**: `ADD_EDGE`, `DELETE_EDGE` - no `UPDATE_EDGE`
- **Validation**: `EDGE_RULES` validates source/target node types
- **Key file**: `packages/core/src/types/edges.ts`

---

## Data Model Changes

### Extended Edge Interface
```typescript
// packages/core/src/types/edges.ts
export interface Edge {
  id: string;              // UUID
  type: EdgeType;
  from: string;
  to: string;
  properties?: EdgeProperties;
  provenance?: EdgeProvenance;
  status?: EdgeStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface EdgeProperties {
  order?: number;          // Scene order in beat, beat order in act
  weight?: number;         // Relation strength (0-1)
  confidence?: number;     // AI confidence (0-1)
  notes?: string;          // Human annotation
}

export interface EdgeProvenance {
  source: 'human' | 'extractor' | 'import';
  patchId?: string;        // Which patch created this edge
  model?: string;          // e.g., 'gpt-4o'
  promptHash?: string;
  createdBy?: string;      // User ID
}

export type EdgeStatus = 'proposed' | 'approved' | 'rejected';

// Utility for deduplication
export function edgeUniqueKey(edge: Edge): string {
  return `${edge.type}:${edge.from}:${edge.to}`;
}
```

### New Patch Operations
```typescript
// packages/core/src/types/patch.ts
export interface UpdateEdgeOp {
  op: 'UPDATE_EDGE';
  id: string;
  set?: Partial<EdgeProperties>;
  unset?: (keyof EdgeProperties)[];
  status?: EdgeStatus;
}

export interface UpsertEdgeOp {
  op: 'UPSERT_EDGE';
  edge: Edge;  // If exists by uniqueKey, update; else insert
}

export interface BatchEdgeOp {
  op: 'BATCH_EDGE';
  adds?: Edge[];
  updates?: Array<{ id: string; set: Partial<EdgeProperties> }>;
  deletes?: string[];  // Edge IDs
}
```

---

## Phase D.1: Core Data Model

**Goal**: Extend Edge type, add new patch ops, update graph operations.

### Tasks

1. **Extend Edge interface** (`packages/core/src/types/edges.ts`)
   - Add id, properties, provenance, status, createdAt, updatedAt
   - Add EdgeProperties, EdgeProvenance, EdgeStatus types
   - Add `edgeUniqueKey()` utility function
   - Add `generateEdgeId()` using UUID

2. **Add new patch operations** (`packages/core/src/types/patch.ts`)
   - Add UpdateEdgeOp to PatchOp union
   - Add UpsertEdgeOp for idempotent edge creation
   - Add BatchEdgeOp for bulk operations

3. **Update applyPatch.ts** (`packages/core/src/core/applyPatch.ts`)
   - Handle UPDATE_EDGE: find by ID, merge properties
   - Handle UPSERT_EDGE: dedupe by uniqueKey, insert or update
   - Handle BATCH_EDGE: process adds/updates/deletes atomically
   - Update ADD_EDGE to auto-generate ID if missing
   - Update DELETE_EDGE to support deletion by ID

4. **Update graph.ts** (`packages/core/src/core/graph.ts`)
   - Add `getEdgeById(graph, id): Edge | undefined`
   - Add `getEdgeByKey(graph, type, from, to): Edge | undefined`
   - Add `rebuildEdgeIndex(graph): Map<string, number>` - builds ID→array-index map
   - Add `getEdgesWithProperties(graph, filters): Edge[]`
   - GraphState gets optional `edgeIndex?: Map<string, number>` for O(1) lookups

5. **Update validator.ts** (`packages/core/src/core/validator.ts`)
   - Validate edge properties (order >= 1, weight/confidence 0-1)
   - Validate status enum values
   - Check for duplicate edge IDs

### Files to Modify
- `packages/core/src/types/edges.ts`
- `packages/core/src/types/patch.ts`
- `packages/core/src/core/applyPatch.ts`
- `packages/core/src/core/graph.ts`
- `packages/core/src/core/validator.ts`

---

## Phase D.2: Edge API Endpoints

**Goal**: Expose edge CRUD + batch/upsert through REST API.

### Endpoints
```
GET    /stories/:id/edges                    # List edges
       ?type=HAS_CHARACTER&from=scene_01&status=approved
GET    /stories/:id/edges/:edgeId            # Get single edge
POST   /stories/:id/edges                    # Create edge
PATCH  /stories/:id/edges/:edgeId            # Update edge
DELETE /stories/:id/edges/:edgeId            # Delete edge

POST   /stories/:id/edges:batch              # Batch ops
       Body: { adds?: Edge[], updates?: [...], deletes?: string[] }
POST   /stories/:id/edges:upsert             # Upsert single
       Body: Edge (dedupe by uniqueKey)
```

### Tasks

1. **Create edge handlers** (`packages/api/src/handlers/edges.ts`)
   ```typescript
   createListEdgesHandler(ctx)     // GET with filters
   createGetEdgeHandler(ctx)       // GET by ID
   createAddEdgeHandler(ctx)       // POST
   createUpdateEdgeHandler(ctx)    // PATCH
   createDeleteEdgeHandler(ctx)    // DELETE
   createBatchEdgesHandler(ctx)    // POST :batch
   createUpsertEdgeHandler(ctx)    // POST :upsert
   ```

2. **Add routes** (`packages/api/src/routes/stories.ts`)
   ```typescript
   router.get('/:id/edges', listEdgesHandler);
   router.get('/:id/edges/:edgeId', getEdgeHandler);
   router.post('/:id/edges', addEdgeHandler);
   router.patch('/:id/edges/:edgeId', updateEdgeHandler);
   router.delete('/:id/edges/:edgeId', deleteEdgeHandler);
   router.post('/:id/edges\\:batch', batchEdgesHandler);
   router.post('/:id/edges\\:upsert', upsertEdgeHandler);
   ```

3. **Update API client** (`packages/ui/src/api/client.ts`)
   ```typescript
   listEdges: (storyId, filters?) => GET<EdgesListData>
   getEdge: (storyId, edgeId) => GET<EdgeData>
   createEdge: (storyId, edge) => POST<EdgeData>
   updateEdge: (storyId, edgeId, changes) => PATCH<EdgeData>
   deleteEdge: (storyId, edgeId) => DELETE
   batchEdges: (storyId, ops) => POST<BatchEdgeResult>
   upsertEdge: (storyId, edge) => POST<EdgeData>
   ```

4. **Add types** (`packages/ui/src/api/types.ts`)
   ```typescript
   interface EdgeData { edge: Edge; }
   interface EdgesListData { edges: Edge[]; total: number; }
   interface BatchEdgeResult { added: number; updated: number; deleted: number; }
   ```

### Files to Create/Modify
- NEW: `packages/api/src/handlers/edges.ts`
- `packages/api/src/routes/stories.ts`
- `packages/api/src/handlers/index.ts`
- `packages/ui/src/api/client.ts`
- `packages/ui/src/api/types.ts`

---

## Phase D.3: Rule Engine

**Goal**: Replace monolithic validator with declarative TypeScript DSL.

### Architecture
```
packages/core/src/rules/
├── index.ts              # Public API: validateWithRules()
├── types.ts              # Rule, RuleContext, RuleResult types
├── engine.ts             # Rule evaluation engine
├── registry.ts           # Rule registration and lookup
├── stcRules.ts           # STC beat structure rules
├── edgeRules.ts          # Edge cardinality rules
└── graphRules.ts         # Graph-level structural rules
```

### Rule DSL
```typescript
// packages/core/src/rules/types.ts
interface Rule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning';
  scope: 'node' | 'edge' | 'graph';
  nodeTypes?: NodeType[];      // Which node types this applies to
  edgeTypes?: EdgeType[];      // Which edge types this applies to
  evaluate: (ctx: RuleContext) => RuleViolation[];
  suggestFix?: (violation: RuleViolation) => Fix | null;
}

interface RuleContext {
  graph: GraphState;
  targetNode?: KGNode;
  targetEdge?: Edge;
  patch?: Patch;               // For validating pending changes
}

interface RuleViolation {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
  edgeId?: string;
  field?: string;
}

interface Fix {
  id: string;
  description: string;
  patch: Patch;                // Patch to apply to fix the issue
}
```

### Initial Rules

**Hard Rules (severity: 'error')**:
```typescript
// stcRules.ts
{
  id: 'stc-break-into-two-ends-act1',
  name: 'Break Into Two ends Act I',
  description: 'BREAK_INTO_TWO beat must link to the last scene(s) of Act I',
  severity: 'error',
  scope: 'graph',
  evaluate: (ctx) => {
    // Find BreakIntoTwo beat
    // Check its FULFILLS edges point to scenes at end of Act I ordering
  }
}

// edgeRules.ts
{
  id: 'scene-order-unique-in-beat',
  name: 'Scene order unique within beat',
  description: 'Scenes in a beat must have unique order values',
  severity: 'error',
  scope: 'edge',
  edgeTypes: ['FULFILLS'],
  evaluate: (ctx) => {
    // Group scenes by beat, check order uniqueness
  }
}

{
  id: 'beat-single-act',
  name: 'Beat belongs to one act',
  description: 'A beat cannot span scenes from multiple acts',
  severity: 'error',
  scope: 'node',
  nodeTypes: ['Beat'],
}

{
  id: 'stc-order-bad-guys-after-midpoint',
  name: 'Bad Guys Close In after Midpoint',
  description: 'BAD_GUYS_CLOSE_IN must occur after MIDPOINT',
  severity: 'error',
  scope: 'graph',
}
```

**Soft Rules (severity: 'warning')**:
```typescript
{
  id: 'scene-has-character',
  name: 'Scene should have character',
  description: 'Every scene should link to at least one character',
  severity: 'warning',
  scope: 'node',
  nodeTypes: ['Scene'],
  suggestFix: (violation) => {
    // Suggest adding HAS_CHARACTER edge
  }
}

{
  id: 'scene-has-location',
  name: 'Scene should have location',
  severity: 'warning',
  scope: 'node',
  nodeTypes: ['Scene'],
}
```

### Engine API
```typescript
// packages/core/src/rules/engine.ts
export function evaluateRules(
  graph: GraphState,
  opts?: {
    rulesOnly?: string[];     // Only run these rules
    severity?: 'error' | 'warning' | 'all';
  }
): RuleResult {
  errors: RuleViolation[];
  warnings: RuleViolation[];
  fixes: Fix[];
}

export function validateWithRules(
  graph: GraphState,
  patch: Patch
): ValidationResult {
  // Apply patch to copy of graph
  // Run all rules
  // Return combined result
}
```

### Tasks

1. **Create rule types** (`packages/core/src/rules/types.ts`)
2. **Create rule registry** (`packages/core/src/rules/registry.ts`)
3. **Create evaluation engine** (`packages/core/src/rules/engine.ts`)
4. **Implement STC rules** (`packages/core/src/rules/stcRules.ts`)
5. **Implement edge rules** (`packages/core/src/rules/edgeRules.ts`)
6. **Implement graph rules** (`packages/core/src/rules/graphRules.ts`)
7. **Add lint endpoint** (`packages/api/src/handlers/lint.ts`)
   ```
   POST /stories/:id/lint
     Body: { nodeIds?, edgeIds? }
     Returns: { errors, warnings, fixes }
   ```
8. **Integrate with validator.ts** - Call rule engine from existing validation

### Files to Create
- `packages/core/src/rules/types.ts`
- `packages/core/src/rules/registry.ts`
- `packages/core/src/rules/engine.ts`
- `packages/core/src/rules/stcRules.ts`
- `packages/core/src/rules/edgeRules.ts`
- `packages/core/src/rules/graphRules.ts`
- `packages/core/src/rules/index.ts`
- `packages/api/src/handlers/lint.ts`

### Files to Modify
- `packages/core/src/core/validator.ts` - Delegate to rule engine
- `packages/api/src/routes/stories.ts` - Add lint route

---

## Phase D.4-D.6 (Feature-Flagged, Future)

### D.4: Edge Editing UI
- RelationsPanel component in ExploreView
- Add/remove edges via picker
- Drag-to-reorder edges with order property
- Provenance/status badges

### D.5: AI-Assisted Editing
- Toggle between guided/AI modes
- Free-text → extractor → diff → approve flow
- Per-item approve/reject

### D.6: Suggestions & Auto-Fix
- "Suggest Relations" button
- Lint results in header badge
- One-click fix buttons

---

## Migration Strategy

1. **On read**: Edges without ID get auto-generated UUID
2. **Default values**:
   - `status: 'approved'` (existing edges are trusted)
   - `provenance.source: 'import'` (migrated data)
3. **GraphState storage**: Keep `edges: Edge[]` array, add `edgeIndex?: Map<string, number>`
4. **Index rebuild**: Call `rebuildEdgeIndex()` after any edge mutation for cache coherence

---

## Acceptance Criteria

### Phase D.1 (Core)
- [ ] Edge interface has id, properties, provenance, status, timestamps
- [ ] UPDATE_EDGE patch operation works
- [ ] UPSERT_EDGE deduplicates by uniqueKey
- [ ] BATCH_EDGE processes adds/updates/deletes atomically
- [ ] Edge ID auto-generated on ADD_EDGE if missing
- [ ] Existing edges get IDs on load

### Phase D.2 (API)
- [ ] All edge CRUD endpoints functional
- [ ] :batch endpoint handles bulk operations
- [ ] :upsert endpoint deduplicates correctly
- [ ] Filters work (type, from, to, status)

### Phase D.3 (Rules)
- [ ] Rule DSL defined and documented
- [ ] 4 hard rules implemented (STC structure)
- [ ] 2 soft rules implemented (scene has char/loc)
- [ ] Lint endpoint returns violations and fixes
- [ ] Suggested fixes generate valid patches

---

## Test Plan (Critical Paths)

### Phase D.1 Tests
- Edge ID generation (UUID format, uniqueness)
- UPDATE_EDGE merges properties correctly
- UPSERT_EDGE: insert when new, update when exists
- BATCH_EDGE: all-or-nothing atomicity
- Edge index rebuild after mutations

### Phase D.2 Tests
- Edge CRUD API roundtrip (create → read → update → delete)
- List edges with filters (type, from, status)
- Batch endpoint with mixed adds/updates/deletes

### Phase D.3 Tests
- Each hard rule: valid case passes, invalid case fails
- Soft rules return warnings not errors
- Suggested fixes generate valid patches

### Deferred (backfill later)
- Edge cases: concurrent mutations, malformed input
- Performance: large edge counts, index rebuild speed
- E2E: UI flows (D.4+)
