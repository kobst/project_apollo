# StoryContext Reference

> Single source of truth for story creative direction and writing guidelines.
> Replaces the former Premise section (Logline, GenreTone, Setting nodes) and freeform markdown StoryContext.

## Overview

StoryContext is a structured object stored at `state.metadata.storyContext`. It is split into two parts:

1. **Constitution** — Stable creative direction. Cached in the AI system prompt. Changes invalidate the prompt cache.
2. **Operational** — Dynamic writing guidelines. Filtered per-task and included in user prompts, not system prompts.

This separation enables Anthropic prompt caching for constitution while allowing operational guidelines to be selectively applied based on task type.

**Location**: `packages/core/src/ai/storyContextTypes.ts`

---

## Constitution

Stable creative identity of the story. Serialized into the system prompt by `systemPromptBuilder.ts`.

```typescript
interface StoryContextConstitution {
  logline: string;           // One-sentence story summary (elevator pitch)
  premise: string;           // Extended premise — what makes the concept unique
  genre: string;             // e.g., "sci-fi thriller", "romantic comedy"
  setting: string;           // e.g., "1920s Chicago", "Modern day Miami"
  thematicPillars: string[]; // Core tensions/themes the story explores
  hardRules: HardRule[];     // Rules the AI must never violate
  toneEssence: string;       // Essential tone and voice
  banned: string[];          // Elements explicitly forbidden
  version: string;           // Version tracking for cache invalidation
}

interface HardRule {
  id: string;
  text: string;
}
```

### Field Definitions

| Field | Purpose | Example |
|-------|---------|---------|
| `logline` | One sentence. The hook. | "A retired strongman gets recruited by his old employers to find who's robbing their shipments" |
| `premise` | Expands on the logline — the core concept and why it matters | "An exploration of loyalty and corruption where a criminal's code of honor proves more reliable than the justice system" |
| `genre` | Genre label(s) | "Crime Thriller", "Sci-fi Romance" |
| `setting` | World/time/place | "Modern day Miami", "Post-apocalyptic wasteland" |
| `thematicPillars` | Core tensions the story explores | ["Honor among criminals vs institutional corruption", "Loyalty vs self-preservation"] |
| `hardRules` | Non-negotiable constraints | "Never reveal the killer's identity before Act 4" |
| `toneEssence` | Voice and feel | "Gritty noir with dark humor; Miami Vice meets The Wire" |
| `banned` | Explicitly forbidden elements | ["Supernatural elements", "Time travel"] |
| `version` | Tracks constitution changes | "1.0.0" |

### Logline vs Premise

- **Logline**: One sentence. Sells the hook. "What is this story?"
- **Premise**: Extended exploration. "What makes this story unique and why does it matter?" The logline is the seed; the premise is the elaboration.

---

## Operational

Dynamic content filtered per-task. Included in user prompts, not cached in system prompts.

```typescript
interface StoryContextOperational {
  softGuidelines: SoftGuideline[];
  workingNotes?: string;        // Freeform scratch space
}

interface SoftGuideline {
  id: string;
  tags: GuidelineTag[];
  text: string;
}
```

### Guideline Tags

Tags control which guidelines are included in prompts for specific task types. Known tags:

| Tag | When included |
|-----|--------------|
| `character` | Character generation/editing |
| `dialogue` | Dialogue-related tasks |
| `scene` | Scene generation/editing |
| `action` | Action sequence tasks |
| `pacing` | Pacing-related decisions |
| `plot` | Plot/story beat tasks |
| `worldbuilding` | World-building tasks |
| `structure` | Structural/outline tasks |
| `tone` | Tone-sensitive tasks |
| `theme` | Thematic tasks |
| `general` | Always included |

The tag set is open-ended — the AI can generate arbitrary string tags beyond this list. The validator accepts any string as a valid tag.

---

## AI Integration

### System Prompt

The constitution is serialized into the system prompt by `systemPromptBuilder.ts`:

```
## Story Constitution

**Logline**: A retired strongman...
**Premise**: An exploration of loyalty...
**Genre**: Crime Thriller
**Setting**: Modern day Miami

**Thematic Pillars**:
- Honor among criminals vs institutional corruption
- ...

**Hard Rules**:
- Never reveal the killer's identity before Act 4

**Tone**: Gritty noir with dark humor...

**Banned Elements**: Supernatural elements, Time travel
```

Operational guidelines are NOT in the system prompt. They are filtered by tag and injected into user prompts per-task.

### Structured Change Operations

The AI proposes StoryContext changes via `StoryContextChangeOperation`:

```typescript
type StoryContextChangeOperation =
  // Constitution string fields
  | { type: 'setConstitutionField'; field: 'logline' | 'premise' | 'genre' | 'setting' | 'toneEssence' | 'version'; value: string }
  // Thematic pillars
  | { type: 'setThematicPillars'; pillars: string[] }
  | { type: 'addThematicPillar'; pillar: string }
  | { type: 'removeThematicPillar'; index: number }
  // Banned elements
  | { type: 'addBanned'; item: string }
  | { type: 'removeBanned'; index: number }
  // Hard rules
  | { type: 'addHardRule'; rule: { id: string; text: string } }
  | { type: 'updateHardRule'; id: string; text: string }
  | { type: 'removeHardRule'; id: string }
  // Soft guidelines (operational)
  | { type: 'addGuideline'; guideline: { id: string; tags: string[]; text: string } }
  | { type: 'updateGuideline'; id: string; changes: { tags?: string[]; text?: string } }
  | { type: 'removeGuideline'; id: string }
  // Working notes
  | { type: 'setWorkingNotes'; content: string };
```

These operations are used by the expand orchestrator when the target is `story-context` or `story-context-section`.

---

## API Endpoints

### `GET /stories/:id/context`
Returns the full StoryContext and last-modified timestamp.

### `PATCH /stories/:id/context`
Saves the full StoryContext. Body: `{ context: StoryContext }`. Validates with `isValidStoryContext()` before saving. Creates a new version snapshot.

---

## Storage & Migration

**Location on disk**: `~/.apollo/stories/<id>/state.json` → `metadata.storyContext`

### Migration Pipeline (`loadVersionedStateById` in `storage.ts`)

1. **String to structured**: If `storyContext` is a string (old markdown format), replaced with `createDefaultStoryContext()`
2. **Logline migration**: If `metadata.logline` exists (old field), copied to `constitution.logline` and removed
3. **Genre/setting backfill**: If `constitution.genre` or `.setting` is undefined, set to `''`

Migrations run on load and auto-save. Protected by per-story mutex to prevent race conditions from concurrent requests.

---

## What Was Removed

The following node types were consolidated into StoryContext and no longer exist:

| Removed | Replaced By |
|---------|-------------|
| `Logline` node | `constitution.logline` |
| `Premise` node | `constitution.logline` + `constitution.premise` |
| `GenreTone` node | `constitution.genre` + `constitution.toneEssence` |
| `Setting` node | `constitution.setting` |
| `SET_IN` edge (Scene → Setting) | Removed — setting is a constitution field |
| `PART_OF` edge (Location → Setting) | Removed — setting is a constitution field |
| `metadata.logline` field | `constitution.logline` |

The UI's former "Premise Section" (PremiseSection, PremisePanel, PremiseEditModal, PremiseHeader components) has been removed. All constitution fields are now edited in the StoryContext Editor.

---

## UI

The StoryContext Editor (`packages/ui/src/components/context/StoryContextEditor.tsx`) provides:

- **Constitution section**: Editable fields for logline, premise, genre, setting, thematic pillars, hard rules, tone essence, banned items
- **Operational section**: Editable soft guidelines with tags, working notes
- **Proposed changes**: Inline display of AI-proposed changes (from expand flow) with accept/reject controls
- **Auto-save**: 1-second debounce after edits, saves full context via PATCH endpoint

---

## Key Files

| File | Role |
|------|------|
| `packages/core/src/ai/storyContextTypes.ts` | Type definitions, factory functions, validators |
| `packages/core/src/ai/types.ts` | `StoryContextChangeOperation` type |
| `packages/core/src/ai/systemPromptBuilder.ts` | Serializes constitution into system prompt |
| `packages/core/src/ai/contextSerializer.ts` | Serializes full story state for user prompts |
| `packages/core/src/ai/prompts/expandPrompt.ts` | Expand prompt instructions for context operations |
| `packages/api/src/handlers/context.ts` | GET/PATCH context endpoints |
| `packages/api/src/storage.ts` | Migration pipeline, atomic saves |
| `packages/ui/src/components/context/StoryContextEditor.tsx` | UI editor component |
