# Elements Board Implementation Plan

## Overview

Implement Option C (Board + Detail) to add element interaction capabilities to the workspace:
1. **View Toggle** - Switch between Structure Board and Elements Board
2. **Elements Board** - Card grid view of all story elements
3. **Element Detail** - Full detail view with editing capabilities
4. **Clickable Sidebar** - Make ElementsPanel items interactive

---

## Architecture

### New View State Type

```typescript
// packages/ui/src/components/workspace/types.ts (new file)
export type WorkspaceView =
  | { view: 'structure' }
  | { view: 'elements' }
  | { view: 'elementDetail'; elementId: string; elementType: string };
```

### Component Hierarchy

```
WorkspaceView
├── PremiseHeader
├── MainArea (row)
│   ├── ElementsPanel (sidebar)
│   └── MainContent
│       ├── ViewToggle [Structure Board] [Elements Board]
│       └── Content Area
│           ├── StructureBoard (when view === 'structure')
│           ├── ElementsBoard (when view === 'elements')
│           └── ElementDetail (when view === 'elementDetail')
```

---

## Implementation Steps

### Phase 1: View Toggle & State Management

#### 1.1 Create Workspace Types
**File**: `packages/ui/src/components/workspace/types.ts`

```typescript
export type ElementType = 'Character' | 'Location' | 'Object';

export type WorkspaceView =
  | { view: 'structure' }
  | { view: 'elements' }
  | { view: 'elementDetail'; elementId: string; elementType: ElementType };
```

#### 1.2 Add View Toggle Component
**File**: `packages/ui/src/components/workspace/ViewToggle.tsx`

Simple toggle button group:
- Two buttons: "Structure Board" and "Elements Board"
- Active state styling to indicate current view
- Props: `activeView`, `onViewChange`

#### 1.3 Update WorkspaceView Component
**File**: `packages/ui/src/components/workspace/WorkspaceView.tsx`

Changes:
- Add `workspaceView` state with type `WorkspaceView`
- Add `setWorkspaceView` handler
- Render ViewToggle in main content header
- Conditionally render StructureBoard or ElementsBoard based on state
- Handle elementDetail view

---

### Phase 2: Elements Board Component

#### 2.1 Create ElementsBoard Component
**File**: `packages/ui/src/components/workspace/ElementsBoard.tsx`

**Purpose**: Grid/card view of all story elements grouped by type

**Structure**:
```
ElementsBoard
├── Section: Characters
│   ├── Header (count + "+ Add" button)
│   └── Grid of ElementCard[]
├── Section: Locations
│   ├── Header (count + "+ Add" button)
│   └── Grid of ElementCard[]
└── Section: Objects
    ├── Header (count + "+ Add" button)
    └── Grid of ElementCard[] or "No objects yet" message
```

**Props**:
```typescript
interface ElementsBoardProps {
  onElementClick: (elementId: string, elementType: ElementType) => void;
  onAddElement: (type: ElementType) => void;
}
```

**Data Fetching**:
- Reuse the same pattern from ElementsPanel
- Fetch Characters, Locations, Objects in parallel
- Optionally: Move fetching to WorkspaceView and pass down as props for consistency

#### 2.2 Create ElementCard Component
**File**: `packages/ui/src/components/workspace/ElementCard.tsx`

**Purpose**: Individual element card in the grid

**Layout**:
```
┌─────────────────────┐
│ 👤 CHARACTER        │  ← type badge with icon
│                     │
│ CAIN                │  ← name (prominent)
│                     │
│ Retired enforcer    │  ← truncated description
│ for the syndicate   │     (2-3 lines max)
│                     │
│ 🎬 3 scenes         │  ← metadata (scene count)
└─────────────────────┘
```

**Props**:
```typescript
interface ElementCardProps {
  element: NodeData;
  onClick: () => void;
}
```

**Features**:
- Type-specific icons (👤 Character, 📍 Location, 📦 Object)
- Truncated description (CSS line-clamp)
- Scene count from relationships (may need API enhancement or approximate)
- Hover state for interactivity

---

### Phase 3: Element Detail Component

#### 3.1 Create ElementDetail Component
**File**: `packages/ui/src/components/workspace/ElementDetail.tsx`

**Purpose**: Full detail view for viewing and editing a single element

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Elements                              👤 CHARACTER   │
│                                                                 │
│  CAIN                                                    [Edit] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DESCRIPTION                                                    │
│  ──────────────────────────────────────────────────────────────│
│  Retired enforcer for the drug syndicate. Runs a body shop     │
│  as a front. Known for his methodical violence and strict      │
│  code.                                                          │
│                                                                 │
│  ATTRIBUTES                                                     │
│  ──────────────────────────────────────────────────────────────│
│  Role: Protagonist                                              │
│  Arc: Reluctant return to violence                              │
│  [any other custom fields from data]                            │
│                                                                 │
│  APPEARS IN (3 scenes)                                          │
│  ──────────────────────────────────────────────────────────────│
│  • Setup - "Rigo shows up at Cain's bodyshop"                  │
│  • Catalyst - "Cain shows up at Rigo's warehouse"              │
│  • Midpoint - "Cain confronts Captain Morrison"                 │
│                                                                 │
│  RELATIONSHIPS                                                  │
│  ──────────────────────────────────────────────────────────────│
│  → Rigo (former partner)                                        │
│  → Captain Morrison (antagonist)                                │
│                                                                 │
│                                              [Edit]  [Delete]   │
└─────────────────────────────────────────────────────────────────┘
```

**Props**:
```typescript
interface ElementDetailProps {
  elementId: string;
  elementType: ElementType;
  onBack: () => void;
  onDelete?: () => void;
}
```

**Data Fetching**:
- Fetch element details: `api.getNode(elementId)` or similar
- Fetch relationships: `api.getEdges(storyId)` filtered to this element
- Fetch scenes where element appears (via edges to Scene nodes)

**Features**:
- Back button to return to Elements Board
- Edit mode toggle (inline editing or modal)
- Delete with confirmation
- Clickable relationships (navigate to related element)
- Clickable scenes (could navigate to Structure Board and highlight)

#### 3.2 Create ElementEditModal Component (Optional)
**File**: `packages/ui/src/components/workspace/ElementEditModal.tsx`

Alternative: Use inline editing like EditPanel pattern instead of modal.

---

### Phase 4: Make Sidebar Elements Clickable

#### 4.1 Update ElementsPanel
**File**: `packages/ui/src/components/workspace/ElementsPanel.tsx`

Changes:
- Make element items clickable (already has `onNodeClick` prop)
- Add visual hover states (cursor pointer, underline or highlight)
- Ensure click handler is connected to workspace view state

#### 4.2 Update WorkspaceView Handler
**File**: `packages/ui/src/components/workspace/WorkspaceView.tsx`

```typescript
const handleNodeClick = (nodeId: string, nodeType: ElementType) => {
  setWorkspaceView({
    view: 'elementDetail',
    elementId: nodeId,
    elementType: nodeType
  });
};
```

---

### Phase 5: API Enhancements (if needed)

Check existing API capabilities:

#### 5.1 Get Node Details
- May already exist: `api.getNode(nodeId)`
- Needs: Full node data including all custom fields

#### 5.2 Get Node Relationships
- May exist: `api.getEdges(storyId)`
- Need to filter by node ID to get relationships

#### 5.3 Get Scenes by Element
- Query edges where element is connected to Scene nodes
- Or add dedicated endpoint: `api.getScenesForElement(elementId)`

---

## File Structure

```
packages/ui/src/components/workspace/
├── ElementsBoard.tsx          (new)
├── ElementsBoard.module.css   (new)
├── ElementCard.tsx            (new)
├── ElementCard.module.css     (new)
├── ElementDetail.tsx          (new)
├── ElementDetail.module.css   (new)
├── ViewToggle.tsx             (new)
├── ViewToggle.module.css      (new)
├── types.ts                   (new)
├── ElementsPanel.tsx          (update)
├── WorkspaceView.tsx          (update)
└── WorkspaceView.module.css   (update)
```

---

## Implementation Order

1. **Phase 1.1**: Create `types.ts` with WorkspaceView type
2. **Phase 1.2**: Create `ViewToggle` component
3. **Phase 1.3**: Update `WorkspaceView` with view state and toggle
4. **Phase 2.2**: Create `ElementCard` component
5. **Phase 2.1**: Create `ElementsBoard` component
6. **Phase 3.1**: Create `ElementDetail` component
7. **Phase 4.1-4.2**: Update `ElementsPanel` and handlers
8. **Phase 5**: API enhancements as needed

---

## Styling Guidelines

**Consistent with existing design**:
- Use CSS modules (`.module.css`)
- Match existing color scheme from StructureBoard and ElementsPanel
- Card styling similar to scene cards in StructureBoard
- Responsive grid: 2 columns on narrow, 3-4 on wide

**Element Card Dimensions**:
- Fixed width cards in responsive grid
- Min-width: ~200px, max-width: ~280px
- Height: auto with min-height for consistency

**Color Coding by Type**:
```css
--character-color: #4A90D9;  /* Blue */
--location-color: #7CB342;   /* Green */
--object-color: #FF9800;     /* Orange */
```

---

## Testing Considerations

1. **Navigation flows**:
   - Toggle between Structure/Elements boards
   - Click element in sidebar → Detail view
   - Click element card → Detail view
   - Back button → Previous view

2. **Data consistency**:
   - Elements show same data in sidebar and board
   - Edits in detail view reflect in board and sidebar

3. **Edge cases**:
   - Empty sections (no objects)
   - Long descriptions (truncation)
   - Many elements (scrolling)
   - Elements with no relationships

---

## Future Enhancements (Out of Scope)

- Drag-and-drop element organization
- Bulk element operations
- Element templates
- Element search/filter
- Element comparison view
- Export elements
