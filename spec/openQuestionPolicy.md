# OpenQuestion → Cluster Generation Policy (v1)

This document defines how **OpenQuestions (OQs)** are transformed into **clusters of NarrativeMoves** in the screenplay knowledge graph system.

The policy reflects the core philosophy:
- Structure (STC + 5-Act) is the primary attractor
- Exploration is breadth-first, not prescriptive
- Humans choose directions; the system samples futures
- Clusters represent *directions*, not “next steps”

---

## 1. Core Definitions

### OpenQuestion (OQ)
A **deterministically derived gap** in the knowledge graph, emitted by schema rules.

OQs do not prescribe order. They signal *areas of opportunity*.

### Cluster
A **bundle of alternative NarrativeMoves** that explore one direction (usually centered on one primary OQ).

### NarrativeMove
A **small, reversible patch** (KG diff) proposing a possible advance.

---

## 2. OpenQuestion Schema

Each OpenQuestion MUST have the following fields:

```json
OpenQuestion {
  id: string
  type: OpenQuestionType
  target_node_id: string
  domain: Domain
  phase: Phase
  severity: Severity
  group_key: string
}
```

### Enums

**Domain:**
- STRUCTURE
- SCENE
- CHARACTER
- CONFLICT
- THEME_MOTIF

**Phase:**
- OUTLINE
- DRAFT
- REVISION

**Severity:**
- BLOCKING (structure cannot progress cleanly)
- IMPORTANT (should be addressed soon)
- SOFT (advisory / attractor only)

## 3. Canonical Grouping (group_key)

To avoid "one cluster per OQ", OQs are grouped via group_key.

### Group Key Patterns

**STRUCTURE:**
- STRUCTURE:BEAT:<beat_type>
- STRUCTURE:ACT:<act>

**SCENE:**
- SCENE:UNPLACED
- SCENE:QUALITY:<scene_id>

**CHARACTER:**
- CHARACTER:ARC:<character_id>

**CONFLICT:**
- CONFLICT:SETUP:<conflict_id>
- CONFLICT:SHOW:<conflict_id>

**THEME / MOTIF:**
- THEME:GROUND:<theme_id>
- MOTIF:GROUND:<motif_id>

Each cluster corresponds to one group_key.

## 4. Cluster Selection Policy (Frontier Construction)

### Hard Limits (v1 defaults)
- Clusters per cycle: 3–6 (default: 4)
- Moves per cluster: 5–12 (default: 8)

### Structural Bias (non-negotiable)
When available:
- ≥2 clusters MUST come from STRUCTURE domain

### Fill Strategy
After structural clusters:
- 1 cluster from CONFLICT or CHARACTER (if available)
- 0–1 cluster from THEME/MOTIF (Revision mode only by default)

## 5. Phase Gating

Clusters are filtered by current mode:

### OUTLINE_MODE
- STRUCTURE
- SCENE (SceneUnplaced only)
- CONFLICT (setup only)
- THEME/MOTIF suppressed unless user requests

### DRAFT_MODE
- STRUCTURE
- SCENE (quality)
- CONFLICT (manifestation)
- CHARACTER (arcs)

### REVISION_MODE
- All domains allowed
- THEME/MOTIF grounding encouraged

## 6. Cluster Schema

```json
MoveCluster {
  id: string
  base_story_version_id: string
  cluster_type: ClusterType
  title: string
  primary_open_question_id: string
  supporting_open_question_ids: string[]
  scope_budget: ScopeBudget
}
```

### ClusterType
- STRUCTURE
- SCENE_LIST
- SCENE_QUALITY
- CONFLICT
- CHARACTER
- THEME
- MOTIF

## 7. Scope Budgets (Critical Control Mechanism)

Every cluster defines how far a move is allowed to go.

```json
ScopeBudget {
  max_ops_per_move: number
  max_new_nodes_per_move: number
  allowed_node_types: string[]
  allowed_depth: Phase
}
```

### Default Budgets by Cluster Type

| Cluster Type | max_ops | max_nodes | Allowed Nodes | Depth |
|---|:---:|:---:|---|---|
| STRUCTURE (BeatUnrealized) | 6 | 2 | Scene, Beat | OUTLINE |
| SCENE_LIST (Unplaced) | 5 | 1 | Scene | OUTLINE |
| SCENE_QUALITY | 4 | 0 | Scene | DRAFT |
| CONFLICT (Setup) | 6 | 2 | Conflict, Scene | DRAFT |
| CONFLICT (Show) | 6 | 2 | Scene | DRAFT |
| CHARACTER (Arc) | 6 | 1 | CharacterArc | DRAFT |
| THEME / MOTIF | 4 | 0 | Scene, Beat | REVISION |

## 8. NarrativeMove Schema

```json
NarrativeMove {
  id: string
  cluster_id: string
  patch_id: string
  title: string
  rationale: string
  expected_effects: string[]
  move_style_tags: string[]
}
```
## 9. Diversity Policy (Inside a Cluster)

Moves within a cluster MUST vary along at least 2 of the following axes:

### Diversity Axes
- Mechanism (reveal, betrayal, loss, decision)
- Tone (tragic, ironic, bleak, restrained)
- Agent focus (protagonist-driven, antagonist-driven)
- Structural emphasis (entry, midpoint, escalation)
- Thematic resonance (optional link to Theme)

Each move includes:

```json
move_style_tags: ["betrayal", "protagonist-driven", "bleak"]
```

Duplicate tag sets are disallowed within the same cluster.

## 10. Acceptance & Collapse Semantics

User may:
- accept one move
- accept multiple moves in one cluster
- accept moves across clusters

System behavior:
1. Merge selected patches
2. Validate merged patch
3. If conflicts:
   - emit ConflictFlags
   - propose 2–3 fix-moves
4. On success → commit new StoryVersion

Clusters remain immutable and reusable for branching.

## 11. Default Cluster Sets by Story Maturity

### Early (Sparse Graph)
- STRUCTURE – Populate key beats
- STRUCTURE – Place existing scenes
- CONFLICT – Define central opposition
- THEME (optional) – Candidate thematic directions

### Mid (Structure Mostly Present)
- STRUCTURE – Strengthen weak beats
- SCENE_LIST – Fill Act 2 escalation
- CONFLICT – Show conflict in scenes
- CHARACTER – Arc turning points

### Late (Revision)
- THEME – Ground themes
- MOTIF – Ensure recurrence
- CONFLICT – Resolve in Finale
- SCENE_QUALITY – Tighten overviews

## 12. One-Line Summary

OpenQuestions define the search space; clusters sample promising directions; scope budgets prevent runaway changes; human choice collapses the story into its next state.

This policy is the operational core of the system.
