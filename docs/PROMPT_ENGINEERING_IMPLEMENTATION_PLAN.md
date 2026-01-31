# Prompt Engineering Implementation Plan

**Date**: 2025-06-01  
**Author**: Esh (AI Assistant)  
**Related**: [PROMPT_ENGINEERING_CRITIQUE.md](./PROMPT_ENGINEERING_CRITIQUE.md)

---

## Overview

This plan addresses the issues identified in the prompt engineering critique, prioritized by impact and risk.

---

## Phase 1: Critical Bug Fixes (P0)

### 1.1 Fix `constraints` undefined error in proposeOrchestrator.ts

**File**: `packages/api/src/ai/proposeOrchestrator.ts`

**Problem**: When `request.mode` is set but doesn't exist in `ai.MODE_DEFAULTS`, accessing `modeConfig.constraints` throws.

**Solution**:
```typescript
// Before
if (request.mode) {
  const modeConfig = ai.MODE_DEFAULTS[request.mode];
  constraints = { ...modeConfig.constraints };
  options = { ...modeConfig.options };
}

// After
if (request.mode && ai.MODE_DEFAULTS[request.mode]) {
  const modeConfig = ai.MODE_DEFAULTS[request.mode];
  constraints = { ...modeConfig.constraints };
  options = { ...modeConfig.options };
}
```

**Risk**: Low — defensive programming, no behavior change for valid inputs.

### 1.2 Fix schema inconsistency (`summary` vs `rationale`)

**Files**: 
- `packages/api/src/ai/refineOrchestrator.ts`
- `packages/core/src/ai/types.ts`

**Problem**: Refine endpoint expects different field names than what LLM returns.

**Solution**: 
1. Update refine orchestrator to accept both `summary` and `rationale`
2. Normalize during parsing: `summary = pkg.summary || pkg.rationale`
3. Update prompt to request `rationale` consistently

**Risk**: Low — additive change with fallback.

---

## Phase 2: Schema Standardization (P0-P1)

### 2.1 Define canonical package schema

Create a single source of truth for package structure:

```typescript
// packages/core/src/ai/packageSchema.ts
export interface NarrativePackage {
  id: string;
  title: string;
  rationale: string;  // Standardize on 'rationale', not 'summary'
  confidence: number;
  style_tags: string[];
  
  // Lineage (for refinements)
  parent_package_id?: string;
  refinement_prompt?: string;
  
  // Changes - standardized structure
  changes: {
    nodes: NodeChange[];
    edges: EdgeChange[];
    storyContext?: StoryContextChange[];
  };
  
  impact: {
    fulfills_gaps: string[];
    creates_gaps: string[];
    conflicts: ConflictInfo[];
  };
}

export interface NodeChange {
  operation: 'add' | 'modify' | 'delete';  // Standardize on 'operation'
  node_type: string;
  node_id: string;
  data?: Record<string, any>;
}

export interface EdgeChange {
  operation: 'add' | 'modify' | 'delete';
  edge_type: string;
  from: string;
  to: string;
  properties?: Record<string, any>;
}
```

### 2.2 Update all orchestrators to use canonical schema

**Files to update**:
- `storyBeatOrchestrator.ts` — uses `primary.nodes[]` → migrate to `changes.nodes[]`
- `characterOrchestrator.ts` — already uses `changes.nodes[]` ✓
- `expandOrchestrator.ts` — already uses `changes.nodes[]` ✓
- `sceneOrchestrator.ts` — verify schema
- `refineOrchestrator.ts` — uses `node_changes[]` → migrate to `changes.nodes[]`

### 2.3 Update all prompts to request canonical schema

Single JSON schema example used across all prompts:

```json
{
  "packages": [{
    "id": "pkg_{timestamp}_{5chars}",
    "title": "Short descriptive title",
    "rationale": "Why this package makes sense",
    "confidence": 0.85,
    "style_tags": ["tag1", "tag2"],
    "changes": {
      "nodes": [
        {"operation": "add", "node_type": "Character", "node_id": "char_xxx", "data": {...}}
      ],
      "edges": [
        {"operation": "add", "edge_type": "HAS_ARC", "from": "char_xxx", "to": "arc_xxx"}
      ]
    },
    "impact": {
      "fulfills_gaps": [],
      "creates_gaps": [],
      "conflicts": []
    }
  }]
}
```

---

## Phase 3: Prompt Optimization (P1)

### 3.1 Create shared prompt builder

**File**: `packages/api/src/ai/promptBuilder.ts`

```typescript
export function buildSystemPrompt(story: Story): string {
  return `You are an AI story development assistant.

## Story Identity
**Title**: ${story.title}

## Story Constitution
${formatConstitution(story.constitution)}

## Guidelines
- Maintain consistency with established story elements
- Respect creative constraints and thematic direction
- NEVER violate hard rules or include banned elements`;
}

export function buildContextSection(state: StoryState, options: ContextOptions): string {
  // Structured YAML-like format for compactness
  return `## Story State
characters: ${formatCompactNodes(state.characters)}
locations: ${formatCompactNodes(state.locations)}
beats: ${formatCompactNodes(state.beats)}
storyBeats: ${formatCompactNodes(state.storyBeats)}
scenes: ${formatCompactNodes(state.scenes)}`;
}

export function buildOutputSchema(mode: GenerationMode): string {
  // Single canonical schema with mode-specific examples
  return CANONICAL_OUTPUT_SCHEMA;
}
```

### 3.2 Reduce prompt verbosity by ~40%

**Strategy**:
1. Remove redundant role definitions (keep only in system prompt)
2. Replace prose node listings with structured format
3. Consolidate "CRITICAL CONSTRAINTS" into scannable bullet points
4. Remove duplicate "Guidelines" sections

**Before** (storyBeatOrchestrator):
```
## CRITICAL CONSTRAINTS - MUST FOLLOW

**STRICT OUTPUT RULES:**
1. PRIMARY section: ONLY StoryBeat nodes. NO Scene, Character, Location, or Object nodes in primary.
2. Each StoryBeat MUST have exactly one ALIGNS_WITH edge to a Beat node.
3. StoryBeats MAY have PRECEDES edges to other StoryBeats for causal ordering.
4. SUPPORTING section: MAY include Character or Location nodes if needed.
5. You MUST generate exactly 1 packages. Not fewer, not more.
```

**After**:
```
## Output Rules
- PRIMARY: StoryBeat nodes only, each with ALIGNS_WITH edge to Beat
- SUPPORTING: Character/Location nodes if essential
- Packages: exactly {packageCount}
- Edges: ALIGNS_WITH (required), PRECEDES (optional for ordering)
```

### 3.3 Move to structured context format

**Before**:
```markdown
### Characters

- **char_protagonist** (Character): Cain: "Retired gangster who now lives in the Florida Keys and ru..."
- **char_rigo_1767488316196_0** (Character): Rigo: "The longtime kingpin of a drug conglomerate. Mid-60s. Alm..."
```

**After**:
```yaml
characters:
  char_protagonist: Cain | PROTAGONIST | Retired syndicate enforcer in Florida Keys
  char_rigo: Rigo | KINGPIN | Mid-60s cartel boss, Cain's old employer
  char_morrison: Captain Morrison | ANTAGONIST | Corrupt police captain running theft crew
```

---

## Phase 4: Testing & Validation (P1)

### 4.1 Add prompt regression tests

**File**: `packages/api/tests/ai/promptRegression.test.ts`

Test that:
1. All prompts produce valid JSON
2. Output matches canonical schema
3. Required fields are present
4. Edge types are valid

### 4.2 Add schema validation in parsers

```typescript
function parsePackageResponse(raw: string): NarrativePackage[] {
  const parsed = JSON.parse(raw);
  
  // Validate against canonical schema
  for (const pkg of parsed.packages) {
    if (!pkg.id || !pkg.title || !pkg.rationale) {
      throw new Error(`Package missing required fields: ${JSON.stringify(pkg)}`);
    }
    if (!pkg.changes?.nodes) {
      throw new Error(`Package missing changes.nodes`);
    }
    // ... more validation
  }
  
  return parsed.packages;
}
```

---

## Phase 5: Documentation & Observability (P2)

### 5.1 Add prompt versioning

Include version in prompts for debugging:

```typescript
const PROMPT_VERSION = "1.0.0";

export function buildUserPrompt(...) {
  return `## Prompt Version: ${PROMPT_VERSION}
  
  ...rest of prompt`;
}
```

### 5.2 Log prompt tokens for monitoring

```typescript
console.log(`[${orchestratorName}] Prompt tokens: system=${systemTokens}, user=${userTokens}`);
```

---

## Implementation Order

| Order | Task | Files | Est. Effort |
|-------|------|-------|-------------|
| 1 | Fix constraints undefined bug | proposeOrchestrator.ts | 10 min |
| 2 | Fix summary/rationale mismatch | refineOrchestrator.ts | 20 min |
| 3 | Define canonical package schema | core/ai/types.ts | 30 min |
| 4 | Update refine prompt to use canonical schema | refineOrchestrator.ts | 30 min |
| 5 | Update storyBeat prompt (primary/supporting → changes) | storyBeatOrchestrator.ts | 45 min |
| 6 | Create shared prompt builder | promptBuilder.ts (new) | 1 hr |
| 7 | Reduce prompt verbosity across all orchestrators | All orchestrators | 2 hr |
| 8 | Add schema validation | parsers | 1 hr |
| 9 | Add regression tests | tests/ | 1 hr |

**Total estimated effort**: ~7 hours

---

## Success Criteria

- [ ] All 8 tests from prompt-test-output.md pass
- [ ] Prompt token count reduced by ≥30%
- [ ] Single canonical package schema used across all endpoints
- [ ] No schema-related runtime errors

---

## Rollback Plan

If issues arise:
1. Schema changes are additive (old field names still accepted)
2. Prompt changes can be reverted via git
3. All changes are in API layer, core graph unchanged
