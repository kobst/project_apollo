Generation Panel UI Specification
Update to Support Four-Mode System with Expansion Scope

1. Overview
This specification describes the UI changes needed to update the Generation Panel to support the new four-mode generation system (Story Beats, Characters, Scenes, Expand) with the expansion scope parameter (Constrained/Flexible).
Current State
The existing Generation Panel has:

Three modes: Add, Expand, Explore
Entry Point dropdown (Auto, Beat, Gap, Character, etc.)
Direction text area
Advanced Options (Creativity slider, Package Options)
Generate Proposals button
Saved Packages section

Target State
The updated Generation Panel will have:

Four modes: Story Beats, Characters, Scenes, Expand
Expansion Scope toggle (Constrained/Flexible)
Mode-specific options (replacing Entry Point)
Direction text area (unchanged)
Advanced Options (unchanged)
Generate button
Saved Packages section (unchanged)
Updated package review UI with Primary/Supporting/Suggestions sections


2. Component Structure
2.1 File Structure
src/components/generation/
├── GenerationPanel.tsx           # Main container (update)
├── ModeSelector.tsx              # NEW: Four-mode tab selector
├── ExpansionScopeToggle.tsx      # NEW: Constrained/Flexible toggle
├── mode-options/
│   ├── StoryBeatsOptions.tsx     # NEW: Story beats mode options
│   ├── CharactersOptions.tsx     # NEW: Characters mode options
│   ├── ScenesOptions.tsx         # NEW: Scenes mode options
│   └── ExpandOptions.tsx         # NEW: Expand mode options
├── PackageReview.tsx             # Update for new package structure
├── PackageCard.tsx               # Update for Primary/Supporting/Suggestions
├── SuggestionCard.tsx            # NEW: For context additions and stashed ideas
└── hooks/
    ├── useGenerationMode.ts      # NEW: Mode state management
    └── useGenerationApi.ts       # Update for new endpoints
2.2 State Management
typescriptinterface GenerationState {
  // Mode selection
  mode: 'story-beats' | 'characters' | 'scenes' | 'expand';
  expansionScope: 'constrained' | 'flexible';
  
  // Mode-specific options
  storyBeatsOptions: {
    focusType: 'all' | 'act' | 'beats';
    targetAct?: 1 | 2 | 3 | 4 | 5;
    priorityBeats: string[];  // Beat types or IDs
    maxPerPackage: number;
  };
  
  charactersOptions: {
    focus: 'develop_existing' | 'new_protagonist' | 'new_antagonist' | 'new_supporting' | 'fill_gaps';
    characterId?: string;  // For develop_existing
    includeArcs: boolean;
    maxPerPackage: number;
  };
  
  scenesOptions: {
    storyBeatIds: string[];  // Selected committed story beats
    scenesPerBeat: number;
    maxPerPackage: number;
  };
  
  expandOptions: {
    targetType: 'node' | 'story-context' | 'story-context-section';
    nodeId?: string;
    contextSection?: 'themes' | 'conflicts' | 'motifs' | 'tone' | 'constraints';
    depth: 'surface' | 'deep';
  };
  
  // Common options
  direction: string;
  creativity: number;
  packageCount: number;
  
  // Generation state
  isGenerating: boolean;
  activeSession?: ProposalSession;
  error?: string;
}
```

---

## 3. Generation Panel Layout

### 3.1 Overall Structure
```
┌─────────────────────────────────────────────────────────────────┐
│ AI GENERATION                                              [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                      MODE SELECTOR                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                   EXPANSION SCOPE TOGGLE                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │                   MODE-SPECIFIC OPTIONS                     │ │
│ │                   (varies by mode)                          │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                      DIRECTION INPUT                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    ADVANCED OPTIONS                     [+] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    [Generate Button]                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    SAVED PACKAGES                       [▶] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Detailed Wireframe
```
┌─────────────────────────────────────────────────────────────────┐
│ AI GENERATION                                              [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ MODE                                                            │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│ │ 📋 Story  │ │ 👤 Chars  │ │ 🎬 Scenes │ │ 🔍 Expand │        │
│ │   Beats   │ │           │ │           │ │           │        │
│ │  ●        │ │           │ │           │ │           │        │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
│                                                                 │
│ SCOPE                                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ Constrained    ● Flexible                                 │ │
│ │   Primary only     + Characters, Locations, Ideas           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ [MODE OPTIONS AREA - CONTENT VARIES]                            │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ DIRECTION                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Additional guidance for the AI...                           │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Advanced Options                                            [+] │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                      Generate                               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Saved Packages (6)                                          [▶] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Mode Selector Component

### 4.1 Design

Four horizontally arranged cards/tabs, one for each mode:
```
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ 📋 Story  │ │ 👤 Chars  │ │ 🎬 Scenes │ │ 🔍 Expand │
│   Beats   │ │           │ │           │ │           │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
4.2 Props
typescriptinterface ModeSelectorProps {
  value: GenerationMode;
  onChange: (mode: GenerationMode) => void;
  disabled?: boolean;
}

type GenerationMode = 'story-beats' | 'characters' | 'scenes' | 'expand';
```

### 4.3 Visual States

| State | Appearance |
|-------|------------|
| Default | Dark background, muted text |
| Hover | Slightly lighter background |
| Selected | Accent border (blue), highlighted text, filled indicator dot |
| Disabled | Grayed out, no hover effect |

### 4.4 Mode Labels and Icons

| Mode | Icon | Label | Sublabel (optional) |
|------|------|-------|---------------------|
| story-beats | 📋 | Story Beats | Fill structure |
| characters | 👤 | Characters | Develop cast |
| scenes | 🎬 | Scenes | Create scenes |
| expand | 🔍 | Expand | Develop ideas |

---

## 5. Expansion Scope Toggle

### 5.1 Design

A segmented toggle or radio group:
```
┌─────────────────────────────────────────────────────────────────┐
│ ○ Constrained              ● Flexible                          │
│   Primary output only        + New characters, locations, ideas │
└─────────────────────────────────────────────────────────────────┘
5.2 Props
typescriptinterface ExpansionScopeToggleProps {
  value: 'constrained' | 'flexible';
  onChange: (scope: 'constrained' | 'flexible') => void;
  mode: GenerationMode;  // To customize description text
}
```

### 5.3 Dynamic Description Text

The sublabel changes based on the selected mode:

| Mode | Constrained Description | Flexible Description |
|------|------------------------|---------------------|
| story-beats | Story beats only | + Characters, Locations, Ideas |
| characters | Character details only | + Story beat hints, Locations |
| scenes | Scenes only | + Characters, Locations, Objects |
| expand | Enrich selected only | + Related nodes and ideas |

---

## 6. Mode-Specific Options

### 6.1 Story Beats Options
```
FOCUS
○ All missing beats
○ Specific act:
  ┌────────────────────────────────────────────────────────────┐
  │ Act 1 - Setup                                           ▼ │
  └────────────────────────────────────────────────────────────┘
○ Priority beats:
  ┌────────────────────────────────────────────────────────────┐
  │ Act 1                                                      │
  │ ☐ Opening Image    ☐ Theme Stated    ☑ Catalyst           │
  │ ☐ Debate                                                   │
  ├────────────────────────────────────────────────────────────┤
  │ Act 2                                                      │
  │ ☐ Break Into Two   ☐ B Story         ☐ Fun & Games        │
  ├────────────────────────────────────────────────────────────┤
  │ Act 3                                                      │
  │ ☐ Midpoint         ☐ Bad Guys Close In                    │
  ├────────────────────────────────────────────────────────────┤
  │ Act 4                                                      │
  │ ☐ All Is Lost      ☐ Dark Night Of Soul                   │
  ├────────────────────────────────────────────────────────────┤
  │ Act 5                                                      │
  │ ☐ Break Into Three ☐ Finale          ☐ Final Image        │
  └────────────────────────────────────────────────────────────┘
Props
typescriptinterface StoryBeatsOptionsProps {
  value: StoryBeatsOptionsState;
  onChange: (options: StoryBeatsOptionsState) => void;
  missingBeats: MissingBeatInfo[];  // From API or computed
}

interface StoryBeatsOptionsState {
  focusType: 'all' | 'act' | 'beats';
  targetAct?: 1 | 2 | 3 | 4 | 5;
  priorityBeats: string[];
}
```

#### Beat Checkbox Visual State

| State | Appearance |
|-------|------------|
| Unchecked, has story beat | Normal checkbox, normal text |
| Unchecked, missing story beat | Normal checkbox, text with warning indicator (orange dot) |
| Checked | Filled checkbox, highlighted text |

### 6.2 Characters Options
```
FOCUS
○ Develop existing character:
  ┌────────────────────────────────────────────────────────────┐
  │ Select character...                                     ▼ │
  └────────────────────────────────────────────────────────────┘
○ New protagonist
○ New antagonist
○ New supporting cast
○ Fill character gaps

☑ Include character arcs
Props
typescriptinterface CharactersOptionsProps {
  value: CharactersOptionsState;
  onChange: (options: CharactersOptionsState) => void;
  existingCharacters: CharacterSummary[];  // For dropdown
  scenesWithoutCharacters: number;  // For "fill gaps" description
}

interface CharactersOptionsState {
  focus: CharacterFocus;
  characterId?: string;
  includeArcs: boolean;
}

type CharacterFocus = 
  | 'develop_existing'
  | 'new_protagonist'
  | 'new_antagonist'
  | 'new_supporting'
  | 'fill_gaps';
```

#### Character Dropdown

When "Develop existing character" is selected, show a searchable dropdown with existing characters:
```
┌────────────────────────────────────────────────────────────┐
│ 🔍 Search characters...                                    │
├────────────────────────────────────────────────────────────┤
│ 👤 Cain - Reluctant Hero (3 scenes)                        │
│ 👤 Rigo - The Employer (2 scenes)                          │
│ 👤 Captain Morrison - Corrupt Authority (1 scene)          │
│ 👤 Sergeant Flores - (1 scene)                             │
│ 👤 Dante "D" Alvarado - (1 scene)                          │
└────────────────────────────────────────────────────────────┘
```

### 6.3 Scenes Options
```
SELECT STORY BEATS TO DEVELOP

(Only showing committed story beats)

┌────────────────────────────────────────────────────────────┐
│ ☑ "Rigo seeks help and finds Cain"                         │
│   Setup • 1 scene exists                                   │
├────────────────────────────────────────────────────────────┤
│ ☑ "Rigo decides to return to Cain"                         │
│   Setup • 1 scene exists                                   │
├────────────────────────────────────────────────────────────┤
│ ☐ "Kane's violent introduction"                            │
│   Fun & Games • 0 scenes                                   │
├────────────────────────────────────────────────────────────┤
│ ☐ "Cain meets Dante for a lead"                            │
│   Fun & Games • 1 scene exists                             │
└────────────────────────────────────────────────────────────┘

Scenes per beat: [1 ▼]

⚠ No committed story beats available
   Generate and commit story beats first to create scenes.
Props
typescriptinterface ScenesOptionsProps {
  value: ScenesOptionsState;
  onChange: (options: ScenesOptionsState) => void;
  committedStoryBeats: CommittedStoryBeatInfo[];
}

interface ScenesOptionsState {
  storyBeatIds: string[];
  scenesPerBeat: number;
}

interface CommittedStoryBeatInfo {
  id: string;
  title: string;
  alignedBeat: string;  // e.g., "Setup", "Catalyst"
  existingSceneCount: number;
}
```

#### Empty State

If no committed story beats exist, show a message:
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ⚠ No committed story beats available                     │
│                                                            │
│  Generate and commit story beats first to create scenes.   │
│                                                            │
│                    [Go to Story Beats Mode]                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 6.4 Expand Options
```
EXPAND TARGET

○ Story Context
  ○ All sections
  ○ Themes only
  ○ Conflicts only
  ○ Motifs only
  ○ Tone only
  ○ Constraints only

○ Selected node
  ┌────────────────────────────────────────────────────────────┐
  │ Click a node in the Story Bible to select it               │
  │                                                            │
  │ Currently selected: (none)                                 │
  └────────────────────────────────────────────────────────────┘

DEPTH
○ Surface - Enrich description only
● Deep - Explore connections and implications
Props
typescriptinterface ExpandOptionsProps {
  value: ExpandOptionsState;
  onChange: (options: ExpandOptionsState) => void;
  selectedNode?: SelectedNodeInfo;  // From workspace selection
}

interface ExpandOptionsState {
  targetType: 'story-context' | 'story-context-section' | 'node';
  contextSection?: ContextSection;
  nodeId?: string;
  depth: 'surface' | 'deep';
}

type ContextSection = 'themes' | 'conflicts' | 'motifs' | 'tone' | 'constraints';

interface SelectedNodeInfo {
  id: string;
  type: string;
  label: string;
}
```

#### Selection Integration

When user clicks on a node in the Story Bible:

1. Fire a selection event with node info
2. Generation Panel receives the event
3. If in Expand mode, auto-populate the selected node
4. Show: "Currently selected: [Character] Cain"
```
○ Selected node
  ┌────────────────────────────────────────────────────────────┐
  │ 👤 Cain                                          [Clear ×] │
  │ Character • Reluctant Hero                                 │
  └────────────────────────────────────────────────────────────┘
```

---

## 7. Advanced Options

Keep existing Advanced Options section, but add package count control:
```
Advanced Options                                              [−]
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│ Creativity                                            Balanced  │
│ ○────────────────────────●────────────────────────○            │
│ Conservative                                        Inventive   │
│                                                                 │
│ Packages to generate                                        3   │
│ ○──────────●──────────────────────────────────────○            │
│ 1                                                          10   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Package Review UI

### 8.1 Package List View

When generation completes, show list of packages:
```
┌─────────────────────────────────────────────────────────────────┐
│ AI GENERATION                                              [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 3 Packages Generated                           [← Back to Form] │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Package 1: "The Betrayal Unfolds"                       [▶] │ │
│ │ 2 story beats • 1 character • 2 suggestions                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Package 2: "The Conspiracy Deepens"                     [▶] │ │
│ │ 3 story beats • 1 suggestion                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Package 3: "Seeds of Doubt"                             [▶] │ │
│ │ 2 story beats • 2 characters • 3 suggestions                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                              [Discard Session]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Package Detail View

When user expands a package:
```
┌─────────────────────────────────────────────────────────────────┐
│ Package: "The Betrayal Unfolds"                    [← Back]     │
│ Cain discovers the conspiracy through an unlikely source        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PRIMARY: STORY BEATS (2)                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑ "The Informant's Warning"                                 │ │
│ │   → Catalyst                                                │ │
│ │   A mysterious figure approaches Cain with evidence of      │ │
│ │   Morrison's corruption                                     │ │
│ │                                          [Edit] [Remove]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑ "Cain Confronts Rigo"                                     │ │
│ │   → Midpoint                                                │ │
│ │   Cain demands answers about what Rigo really knows         │ │
│ │                                          [Edit] [Remove]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ SUPPORTING (1)                                   [Show/Hide ▼]  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 👤 NEW CHARACTER                                            │ │
│ │ ☑ "The Informant"                                          │ │
│ │   A nervous low-level dealer who witnessed Morrison's crew  │ │
│ │                                          [Edit] [Remove]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ SUGGESTIONS (2)                                  [Show/Hide ▼]  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📝 STORY CONTEXT → Themes                                   │ │
│ │ "Information as currency - who knows what determines power" │ │
│ │                                      [Include] [Dismiss]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💡 IDEA                                                     │ │
│ │ "The Informant could have a personal grudge - maybe         │ │
│ │  Morrison killed his brother?"                              │ │
│ │                                      [Include] [Dismiss]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                         [Reject Package] [Accept Package]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
8.3 Package Card Component
typescriptinterface PackageCardProps {
  package: NarrativePackage;
  onEdit: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  onIncludeSuggestion: (suggestionId: string) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onAccept: () => void;
  onReject: () => void;
}
```

### 8.4 Section Headers

Each section (Primary, Supporting, Suggestions) has a header with count and collapse toggle:
```
PRIMARY: STORY BEATS (2)                                          
SUPPORTING (1)                                     [Show/Hide ▼]  
SUGGESTIONS (2)                                    [Show/Hide ▼]  
```

Supporting and Suggestions sections are collapsible. Default state:
- Supporting: Expanded if present
- Suggestions: Collapsed

### 8.5 Node Item States

| State | Visual |
|-------|--------|
| Included | ☑ Checkbox checked, normal styling |
| Removed | ☐ Checkbox unchecked, strikethrough text, grayed |
| Editing | Inline edit form replaces card content |

### 8.6 Suggestion Item Actions

| Action | Result |
|--------|--------|
| Include | Mark suggestion to be committed with package |
| Dismiss | Remove suggestion from package (won't be committed) |

Default state: Included (suggestions are opt-out)

---

## 9. Ideas Section in Story Bible

### 9.1 Left Nav Addition

Add "Ideas" section to the Story Bible navigation:
```
STORY BIBLE
├── Premise ✓
├── Elements
│   └── ...
├── Structure
│   └── ...
├── Context ✓
└── Ideas (3)        ← NEW
```

### 9.2 Ideas Section View

When user clicks "Ideas" in nav:
```
┌─────────────────────────────────────────────────────────────────┐
│ 💡 IDEAS                                            [+ Add Idea]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Stashed ideas from AI generation and manual notes               │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💡 CHARACTER IDEA                                           │ │
│ │ "The Informant could have a personal grudge against         │ │
│ │  Morrison - maybe he killed his brother?"                   │ │
│ │                                                             │ │
│ │ Related: The Informant                                      │ │
│ │ Added: 2 hours ago                                          │ │
│ │                                    [Develop] [Delete]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💡 PLOT IDEA                                                │ │
│ │ "Consider a B-story romance between Cain and a reporter     │ │
│ │  investigating the same corruption"                         │ │
│ │                                                             │ │
│ │ Added: 1 day ago                                            │ │
│ │                                    [Develop] [Delete]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💡 SCENE IDEA                                               │ │
│ │ "A tense scene where Cain and Morrison almost cross paths   │ │
│ │  at a charity event"                                        │ │
│ │                                                             │ │
│ │ Added: 2 days ago                                           │ │
│ │                                    [Develop] [Delete]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Idea Actions

| Action | Result |
|--------|--------|
| Develop | Opens Generation Panel in Expand mode with this idea as direction |
| Delete | Removes idea (with confirmation) |
| + Add Idea | Opens inline form to manually add an idea |

---

## 10. Context-Aware Generation Triggers

### 10.1 Empty Beat Card

When viewing an empty beat in Structure, the beat card includes a generation button:
```
┌─────────────────────────────────────────────────────────────────┐
│ Opening Image                                               [×] │
│ The opening snapshot that sets tone and stakes.                 │
│                                                                 │
│ No story beats aligned to this beat yet.                        │
│                                                                 │
│ [+ Add Story Beat]    [🤖 Generate Story Beat]                  │
└─────────────────────────────────────────────────────────────────┘
Clicking "Generate Story Beat":

Opens Generation Panel (if not already open)
Sets mode to "Story Beats"
Sets focus to "Priority beats" with this beat pre-selected

10.2 Node Selection
When user clicks on a node card (Character, StoryBeat, Scene, etc.):

Node becomes "selected" (visual highlight)
If Generation Panel is open in Expand mode, show the node as selected target
Panel updates: "Currently selected: [Character] Cain"

10.3 Story Context Section
When user is viewing the Context section:

Generation Panel could show a contextual hint: "Tip: Use Expand mode to develop themes and conflicts"
Or add an inline button: [🤖 Generate Context Ideas]


11. API Integration
11.1 Endpoint Mapping
ModeEndpointstory-beatsPOST /stories/:id/propose/story-beatscharactersPOST /stories/:id/propose/charactersscenesPOST /stories/:id/propose/scenesexpandPOST /stories/:id/propose/expand
11.2 Request Building
typescriptfunction buildRequest(state: GenerationState): GenerationRequest {
  const common = {
    expansionScope: state.expansionScope,
    direction: state.direction || undefined,
    packageCount: state.packageCount,
    creativity: state.creativity,
  };

  switch (state.mode) {
    case 'story-beats':
      return {
        ...common,
        priorityBeats: state.storyBeatsOptions.focusType === 'beats' 
          ? state.storyBeatsOptions.priorityBeats 
          : undefined,
        targetAct: state.storyBeatsOptions.focusType === 'act'
          ? state.storyBeatsOptions.targetAct
          : undefined,
        maxStoryBeatsPerPackage: state.storyBeatsOptions.maxPerPackage,
      };
    
    case 'characters':
      return {
        ...common,
        focus: state.charactersOptions.focus,
        characterId: state.charactersOptions.characterId,
        includeArcs: state.charactersOptions.includeArcs,
        maxCharactersPerPackage: state.charactersOptions.maxPerPackage,
      };
    
    case 'scenes':
      return {
        ...common,
        storyBeatIds: state.scenesOptions.storyBeatIds,
        scenesPerBeat: state.scenesOptions.scenesPerBeat,
        maxScenesPerPackage: state.scenesOptions.maxPerPackage,
      };
    
    case 'expand':
      return {
        ...common,
        target: buildExpandTarget(state.expandOptions),
        depth: state.expandOptions.depth,
      };
  }
}

function buildExpandTarget(options: ExpandOptionsState): ExpandTarget {
  if (options.targetType === 'node') {
    return { type: 'node', nodeId: options.nodeId! };
  }
  if (options.targetType === 'story-context-section') {
    return { type: 'story-context-section', section: options.contextSection! };
  }
  return { type: 'story-context' };
}
11.3 Response Handling
typescriptinterface GenerationApiHook {
  generate: (state: GenerationState) => Promise<void>;
  commitPackage: (packageId: string, modifications: PackageModifications) => Promise<void>;
  rejectPackage: (packageId: string) => Promise<void>;
  discardSession: () => Promise<void>;
  
  isGenerating: boolean;
  session: ProposalSession | null;
  error: string | null;
}

interface PackageModifications {
  removedNodeIds: string[];
  editedNodes: { id: string; changes: Partial<Node> }[];
  includedSuggestionIds: string[];
  dismissedSuggestionIds: string[];
}
```

---

## 12. Validation and Error States

### 12.1 Mode-Specific Validation

**Story Beats:**
- No validation required (can always generate)

**Characters:**
- If focus is "develop_existing", characterId must be selected
- Show: "Select a character to develop"

**Scenes:**
- At least one story beat must be selected
- Show: "Select at least one story beat"
- If no committed story beats exist, show empty state with guidance

**Expand:**
- If target is "node", nodeId must be selected
- Show: "Select a node in the Story Bible to expand"

### 12.2 Generate Button States

| State | Appearance | Enabled |
|-------|------------|---------|
| Ready | "Generate" | Yes |
| Validation Error | "Generate" (with tooltip showing error) | No |
| Generating | "Generating..." with spinner | No |
| Error | "Generate" (error toast shown) | Yes |

### 12.3 Error Display

Show errors as toast notifications or inline messages:
```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠ Generation failed                                       [×]  │
│ Failed to connect to generation service. Please try again.     │
└─────────────────────────────────────────────────────────────────┘

13. Accessibility
13.1 Keyboard Navigation

Tab through mode selector, scope toggle, options, direction, buttons
Arrow keys to navigate within mode selector
Enter to select/toggle
Escape to close panel or cancel edit

13.2 Screen Reader Support

Mode buttons have aria-label: "Story Beats mode - Fill in narrative structure"
Scope toggle has aria-describedby linking to description text
Package items have aria-expanded for collapsible sections

13.3 Focus Management

After generation completes, focus moves to first package
After accepting/rejecting package, focus moves to next package or back to form
After closing edit modal, focus returns to edit button


14. Implementation Phases
Phase 1: Core Mode Selector and Scope Toggle

Create ModeSelector component
Create ExpansionScopeToggle component
Update GenerationPanel to use new components
Remove old Entry Point dropdown

Phase 2: Mode-Specific Options

Create StoryBeatsOptions component
Create CharactersOptions component
Create ScenesOptions component
Create ExpandOptions component
Wire up conditional rendering based on mode

Phase 3: API Integration

Update useGenerationApi hook for new endpoints
Implement request building for each mode
Handle new response structure

Phase 4: Package Review UI

Update PackageCard for Primary/Supporting/Suggestions sections
Create SuggestionCard component
Implement edit/remove/include/dismiss actions

Phase 5: Ideas Section

Add Ideas to Story Bible navigation
Create Ideas section view
Implement Develop and Delete actions
Wire up stashed ideas from package commits

Phase 6: Context-Aware Triggers

Add generation button to empty beat cards
Implement node selection sync with Generation Panel
Add contextual hints