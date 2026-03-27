Apollo Contract UI: Unified Workspace with Staged Package Preview
Implementation Specification v1.0

1. Overview
1.1 Purpose
Consolidate the Generation and Workspace tabs into a single unified view where users can generate AI-powered story element packages, preview proposed changes staged directly within the workspace, edit individual elements inline, and accept/reject packages—all without switching tabs.
1.2 Goals

Eliminate context-switching between Generation and Workspace tabs
Provide visual preview of proposed changes in their actual story context (Structure Board, Elements, etc.)
Enable inline editing of proposed nodes before accepting
Maintain ability to compare multiple generated packages via carousel navigation
Show at-a-glance indicators of which workspace sections contain proposed changes

1.3 Key User Flows

Generate: User opens compose form → enters direction → generates packages
Review: First package auto-stages → proposed elements appear highlighted in workspace views
Navigate: User browses packages via carousel → staging swaps to selected package
Edit: User clicks proposed element → inline editor expands → user modifies fields
Accept/Reject: User accepts package → changes commit to graph → staging clears


2. Architecture Changes
2.1 Tab Structure
Current:
[Stories] [Workspace] [Generation]
New:
[Stories] [Workspace]
The Generation tab is removed. All generation functionality moves into the Workspace view via a collapsible Generation Panel.
2.2 State Management
2.2.1 New State: stagingState
typescriptinterface StagingState {
  // Currently staged package (null if nothing staged)
  stagedPackage: Package | null;
  
  // All available packages from current generation session
  availablePackages: Package[];
  
  // Index of currently staged package in availablePackages
  activePackageIndex: number;
  
  // Edited versions of nodes (keyed by temporary node ID)
  // These override the original package node data until accept/reject
  editedNodes: Map<string, Partial<NodeData>>;
  
  // Nodes marked for removal from the package
  removedNodeIds: Set<string>;
  
  // Loading states
  isGenerating: boolean;
  isRegeneratingSingleNode: string | null; // node ID being regenerated
}
2.2.2 Computed State: mergedGraphView
When a package is staged, views should display a merged representation:
typescriptinterface MergedGraphView {
  // Committed nodes from the actual graph
  committedNodes: Node[];
  
  // Proposed nodes from staged package (with edits applied, removals excluded)
  proposedNodes: ProposedNode[];
  
  // Committed edges
  committedEdges: Edge[];
  
  // Proposed edges from staged package
  proposedEdges: ProposedEdge[];
}

interface ProposedNode extends Node {
  _isProposed: true;
  _packageId: string;
  _originalData: NodeData; // For reset/comparison
}

interface ProposedEdge extends Edge {
  _isProposed: true;
  _packageId: string;
}
2.2.3 Derived State: sectionChangeCounts
For Story Map badges:
typescriptinterface SectionChangeCounts {
  premise: { additions: number; modifications: number };
  structureBoard: { additions: number; modifications: number };
  elements: { additions: number; modifications: number };
  storyContext: { additions: number; modifications: number };
}
```

Computed from `stagedPackage` by categorizing proposed nodes:
- **Premise**: Premise, GenreTone, Setting nodes
- **Structure Board**: Beat, PlotPoint, Scene nodes
- **Elements**: Character, Location, Object nodes
- **Story Context**: ThematicConcerns, or similar context nodes

---

## 3. Component Specifications

### 3.1 Layout Structure
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Header: Apollo Contract UI                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ [Stories] [Workspace]                                                   │
├──────────────────┬─────────────────────────────────┬────────────────────┤
│ StoryMap         │ MainContent                     │ GenerationPanel    │
│ (Left Panel)     │ (Center)                        │ (Right Panel)      │
│ ~200px           │ flex: 1                         │ ~320px, collapsible│
└──────────────────┴─────────────────────────────────┴────────────────────┘
```

### 3.2 StoryMap Component (Modified)

#### 3.2.1 Structure
```
WORKSPACE                        ◀ (collapse toggle)
│
├── Premise              [+N] [●]    ← badges when staging active
├── Structure Board      [+N] [●]
├── Elements             [+N] [●]
│
├── STORY CONTEXT
│   └── Open Editor      [●]
│
├── 📋 All Changes       (N)         ← NEW: only visible when staging
│
└── STAGING ─────────────────────    ← NEW: staging status section
    ○ No package staged              (when empty)
    ● "Package Name..."              (when staging active)
3.2.2 Props
typescriptinterface StoryMapProps {
  selectedView: 'premise' | 'structureBoard' | 'elements' | 'allChanges';
  onViewSelect: (view: string) => void;
  
  // Staging-related
  stagingState: StagingState;
  sectionChangeCounts: SectionChangeCounts;
}
3.2.3 Badge Display Logic
typescriptfunction getBadgeForSection(section: string, counts: SectionChangeCounts) {
  const sectionCounts = counts[section];
  if (!sectionCounts) return null;
  
  const badges = [];
  if (sectionCounts.additions > 0) {
    badges.push({ type: 'addition', value: `+${sectionCounts.additions}` });
  }
  if (sectionCounts.modifications > 0) {
    badges.push({ type: 'modification', value: '●' });
  }
  return badges;
}
```

#### 3.2.4 Styling

- Badges appear to the right of section names
- Addition badges: green background, white text (`+N`)
- Modification badges: orange dot (`●`)
- "All Changes" row only renders when `stagingState.stagedPackage !== null`
- "All Changes" shows total count: sum of all additions + modifications

---

### 3.3 GenerationPanel Component (New)

Replaces the Generation tab. A collapsible right-side panel.

#### 3.3.1 Structure
```
┌────────────────────────┐
│ GENERATION        [><] │  ← collapse toggle
├────────────────────────┤
│                        │
│ ▼ COMPOSE              │  ← collapsible section
│ ┌────────────────────┐ │
│ │ Mode               │ │
│ │ ○ Add  ○ Expand    │ │
│ │ ○ Explore          │ │
│ │                    │ │
│ │ Entry Point        │ │
│ │ [Auto (AI decides)]│ │
│ │                    │ │
│ │ Direction          │ │
│ │ [                 ]│ │
│ │ [                 ]│ │
│ │                    │ │
│ │ ▶ Advanced Options │ │
│ │                    │ │
│ │ [Generate Proposals]│ │
│ └────────────────────┘ │
│                        │
│ ▼ PACKAGES (N)         │  ← collapsible, shows when packages exist
│ ┌────────────────────┐ │
│ │    ← ○ ○ ● ○ ○ →   │ │  ← carousel dots/arrows
│ │ ┌────────────────┐ │ │
│ │ │ Package Title  │ │ │
│ │ │ 88%            │ │ │
│ │ │ ────────────── │ │ │
│ │ │ Context     ●  │ │ │  ← affected sections
│ │ │ Structure  +4  │ │ │
│ │ │ Elements   +2  │ │ │
│ │ └────────────────┘ │ │
│ │                    │ │
│ │ [Accept]           │ │
│ │ [Reject]           │ │
│ │ [Save for Later]   │ │
│ └────────────────────┘ │
│                        │
│ ▼ SAVED (N)            │  ← collapsible, shows saved packages
│ ┌────────────────────┐ │
│ │ • Package A   82%  │ │  ← clickable: stages for preview
│ │ • Package B   91%  │ │
│ │ ...                │ │
│ │ (Click to preview) │ │
│ └────────────────────┘ │
│                        │
│ ── When saved pkg ──── │  ← shown when viewing saved package
│ ┌────────────────────┐ │
│ │ 💾 SAVED PACKAGE   │ │
│ │ Package Title      │ │
│ │ 88%  Saved 1/20/26 │ │
│ │                    │ │
│ │ [Apply to Story]   │ │  ← commits to graph, removes from saved
│ │ [Discard] [Back]   │ │  ← delete / unstage
│ └────────────────────┘ │
│                        │
└────────────────────────┘
3.3.2 Props
typescriptinterface GenerationPanelProps {
  // Collapse state
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  
  // Compose form state
  composeForm: ComposeFormState;
  onComposeFormChange: (updates: Partial<ComposeFormState>) => void;
  onGenerate: () => void;
  
  // Staging state
  stagingState: StagingState;
  onPackageSelect: (index: number) => void;
  onAccept: () => void;
  onReject: () => void;
  onSaveForLater: () => void;
  
  // Saved packages
  savedPackages: SavedPackage[];
  onSavedPackageSelect: (packageId: string) => void;
}

interface ComposeFormState {
  mode: 'add' | 'expand' | 'explore';
  entryPoint: string;
  direction: string;
  advancedOptions: {
    creativity: number;
    packageCount: number;
    nodesPerPackage: number;
  };
}
3.3.3 Package Card Component
typescriptinterface PackageCardProps {
  package: Package;
  isActive: boolean;
  sectionCounts: SectionChangeCounts;
  onClick: () => void;
}
Card displays:

Package title (truncated to ~30 chars)
Confidence percentage
Section indicators:

Context ● if story context changes
Structure +N if structure additions
Elements +N if element additions



3.3.4 Carousel Behavior

Arrow buttons navigate prev/next package
Dot indicators show position (filled = active)
Clicking dot or arrow calls onPackageSelect(index)
Selecting a package updates stagingState.activePackageIndex and stagedPackage
Keyboard: Left/Right arrows when panel focused

3.3.5 Package Actions (Session Packages)

When a session package is staged, the following action buttons appear:

| Action | Button | Behavior |
|--------|--------|----------|
| **Accept** | Green "Accept" | Commits package to graph, clears staging |
| **Reject** | Red "Reject" | Removes package from session, clears staging |
| **Save for Later** | Blue "Save for Later" | Saves package to saved list (remains staged) |

3.3.6 Saved Package Staging

Clicking a saved package stages it for workspace preview:

```typescript
function handleSavedPackageClick(savedPkg: SavedPackageData) {
  setViewingSavedPackageId(savedPkg.id);
  stageSavedPackage(savedPkg.package); // Stage for workspace preview
}
```

When a saved package is staged:
- The package carousel is hidden (replaced by saved package UI)
- Workspace shows proposed changes inline (same as session packages)
- Different action buttons appear:

| Action | Button | Behavior |
|--------|--------|----------|
| **Apply to Story** | Green "Apply to Story" | Commits to graph, removes from saved list |
| **Discard** | Red "Discard" | Permanently deletes saved package |
| **Back** | Gray "Back" | Unstages package, returns to saved list (package remains saved) |

3.3.7 Saved Package UI Structure
```
┌────────────────────────┐
│ 💾 SAVED PACKAGE       │  ← Blue badge indicates source
├────────────────────────┤
│ Package Title          │
│ 88%   Saved 1/20/2026  │  ← Confidence + save date
├────────────────────────┤
│ [Apply to Story]       │  ← Primary action (green)
│ [Discard] [Back]       │  ← Secondary actions
└────────────────────────┘
```


3.4 MainContent Area (Modified Views)
The center content area renders different views based on selectedView. Each view must now handle the merged state (committed + proposed).
3.4.1 View Routing
typescriptfunction MainContent({ selectedView, mergedGraphView, stagingState }) {
  switch (selectedView) {
    case 'premise':
      return <PremiseView merged={mergedGraphView} staging={stagingState} />;
    case 'structureBoard':
      return <StructureBoardView merged={mergedGraphView} staging={stagingState} />;
    case 'elements':
      return <ElementsView merged={mergedGraphView} staging={stagingState} />;
    case 'allChanges':
      return <AllChangesView merged={mergedGraphView} staging={stagingState} />;
    default:
      return null;
  }
}
3.4.2 Proposed Node Rendering
All views must distinguish between committed and proposed nodes visually.
Visual Differentiation:
AttributeCommitted NodeProposed NodeBorder1px solid var(--border-default)2px solid var(--color-proposed) + box-shadow: 0 0 8px var(--color-proposed-glow)BadgeNonePROPOSED badge top-rightBackgroundvar(--bg-card)var(--bg-card-proposed) (subtle tint)CursorpointerpointerClick behaviorOpens detail panelExpands inline editor
CSS Variables to add:
css:root {
  --color-proposed: #4ade80;           /* green-400 */
  --color-proposed-glow: rgba(74, 222, 128, 0.3);
  --bg-card-proposed: rgba(74, 222, 128, 0.05);
}
```

---

### 3.5 Inline Editor Component (New)

When a proposed node is clicked, it expands to show an inline editor.

#### 3.5.1 Structure (Collapsed)
```
╔════════════════════════════════════════════════════════════════╗
║ PROPOSED                                                       ║
║ ┌────────────────────────────────────────────────────────────┐ ║
║ │ INT. TOMMY'S PAWN SHOP - DAY                               │ ║
║ │ Cain reconnects with old friend Tommy who nervously...     │ ║
║ │ [Afternoon] [Nervous]                                      │ ║
║ └────────────────────────────────────────────────────────────┘ ║
╚════════════════════════════════════════════════════════════════╝
```

#### 3.5.2 Structure (Expanded)
```
╔══════════════════════════════════════════════════════════════════════╗
║ PROPOSED · SCENE                                  [Regenerate] [×]   ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  Heading                                                             ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │ INT. TOMMY'S PAWN SHOP - DAY                                   │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  Overview                                                            ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │ Cain reconnects with old friend Tommy who nervously provides  │  ║
║  │ intel about the corrupt cops stealing shipments, despite      │  ║
║  │ knowing the danger.                                           │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  Mood                     Time of Day                                ║
║  ┌───────────────┐        ┌───────────────┐                          ║
║  │ Nervous     ▼ │        │ Afternoon   ▼ │                          ║
║  └───────────────┘        └───────────────┘                          ║
║                                                                      ║
║  ────────────────────────────────────────────────────────────────    ║
║  RELATIONSHIPS (proposed)                                            ║
║  → Located at: Tommy's Pawn Shop                                     ║
║  → Characters: Cain, Tommy Reeves                                    ║
║  → Satisfies: Tommy provides crucial intel                           ║
║                                                                      ║
║                                                [Done] [Regenerate]   ║
╚══════════════════════════════════════════════════════════════════════╝
3.5.3 Props
typescriptinterface InlineEditorProps {
  node: ProposedNode;
  isExpanded: boolean;
  onToggleExpand: () => void;
  
  // Edit actions
  onFieldChange: (nodeId: string, field: string, value: any) => void;
  onRegenerate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  
  // Relationships (read-only display for now)
  proposedEdges: ProposedEdge[];
}
3.5.4 Field Configuration by Node Type
typescriptconst nodeFieldConfig: Record<NodeType, FieldConfig[]> = {
  Scene: [
    { key: 'heading', label: 'Heading', type: 'text' },
    { key: 'scene_overview', label: 'Overview', type: 'textarea' },
    { key: 'mood', label: 'Mood', type: 'select', options: moodOptions },
    { key: 'time_of_day', label: 'Time of Day', type: 'select', options: timeOptions },
    { key: 'int_ext', label: 'Int/Ext', type: 'select', options: ['INT', 'EXT'] },
  ],
  Character: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'archetype', label: 'Archetype', type: 'select', options: archetypeOptions },
    { key: 'status', label: 'Status', type: 'select', options: statusOptions },
  ],
  PlotPoint: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'summary', label: 'Summary', type: 'textarea' },
    { key: 'intent', label: 'Intent', type: 'select', options: ['PLOT', 'CHARACTER', 'TONE'] },
    { key: 'priority', label: 'Priority', type: 'number' },
  ],
  Location: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'atmosphere', label: 'Atmosphere', type: 'text' },
  ],
  // ... other node types
};
```

#### 3.5.5 Behavior

- **Click collapsed card** → Expands to show full editor
- **Click outside / Click "Done"** → Collapses, changes are retained in `editedNodes`
- **Click "Regenerate"** → API call to regenerate single node, shows loading state, replaces node data
- **Click "×" (Remove)** → Adds to `removedNodeIds`, node disappears from view (with undo toast)
- **Edit field** → Updates `stagingState.editedNodes[nodeId][field]`

---

### 3.6 AllChangesView Component (New)

A consolidated view showing all proposed changes in one scrollable list.

#### 3.6.1 Structure
```
┌──────────────────────────────────────────────────────────────────────┐
│ All Changes                                    Package: Informant... │
│ 7 proposed items                                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ STORY CONTEXT ─────────────────────────────────────────────────────  │
│ [ProposedNodeCard for each context node]                             │
│                                                                      │
│ ELEMENTS ──────────────────────────────────────────────────────────  │
│ [ProposedNodeCard for each character/location/object]                │
│                                                                      │
│ STRUCTURE ─────────────────────────────────────────────────────────  │
│ [ProposedNodeCard for each plotpoint/scene]                          │
│                                                                      │
│ ──────────────────────────────────────────────────────────────────── │
│ IMPACT                                                               │
│ ✓ Fulfills: [list of gaps/beats addressed]                           │
│ → Creates: [new gaps/questions introduced]                           │
│ ✓ No conflicts  OR  ⚠ Conflicts: [list]                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
3.6.2 Props
typescriptinterface AllChangesViewProps {
  stagedPackage: Package;
  mergedGraphView: MergedGraphView;
  stagingState: StagingState;
  
  // Edit handlers (same as InlineEditor)
  onFieldChange: (nodeId: string, field: string, value: any) => void;
  onRegenerate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
}
3.6.3 Grouping Logic
typescriptfunction groupProposedNodes(nodes: ProposedNode[]) {
  return {
    storyContext: nodes.filter(n => ['ThematicConcerns', 'StoryContext'].includes(n.type)),
    elements: nodes.filter(n => ['Character', 'Location', 'Object'].includes(n.type)),
    structure: nodes.filter(n => ['PlotPoint', 'Scene', 'Beat'].includes(n.type)),
  };
}
```

#### 3.6.4 Impact Section

Display the package's impact analysis:
- **Fulfills**: Gaps or beats that this package addresses
- **Creates**: New gaps or questions introduced
- **Conflicts**: Any validation issues (if applicable)

---

## 4. API Integration

### 4.1 Existing Endpoints (No Changes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/stories/:id/generate` | POST | Generate packages |
| `POST /api/stories/:id/propose/commit` | POST | Commit accepted package |
| `DELETE /api/stories/:id/packages/:pkgId` | DELETE | Reject/delete package |
| `POST /api/stories/:id/packages/:pkgId/save` | POST | Save for later |

### 4.2 New/Modified Endpoints

#### 4.2.1 Regenerate Single Node
```
POST /api/stories/:storyId/packages/:packageId/nodes/:nodeId/regenerate

Request Body:
{
  "context": {
    // Current package state including edits
    "editedNodes": { ... },
    "removedNodeIds": [ ... ]
  }
}

Response:
{
  "node": {
    "id": "temp_node_xyz",
    "type": "Scene",
    "data": { ... }
  },
  "edges": [ ... ]  // Updated edges if applicable
}
```

#### 4.2.2 Accept Package with Edits

Modify the accept endpoint to include edits:
```
POST /api/stories/:storyId/propose/commit

Request Body:
{
  "edits": {
    "nodes": {
      "temp_node_abc": {
        "heading": "Modified heading",
        "scene_overview": "Modified overview"
      }
    },
    "removedNodeIds": ["temp_node_xyz"]
  }
}

Response:
{
  "version": "ver_123...",
  "appliedNodes": [ ... ],
  "appliedEdges": [ ... ]
}
```

---

## 5. State Flow Diagrams

### 5.1 Generate Flow
```
User enters direction
        │
        ▼
[Generate Proposals] clicked
        │
        ▼
stagingState.isGenerating = true
        │
        ▼
POST /api/stories/:id/generate
        │
        ▼
Response: { packages: [...] }
        │
        ▼
stagingState = {
  availablePackages: packages,
  activePackageIndex: 0,
  stagedPackage: packages[0],
  isGenerating: false
}
        │
        ▼
UI updates:
  - Story Map shows badges
  - Workspace views show merged state
  - Generation Panel shows carousel
```

### 5.2 Package Navigation Flow
```
User clicks carousel arrow/dot
        │
        ▼
onPackageSelect(newIndex)
        │
        ▼
stagingState.activePackageIndex = newIndex
stagingState.stagedPackage = availablePackages[newIndex]
stagingState.editedNodes.clear()  // Reset edits for new package
stagingState.removedNodeIds.clear()
        │
        ▼
UI re-renders with new package's proposed nodes
```

### 5.3 Edit Flow
```
User clicks proposed node
        │
        ▼
InlineEditor expands
        │
        ▼
User modifies field
        │
        ▼
onFieldChange(nodeId, field, value)
        │
        ▼
stagingState.editedNodes.set(nodeId, {
  ...existing,
  [field]: value
})
        │
        ▼
mergedGraphView recomputes with edits applied
```

### 5.4 Complete Package Lifecycle
```
                    ┌─────────────┐
                    │  Generate   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
             ┌──────│   Staged    │──────┐
             │      │  (Preview)  │      │
             │      └──────┬──────┘      │
             │             │             │
        [Accept]     [Save for      [Reject]
             │        Later]            │
             │             │             │
             ▼             ▼             ▼
      ┌─────────────┐ ┌─────────┐  ┌─────────┐
      │  Committed  │ │  Saved  │  │Discarded│
      │  (Graph)    │ │  List   │  │         │
      └─────────────┘ └────┬────┘  └─────────┘
                           │
                     [Click to
                      Preview]
                           │
                           ▼
                    ┌─────────────┐
             ┌──────│   Staged    │──────┐
             │      │  (Preview)  │      │
             │      └──────┬──────┘      │
             │             │             │
        [Apply]      [Back to      [Discard]
             │        Saved]            │
             │             │             │
             ▼             ▼             ▼
      ┌─────────────┐ ┌─────────┐  ┌─────────┐
      │  Committed  │ │  Saved  │  │ Deleted │
      │  (Graph)    │ │  List   │  │         │
      └─────────────┘ └─────────┘  └─────────┘
```

### 5.5 Accept Flow
```
User clicks [Accept]
        │
        ▼
POST /api/.../propose/commit with edits
        │
        ▼
Response: new version created
        │
        ▼
stagingState = {
  stagedPackage: null,
  availablePackages: [],
  editedNodes: clear,
  removedNodeIds: clear
}
        │
        ▼
Refresh graph state from server
        │
        ▼
UI shows committed state (no more proposed nodes)
Toast: "Package accepted. Version created."
```

---

## 6. Component Hierarchy
```
WorkspaceView
├── StoryMap
│   ├── SectionItem (Premise) [with badge]
│   ├── SectionItem (Structure Board) [with badge]
│   ├── SectionItem (Elements) [with badge]
│   ├── SectionItem (Story Context) [with badge]
│   ├── SectionItem (All Changes) [conditional]
│   └── StagingStatus
│
├── MainContent
│   ├── PremiseView
│   │   └── ProposedNodeCard (inline editor)
│   ├── StructureBoardView
│   │   ├── ActRow
│   │   │   ├── BeatColumn
│   │   │   │   ├── PlotPointCard (committed)
│   │   │   │   ├── ProposedPlotPointCard (inline editor)
│   │   │   │   ├── SceneCard (committed)
│   │   │   │   └── ProposedSceneCard (inline editor)
│   ├── ElementsView
│   │   ├── CharacterSection
│   │   │   ├── CharacterCard (committed)
│   │   │   └── ProposedCharacterCard (inline editor)
│   │   ├── LocationSection
│   │   └── ObjectSection
│   └── AllChangesView
│       ├── SectionGroup (Story Context)
│       ├── SectionGroup (Elements)
│       ├── SectionGroup (Structure)
│       └── ImpactSummary
│
└── GenerationPanel
    ├── CollapseToggle
    ├── ComposeSection
    │   ├── ModeSelector
    │   ├── EntryPointSelector
    │   ├── DirectionInput
    │   ├── AdvancedOptions (collapsible)
    │   └── GenerateButton
    ├── PackagesSection
    │   ├── CarouselNavigation
    │   ├── PackageCard
    │   └── PackageActions (Accept/Reject/Save)
    └── SavedPackagesSection
        └── SavedPackageList

7. Styling Specifications
7.1 Color Tokens
css:root {
  /* Proposed/Staged elements */
  --color-proposed: #4ade80;                    /* green-400 */
  --color-proposed-hover: #22c55e;              /* green-500 */
  --color-proposed-glow: rgba(74, 222, 128, 0.3);
  --bg-proposed: rgba(74, 222, 128, 0.05);
  --border-proposed: rgba(74, 222, 128, 0.5);
  
  /* Badges */
  --badge-addition-bg: #166534;                 /* green-800 */
  --badge-addition-text: #bbf7d0;               /* green-200 */
  --badge-modification: #fb923c;                /* orange-400 */
  
  /* Generation Panel */
  --panel-bg: var(--bg-secondary);
  --panel-border: var(--border-default);
  --panel-width: 320px;
  --panel-collapsed-width: 48px;
}
7.2 Proposed Node Card Styles
css.proposed-node-card {
  border: 2px solid var(--color-proposed);
  box-shadow: 0 0 12px var(--color-proposed-glow);
  background: var(--bg-proposed);
  position: relative;
}

.proposed-node-card::before {
  content: 'PROPOSED';
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--color-proposed);
  color: var(--bg-primary);
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.proposed-node-card.expanded {
  /* Full width when editing */
  grid-column: 1 / -1;
}
7.3 Badge Styles
css.story-map-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  margin-left: 8px;
}

.story-map-badge.addition {
  background: var(--badge-addition-bg);
  color: var(--badge-addition-text);
}

.story-map-badge.modification {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--badge-modification);
  padding: 0;
}
7.4 Generation Panel Styles
css.generation-panel {
  width: var(--panel-width);
  background: var(--panel-bg);
  border-left: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
}

.generation-panel.collapsed {
  width: var(--panel-collapsed-width);
}

.generation-panel-section {
  border-bottom: 1px solid var(--panel-border);
  padding: 16px;
}

.generation-panel-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}

8. Interaction Specifications
8.1 Keyboard Shortcuts
ShortcutContextAction← / →Generation Panel focusedNavigate packagesEnterPackage selectedAccept packageEscapeInline editor openClose editorEscapePackage stagedReject package (with confirmation)GWorkspaceFocus generation panel
8.2 Loading States
StateUI IndicationGenerating packagesButton shows spinner + "Generating...", panel shows skeleton cardsRegenerating single nodeNode card shows spinner overlay, [Regenerate] disabledAccepting package[Accept] shows spinner + "Accepting...", all actions disabled
8.3 Error States
ErrorUI ResponseGeneration failsToast error, form remains filled, can retryRegenerate failsToast error, original node data preservedAccept failsToast error, staging state preserved, can retryPackage outdatedWarning banner on package card, "X versions behind"
8.4 Undo Support
ActionUndo MechanismRemove node from packageToast with "Undo" button (5s timeout)Reject packageConfirmation modal before actionEdit fieldNo explicit undo (changes can be reverted by regenerating)

9. Migration Plan
9.1 Phase 1: Add GenerationPanel to Workspace

Create GenerationPanel component with compose form
Add panel to WorkspaceView layout
Wire up generate action to existing API
Generation tab still exists but redirects to Workspace

9.2 Phase 2: Implement Staging State

Add stagingState to context/store
Implement mergedGraphView computation
Add badges to StoryMap
Update view components to render proposed nodes (visual only)

9.3 Phase 3: Inline Editing

Create InlineEditor component
Implement expand/collapse behavior
Wire up field editing to stagingState.editedNodes
Implement remove functionality

9.4 Phase 4: All Changes View

Create AllChangesView component
Add to StoryMap navigation
Include impact summary

9.5 Phase 5: Package Navigation

Implement carousel in GenerationPanel
Wire up package switching
Handle saved packages in panel

9.6 Phase 6: Polish & Cleanup

Remove Generation tab
Add keyboard shortcuts
Add loading/error states
Add undo support
Performance optimization for large packages


10. Testing Considerations
10.1 Unit Tests

mergedGraphView computation with various staging states
sectionChangeCounts calculation
Badge display logic
Field change handlers

10.2 Integration Tests

Generate → Stage → Edit → Accept flow
Package navigation preserves/resets edit state
Remove node → Undo flow
Regenerate single node

10.3 E2E Tests

Full workflow: Compose → Generate → Review in Structure Board → Edit scene → Accept
Package carousel navigation updates workspace correctly
"All Changes" view shows all proposed items
Accept creates new version with edits applied


11. Open Questions / Future Considerations

Relationship editing: Should users be able to modify proposed edges (e.g., change which location a scene is assigned to)?
Partial accept: Should users be able to accept some nodes from a package but not others?
Diff view: Should there be a way to see exact before/after comparison for modifications (not just additions)?
Bulk operations: Should "All Changes" view support bulk remove/regenerate?
Package merging: Should users be able to combine elements from multiple packages?


12. Appendix
12.1 Node Type → Section Mapping
typescriptconst nodeSectionMapping: Record<string, Section> = {
  // Premise section
  Premise: 'premise',
  GenreTone: 'premise',
  Setting: 'premise',
  
  // Structure Board section
  Beat: 'structureBoard',
  PlotPoint: 'structureBoard',
  Scene: 'structureBoard',
  
  // Elements section
  Character: 'elements',
  Location: 'elements',
  Object: 'elements',
  CharacterArc: 'elements',
  
  // Story Context section
  ThematicConcerns: 'storyContext',
  StoryContext: 'storyContext',
};
12.2 Package Data Structure Reference
typescriptinterface Package {
  id: string;
  title: string;
  description: string;
  confidence: number;
  tags: string[];
  createdAt: string;
  
  // Proposed content
  nodes: PackageNode[];
  edges: PackageEdge[];
  
  // Impact analysis
  impact: {
    fulfills: string[];    // Gap/beat IDs addressed
    creates: string[];     // New gaps/questions
    conflicts: string[];   // Validation issues
  };
  
  // Metadata
  mode: 'add' | 'expand' | 'explore';
  entryPoint: string;
  direction: string;
}

interface PackageNode {
  tempId: string;          // Temporary ID until accepted
  type: NodeType;
  data: Record<string, any>;
}

interface PackageEdge {
  tempId: string;
  type: EdgeType;
  sourceId: string;        // Can reference tempId or real node ID
  targetId: string;
  data?: Record<string, any>;
}

End of Specification
