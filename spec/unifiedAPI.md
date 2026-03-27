Generation System Specification
Specialized Endpoints with Expansion Scope

1. Overview
This specification defines a generation system with four specialized endpoints, each focused on a primary output type but capable of producing related content based on an "expansion scope" parameter. This replaces the previous generic "entry point" approach with a more structured, predictable generation model.
Design Principles

Primary Focus: Each endpoint has a clear primary output type
Controlled Expansion: The expansionScope parameter determines whether related nodes are generated
Universal Suggestions: All endpoints can produce Story Context additions and stashed ideas
Dependency Ordering: Scenes require committed plot points; the API enforces this

The Four Modes
ModeEndpointPrimary OutputPurposePlot Points/propose/plot-pointsPlotPoint nodesFill in narrative structureCharacters/propose/charactersCharacter nodesDevelop the castScenes/propose/scenesScene nodesCreate scenes for plot pointsExpand/propose/expandVaries by targetDevelop any existing node

2. Common Schemas
2.1 Expansion Scope
All endpoints accept this parameter:
typescripttype ExpansionScope = 'constrained' | 'flexible';

// 'constrained': 
//   - Generate only the primary output type
//   - Reference existing nodes but don't create new supporting nodes
//   - Still may produce suggestions (context additions, stashed ideas)

// 'flexible':
//   - Generate primary output plus supporting nodes
//   - May create new characters, locations, objects as needed
//   - More creative, more interconnected output
2.2 Package Structure
All endpoints return packages with this structure:
typescriptinterface NarrativePackage {
  id: string;
  title: string;
  summary: string;
  
  // Primary output - always present, type depends on endpoint
  primary: {
    type: 'PlotPoint' | 'Character' | 'Scene' | 'Mixed';
    nodes: Node[];
    edges: Edge[];
  };
  
  // Supporting nodes - only present when expansionScope: 'flexible'
  supporting?: {
    characters?: CharacterNode[];
    locations?: LocationNode[];
    objects?: ObjectNode[];
    plotPoints?: PlotPointNode[];  // For character mode hints
    edges: Edge[];  // Edges connecting supporting nodes
  };
  
  // Suggestions - may be present regardless of expansionScope
  suggestions?: {
    contextAdditions?: ContextAddition[];
    stashedIdeas?: StashedIdea[];
  };
}

interface ContextAddition {
  id: string;
  section: 'themes' | 'conflicts' | 'motifs' | 'tone' | 'constraints';
  content: string;
  action: 'append';  // For now, only append; could add 'replace' later
}

interface StashedIdea {
  id: string;
  content: string;
  category: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
  relatedNodeIds?: string[];  // Optional references to existing nodes
}
2.3 Common Request Parameters
typescriptinterface CommonGenerationParams {
  expansionScope?: ExpansionScope;  // default: 'flexible'
  direction?: string;               // User guidance/instructions
  packageCount?: number;            // default: 3, max: 10
  creativity?: number;              // 0-1, default: 0.5
}
```

---

## 3. Plot Points Endpoint

### 3.1 Purpose

Generate PlotPoint nodes that align to Save the Cat structural beats. Used for filling in the narrative structure before developing scenes.

### 3.2 Endpoint
```
POST /stories/:storyId/propose/plot-points
3.3 Request Schema
typescriptinterface ProposePlotPointsRequest extends CommonGenerationParams {
  // Focus options (all optional, use to narrow generation)
  priorityBeats?: string[];         // Beat IDs or BeatTypes to prioritize
                                    // e.g., ["Catalyst", "Midpoint"] or ["beat_Catalyst"]
  targetAct?: 1 | 2 | 3 | 4 | 5;    // Focus on specific act
  
  // Output limits
  maxPlotPointsPerPackage?: number; // default: 5, max: 10
}
3.4 Response Schema
typescriptinterface ProposePlotPointsResponse {
  sessionId: string;
  packages: NarrativePackage[];
  
  // Metadata about structural gaps
  missingBeats: MissingBeatInfo[];
}

interface MissingBeatInfo {
  beatId: string;
  beatType: BeatType;  // e.g., "Catalyst", "Midpoint"
  act: 1 | 2 | 3 | 4 | 5;
  position: number;
  hasPlotPoint: boolean;  // false if no PlotPoint aligned
}
3.5 Primary Output

Node type: PlotPoint
Required edges: alignedBeatId (PlotPoint → Beat)
Optional edges: PRECEDES (PlotPoint → PlotPoint)

3.6 Supporting Output (when flexible)
Node TypeWhen GeneratedCharacterWhen plot point introduces a new character conceptLocationWhen plot point specifies a setting
Supporting edges:

No direct edges from PlotPoint to Character/Location (those come via Scenes later)
Characters and Locations are "introduced by" the package but not formally linked

3.7 Example Request
bashcurl -X POST http://localhost:3000/stories/my-story/propose/plot-points \\
  -H 'Content-Type: application/json' \\
  -d '{
    "priorityBeats": ["Catalyst", "Midpoint", "All Is Lost"],
    "targetAct": 1,
    "expansionScope": "flexible",
    "direction": "Focus on the protagonist discovering betrayal",
    "packageCount": 3,
    "maxPlotPointsPerPackage": 3
  }'
3.8 Example Response
json{
  "sessionId": "session_abc123",
  "packages": [
    {
      "id": "pkg_1",
      "title": "The Betrayal Unfolds",
      "summary": "Cain discovers the conspiracy through an unlikely source",
      "primary": {
        "type": "PlotPoint",
        "nodes": [
          {
            "id": "plotpoint_new_1",
            "type": "PlotPoint",
            "title": "The Informant's Warning",
            "summary": "A mysterious figure approaches Cain with evidence of Morrison's corruption",
            "intent": "PLOT",
            "status": "proposed"
          }
        ],
        "edges": [
          {
            "type": "alignedBeatId",
            "source": "plotpoint_new_1",
            "target": "beat_Catalyst"
          }
        ]
      },
      "supporting": {
        "characters": [
          {
            "id": "char_new_1",
            "type": "Character",
            "name": "The Informant",
            "description": "A nervous low-level dealer who witnessed Morrison's crew in action"
          }
        ],
        "edges": []
      },
      "suggestions": {
        "contextAdditions": [
          {
            "id": "ctx_1",
            "section": "themes",
            "content": "Information as currency - who knows what determines power",
            "action": "append"
          }
        ],
        "stashedIdeas": [
          {
            "id": "idea_1",
            "content": "The Informant could have a personal grudge against Morrison - killed his brother?",
            "category": "character",
            "relatedNodeIds": ["char_new_1"]
          }
        ]
      }
    }
  ],
  "missingBeats": [
    { "beatId": "beat_Opening_Image", "beatType": "Opening Image", "act": 1, "position": 0, "hasPlotPoint": false },
    { "beatId": "beat_Theme_Stated", "beatType": "Theme Stated", "act": 1, "position": 1, "hasPlotPoint": false },
    { "beatId": "beat_Catalyst", "beatType": "Catalyst", "act": 1, "position": 3, "hasPlotPoint": false }
  ]
}
```

---

## 4. Characters Endpoint

### 4.1 Purpose

Generate Character nodes with descriptions and optional arc development. Can also produce plot point hints showing how the character might interact with the structure.

### 4.2 Endpoint
```
POST /stories/:storyId/propose/characters
4.3 Request Schema
typescriptinterface ProposeCharactersRequest extends CommonGenerationParams {
  // Focus options
  focus: CharacterFocus;
  
  // For 'develop_existing'
  characterId?: string;             // Required when focus is 'develop_existing'
  
  // Output options
  includeArcs?: boolean;            // default: true, generate CharacterArc nodes
  maxCharactersPerPackage?: number; // default: 3, max: 5
}

type CharacterFocus = 
  | 'develop_existing'    // Expand an existing character
  | 'new_protagonist'     // Generate protagonist options
  | 'new_antagonist'      // Generate antagonist options
  | 'new_supporting'      // Generate supporting cast
  | 'fill_gaps';          // Generate characters for scenes lacking them
4.4 Response Schema
typescriptinterface ProposeCharactersResponse {
  sessionId: string;
  packages: NarrativePackage[];
  
  // Metadata
  existingCharacters: CharacterSummary[];  // Current cast for reference
}

interface CharacterSummary {
  id: string;
  name: string;
  archetype?: string;
  sceneCount: number;  // How many scenes they appear in
}
4.5 Primary Output

Node type: Character
Optional nodes: CharacterArc (when includeArcs: true)
Required edges: HAS_ARC (Character → CharacterArc) when arcs included

4.6 Supporting Output (when flexible)
Node TypeWhen GeneratedPlotPointAs "hints" - suggestions for how character could drive structureLocationCharacter's home base, workplace, etc.
Note: Supporting PlotPoints are marked as suggestions/hints, not fully-formed beats. They indicate structural potential.
4.7 Example Request
bashcurl -X POST http://localhost:3000/stories/my-story/propose/characters \\
  -H 'Content-Type: application/json' \\
  -d '{
    "focus": "new_antagonist",
    "expansionScope": "flexible",
    "includeArcs": true,
    "direction": "A corrupt authority figure who was once trusted",
    "packageCount": 3
  }'
4.8 Example Response
json{
  "sessionId": "session_def456",
  "packages": [
    {
      "id": "pkg_1",
      "title": "Captain Morrison - The Fallen Protector",
      "summary": "A decorated police captain running a theft ring",
      "primary": {
        "type": "Character",
        "nodes": [
          {
            "id": "char_new_1",
            "type": "Character",
            "name": "Captain Frank Morrison",
            "description": "Veteran police captain running a crew that steals drug shipments during fake raids. 20-year veteran with expensive tastes and a gambling problem.",
            "archetype": "Corrupt Authority"
          },
          {
            "id": "arc_new_1",
            "type": "CharacterArc",
            "arc_type": "Fall",
            "start_state": "Respected captain maintaining a double life",
            "end_state": "Exposed and desperate, willing to kill to survive"
          }
        ],
        "edges": [
          {
            "type": "HAS_ARC",
            "source": "char_new_1",
            "target": "arc_new_1"
          }
        ]
      },
      "supporting": {
        "plotPoints": [
          {
            "id": "hint_beat_1",
            "type": "PlotPointHint",
            "title": "Morrison's true nature revealed",
            "suggestedBeat": "Midpoint",
            "description": "Cain discovers evidence of Morrison's involvement"
          }
        ],
        "locations": [
          {
            "id": "loc_new_1",
            "type": "Location",
            "name": "Morrison's Office",
            "description": "Wood-paneled corner office with commendations on the wall and secrets in the desk"
          }
        ],
        "edges": []
      },
      "suggestions": {
        "contextAdditions": [
          {
            "id": "ctx_1",
            "section": "conflicts",
            "content": "Institutional corruption - the people meant to protect are the predators",
            "action": "append"
          }
        ]
      }
    }
  ],
  "existingCharacters": [
    { "id": "char_cain", "name": "Cain", "archetype": "Reluctant Hero", "sceneCount": 3 },
    { "id": "char_rigo", "name": "Rigo", "archetype": "The Employer", "sceneCount": 2 }
  ]
}
```

---

## 5. Scenes Endpoint

### 5.1 Purpose

Generate Scene nodes that satisfy committed PlotPoints. This endpoint enforces the dependency rule: scenes can only be created for plot points that have been committed to the graph.

### 5.2 Endpoint
```
POST /stories/:storyId/propose/scenes
5.3 Request Schema
typescriptinterface ProposeScenesRequest extends CommonGenerationParams {
  // Required: which plot points to develop scenes for
  plotPointIds: string[];           // Must be committed PlotPoint IDs
  
  // Output options
  scenesPerBeat?: number;           // default: 1, max: 3
  maxScenesPerPackage?: number;     // default: 5, max: 10
}
5.4 Response Schema
typescriptinterface ProposeScenesResponse {
  sessionId: string;
  packages: NarrativePackage[];
  
  // Validation info
  validatedBeats: ValidatedBeatInfo[];
  rejectedBeats: RejectedBeatInfo[];
}

interface ValidatedBeatInfo {
  plotPointId: string;
  title: string;
  alignedTo: string;  // Beat type, e.g., "Catalyst"
}

interface RejectedBeatInfo {
  plotPointId: string;
  reason: 'not_found' | 'not_committed' | 'already_has_scenes';
}
5.5 Primary Output

Node type: Scene
Required edges:

REALIZED_BY (PlotPoint → Scene) - links scene to its plot point
HAS_CHARACTER (Scene → Character) - at least one character
LOCATED_AT (Scene → Location) - scene location



5.6 Supporting Output (when flexible)
Node TypeWhen GeneratedCharacterWhen scene introduces a new characterLocationWhen scene requires a new settingObjectWhen scene features a significant prop
5.7 Constraint: Committed Plot Points Only
The endpoint MUST validate that all requested plotPointIds:

Exist in the graph
Are in COMMITTED status (not proposed)

If any plot point is not committed, it should be returned in rejectedBeats with reason 'not_committed'.
5.8 Example Request
bashcurl -X POST http://localhost:3000/stories/my-story/propose/scenes \\
  -H 'Content-Type: application/json' \\
  -d '{
    "plotPointIds": ["plotpoint_catalyst_1", "plotpoint_midpoint_1"],
    "expansionScope": "flexible",
    "scenesPerBeat": 2,
    "direction": "Noir atmosphere, tense confrontations"
  }'
5.9 Example Response
json{
  "sessionId": "session_ghi789",
  "packages": [
    {
      "id": "pkg_1",
      "title": "The Revelation Scenes",
      "summary": "Key confrontation scenes for Catalyst and Midpoint",
      "primary": {
        "type": "Scene",
        "nodes": [
          {
            "id": "scene_new_1",
            "type": "Scene",
            "heading": "INT. PARKING GARAGE - NIGHT",
            "scene_overview": "The Informant meets Cain in a shadowy parking structure, nervously handing over evidence of Morrison's operation.",
            "mood": "tense, paranoid",
            "int_ext": "INT",
            "time_of_day": "NIGHT"
          }
        ],
        "edges": [
          {
            "type": "REALIZED_BY",
            "source": "plotpoint_catalyst_1",
            "target": "scene_new_1"
          },
          {
            "type": "HAS_CHARACTER",
            "source": "scene_new_1",
            "target": "char_cain"
          },
          {
            "type": "HAS_CHARACTER",
            "source": "scene_new_1",
            "target": "char_new_informant"
          },
          {
            "type": "LOCATED_AT",
            "source": "scene_new_1",
            "target": "loc_new_garage"
          }
        ]
      },
      "supporting": {
        "characters": [
          {
            "id": "char_new_informant",
            "type": "Character",
            "name": "Nervous Eddie",
            "description": "Low-level dealer who saw too much"
          }
        ],
        "locations": [
          {
            "id": "loc_new_garage",
            "type": "Location",
            "name": "Downtown Parking Structure",
            "description": "Concrete levels of shadow, flickering fluorescents, echoing footsteps"
          }
        ],
        "objects": [
          {
            "id": "obj_new_1",
            "type": "Object",
            "name": "Burner Phone",
            "description": "Contains photos of Morrison meeting with known criminals"
          }
        ],
        "edges": [
          {
            "type": "FEATURES_OBJECT",
            "source": "scene_new_1",
            "target": "obj_new_1"
          }
        ]
      }
    }
  ],
  "validatedBeats": [
    { "plotPointId": "plotpoint_catalyst_1", "title": "The Informant's Warning", "alignedTo": "Catalyst" },
    { "plotPointId": "plotpoint_midpoint_1", "title": "Morrison Exposed", "alignedTo": "Midpoint" }
  ],
  "rejectedBeats": []
}
```

---

## 6. Expand Endpoint

### 6.1 Purpose

Develop any existing node or Story Context with more detail and optional related content. This is the general-purpose "tell me more" endpoint.

### 6.2 Endpoint
```
POST /stories/:storyId/propose/expand
6.3 Request Schema
typescriptinterface ProposeExpandRequest extends CommonGenerationParams {
  // What to expand
  target: ExpandTarget;
  
  // Depth of expansion
  depth?: 'surface' | 'deep';  // default: 'deep'
  
  // Output limits
  maxNodesPerPackage?: number;  // default: 5, max: 10
}

type ExpandTarget = 
  | { type: 'node'; nodeId: string }      // Expand a specific node
  | { type: 'story-context' }              // Expand Story Context
  | { type: 'story-context-section'; section: ContextSection };  // Expand specific section

type ContextSection = 'themes' | 'conflicts' | 'motifs' | 'tone' | 'constraints';
6.4 Response Schema
typescriptinterface ProposeExpandResponse {
  sessionId: string;
  packages: NarrativePackage[];
  
  // Info about what was expanded
  expandedTarget: {
    type: 'node' | 'story-context';
    nodeId?: string;
    nodeType?: string;
    section?: ContextSection;
  };
}
6.5 Behavior by Target Type
When target is a Character node:
Constrained output:

Enriched description
Additional backstory details
Arc refinements (if arc exists)

Flexible output (adds):

Related PlotPoint hints ("This character could drive...")
Locations associated with character
Relationships to other characters

When target is a PlotPoint node:
Constrained output:

Enriched summary
Stakes clarification
Intent refinement

Flexible output (adds):

Scene ideas that could satisfy the beat
Characters involved
Location suggestions

When target is a Scene node:
Constrained output:

Enriched scene_overview
Mood and atmosphere details
Beat-by-beat breakdown within scene

Flexible output (adds):

New characters for the scene
Objects/props
Location enrichment

When target is a Location node:
Constrained output:

Enriched description
Atmosphere details
Sensory information

Flexible output (adds):

Scenes that could be set here
Objects present in location
Characters associated with location

When target is Story Context:
Constrained output:

Additional themes, conflicts, motifs
Refined tone description
New constraints/guidelines

Flexible output (adds):

Character concepts that embody themes
PlotPoint hints that could explore conflicts
Stashed ideas for development

6.6 Example Request - Expand Character
bashcurl -X POST http://localhost:3000/stories/my-story/propose/expand \\
  -H 'Content-Type: application/json' \\
  -d '{
    "target": { "type": "node", "nodeId": "char_cain" },
    "expansionScope": "flexible",
    "depth": "deep",
    "direction": "Explore his past and what drives him"
  }'
6.7 Example Request - Expand Story Context
bashcurl -X POST http://localhost:3000/stories/my-story/propose/expand \\
  -H 'Content-Type: application/json' \\
  -d '{
    "target": { "type": "story-context-section", "section": "themes" },
    "expansionScope": "flexible",
    "direction": "Explore the theme of loyalty and betrayal"
  }'
6.8 Example Response - Expand Story Context
json{
  "sessionId": "session_jkl012",
  "packages": [
    {
      "id": "pkg_1",
      "title": "Loyalty as Currency",
      "summary": "Exploring how loyalty operates in the criminal underworld",
      "primary": {
        "type": "Mixed",
        "nodes": [],
        "edges": []
      },
      "suggestions": {
        "contextAdditions": [
          {
            "id": "ctx_1",
            "section": "themes",
            "content": "Loyalty as transaction - everyone has a price, the question is what",
            "action": "append"
          },
          {
            "id": "ctx_2",
            "section": "themes", 
            "content": "The weight of old debts - favors owed can become chains",
            "action": "append"
          },
          {
            "id": "ctx_3",
            "section": "conflicts",
            "content": "Cain's loyalty to the old code vs. self-preservation",
            "action": "append"
          },
          {
            "id": "ctx_4",
            "section": "motifs",
            "content": "Handshakes and broken promises - agreements made and violated",
            "action": "append"
          }
        ],
        "stashedIdeas": [
          {
            "id": "idea_1",
            "content": "Cain once let someone go who he should have killed - this comes back",
            "category": "plot"
          },
          {
            "id": "idea_2", 
            "content": "A loyalty test scene where Cain must choose between Rigo and self-interest",
            "category": "scene"
          }
        ]
      },
      "supporting": {
        "characters": [
          {
            "id": "char_hint_1",
            "type": "Character",
            "name": "Ghost from the Past",
            "description": "Someone Cain showed mercy to years ago - now returns as either ally or threat"
          }
        ],
        "plotPoints": [
          {
            "id": "beat_hint_1",
            "type": "PlotPointHint",
            "title": "The Loyalty Test",
            "suggestedBeat": "All Is Lost",
            "description": "Cain must choose: betray Rigo to save himself, or go down with the ship"
          }
        ],
        "edges": []
      }
    }
  ],
  "expandedTarget": {
    "type": "story-context",
    "section": "themes"
  }
}
```

---

## 7. Shared Behaviors

### 7.1 Session Management

All endpoints create a proposal session that can be managed with existing endpoints:

- **View active proposal**: `GET /stories/:id/propose/active`
- **Commit a package**: `POST /stories/:id/propose/commit`
- **Discard session**: `DELETE /stories/:id/propose/active`

### 7.2 Package Operations

Before committing, users can modify packages:

- **Edit node**: Modify any node's fields within the package
- **Remove node**: Mark a node for exclusion from commit
- **Remove suggestion**: Dismiss a context addition or stashed idea

### 7.3 Suggestion Handling

Context additions and stashed ideas are handled specially:

**Context Additions:**
- When package is committed, context additions are appended to Story Context
- Each addition goes to its specified section
- User can dismiss individual additions before commit

**Stashed Ideas:**
- When package is committed, stashed ideas go to an Ideas collection
- Ideas are stored separately from the main graph
- Users can later promote ideas to real nodes or delete them

### 7.4 Validation

All endpoints validate:

1. Story exists and is accessible
2. Referenced node IDs exist (for expand, scenes)
3. Committed status where required (scenes endpoint)
4. Node types match expected types

---

## 8. UI Integration

### 8.1 Generation Panel Structure
```
┌─────────────────────────────────────────────────────────────────┐
│ AI GENERATION                                              [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ MODE                                                            │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│ │📋 Story   │ │👤 Chars   │ │🎬 Scenes  │ │🔍 Expand  │        │
│ │  Beats    │ │           │ │           │ │           │        │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
│                                                                 │
│ SCOPE                                                           │
│ ○ Constrained - Primary output only, use existing elements      │
│ ● Flexible - May introduce new characters, locations, ideas     │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ [MODE-SPECIFIC OPTIONS - see below]                             │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ DIRECTION (optional)                                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Additional guidance for the AI...                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Advanced Options                                            [+] │
│                                                                 │
│                                              [Generate]         │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Mode-Specific Options

#### Plot Points Mode
```
FOCUS
○ All missing beats
○ Specific act: [Act 1 - Setup                              ▼]
○ Priority beats:
  ☐ Opening Image    ☐ Theme Stated    ☑ Catalyst
  ☐ Break Into Two   ☐ B Story         ☐ Fun & Games
  ☐ Midpoint         ☐ Bad Guys Close In ☑ All Is Lost
  ☐ Dark Night       ☐ Break Into Three ☐ Finale
  ☐ Final Image
```

#### Characters Mode
```
FOCUS
○ Develop existing: [Select character...                    ▼]
○ New protagonist
○ New antagonist
○ New supporting cast
○ Fill character gaps (scenes without characters)

☑ Include character arcs
```

#### Scenes Mode
```
SELECT PLOT POINTS TO DEVELOP
(Only committed plot points shown)

☑ "The Informant's Warning" (Catalyst) - 0 scenes
☑ "Morrison Exposed" (Midpoint) - 0 scenes  
☐ "Cain's Choice" (All Is Lost) - 1 scene

Scenes per beat: [1                                         ▼]
```

#### Expand Mode
```
EXPAND TARGET
○ Story Context
  ○ All sections
  ○ Themes
  ○ Conflicts
  ○ Motifs
  ○ Tone
  ○ Constraints
○ Selected node: [Click a node in the Story Bible]
  Current: (none selected)

DEPTH
○ Surface - Enrich description only
● Deep - Explore connections and implications
```

### 8.3 Package Review UI
```
┌─────────────────────────────────────────────────────────────────┐
│ Package: "The Betrayal Unfolds"                                 │
│ Cain discovers the conspiracy through an unlikely source        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PRIMARY: PLOT POINTS                                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑ "The Informant's Warning" → Catalyst                      │ │
│ │   A mysterious figure approaches Cain with evidence...      │ │
│ │                                           [Edit] [Remove]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ SUPPORTING ELEMENTS                              [Show/Hide ▼]  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 👤 NEW CHARACTER                                            │ │
│ │ ☑ "The Informant" - A nervous low-level dealer...          │ │
│ │                                           [Edit] [Remove]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ SUGGESTIONS                                      [Show/Hide ▼]  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📝 ADD TO STORY CONTEXT → Themes                            │ │
│ │ "Information as currency - who knows what determines power" │ │
│ │                                  [Keep] [Dismiss]           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💡 STASH FOR LATER                                          │ │
│ │ "The Informant could have a personal grudge against..."     │ │
│ │                                  [Keep] [Dismiss]           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                   [Reject] [Accept Package]     │
└─────────────────────────────────────────────────────────────────┘
8.4 Context-Aware Generation
When user has selected a node in the Story Bible:

Generation Panel detects selection
Expand mode auto-selects with that node as target
Shows: "Expand: [Node Name]"
User can override or proceed

When user clicks empty beat in Structure:

Generation Panel could auto-switch to Plot Points mode
Pre-select that beat as priority
Or show inline "Generate plot point" button on the empty beat card


9. Ideas/Stash Feature
9.1 Data Model
typescriptinterface StashedIdea {
  id: string;
  storyId: string;
  content: string;
  category: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
  relatedNodeIds?: string[];
  sourcePackageId?: string;  // Which package created this
  createdAt: string;
  status: 'active' | 'promoted' | 'dismissed';
}
```

### 9.2 API Endpoints
```
GET /stories/:id/ideas              // List all stashed ideas
POST /stories/:id/ideas             // Manually create an idea
PATCH /stories/:id/ideas/:ideaId    // Update idea status
DELETE /stories/:id/ideas/:ideaId   // Remove idea
```

### 9.3 UI Location

In the Story Bible left nav:
```
STORY BIBLE
├── Premise ✓
├── Elements
├── Structure
│   ├── Act 1
│   └── ...
├── Context
└── Ideas (3)        ← Stashed ideas bucket

10. Migration Path
Phase 1: Plot Points Endpoint (Already Exists)

Endpoint: /propose/plot-points ✓
Add expansionScope parameter
Add supporting nodes output
Add suggestions output

Phase 2: Characters Endpoint

New endpoint: /propose/characters
Implement all focus types
Add arc generation

Phase 3: Scenes Endpoint

New endpoint: /propose/scenes
Implement committed-only validation
Add supporting elements

Phase 4: Expand Endpoint

New endpoint: /propose/expand
Implement all target types
Story Context expansion

Phase 5: UI Integration

Update Generation Panel with mode selector
Add mode-specific options
Update package review UI
Implement Ideas section

Phase 6: Deprecation

Mark generic /propose as deprecated
Remove "Auto (AI decides)" from UI
Eventually remove generic endpoint


11. Open Questions for Implementation

Hint vs. Real Node: When Characters mode produces plot point "hints," should these be actual PlotPoint nodes marked as suggestions, or a separate lighter-weight data structure?
Stashed Ideas Storage: Should ideas be stored in the graph as a special node type, or in a separate collection?
Context Additions Format: Should context additions be stored as pending operations until commit, or immediately previewed in the Story Context UI?
Selection Sync: How does node selection in Story Bible communicate with the Generation Panel? Event bus? Shared state?
Scenes Endpoint - Multiple Beats: If user selects multiple plot points, should scenes be grouped by beat in the package, or mixed?

