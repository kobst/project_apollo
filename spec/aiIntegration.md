AI Integration Specification
Version: 1.0.0
Date: 2026-01-09
Status: Draft

Overview
This document defines the AI integration architecture for the Apollo screenplay knowledge graph system. The AI assists users in developing stories through three distinct phases: Interpretation, Staging, and Generation.
Core Principles

Human-in-the-loop: AI proposes, human decides. All AI output is a proposal that requires user acceptance.
Complete packages: Every AI generation produces fully-formed, ready-to-apply sets of changes—not partial suggestions requiring follow-up.
Exploration over prescription: Generate multiple alternatives for the user to explore, rather than guiding toward a single solution.
Full graph awareness: AI reads and can propose changes to any part of the story graph, including Story Context.


1. Three AI Phases
1.1 Interpretation Phase
Purpose: Transform freeform user input into structured proposals.
Input: Natural language text from the user (e.g., "I want a scene where Mike realizes his partner has been lying to him")
AI Behavior:

Parse user input for narrative intent
Consult existing graph state (nodes, edges, gaps)
Consult Story Context (themes, constraints, creative direction)
Determine the most appropriate output form:

Concrete node (Character, Location, Scene, PlotPoint, Object)
Idea node (if concept is not yet ready to be concrete)
Story Context addition (if content is thematic/directional/constraint)
Combination of the above



Output: One or more proposed changes with rationale
User Actions:

Accept: Apply the proposal to the graph
Reject: Discard the proposal
Edit: Modify the proposal before accepting

1.2 Staging Phase
Purpose: Show the impact of proposed changes before committing.
Input: Proposed changes from Interpretation or Generation phase
AI/System Behavior:

Compute which gaps would be fulfilled
Identify conflicts with existing nodes
Identify new gaps that would be created
Run lint rules to preview any violations
Show edge relationships that would be created

Output: Impact analysis including:

Gaps fulfilled (✓)
Gaps created (→)
Conflicts detected (⚠)
Lint warnings/errors

User Actions:

Proceed: Accept the changes with full awareness of impact
Cancel: Return to editing or reject the proposal

1.3 Generation Phase
Purpose: Produce multiple complete narrative packages that the user can explore, refine, and accept.
Input:

Entry point (beat, node, gap, or naked/global)
Optional direction (freeform guidance text)
Scope parameters (depth, option count)

AI Behavior:

Analyze the entry point and context
Consult graph state, Story Context, and gaps
Generate N complete packages, each containing:

Primary changes (what user asked for)
Supporting elements (characters, locations, etc. needed to make it work)
Edge relationships
Story Context modifications (if relevant)


Compute impact analysis for each package

Output: N complete packages, each ready to apply
User Actions:

Accept: Apply the entire package, create new version
Refine: Provide constraints, generate N variations of selected package
Reject: Remove package from consideration
Regenerate All: Discard all packages, start fresh with same prompt


2. Generation Parameters
2.1 Package Depth
Controls how much each generated package contains.
SettingLabelDescriptionApproximate BudgetnarrowFocusedJust the requested element, minimal supporting material1-2 new nodesmediumStandardRequested element plus immediate dependencies3-5 new nodeswideExpansiveFull cascade with downstream implications6-10 new nodes
2.2 Package Count
Controls how many alternative packages are generated.
SettingLabelPackages GeneratedfewQuick2-3 packagesstandardExplore4-6 packagesmanyDeep dive8-12 packages
2.3 Direction
Optional freeform text providing guidance for generation.
Examples:

"Focus on betrayal and trust themes"
"Make it more action-oriented"
"The new character should be sympathetic"


3. Package Structure
A package is a complete, self-contained set of proposed changes.
3.1 Package Schema
typescriptinterface NarrativePackage {
  id: string;
  title: string;
  rationale: string;
  confidence: number;                    // 0.0 - 1.0
  
  // Refinement lineage
  parent_package_id?: string;            // If this is a refinement
  refinement_prompt?: string;            // User guidance that produced this
  
  // Changes organized by hierarchy
  changes: {
    storyContext?: StoryContextChange[];
    premise?: NodeChange[];
    storyElements?: NodeChange[];        // Characters, Locations, Objects
    outline?: NodeChange[];              // PlotPoints, Scenes, Beats
  };
  
  // Edges to create/modify/delete
  edges: EdgeChange[];
  
  // Pre-computed impact
  impact: {
    fulfills_gaps: string[];             // Gap IDs resolved
    creates_gaps: string[];              // Gap IDs introduced
    conflicts: ConflictInfo[];           // Conflicts with existing nodes
  };
}

interface NodeChange {
  operation: 'add' | 'modify' | 'delete';
  node_type: string;
  node_id: string;
  data?: Record<string, any>;            // For add/modify
  previous_data?: Record<string, any>;   // For modify (shows what changed)
}

interface EdgeChange {
  operation: 'add' | 'modify' | 'delete';
  edge_type: string;
  from: string;
  to: string;
  properties?: Record<string, any>;
}

interface StoryContextChange {
  operation: 'add' | 'modify' | 'delete';
  section: string;                       // e.g., "Themes & Motifs"
  content: string;
  previous_content?: string;             // For modify
}

interface ConflictInfo {
  type: 'contradicts' | 'duplicates' | 'interferes';
  existing_node_id: string;
  description: string;
  suggested_resolution?: string;
}
```

### 3.2 Package Display Organization

Packages are displayed organized by story hierarchy:
```
STORY CONTEXT
  + Add to Themes: "..."
  ~ Modify Constraints: "..."

PREMISE
  (no changes)

STORY ELEMENTS
  + Character: "..."
  + Location: "..."
  ~ Character (existing): modify description

OUTLINE
  + PlotPoint: "..."
    └─ ALIGNS_WITH → Beat
  + Scene: "..."
    └─ SATISFIES → PlotPoint
    └─ HAS_CHARACTER → Character
    └─ LOCATED_AT → Location

IMPACT
  ✓ Fulfills: [gap descriptions]
  → Creates: [new gap descriptions]
  ⚠ Conflicts: [conflict descriptions]
```

---

## 4. Refinement Flow

### 4.1 Refinement Process

1. User selects a package they partially like
2. User clicks "Refine" and provides constraints:
   - What to keep unchanged
   - What to change and how
   - Additional guidance
3. AI generates N variations that respect the constraints
4. Variations become children of the original package in the tree

### 4.2 Refinement Tree

Packages form a tree structure through refinement:
```
Initial Generation
├── Package A
├── Package B ← User refines
│   ├── Package B.1
│   ├── Package B.2 ← User refines further
│   │   ├── Package B.2.1 ← User accepts
│   │   ├── Package B.2.2
│   │   └── Package B.2.3
│   ├── Package B.3
│   └── Package B.4
├── Package C
└── Package D
4.3 Refinement Schema
typescriptinterface RefinementRequest {
  base_package_id: string;
  keep_elements: string[];               // Node IDs to preserve as-is
  regenerate_elements: string[];         // Node IDs to regenerate
  guidance: string;                      // Freeform refinement direction
  depth: 'narrow' | 'medium' | 'wide';
  count: 'few' | 'standard' | 'many';
}
```

### 4.4 Tree Navigation

- User can navigate to any package in the tree
- Sibling packages shown as tabs
- Back button to navigate up the tree
- Breadcrumb shows current path (e.g., "Pkg 2 → Pkg 2.2 → Pkg 2.2.1")

---

## 5. AI Authority

### 5.1 What AI Can Propose

The AI can propose any graph operation as part of a package:

| Operation | Allowed | Notes |
|-----------|---------|-------|
| Add new nodes | ✅ | Any node type |
| Add new edges | ✅ | Any valid edge type |
| Modify existing nodes | ✅ | Changes flagged clearly |
| Delete existing nodes | ✅ | Shown with warning |
| Modify Story Context | ✅ | Section and content shown |

### 5.2 Constraint: Everything is a Proposal

No AI-generated change is applied without user acceptance. The AI surfaces conflicts and implications, but the user always makes the final decision.

### 5.3 Conflict Handling

When AI detects that a proposed change conflicts with existing content:
1. Conflict is flagged in the package
2. AI may include a modification to the existing node as part of the package
3. User can accept (which applies the resolution) or refine to try a different approach

---

## 6. Story Context Integration

### 6.1 Reading Story Context

AI consults Story Context when:
- Generating packages (for thematic alignment)
- Interpreting user input (for context)
- Proposing node types (to match creative direction)

### 6.2 Writing to Story Context

Story Context can be modified through:

**Interpretation Phase:**
- User input that is thematic/directional → AI proposes Story Context addition
- Example: "I want this to be about corruption" → Add to Themes section

**Generation Phase:**
- Packages can include Story Context changes
- Example: New character implies theme → Package includes Story Context addition

### 6.3 Story Context Change Display
```
STORY CONTEXT
┌────────────────────────────────────────────────────────────────┐
│ + Add to "Themes & Motifs":                                    │
│   "Institutional betrayal - the system protects its own"       │
│                                                                │
│ ~ Modify "Constraints & Rules":                                │
│   - Before: "Single POV only"                                  │
│   + After: "Single POV only, except for Act 3 reveal"          │
└────────────────────────────────────────────────────────────────┘

7. Entry Points
Generation can be triggered from multiple locations in the UI.
7.1 Entry Point Types
Entry PointContext ProvidedTypical GenerationEmpty BeatBeat type, act, positionPlotPoints + supporting elementsBeat with PlotPointsBeat + existing PlotPointsScenes to satisfy PlotPointsPlotPointPlotPoint detailsScenes, supporting characters/locationsCharacterCharacter detailsArcs, scenes featuring characterGap itemGap type and targetWhatever resolves the gapNaked/GlobalFull graph stateAI determines highest-value additionsStory Context sectionSection contentNodes that realize thematic elementsIdea nodeIdea contentPromotion to concrete node(s)
7.2 Entry Point Behavior
Each entry point pre-fills generation context:

Target: What element generation is anchored to
Suggested depth: Based on entry point (e.g., Beat → medium, Character → narrow)
Allowed types: Node types relevant to entry point

User can override all defaults.

8. Generation Session
8.1 Session Lifecycle

Start: User triggers generation from an entry point
Active: User explores packages, refines, navigates tree
End: User accepts a package OR abandons session

8.2 Session State
typescriptinterface GenerationSession {
  id: string;
  story_id: string;
  created_at: string;
  
  // Initial generation context
  entry_point: {
    type: string;
    target_id?: string;
  };
  initial_params: {
    depth: string;
    count: string;
    direction?: string;
  };
  
  // Package tree
  packages: NarrativePackage[];
  
  // Navigation state
  current_package_id?: string;
  
  // Outcome
  status: 'active' | 'accepted' | 'abandoned';
  accepted_package_id?: string;
}
```

### 8.3 Session Persistence

- Sessions are persisted to allow resumption
- Active session stored in `~/.apollo/stories/<id>/session.json`
- On acceptance, session is archived with the created version
- Abandoned sessions can be cleaned up or retained for history

---

## 9. UI Components

### 9.1 Generation Trigger
```
┌─────────────────────────────────────────────────────────────┐
│ Generate for: [Midpoint ▼]                                  │
│                                                             │
│ Depth:    ○ Focused  ● Standard  ○ Expansive               │
│ Options:  ○ Quick    ● Explore   ○ Deep dive               │
│                                                             │
│ Direction (optional):                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                                            [Generate]       │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Package Browser
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ GENERATION: "Midpoint options"                              [Regenerate All]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ TREE: ○ Pkg 1   ● Pkg 2 ──┬── Pkg 2.1    ○ Pkg 3   ○ Pkg 4                 │
│                           ├── Pkg 2.2                                       │
│                           └── Pkg 2.3                                       │
│                                                                             │
│ VIEWING: Pkg 2 → [Pkg 2.1]  [Pkg 2.2]  [Pkg 2.3]                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ PACKAGE: "The Corruption Reveal"                           Confidence: 85%│
│ │                                                                         │ │
│ │ (Package contents organized by hierarchy...)                            │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [← Back to Pkg 2]                    [Accept Package]  [Refine...]  [Reject]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Refinement Modal
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ REFINE: "The Corruption Reveal"                                       [x]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Current package contains:                                                   │
│ • PlotPoint: Mike discovers partner's betrayal                              │
│ • Character: Agent Torres (Internal Affairs)                                │
│ • Location: Police Evidence Room                                            │
│ • Story Context: Theme addition                                             │
│                                                                             │
│ What would you like to change?                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Make Torres more sympathetic - maybe a former friend of Mike's.         │ │
│ │ The location feels too obvious, somewhere more personal?                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Keep unchanged:                                                             │
│ ☑ PlotPoint concept                                                        │
│ ☐ Character (will regenerate)                                              │
│ ☐ Location (will regenerate)                                               │
│ ☑ Story Context addition                                                   │
│                                                                             │
│ Generate: [4 ▼] variations    Depth: [Standard ▼]                          │
│                                                                             │
│                                               [Generate Variations] [Cancel]│
└─────────────────────────────────────────────────────────────────────────────┘

10. Integration with Existing Systems
10.1 Gap System

Gaps serve as generation opportunities
AI consults gaps when generating packages
Impact analysis shows which gaps are fulfilled/created
Gap entry point triggers generation targeted at resolution

10.2 Lint System

Lint runs on proposed packages before display
Violations shown in impact section
Hard errors block acceptance (must refine)
Soft warnings allow acceptance with acknowledgment

10.3 Version Control

Accepting a package creates a new StoryVersion
Package metadata stored with version for audit trail
Refinement tree can be reconstructed from version history

10.4 Existing Cluster/Move System
The existing MoveCluster and NarrativeMove types are extended to support this architecture:

NarrativePackage is an enhanced NarrativeMove
Refinement tree tracked via parent_package_id
Session state extends existing session.json


11. Future Considerations
11.1 Not in Scope for V1

Real-time collaboration (multiple users generating simultaneously)
Package comparison view (side-by-side diff of two packages)
AI explanation mode ("why did you suggest this?")
Learning from user preferences (personalized generation)
Batch generation across multiple entry points

11.2 Open Questions

How long should generation sessions be retained?
Should rejected packages be permanently deleted or archived?
Rate limiting / cost management for LLM calls
Caching strategies for similar generation requests


12. Summary
The AI integration provides three phases of assistance:

Interpretation: Transforms freeform input into structured proposals
Staging: Shows impact before committing changes
Generation: Produces multiple complete packages for exploration

Users control generation via depth (focused/standard/expansive) and count (quick/explore/deep dive) parameters. Packages can be refined through a tree structure, allowing iterative exploration. All AI output is proposals—the user always decides what gets committed to the story graph.