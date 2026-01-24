# Unified Propose Pipeline

This document describes the unified AI generation pipeline that consolidates all AI-assisted content creation into a single `/propose` workflow.

## Overview

Previously, the system had multiple separate AI endpoints:
- `/interpret` - Low-creativity text interpretation
- `/generate` - High-creativity content generation
- `/regenerate` - Re-run generation with same parameters
- `/refine` - Modify existing packages

These have been unified into a single `/propose` endpoint with a **creativity slider** that controls the AI's behavior along a spectrum from conservative interpretation to inventive generation.

## Architecture

### API Endpoints

#### New Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/:id/propose` | POST | Create a new proposal with packages |
| `/:id/propose/active` | GET | Get the active proposal for a story |
| `/:id/propose/active` | DELETE | Discard the active proposal |
| `/:id/propose/commit` | POST | Commit (accept) a package from the proposal |
| `/:id/propose/refine` | POST | Refine an existing package with guidance |
| `/:id/propose/story-beats` | POST | Generate StoryBeat nodes only (see below) |

#### Removed Endpoints

- `/:id/interpret` - Use `/propose` with `creativity < 0.3`
- `/:id/generate` - Use `/propose` with `creativity >= 0.3`
- `/:id/regenerate` - Use `/propose` again
- `/:id/refine` - Use `/propose/refine`

### Request Schema

```typescript
interface ProposeRequest {
  intent: 'add' | 'edit' | 'expand' | 'link';
  scope: {
    entryPoint: 'freeText' | 'node' | 'beat' | 'gap' | 'document';
    targetType?: string;      // For 'add' intent
    targetIds?: string[];     // For edit/expand/link
  };
  input?: {
    text?: string;            // Free-form direction
    structured?: Record<string, unknown>;
    documentId?: string;
  };
  constraints: {
    creativity: number;       // 0-1 scale (KEY PARAMETER)
    inventNewEntities: boolean;
    respectStructure: 'strict' | 'soft';
    depth?: 'narrow' | 'medium' | 'wide';
    count?: 'few' | 'standard' | 'many';
  };
  options: {
    packageCount: number;
  };
}
```

### Creativity Parameter

The `creativity` parameter (0-1) is the key differentiator:

| Range | Label | Behavior |
|-------|-------|----------|
| 0.0 - 0.32 | Conservative | Stays close to input, minimal invention, strict structure |
| 0.33 - 0.66 | Balanced | Mix of interpretation and invention |
| 0.67 - 1.0 | Inventive | Free to invent new elements, soft structure |

Internally, creativity maps to:
- `InterpretStrategy` when `entryPoint === 'freeText' && creativity < 0.3`
- `GenerateStrategy` for beat/gap entry points
- `RefineStrategy` for node + edit intent

### Response Schema

```typescript
interface ProposeResponse {
  sessionId: string;
  packages: NarrativePackage[];
  interpretation?: {
    summary: string;
    confidence: number;
    alternatives?: Array<{ summary: string; confidence: number }>;
  };
}
```

## UI Components

### New Components

Located in `packages/ui/src/components/propose/`:

#### ProposeTrigger
Main input component for creating proposals.
- Intent selector (Add/Edit/Expand/Link buttons)
- Direction textarea
- Creativity slider with labels
- Depth options (Focused/Standard/Expansive)

#### IntentSelector
Reusable button group for selecting proposal intent.
- Supports compact mode
- Can limit available intents

#### PackageStaging
Review and commit workflow for generated packages.
- Package list with tree structure (parent/child refinements)
- Preview panel with changes breakdown
- Conflict warnings
- Actions: Discard All, Discard, Save, Refine, Commit

### Removed Components

- `packages/ui/src/components/input/InputPanel.tsx` - Replaced by ProposeTrigger with low creativity
- `packages/ui/src/components/input/ProposalCard.tsx` - No longer needed

### Updated Components

#### GenerationPanel
Now uses the new propose components:
- `ProposeTrigger` instead of `GenerationTrigger`
- `PackageStaging` instead of `PackageBrowser`
- Two views: "propose" and "staging"

#### ElementsPanel
Removed the "Extract" section from the left sidebar.

#### ExploreView
Removed InputPanel from the right pane.

#### FoundationsPanel
Removed InputPanel from the right pane.

## File Changes Summary

### Created

```
packages/core/src/ai/
├── types.ts                    # ProposeRequest, ProposeResponse types
└── config.ts                   # CreativityConfig, presets

packages/api/src/ai/
└── proposeOrchestrator.ts      # Strategy pattern orchestrator

packages/ui/src/components/propose/
├── index.ts
├── ProposeTrigger.tsx
├── ProposeTrigger.module.css
├── IntentSelector.tsx
├── IntentSelector.module.css
├── PackageStaging.tsx
└── PackageStaging.module.css
```

### Modified

```
packages/api/src/
├── handlers/generate.ts        # Added propose handlers
├── handlers/index.ts           # Export new handlers
└── routes/stories.ts           # Added /propose routes, removed legacy

packages/ui/src/
├── api/client.ts               # Added propose methods, removed legacy
├── api/types.ts                # Added ProposeRequest types
├── context/GenerationContext.tsx
├── components/generation/GenerationPanel.tsx
├── components/generation/GenerationSidebar.tsx
├── components/generation/GenerationView.tsx
├── components/workspace/ElementsPanel.tsx
├── components/workspace/FoundationsPanel.tsx
└── components/explore/ExploreView.tsx
```

### Deleted

```
packages/ui/src/components/input/
├── InputPanel.tsx
├── InputPanel.module.css
├── ProposalCard.tsx
└── ProposalCard.module.css
```

## Migration Guide

### For API Consumers

**Old: Interpret text**
```typescript
// Before
await api.interpret(storyId, { userInput: "John is a detective", targetType: "Character" });

// After
await api.propose(storyId, {
  intent: 'add',
  scope: { entryPoint: 'freeText', targetType: 'Character' },
  input: { text: "John is a detective" },
  constraints: { creativity: 0.2, inventNewEntities: false, respectStructure: 'strict' },
  options: { packageCount: 3 }
});
```

**Old: Generate content**
```typescript
// Before
await api.generate(storyId, { entryPoint: { type: 'beat' }, depth: 'medium' });

// After
await api.propose(storyId, {
  intent: 'add',
  scope: { entryPoint: 'beat' },
  constraints: { creativity: 0.5, inventNewEntities: true, respectStructure: 'soft', depth: 'medium' },
  options: { packageCount: 3 }
});
```

**Old: Refine package**
```typescript
// Before
await api.refine(storyId, { basePackageId: pkgId, guidance: "Make it darker" });

// After
await api.refineProposal(storyId, { packageId: pkgId, guidance: "Make it darker" });
```

### For UI Development

The Generation panel is now the single entry point for all AI features:
1. Open via the "Generation" tab
2. Use ProposeTrigger to create proposals
3. Adjust creativity slider based on desired behavior
4. Review packages in PackageStaging
5. Commit to apply changes to the story graph

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Creativity as separate dimension | 0-1 slider | More intuitive than depth/count for controlling AI behavior |
| Single active proposal | One per story | Simplifies state management for single-user model |
| Auto-discard on new propose | Silent | Reduces friction, user can always re-propose |
| Always show staging UI | No auto-commit | User should review AI output before committing |
| Strategy pattern | Internal routing | Clean separation of interpret/generate/refine logic |

## Specialized Endpoints

### StoryBeat-Only Generation

The `/propose/story-beats` endpoint provides a specialized generation flow for filling structural gaps with **only StoryBeat nodes**.

#### Use Cases

- Filling in story beats after establishing basic structure
- Generating narrative milestones without creating supporting elements (scenes, characters)
- Focused structure development when beats exist but lack story content

#### Request Schema

```typescript
interface ProposeStoryBeatsRequest {
  priorityBeats?: string[];           // Beat IDs or BeatTypes to always include
  packageCount?: number;              // default: 3
  maxStoryBeatsPerPackage?: number;   // default: 5
  direction?: string;                 // User guidance
  creativity?: number;                // 0-1, default: 0.5
}
```

#### Response Schema

```typescript
interface ProposeStoryBeatsResponse {
  sessionId: string;
  packages: NarrativePackage[];       // Only contains StoryBeat nodes
  missingBeats: MissingBeatInfo[];    // All beats lacking StoryBeat alignment
}

interface MissingBeatInfo {
  beatId: string;
  beatType: BeatType;
  act: 1 | 2 | 3 | 4 | 5;
  position: number;
}
```

#### Strict Constraints

1. **Node Types**: ONLY `StoryBeat` nodes are generated. Scene, Character, Location, and Object nodes are filtered out.
2. **Edge Types**: ONLY `ALIGNS_WITH` and `PRECEDES` edges are allowed:
   - `ALIGNS_WITH`: StoryBeat → Beat (required for each StoryBeat)
   - `PRECEDES`: StoryBeat → StoryBeat (optional, for causal ordering)
3. **Validation**: ALIGNS_WITH edges must target valid Beat IDs

#### Priority Beats

The `priorityBeats` parameter accepts Beat IDs (e.g., `beat_Catalyst`) or Beat types (e.g., `Catalyst`). When specified:
- At least one package SHOULD address each priority beat
- A warning is logged if no package covers priority beats

#### Example

```bash
curl -X POST http://localhost:3000/stories/my-story/propose/story-beats \
  -H 'Content-Type: application/json' \
  -d '{
    "priorityBeats": ["Catalyst", "Midpoint"],
    "packageCount": 3,
    "maxStoryBeatsPerPackage": 3,
    "direction": "Focus on protagonist inner conflict"
  }'
```

#### Integration

The generated session can be reviewed and committed using the standard propose workflow:
- View active proposal: `GET /:id/propose/active`
- Commit a package: `POST /:id/propose/commit`
- Discard: `DELETE /:id/propose/active`
