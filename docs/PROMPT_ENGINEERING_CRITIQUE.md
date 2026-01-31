# Project Apollo Prompt Engineering Critique

**Date**: 2025-06-01  
**Author**: Esh (AI Assistant)  
**Status**: Implementation in progress

---

## Executive Summary

**The Good**: Creative output quality is excellent. The LLM generates narratively compelling, thematically coherent content. The package structure is sound and the story constitution approach is well-designed.

**The Bad**: Schema inconsistencies between prompts and backend code are causing failures. Prompts are verbose with redundant instructions. There are clear bugs unrelated to prompt engineering.

---

## 1. Test Failures Analysis

### Tests 1 & 8: `Cannot read properties of undefined (reading 'constraints')`

**This is NOT a prompt issue** — it's a code bug in `proposeOrchestrator.ts`:

```typescript
if (request.mode) {
  const modeConfig = ai.MODE_DEFAULTS[request.mode];  // ← undefined if mode isn't in defaults
  constraints = { ...modeConfig.constraints };  // ← BOOM
}
```

**Fix**: Add guard:
```typescript
if (request.mode && ai.MODE_DEFAULTS[request.mode]) {
  const modeConfig = ai.MODE_DEFAULTS[request.mode];
  // ...
}
```

### Test 7: `Package 0 missing summary`

The LLM returned a valid package with `summary` field, but the code expects `rationale`. The refine endpoint has different expectations than other generation endpoints.

**Root cause**: Schema mismatch between generation modes.

---

## 2. Prompt Structure Issues

### 2.1 System Prompt vs User Prompt Redundancy

The system prompt says:
> "You are an AI story development assistant helping to craft a compelling narrative..."

Then the user prompt opens with:
> "You are a story structure specialist generating StoryBeat nodes..."

**Problem**: The model is being told what it is twice, with slightly different framing.

**Recommendation**: 
- **System prompt**: Story identity + constitution + hard rules only
- **User prompt**: Task-specific instructions + context + output schema

### 2.2 Prompt Length

The Story Beats prompt is ~3,500 tokens before the LLM even starts thinking. This leads to:
- Higher costs
- Potential "lost in the middle" effect
- Slower response times

**Recommendations**:
1. Move the story state snapshot to structured data (not prose)
2. Remove redundant "Guidelines" that appear in both prompts
3. Use terser formatting for existing nodes list

### 2.3 Schema Inconsistencies Across Endpoints

| Endpoint | Package Schema |
|----------|----------------|
| `/propose/story-beats` | `primary.nodes[]`, `primary.edges[]`, `supporting` |
| `/propose/characters` | `changes.nodes[]`, `changes.edges[]` |
| `/propose/expand` | `changes.nodes[]`, `changes.edges[]`, `changes.storyContext[]` |
| `/propose/refine` | `changes.node_changes[]`, `changes.edge_changes[]` |

The refine output uses `node_changes` with `op: "add"` while others use `nodes` with `operation: "add"`.

**Recommendation**: Standardize on ONE package schema.

---

## 3. Good Patterns Worth Keeping

### 3.1 Story Constitution Injection ✓
```
**Logline**: A retired strong man for a drug syndicate...
**Genre**: Crime Thriller
**Setting**: Modern day Miami
### Thematic Pillars
- Honor among criminals vs corruption in institutions...
```

Excellent — gives the model a clear creative North Star.

### 3.2 Explicit Edge Type Constraints ✓
```
**VALID EDGE TYPES:**
- PRIMARY: ALIGNS_WITH (StoryBeat -> Beat, REQUIRED)
- SUPPORTING: FEATURES_CHARACTER, LOCATED_AT
```

Prevents the model from inventing relationship types.

### 3.3 Impact Analysis in Packages ✓
```json
"impact": {
  "fulfills_gaps": ["derived_missing_beat_BreakIntoTwo"],
  "creates_gaps": [],
  "conflicts": []
}
```

Good self-documentation pattern that helps with staging.

---

## 4. Specific Improvements

### 4.1 Simplify "CRITICAL CONSTRAINTS" Section

**Before** (too verbose):
```
**STRICT OUTPUT RULES:**
1. PRIMARY section: ONLY StoryBeat nodes. NO Scene, Character, Location, or Object nodes in primary.
2. Each StoryBeat MUST have exactly one ALIGNS_WITH edge to a Beat node.
3. StoryBeats MAY have PRECEDES edges to other StoryBeats for causal ordering.
...
```

**After** (scannable):
```
## Output Rules
- PRIMARY: StoryBeat nodes only → each MUST have ALIGNS_WITH edge to a Beat
- SUPPORTING: Character/Location nodes if needed
- Package count: exactly {packageCount}
```

### 4.2 Use Structured Context, Not Prose

**Before**:
```
### Characters

- **char_protagonist** (Character): Cain: "Retired gangster who now lives in the Florida Keys and ru..."
```

**After**:
```yaml
characters:
  char_protagonist: {name: "Cain", archetype: "PROTAGONIST", summary: "Retired syndicate enforcer"}
```

Models handle structured data efficiently.

### 4.3 Add Output Validation Rules

Include in prompt:
```
## Validation (output rejected if these fail)
- All node_ids follow pattern: `{type}_{timestamp}_{5chars}`
- All edge from/to reference valid node_ids
- Package count matches requested
- No trailing commas in JSON
```

---

## 5. Recommended Prompt Architecture

```
┌─────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT (~500 tokens)                              │
│ - Role definition                                        │
│ - Story Identity + Constitution                          │
│ - Logline, Genre, Setting, Thematic Pillars, Rules      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ USER PROMPT                                              │
│ 1. TASK (what to generate)               ~100 tokens    │
│ 2. CONTEXT (structured YAML/JSON)        ~800 tokens    │
│    - existing nodes (compact)                           │
│    - gaps/opportunities                                 │
│    - user direction                                     │
│ 3. OUTPUT SCHEMA (example + rules)       ~400 tokens    │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Priority Fixes

| Priority | Issue | Action |
|----------|-------|--------|
| 🔴 P0 | `constraints` undefined bug | Add null check in proposeOrchestrator.ts |
| 🔴 P0 | Schema inconsistency (`summary` vs `rationale`) | Standardize package schema |
| 🟡 P1 | Verbose prompts | Reduce by ~40% using structured context |
| 🟡 P1 | Redundant role instructions | Keep in system prompt only |
| 🟢 P2 | No prompt versioning | Add `prompt_version` to help debug |

---

## 7. Creative Output Quality: A+

Despite structural issues, actual creative output is excellent:

> "Lieutenant Isabel Korda: A ruthless Miami-Dade Internal Affairs lieutenant who built her career by turning corruption cases into leverage, not convictions."

> "Codes vs badges: criminals keep predictable rules and debts, while corrupt police weaponize authority, making morality about conduct rather than legality."

The model understands the noir tone, creates compelling moral ambiguity, and produces ready-to-use screenplay material. The prompt engineering for *creative direction* is working well — it's the *output formatting* and *schema consistency* that need work.
