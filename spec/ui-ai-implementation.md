# AI UI Implementation Plan

**Version:** 1.0.0
**Date:** 2026-01-12
**Status:** Ready for Implementation

---

## Overview

Implement UI components to expose the AI generation capabilities defined in `aiIntegration.md`. The backend is complete with 8 endpoints; this plan covers the frontend integration.

---

## Current State

### Backend Endpoints (Complete)
| Endpoint | Handler | Purpose |
|----------|---------|---------|
| `POST /stories/:id/interpret` | `interpretOrchestrator` | Parse freeform input → proposals |
| `POST /stories/:id/generate` | `generateOrchestrator` | Entry point → N packages |
| `POST /stories/:id/regenerate` | `generateOrchestrator` | Re-run with same params |
| `POST /stories/:id/refine` | `refineOrchestrator` | Base package → variations |
| `GET /stories/:id/session` | session.ts | Get current session state |
| `DELETE /stories/:id/session` | session.ts | Abandon session |
| `POST /stories/:id/proposal-to-package` | - | Convert proposal to package |
| `POST /stories/:id/accept-package` | - | Apply package to graph |
| `POST /stories/:id/regenerate-element` | `regenerateElementOrchestrator` | Regenerate single element → N options |
| `POST /stories/:id/apply-element-option` | - | Apply selected option to package |
| `POST /stories/:id/update-package-element` | - | Manual edit of element |
| `POST /stories/:id/validate-package` | - | Validate package against graph |

### Existing UI Components
- `InputPanel.tsx` - Basic extraction (non-AI, uses `/extract`)
- `ClusterControls.tsx`, `ClusterCard.tsx` - Legacy cluster system
- `WorkspaceView.tsx` - Main workspace with tabs

---

## Implementation Phases

### Phase 1: API Client Extension
**File:** `packages/ui/src/api/client.ts`

Add methods for all AI endpoints:

```typescript
// AI Generation
interpret: (storyId: string, data: InterpretRequest) =>
  POST<InterpretResponseData>(`/stories/${storyId}/interpret`, data),

generate: (storyId: string, data: GenerateRequest) =>
  POST<GenerateResponseData>(`/stories/${storyId}/generate`, data),

regenerate: (storyId: string) =>
  POST<GenerateResponseData>(`/stories/${storyId}/regenerate`),

refine: (storyId: string, data: RefineRequest) =>
  POST<RefineResponseData>(`/stories/${storyId}/refine`, data),

getSession: (storyId: string) =>
  GET<SessionResponseData>(`/stories/${storyId}/session`),

deleteSession: (storyId: string) =>
  DELETE<{ abandoned: boolean }>(`/stories/${storyId}/session`),

acceptPackage: (storyId: string, packageId: string) =>
  POST<AcceptPackageResponseData>(`/stories/${storyId}/accept-package`, { packageId }),
```

**File:** `packages/ui/src/api/types.ts`

Add type definitions:

```typescript
// Request types
interface InterpretRequest {
  userInput: string;
  targetType?: string;
}

interface GenerateRequest {
  entryPoint: GenerationEntryPoint;
  depth?: 'narrow' | 'medium' | 'wide';
  count?: 'few' | 'standard' | 'many';
  direction?: string;
}

interface RefineRequest {
  basePackageId: string;
  keepElements?: string[];
  regenerateElements?: string[];
  guidance: string;
  depth?: 'narrow' | 'medium' | 'wide';
  count?: 'few' | 'standard' | 'many';
}

// Response types
interface GenerationEntryPoint {
  type: 'beat' | 'plotPoint' | 'character' | 'gap' | 'idea' | 'naked';
  targetId?: string;
}

interface NarrativePackage {
  id: string;
  title: string;
  rationale: string;
  confidence: number;
  parent_package_id?: string;
  refinement_prompt?: string;
  style_tags: string[];
  changes: PackageChanges;
  impact: PackageImpact;
}

interface PackageChanges {
  storyContext?: StoryContextChange[];
  nodes: NodeChange[];
  edges: EdgeChange[];
}

interface PackageImpact {
  fulfills_gaps: string[];
  creates_gaps: string[];
  conflicts: ConflictInfo[];
}
```

---

### Phase 2: Generation Components

#### 2.1 GenerationTrigger Component
**File:** `packages/ui/src/components/generation/GenerationTrigger.tsx`

Entry point selector with generation parameters.

```
┌─────────────────────────────────────────────────────────────┐
│ Generate for: [Midpoint ▼]                                  │
│                                                             │
│ Depth:    ○ Focused  ● Standard  ○ Expansive               │
│ Options:  ○ Quick    ● Explore   ○ Deep dive               │
│                                                             │
│ Direction (optional):                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Focus on betrayal themes...                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                                            [Generate]       │
└─────────────────────────────────────────────────────────────┘
```

**Props:**
- `entryPoints: EntryPointOption[]` - Available entry points
- `defaultEntryPoint?: GenerationEntryPoint`
- `onGenerate: (request: GenerateRequest) => void`
- `loading?: boolean`

**State:**
- Selected entry point
- Depth (narrow/medium/wide)
- Count (few/standard/many)
- Direction text

#### 2.2 PackageCard Component
**File:** `packages/ui/src/components/generation/PackageCard.tsx`

Display a single package with its contents organized by hierarchy.

```
┌─────────────────────────────────────────────────────────────┐
│ "The Corruption Reveal"                        Confidence: 85%│
│                                                             │
│ STORY CONTEXT                                               │
│   + Add to Themes: "Institutional betrayal..."              │
│                                                             │
│ STORY ELEMENTS                                              │
│   + Character: Agent Torres                                 │
│   + Location: Evidence Room                                 │
│                                                             │
│ OUTLINE                                                     │
│   + PlotPoint: Mike discovers betrayal                      │
│     └─ ALIGNS_WITH → Midpoint                              │
│   + Scene: INT. EVIDENCE ROOM - NIGHT                       │
│     └─ SATISFIED_BY → PlotPoint                            │
│     └─ HAS_CHARACTER → Mike, Torres                        │
│                                                             │
│ IMPACT                                                      │
│   ✓ Fulfills: Midpoint needs content                       │
│   → Creates: Torres character arc needed                    │
│   ⚠ Conflicts: None                                        │
└─────────────────────────────────────────────────────────────┘
```

**Props:**
- `package: NarrativePackage`
- `selected?: boolean`
- `onClick?: () => void`

#### 2.3 PackageBrowser Component
**File:** `packages/ui/src/components/generation/PackageBrowser.tsx`

Main view for browsing generated packages with tree navigation.

```
┌─────────────────────────────────────────────────────────────────────┐
│ GENERATION: "Midpoint options"                    [Regenerate All] │
├─────────────────────────────────────────────────────────────────────┤
│ PACKAGES: [Pkg 1] [Pkg 2 ▼] [Pkg 3]                                │
│           ├── [Pkg 2.1] [Pkg 2.2] [Pkg 2.3]                        │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ (PackageCard content)                                           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [← Back]                         [Accept Package] [Refine] [Reject] │
└─────────────────────────────────────────────────────────────────────┘
```

**Props:**
- `session: GenerationSession`
- `onAccept: (packageId: string) => void`
- `onRefine: (packageId: string) => void`
- `onReject: (packageId: string) => void`
- `onRegenerate: () => void`
- `onAbandon: () => void`

**State:**
- Current package ID
- Navigation path (breadcrumb)
- Loading states

#### 2.4 EditableElement Component
**File:** `packages/ui/src/components/generation/EditableElement.tsx`

Inline editing component for individual package elements (nodes, edges, story context).

```
┌─────────────────────────────────────────────────────────────────────┐
│ + Character: Agent Torres                          [Edit] [Regenerate]│
│   role: "Internal Affairs"                                          │
│   description: "A seasoned investigator..."                         │
└─────────────────────────────────────────────────────────────────────┘

Edit Mode:
┌─────────────────────────────────────────────────────────────────────┐
│ + Character: Agent Torres                                           │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Name: [Agent Torres___________]                                 │ │
│ │ Role: [Internal Affairs______]                                  │ │
│ │ Description: [________________]                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                           [Cancel] [Save]           │
└─────────────────────────────────────────────────────────────────────┘

Regenerate Mode:
┌─────────────────────────────────────────────────────────────────────┐
│ + Character: Agent Torres                                           │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Guidance: [Make more sympathetic_________________]              │ │
│ │ Options: [Few (3) ▼]                                            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                    [Cancel] [Generate Options]      │
│                                                                     │
│ Choose an option:                                                   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ "Agent Torres (former partner)"                                 │ │
│ │ A former friend who was reassigned...                           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ "Agent Torres (reluctant investigator)"                         │ │
│ │ Assigned against his wishes...                                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                              [Keep Original]        │
└─────────────────────────────────────────────────────────────────────┘
```

**Props:**
- `elementType: 'node' | 'edge' | 'storyContext'`
- `elementIndex: number`
- `element: NodeChangeAI | EdgeChangeAI | StoryContextChange`
- `onEdit: (updated) => void`
- `onRegenerate: (guidance, count) => void`
- `loading?: boolean`
- `regenerateOptions?: Array<...>` - Options returned from regeneration
- `onSelectOption?: (option) => void`

**Features:**
- **View Mode**: Displays element summary with Edit/Regenerate buttons
- **Edit Mode**: Type-specific inline form (Character fields, Scene fields, etc.)
- **Regenerate Mode**: Guidance input, count selector, displays multiple options to choose from

---

### Phase 3: Integration Points

#### 3.1 Entry Points in Existing Views

**OutlineView - Beat entry point:**
Add "Generate" button to EmptyBeatSlot or Beat with no scenes.

**NodeDetailPanel - Character/PlotPoint entry point:**
Add "Generate for this..." action button.

**GapList - Gap entry point:**
Add "Resolve with AI" button to gap items.

**Header or Toolbar - Naked entry point:**
Add global "AI Generate" button for open-ended generation.

#### 3.2 Generation Panel/View

Create a new view or panel that houses the full generation UI:

**Option A: Dedicated View**
Add "Generate" tab to ViewTabs alongside Stories/Workspace.

**Option B: Slide-over Panel**
Slide-out panel from right side, overlays current view.

**Option C: Modal Flow**
Full-screen modal for generation session.

**Recommendation:** Option B (Slide-over Panel) for minimal disruption to existing workflow.

#### 3.3 Session State Management

Create a React context for generation session:

**File:** `packages/ui/src/context/GenerationContext.tsx`

```typescript
interface GenerationContextValue {
  session: GenerationSession | null;
  loading: boolean;
  error: string | null;

  // Actions
  startGeneration: (request: GenerateRequest) => Promise<void>;
  refinePackage: (request: RefineRequest) => Promise<void>;
  acceptPackage: (packageId: string) => Promise<void>;
  abandonSession: () => Promise<void>;
  regenerateAll: () => Promise<void>;

  // Navigation
  selectPackage: (packageId: string) => void;
  navigateUp: () => void;
}
```

---

### Phase 4: Interpretation Flow

#### 4.1 Enhanced InputPanel

Upgrade `InputPanel.tsx` to use AI interpretation instead of basic extraction.

Changes:
- Call `/interpret` instead of `/extract`
- Display interpretation summary with confidence
- Show alternative interpretations
- Convert proposals to packages for acceptance

#### 4.2 InterpretationResults Component

Display interpretation results with options:

```
┌─────────────────────────────────────────────────────────────┐
│ INTERPRETATION                                   Confidence: 92%│
│ "You want to add a scene where Mike confronts his partner"     │
│                                                                │
│ PROPOSALS                                                      │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ + Scene: "Mike confronts Sarah"                            │ │
│ │   └─ HAS_CHARACTER → Mike, Sarah                           │ │
│ │   Rationale: Direct match to user input                    │ │
│ │                                    [Accept] [Edit] [Reject]│ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ALTERNATIVES                                                   │
│ • "Add confrontation as PlotPoint instead" (78%)              │
│ • "Add to Story Context as conflict theme" (65%)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
packages/ui/src/
├── api/
│   ├── client.ts              # Add AI methods
│   └── types.ts               # Add AI types
├── context/
│   ├── StoryContext.tsx       # Existing
│   └── GenerationContext.tsx  # NEW: Generation session state
├── components/
│   ├── generation/            # NEW: AI generation components
│   │   ├── index.ts
│   │   ├── GenerationTrigger.tsx
│   │   ├── GenerationTrigger.module.css
│   │   ├── PackageCard.tsx
│   │   ├── PackageCard.module.css
│   │   ├── PackageBrowser.tsx
│   │   ├── PackageBrowser.module.css
│   │   ├── PackageTree.tsx
│   │   ├── PackageTree.module.css
│   │   ├── RefineModal.tsx
│   │   ├── RefineModal.module.css
│   │   ├── GenerationPanel.tsx    # Slide-over container
│   │   └── GenerationPanel.module.css
│   ├── input/
│   │   ├── InputPanel.tsx         # Update for interpretation
│   │   └── InterpretationResults.tsx  # NEW
│   └── ...
```

---

## Implementation Order

| Phase | Files | Dependencies | Priority |
|-------|-------|--------------|----------|
| 1.1 | `api/types.ts` | None | High |
| 1.2 | `api/client.ts` | types.ts | High |
| 2.1 | `GenerationTrigger.tsx` | api | High |
| 2.2 | `PackageCard.tsx` | types | High |
| 2.3 | `PackageBrowser.tsx` | PackageCard, api | High |
| 2.4 | `RefineModal.tsx` | types | Medium |
| 3.1 | `GenerationContext.tsx` | api | High |
| 3.2 | `GenerationPanel.tsx` | Browser, Trigger, Context | High |
| 3.3 | Integration into WorkspaceView | GenerationPanel | Medium |
| 4.1 | Update `InputPanel.tsx` | api | Medium |
| 4.2 | Entry points in existing views | GenerationTrigger | Low |

---

## UI/UX Considerations

### Loading States
- Show streaming tokens during generation (SSE support)
- Progress indicator for long-running generations
- Skeleton loaders for package cards

### Error Handling
- Display API key missing error prominently
- Handle rate limits gracefully
- Show validation errors from package acceptance

### Accessibility
- Keyboard navigation through packages
- ARIA labels for tree navigation
- Focus management in modals

### Responsive Design
- Slide-over panel collapses to bottom sheet on mobile
- Package cards stack vertically on narrow screens

---

## Testing Strategy

### Unit Tests
- PackageCard renders changes correctly
- RefineModal handles keep/regenerate selection
- GenerationTrigger validates inputs

### Integration Tests
- Full generation flow (trigger → browse → accept)
- Refinement flow (select → refine → variations)
- Session persistence and recovery

### E2E Tests
- Complete user journey from entry point to accepted package
- Error recovery scenarios

---

## Acceptance Criteria

- [ ] User can trigger generation from multiple entry points
- [ ] Generated packages display with full change details
- [ ] User can navigate package refinement tree
- [ ] Refine modal allows selecting keep/regenerate elements
- [ ] Accept applies package changes to graph
- [ ] Reject removes package from consideration
- [ ] Regenerate All discards packages and starts fresh
- [ ] Session state persists across page refreshes
- [ ] Loading states shown during AI calls
- [ ] Errors displayed with actionable suggestions
