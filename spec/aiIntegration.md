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


## AI Provider Configuration

Apollo supports multiple AI providers:

| Provider | Model | Env Variable |
|----------|-------|--------------|
| Anthropic (default) | claude-sonnet-4-20250514 | `ANTHROPIC_API_KEY` |
| OpenAI | gpt-5.2 | `OPENAI_API_KEY` |

**Configuration:**
- Set `APOLLO_AI_PROVIDER=anthropic` or `APOLLO_AI_PROVIDER=openai` in `.env`
- Provide the corresponding API key

**Note:** OpenAI reasoning models (gpt-5.x) require higher token budgets for reasoning + output. The system uses `max_completion_tokens` instead of `max_tokens` for OpenAI.

---

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

### 2.1 Generation Modes

Apollo provides four specialized generation modes, each focused on a specific output type:

| Mode | Endpoint | Primary Output | Use Case |
|------|----------|----------------|----------|
| **Story Beats** | `/propose/story-beats` | StoryBeat nodes | Fill in narrative structure |
| **Characters** | `/propose/characters` | Character nodes | Develop the cast |
| **Scenes** | `/propose/scenes` | Scene nodes | Create scenes for story beats |
| **Expand** | `/propose/expand` | Varies by target | Develop any existing node |

### 2.2 Expansion Scope

All generation endpoints support an expansion scope parameter:

| Scope | Description | Output |
|-------|-------------|--------|
| **Constrained** | Primary output only | Just the requested node type, references existing nodes |
| **Flexible** | Primary + supporting | May create new characters, locations, objects as needed |

Both scopes can produce **suggestions**: Story Context additions and stashed ideas.

### 2.3 Package Count
Controls how many alternative packages are generated (default: 3, max: 10).

### 2.4 Direction
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

### 9.1 Generation Panel
```
┌─────────────────────────────────────────────────────────────┐
│ AI GENERATION                                          [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ MODE                                                        │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│ │📋 Story   │ │👤 Chars   │ │🎬 Scenes  │ │🔍 Expand  │    │
│ │  Beats    │ │           │ │           │ │           │    │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘    │
│                                                             │
│ SCOPE                                                       │
│ ○ Constrained - Primary output only                        │
│ ● Flexible - + Characters, Locations, Ideas                │
│                                                             │
│ [MODE-SPECIFIC OPTIONS]                                     │
│                                                             │
│ DIRECTION (optional):                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Additional guidance for the AI...                       │ │
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

### 11.3 Specialized Generation Endpoints

#### StoryBeat-Only Generation

The `/propose/story-beats` endpoint provides focused generation of **only StoryBeat nodes** to fill structural gaps (beats without ALIGNS_WITH edges from any StoryBeat).

**Use Cases:**
- Filling in story beats after establishing basic structure
- Generating narrative milestones without creating supporting elements
- Focused structure development when beats exist but lack story content

**Request:**
```typescript
interface ProposeStoryBeatsRequest {
  priorityBeats?: string[];           // Beat IDs or BeatTypes to always include
  packageCount?: number;              // default: 3
  maxStoryBeatsPerPackage?: number;   // default: 5
  direction?: string;                 // User guidance
  creativity?: number;                // 0-1, default: 0.5
}
```

**Response:**
```typescript
interface ProposeStoryBeatsResponse {
  sessionId: string;
  packages: NarrativePackage[];       // Only contains StoryBeat nodes
  missingBeats: MissingBeatInfo[];    // All beats lacking StoryBeat alignment
}
```

**Strict Constraints:**
1. **Node Types**: ONLY `StoryBeat` nodes are generated
2. **Edge Types**: ONLY `ALIGNS_WITH` (StoryBeat → Beat) and `PRECEDES` (StoryBeat → StoryBeat) edges
3. **Validation**: ALIGNS_WITH edges must target valid Beat IDs

**Example:**
```bash
POST /stories/:id/propose/story-beats
{
  "priorityBeats": ["Catalyst", "Midpoint"],
  "packageCount": 3,
  "direction": "Focus on protagonist inner conflict"
}
```

---

12. Input Processing Workflows

This section documents the two pathways for processing user text input into story graph changes.

### 12.1 Overview

Users can input freeform text through the Input Panel, which offers two processing modes:

| Mode | Method | Speed | Best For |
|------|--------|-------|----------|
| **Extract** | Pattern matching | Fast | Structured input (scripts, outlines) |
| **Interpret** (AI) | LLM analysis | Slower | Natural language, creative ideas |

Both modes produce **proposals** that require user acceptance before being applied.

### 12.2 Extraction (Pattern-Based)

Non-AI extraction uses regex patterns to identify story elements in structured text.

**Triggers:**
- Screenplay format (INT./EXT. headers)
- Character cues (ALL CAPS names)
- Beat markers (ACT ONE, MIDPOINT, etc.)
- Explicit type markers ("Character: name")

**Flow:**
```
User Input → Pattern Matching → Proposals → Accept/Reject → Apply to Graph
```

**API Endpoint:**
```
POST /stories/:id/extract
{
  "input": "INT. POLICE STATION - NIGHT\n\nCAIN enters, looking nervous...",
  "targetType": "Scene"  // Optional hint
}
```

**Response:**
```json
{
  "proposals": [
    {
      "id": "prop_123",
      "title": "Scene: INT. POLICE STATION - NIGHT",
      "description": "Detected scene header with location",
      "confidence": 0.9,
      "extractedEntities": [
        { "type": "Scene", "name": "INT. POLICE STATION - NIGHT", "id": "scene_xxx" },
        { "type": "Character", "name": "CAIN", "id": "char_xxx" }
      ]
    }
  ]
}
```

### 12.3 Interpretation (AI-Powered)

AI interpretation uses an LLM to understand natural language and propose appropriate changes.

**Flow:**
```
User Input → LLM Analysis → InterpretationProposals + Validations → Accept → Apply
```

Validation happens automatically as part of the interpret response - no separate "Check" step needed.

**API Endpoint:**
```
POST /stories/:id/interpret
{
  "userInput": "Cain realizes the cops are connected to the drug ring",
  "targetType": "PlotPoint"  // Optional hint
}
```

**Response:**
```json
{
  "interpretation": {
    "summary": "User is describing a key plot revelation...",
    "confidence": 0.92
  },
  "proposals": [
    {
      "type": "node",
      "operation": "add",
      "target_type": "PlotPoint",
      "data": {
        "title": "Cain discovers police corruption",
        "summary": "Cain realizes the cops are connected..."
      },
      "rationale": "This is a major turning point...",
      "relates_to": ["char_protagonist", "pp_extracted_123"]
    }
  ],
  "validations": {
    "0": {
      "similarities": [],
      "fulfillsGaps": [{ "gapId": "...", "gapTitle": "Missing PlotPoint", "fulfillment": "full" }],
      "suggestedConnections": [{ "nodeId": "...", "nodeName": "Cain", "edgeType": "ADVANCES" }],
      "warnings": [],
      "score": 0.95
    }
  },
  "alternatives": [
    {
      "summary": "Could also be interpreted as a Scene...",
      "confidence": 0.3
    }
  ]
}
```

**InterpretationProposal Schema:**
```typescript
interface InterpretationProposal {
  type: 'node' | 'storyContext' | 'edge';
  operation: 'add' | 'modify';
  target_type?: string;              // Node type if type='node'
  data: Record<string, unknown>;     // Node data or content
  rationale: string;                 // AI explanation
  relates_to?: string[];             // Referenced node IDs (informational)
}
```

---

## 13. Proposal Validation (Automatic Pre-Flight)

Validation happens automatically when proposals are generated. Each AI interpretation proposal is validated against the existing knowledge graph as part of the interpret response.

### 13.1 Purpose

The validation system helps users understand:
- **Conflicts**: Does this duplicate or contradict existing nodes?
- **Fit**: Which story gaps would this fill?
- **Connections**: What existing nodes could this relate to?

### 13.2 Validation Flow

```
POST /stories/:id/interpret
         ↓
   LLM generates proposals
         ↓
   Server auto-validates each proposal
         ↓
   Response includes proposals + validations
         ↓
   ┌─────────────────────────────────────┐
   │ • Similarity warnings               │
   │ • Gap fulfillment indicators        │
   │ • Connection suggestions            │
   │ • Overall score                     │
   └─────────────────────────────────────┘
         ↓
   User decides: Accept / Accept Anyway / Reject
```

No manual "Check" step required - validation is included automatically.

### 13.3 Validation Components

#### Similarity Detection

Compares proposed node name/title against existing nodes of the same type using text similarity:

| Match Type | Similarity | Result |
|------------|------------|--------|
| **Exact** | ≥95% | ERROR: "Character 'Cain' already exists" |
| **Fuzzy** | 60-95% | WARNING: "Similar to 'Cain Smith'" |
| **Partial** | Contains | WARNING: Substring match detected |

**Fields Checked by Node Type:**

| Node Type | Primary Field | Secondary Fields |
|-----------|--------------|------------------|
| Character | `name` | `archetype` |
| Location | `name` | - |
| Scene | `heading`, `title` | `scene_overview` |
| PlotPoint | `title` | `summary` |
| Object | `name` | - |

#### Gap Fulfillment

Maps the proposed node type to story tiers and checks which gaps would be addressed:

| Node Type | Tier | Gap Types Fulfilled |
|-----------|------|---------------------|
| Logline | premise | Missing logline |
| Character, Location, Object | foundations | Missing foundations |
| Beat | structure | Unrealized beats |
| PlotPoint | plotPoints | Missing plot points |
| Scene | scenes | Missing scenes, unplaced content |

**Fulfillment Levels:**
- **Full**: Proposal directly addresses the gap (e.g., "Missing Character" → adding Character)
- **Partial**: Proposal is in same tier and may help (e.g., adding Location when foundations are incomplete)

#### Connection Suggestions

Suggests existing nodes that could be connected via valid edge types:

**Content-Based Suggestions:**
Scans the proposal's description for mentions of existing node names.
```
"Cain enters the warehouse" → Suggests HAS_CHARACTER edge to "Cain", LOCATED_AT to "warehouse"
```

**Type-Based Suggestions:**
Based on valid edge rules for the node type:

| Proposal Type | Suggested Edges | Target Types |
|---------------|-----------------|--------------|
| Scene | HAS_CHARACTER | Characters |
| Scene | LOCATED_AT | Locations |
| Scene | FEATURES_OBJECT | Objects |
| PlotPoint | PRECEDES | Other PlotPoints |
| PlotPoint | ALIGNS_WITH | Beats |
| PlotPoint | ADVANCES | Character Arcs |
| Character | HAS_ARC | Character Arcs |
| Location | PART_OF | Settings |

### 13.4 Validation Response Schema

```typescript
interface ProposalValidation {
  similarities: SimilarityMatch[];
  fulfillsGaps: GapMatch[];
  suggestedConnections: ConnectionSuggestion[];
  warnings: ProposalWarning[];
  score: number;  // 0-1, higher is better
}

interface SimilarityMatch {
  existingNodeId: string;
  existingNodeType: string;
  existingNodeName: string;
  matchedField: string;
  similarity: number;        // 0-1
  type: 'exact' | 'fuzzy' | 'partial';
}

interface GapMatch {
  gapId: string;
  gapTitle: string;
  gapTier: GapTier;
  fulfillment: 'full' | 'partial';
  reason: string;
}

interface ConnectionSuggestion {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  edgeType: EdgeType;
  direction: 'from' | 'to';  // 'from' = new node → existing
  reason: string;
  confidence: number;
}

interface ProposalWarning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}
```

### 13.5 Warning Codes

| Code | Severity | Trigger | User Action |
|------|----------|---------|-------------|
| `EXACT_DUPLICATE` | error | ≥95% name match | Shown "Accept Anyway" button |
| `SIMILAR_EXISTS` | warning | 60-95% match | Review existing nodes |
| `NO_GAP_MATCH` | info | No gaps fulfilled | Informational only |
| `CONNECTION_AVAILABLE` | info | Connections possible | Consider adding edges |

### 13.6 Score Calculation

The validation score (0-1) summarizes the proposal's fit:

```
score = 1.0
  - (exact_matches × 0.3)      // Penalty for duplicates
  - (high_similarity × 0.1)    // Penalty for similar nodes
  + (full_fulfillment × 0.1)   // Bonus for filling gaps
  - (error_warnings × 0.2)     // Penalty for errors
```

**Score Interpretation:**
| Score | Meaning |
|-------|---------|
| 0.9-1.0 | Excellent fit, no conflicts |
| 0.7-0.9 | Good fit, minor concerns |
| 0.5-0.7 | Acceptable, review warnings |
| <0.5 | Potential issues, review carefully |

### 13.7 UI Display

Validation results are shown automatically with each proposal (no "Check" button needed):

```
┌─────────────────────────────────────────────────────────────┐
│ PLOTPOINT                                              add  │
│                                                             │
│ Cain discovers police corruption                            │
│ Cain realizes that the cops are somehow connected...        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ This is a significant narrative event...                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Related to: char_protagonist, pp_extracted_123              │
│                                                             │
│ ┌─ Validation Results ────────────────────────────────────┐ │
│ │ ⚠️ Similar to: Police corruption revealed (72%)         │ │
│ │ ✓ Fills gaps: Missing PlotPoint in Act 2               │ │
│ │ 💡 Possible connections:                                │ │
│ │    Could precede "Cain gets arrested"                  │ │
│ │    Could advance "Cain's moral arc"                    │ │
│ │                                            Score: 85%   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                                              [Accept]       │
│                      (or if errors:)  [Accept Anyway]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 14. Comparison: Validation vs Lint

| Aspect | Proposal Validation | Lint System |
|--------|---------------------|-------------|
| **When** | Before acceptance | After changes applied |
| **What** | Single proposal | Entire graph |
| **Focus** | Conflicts, fit, connections | Structural rules |
| **Blocking** | Warnings only | Hard rules block commit |
| **API** | Part of `/proposal-to-package` | `POST /lint` |

Both systems are complementary:
- **Validation** catches conflicts before they enter the graph
- **Lint** ensures graph integrity after changes

---

## 15. Inline Element Editing

Users can edit individual elements within packages before accepting them.

### 15.1 Editing Capabilities

| Action | Description |
|--------|-------------|
| **Edit** | Modify element properties directly in the package review |
| **Regenerate** | Request AI alternatives for a single element |
| **Remove** | Mark element for exclusion from the package |
| **Restore** | Bring back a previously removed element |

### 15.2 Cascading Name Changes

When editing a node's name, the system automatically updates all references:
- Edge labels update to reflect new names
- Related nodes display the updated name
- Impact analysis recalculates with new names

### 15.3 Regenerate Element

Request AI alternatives for a specific element:
1. Select the element to regenerate
2. Optionally provide guidance ("make more sympathetic", "different location")
3. Choose from 3-7 alternative options
4. Selected option replaces the original in the package

---

## 16. Saved Packages

Packages can be saved for later use without immediately applying them.

### 16.1 Save for Later

- Any package in review can be saved
- Saved packages persist across sessions
- Saved packages appear in the sidebar under "Saved"

### 16.2 Compatibility Checking

When loading a saved package, the system checks compatibility:

| Status | Meaning | Action |
|--------|---------|--------|
| **Compatible** | Package can be applied without issues | Apply normally |
| **Outdated** | Graph has changed but no conflicts | Warning shown, can apply |
| **Conflicting** | Changes conflict with current graph | Must use "Apply Anyway" |

### 16.3 Managing Saved Packages

- View saved packages in the Generation sidebar
- Delete packages no longer needed
- "Apply Anyway" option for conflicting packages with manual resolution

---

## 17. Stash/Ideas Feature

Stashed ideas are generated by AI alongside primary output and can be developed later.

### 17.1 When Ideas Are Generated

- During AI generation with `expansionScope: 'flexible'`
- As suggestions alongside primary nodes
- Can be character concepts, plot ideas, scene ideas, or worldbuilding notes

### 17.2 Idea Workflow

1. AI generates ideas as suggestions in packages
2. User can include or dismiss suggestions during package review
3. Included ideas are saved to the Ideas collection on commit
4. User can later "Develop" an idea (opens Expand mode with idea as direction)
5. Ideas can also be manually created or deleted

### 17.3 UI Location

Ideas appear in the Story Bible navigation under "Ideas (N)" where N is the count.

---

## 18. Summary

The AI integration provides three phases of assistance:

1. **Interpretation**: Transforms freeform input into structured proposals
2. **Staging**: Shows impact before committing changes
3. **Generation**: Produces multiple complete packages for exploration

Users control generation via four specialized modes (Story Beats, Characters, Scenes, Expand) with expansion scope (Constrained/Flexible). Packages can be refined through a tree structure, allowing iterative exploration. All AI output is proposals—the user always decides what gets committed to the story graph.