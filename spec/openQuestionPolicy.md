# OpenQuestion → Package Generation Policy (v1)

This document defines how **OpenQuestions (OQs)** drive generation of **NarrativePackages** staged for review and merge.

The policy reflects the core philosophy:
- Structure (STC + 5-Act) is the primary attractor
- Exploration is breadth-first, not prescriptive
- Humans choose directions; the system samples futures
- Packages represent alternative directions; users choose what to merge

---

## 1. Core Definitions

### OpenQuestion (OQ)
A **deterministically derived gap** in the knowledge graph, emitted by schema rules.

OQs do not prescribe order. They signal *areas of opportunity*.

### Proposal Session
An active generation session that contains a set of alternative NarrativePackages.

### NarrativePackage
A staged, reversible bundle of changes (nodes/edges + impact) proposed as one option.

---

## 2. OpenQuestion Schema

Each OpenQuestion MUST have the following fields:

```json
OpenQuestion {
  id: string
  type: OpenQuestionType
  target_node_id: string
  domain: Domain
  group_key: string
}
```

### Enums

**Domain:**
- STRUCTURE
- SCENE
- CHARACTER

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
- CHARACTER:DETAIL:<character_id>

Each proposal session is typically scoped to one group_key.

## 4. Session Selection Policy (Frontier Construction)

### Hard Limits (v1 defaults)
- Sessions per cycle: 1 active per user action
- Packages per session: 3–8 (default: 3)

### Structural Bias (non-negotiable)
When available:
- ≥2 clusters MUST come from STRUCTURE domain

### Fill Strategy
Bias toward STRUCTURE when gaps exist; otherwise CHARACTER/SCENE quality.

## 5. Proposal Session Schema

```json
GenerationSession {
  id: string,
  story_id: string,
  entry_point: { type: string, target_id?: string },
  initial_params: { depth: string, count: string, direction?: string },
  packages: NarrativePackage[],
  status: 'active' | 'accepted' | 'abandoned',
  accepted_package_id?: string
}
```

## 6. Budgets (Depth & Count)

Budgets are specified via depth (narrow/medium/wide) and count (few/standard/many) and enforced in the AI layer (see aiimplementationplan.md).

## 7. NarrativePackage Schema

See aiIntegration.md for the full NarrativePackage structure (changes, edges, impact, lineage).
## 8. Diversity Policy (Inside a Session)

Packages within a session MUST vary along at least 2 of the following axes:

### Diversity Axes
- Mechanism (reveal, betrayal, loss, decision)
- Tone (tragic, ironic, bleak, restrained)
- Agent focus (protagonist-driven, antagonist-driven)
- Structural emphasis (entry, midpoint, escalation)
- Thematic resonance (optional link to Theme)

Each package includes:

```json
style_tags: ["betrayal", "protagonist-driven", "bleak"]
```

Duplicate tag sets are disallowed within the same session.

## 9. Acceptance & Collapse Semantics

User may:
- accept one package (per session)
- refine a selected package and accept a child

System behavior:
1. Convert selected package to Patch
2. Validate against current graph; run lint pre-commit
3. Optionally apply auto-fix transforms
4. On success → commit new StoryVersion

Sessions remain immutable and reusable for branching until discarded.

## 10. Default Session Entry Points by Story Maturity

### Early (Sparse Graph)
- STRUCTURE – Populate key beats (StoryBeats)
- STRUCTURE – Place existing scenes
- CHARACTER – Define main characters

### Mid (Structure Mostly Present)
- STRUCTURE – Strengthen weak beats
- SCENES – Fill Act 2 escalation
- CHARACTER – Arc turning points

### Late (Polish)
- SCENE_QUALITY – Tighten overviews
- CHARACTER – Complete arcs

## 11. One-Line Summary

OpenQuestions define the search space; sessions produce diverse packages under budgets; human choice collapses the story into its next state.

This policy is the operational core of the system.
