# CLI Improvements Plan

Based on v1 contract alignment review. Organized by priority.

---

## Summary of Gaps

| Gap | Priority | Effort |
|-----|----------|--------|
| 1. Edge vocabulary mismatch in docs | High | Low |
| 2. Validation failure UX missing | High | Medium |
| 3. Cluster enhancements (--count, --regenerate) | Medium | Medium |
| 4. Preview command for patches | Medium | Low |
| 5. Manual add/edit/delete commands | High | High |
| 6. StoryVersion history + branching | Medium | High |
| 7. Export format alignment | Low | Low |

---

## 1. Edge Vocabulary Documentation

### Problem
CLI guide mentions edges (HAS_CHARACTER, LOCATED_AT, FULFILLS, INVOLVES) but omits others from v1 contract.

### Missing Edges
| Edge Type | Source | Target | Phase Required |
|-----------|--------|--------|----------------|
| FEATURES_OBJECT | Scene | Object | Optional |
| MANIFESTS_IN | Conflict | Scene | DRAFT |
| HAS_ARC | Character | CharacterArc | Optional |
| EXPRESSED_IN | Theme | Scene/Beat | REVISION |
| APPEARS_IN | Motif | Scene | REVISION |

### Solution
Add "Edge Types" section to CLI guide listing all 9 edge types with meanings.

### Files to Modify
- `spec/cliGuide.md` - Add edge vocabulary section

---

## 2. Validation Failure UX

### Problem
CLI only shows success paths. No documentation or handling for:
- Patch validation failures
- Structured error codes
- Recovery options

### Current Error Codes (from validator.ts)
```
FK_INTEGRITY        - Foreign key violation
MISSING_REQUIRED    - Required field missing
INVALID_ENUM        - Enum value invalid
DUPLICATE_ID        - Node ID already exists
DUPLICATE_EDGE      - Same (type, from, to) exists
CONSTRAINT_VIOLATION - Business rule failed
INVALID_TYPE        - Field type mismatch
OUT_OF_RANGE        - Numeric value out of range
INVALID_EDGE_TYPE   - Unknown edge type
INVALID_EDGE_SOURCE - Invalid source node type
INVALID_EDGE_TARGET - Invalid target node type
```

### Solution

#### 2a. Enhanced `accept` command output on failure
```
project-apollo accept mv_1234567890_0

✗ Patch rejected: 2 validation errors

Errors:
  1. FK_INTEGRITY (op #2)
     Referenced node does not exist: char_INVALID
     Field: scene.characters (HAS_CHARACTER edge)

  2. OUT_OF_RANGE (op #0)
     Value 0 out of range for order_index (must be ≥ 1)
     Node: scene_001

Suggestions:
  - Create missing character first: project-apollo add character --name "..."
  - Or edit move before accepting

Options:
  Run "project-apollo cluster <oq_id>" to regenerate
  Run "project-apollo add character --name <name>" to create missing node
```

#### 2b. Add `--dry-run` flag to accept
```bash
project-apollo accept mv_123 --dry-run
```
Shows what would happen without committing.

### Files to Modify
- `packages/cli/src/commands/commit-package.ts` - Enhanced error display + dry-run
- `packages/cli/src/utils/errors.ts` - Add validation error formatter
- `spec/cliGuide.md` - Document failure output

---

## 3. Cluster Command Enhancements

### Problem
Current `cluster` command only generates 1 cluster with 3-5 moves. No control over:
- Number of moves generated
- Regeneration with new seed
- "None of the above" flow

### Solution

#### 3a. Add options to `cluster` command
```bash
# Generate more moves
project-apollo cluster oq_beat_beat_Catalyst --count 6

# Regenerate with fresh seed (new variations)
project-apollo cluster oq_beat_beat_Catalyst --regenerate

# Combine: regenerate with specific count
project-apollo cluster oq_beat_beat_Catalyst --regenerate --count 5
```

#### 3b. Add "none of the above" option
When displaying moves, add footer:
```
Not satisfied with these options?
  --regenerate    Generate new variations
  --count N       Request more moves (max 10)
```

#### 3c. Persist last seed per OQ
Store in session.json so `--regenerate` creates different results.

### Files to Modify
- `packages/cli/src/commands/cluster.ts` - Add --count, --regenerate flags
- `packages/cli/src/state/session.ts` - Store cluster seeds
- `packages/core/src/stubs/clusterStub.ts` - Accept seed/count params
- `spec/cliGuide.md` - Document new options

---

## 4. Preview Command

### Problem
Users can't see what a move will do before accepting it.

### Solution

#### 4a. Add `preview` command
```bash
project-apollo preview mv_1234567890_0
```

Output:
```
Move Preview: Catalyst: Dramatic confrontation
────────────────────────────────────────────

Patch Operations (3 ops):

  1. ADD_NODE Scene
     id: scene_001
     heading: "INT. WIZARD TOWER - NIGHT"
     scene_overview: "The young wizard accidentally unleashes..."
     beat_id: beat_Catalyst
     order_index: 1

  2. ADD_EDGE HAS_CHARACTER
     scene_001 → char_protagonist

  3. ADD_EDGE LOCATED_AT
     scene_001 → loc_001

Expected Effects:
  - Resolves: Beat "Catalyst" has no scenes assigned
  - May introduce: SceneHasNoCast (if characters not linked)

Confidence: 88%

Run "project-apollo accept mv_1234567890_0" to apply.
```

#### 4b. Alternative: Add `--show-patch` to cluster command
```bash
project-apollo cluster oq_beat_beat_Catalyst --show-patch
```
Shows full patch details inline with move list.

### Files to Modify
- `packages/cli/src/commands/preview.ts` - New command
- `packages/cli/src/utils/format.ts` - Add patch formatter
- `packages/cli/src/index.ts` - Register command
- `spec/cliGuide.md` - Document command

---

## 5. Manual Add/Edit/Delete Commands

### Problem
Users can only modify story through cluster moves. Need direct node manipulation.

### Solution

#### 5a. Add Character
```bash
project-apollo add character --name "John" --description "A mysterious stranger"
project-apollo add character --name "John" --archetype "Mentor" --traits "wise,patient"
```

#### 5b. Add Conflict
```bash
project-apollo add conflict \
  --name "Save the president" \
  --type societal \
  --description "A coup unfolds aboard Air Force One..."
```

#### 5c. Add Location
```bash
project-apollo add location --name "Paris" --description "City of lights"
project-apollo add location --name "Eiffel Tower" --parent "Paris"
```

#### 5d. Add Scene (more complex)
```bash
project-apollo add scene \
  --heading "INT. CAFE - DAY" \
  --overview "The detective meets their informant..." \
  --beat Catalyst \
  --characters "John,Mary" \
  --location "Paris Cafe"
```

#### 5e. Edit Node
```bash
project-apollo edit char_001 --set name="Jonathan" --set archetype="Hero"
project-apollo edit scene_001 --set mood="tense"
```

#### 5f. Delete Node
```bash
project-apollo delete char_001
project-apollo delete char_001 --force  # Skip confirmation
```

#### Implementation Notes
- All commands create a Patch internally
- Patch is validated before commit
- Each operation creates new StoryVersion
- Show confirmation with node details before commit

### Files to Create
- `packages/cli/src/commands/add.ts` - Add subcommands
- `packages/cli/src/commands/edit.ts` - Edit command
- `packages/cli/src/commands/delete.ts` - Delete command

### Files to Modify
- `packages/cli/src/index.ts` - Register commands
- `spec/cliGuide.md` - Document commands

---

## 6. StoryVersion History + Branching

### Problem
Current storage saves only "current state". Spec defines:
- StoryVersion nodes with parent_story_version_id
- DAG of versions for branching
- Ability to checkout previous versions

### Current Storage
```json
{
  "storyId": "my-story",
  "storyVersionId": "sv_123",
  "graph": { ... }
}
```

### Target Storage
```json
{
  "storyId": "my-story",
  "currentVersionId": "sv_456",
  "versions": {
    "sv_123": {
      "id": "sv_123",
      "parent_id": null,
      "label": "Initial",
      "created_at": "...",
      "graph": { ... }
    },
    "sv_456": {
      "id": "sv_456",
      "parent_id": "sv_123",
      "label": "Added catalyst scene",
      "created_at": "...",
      "graph": { ... }
    }
  }
}
```

### New Commands

#### 6a. Log command
```bash
project-apollo log

Version History
───────────────
* sv_456 (current) "Added catalyst scene" - 2 minutes ago
  sv_123 "Initial" - 1 hour ago
```

#### 6b. Checkout command
```bash
project-apollo checkout sv_123

✓ Switched to version: sv_123
  Label: Initial
  Warning: You are in detached state. Any changes will create a branch.
```

#### 6c. Branch command (future)
```bash
project-apollo branch "experimental-ending"
```

### Implementation Phases
1. **Phase 1** (MVP): Store version history, add `log` command
2. **Phase 2**: Add `checkout` to switch versions
3. **Phase 3**: Full branching support

### Files to Modify
- `packages/cli/src/state/store.ts` - New storage format with versions
- `packages/cli/src/commands/log.ts` - New command
- `packages/cli/src/commands/checkout.ts` - New command
- Migration script for existing stories

---

## 7. Export Format Alignment

### Problem
Export format missing some fields from spec.

### Current Export
```json
{
  "version": "1.0.0",
  "exportedAt": "...",
  "storyId": "my-story",
  "storyVersionId": "sv_123",
  "metadata": { "name": "...", "phase": "..." },
  "graph": { "nodes": {...}, "edges": [...] }
}
```

### Target Export (v1 aligned)
```json
{
  "version": "1.0.0",
  "exportedAt": "...",
  "storyId": "my-story",
  "storyVersion": {
    "id": "sv_123",
    "parent_story_version_id": "sv_122",
    "label": "Added catalyst scene",
    "created_at": "...",
    "logline": "...",
    "tags": []
  },
  "graph": { "nodes": {...}, "edges": [...] }
}
```

### Changes
- Replace flat `storyVersionId` with full `storyVersion` object
- Include `parent_story_version_id` for lineage
- Add `label` and `tags` fields

### Files to Modify
- `packages/cli/src/commands/save.ts` - Updated export format
- `packages/cli/src/commands/load.ts` - Handle both formats
- `spec/cliGuide.md` - Update format documentation

---

## Implementation Order

### Batch 1: Documentation + Quick Wins (Low effort, high impact)
1. Edge vocabulary in CLI guide
2. Preview command
3. Export format alignment

### Batch 2: Core UX Improvements (Medium effort)
4. Validation failure UX in accept
5. Cluster enhancements (--count, --regenerate)

### Batch 3: Major Features (High effort)
6. Manual add/edit/delete commands
7. StoryVersion history + log command

### Batch 4: Advanced Features (Future)
8. Checkout command
9. Branching support

---

## Estimated Timeline

| Batch | Items | Files Changed | Complexity |
|-------|-------|---------------|------------|
| 1 | Docs, preview, export | 4 files | Low |
| 2 | Accept UX, cluster opts | 5 files | Medium |
| 3 | Manual commands, history | 8+ files | High |
| 4 | Checkout, branching | 4 files | Medium |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Storage format migration | Keep backward compatibility, auto-migrate |
| Manual commands complexity | Start with character/location, add scene later |
| Branching complexity | Defer to Phase 3, focus on linear history first |

---

## Success Criteria

- [ ] CLI guide documents all 9 edge types
- [ ] `accept` shows structured errors on validation failure
- [ ] `cluster --count 6` generates 6 moves
- [ ] `preview <move_id>` shows patch operations
- [ ] `add character --name "..."` creates character node
- [ ] `log` shows version history
- [ ] Export includes full StoryVersion object
