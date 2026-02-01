# StoryBeat Abstraction Layer Specification

**Date:** 2026-02-01  
**Status:** Proposal  
**Author:** Esh (AI Assistant)  

---

## 1. Problem Statement

### 1.1 Current Architecture

The current three-tier structure is:

```
Beat (structural) → StoryBeat → Scene
```

Where:
- **Beat**: Pure structural abstraction (Save the Cat beats: OpeningImage, ThemeStated, etc.)
- **StoryBeat**: Supposed to be a plot/character/tone beat that realizes a Beat
- **Scene**: Concrete execution with heading, setting, action, dialogue

### 1.2 The Problem

**StoryBeats are inconsistently abstract.** Many are written as scene synopses rather than narrative functions:

| StoryBeat Title | Current Summary | Abstraction Level |
|-----------------|-----------------|-------------------|
| "Keys Code: No Badges, No Oaths" | "At his Keys body shop, Cain breaks up a petty shake-down when a uniformed officer leans on a local kid for 'protection' money. Cain refuses to get pulled in, but his words land: criminals at least keep their bargains; badges rewrite theirs." | **Scene-like** ❌ |
| "Dante sells Cain out to Morrison" | "Terrified and tempted, Dante tips Morrison to Cain's next move; Morrison's crew ambushes Cain..." | **Scene-like** ❌ |
| "Police involvement revealed" | "Cain realizes the thefts are being carried out by corrupt cops..." | **Properly abstract** ✅ |

**Consequences:**

1. **No room for Scene layer**: If the StoryBeat already describes the scene in detail, what's left for the Scene node?
2. **Hard to generate alternatives**: Can't generate multiple scene options for one narrative beat because the beat IS a specific scene
3. **LLM jumps too far**: Asking the LLM to go from "ThemeStated" (pure structure) to a detailed scene description (concrete execution) is a big leap
4. **Messy gap analysis**: "StoryBeat has no scenes" is meaningless when the StoryBeat description already contains the scene

### 1.3 User Workflow Impact

Writers think in steps:
1. **Structure**: "I need a ThemeStated beat in Act 1"
2. **Narrative function**: "It should establish the protagonist's moral code"
3. **Concrete execution**: "Maybe a scene where he refuses a bribe, or confronts corruption"

The current system forces them to jump from step 1 to step 3 immediately, skipping the critical middle layer.

---

## 2. Proposed Solution: Clean Abstraction Hierarchy

### 2.1 Core Principle

**StoryBeat = Narrative Intent (what/why)**  
**Scene = Concrete Execution (how)**

### 2.2 New Architecture

```
Beat (structural requirement)
  ↓ ALIGNS_WITH
StoryBeat (narrative function/intent)
  ↓ SATISFIED_BY
Scene (concrete execution)
  ↓ SATISFIED_BY (optional)
Scene (alternate execution)
```

### 2.3 Examples

#### Example 1: Theme Stated

**Beat:**
```
Type: Beat
Name: "ThemeStated"
Guidance: "Someone states the theme, often to the protagonist"
```

**StoryBeat (NEW - properly abstract):**
```
Type: StoryBeat
Title: "Establish Cain's Personal Code"
Summary: "Show that Cain lives by a personal honor system that values 
          keeping promises over institutional authority. He's skeptical 
          of badges but respects street-level agreements."
Narrative Function: "theme_establishment"
Intent: "tone"
```

**Scenes (multiple options):**
```
Scene A:
  Heading: "INT. CAIN'S BODY SHOP - DAY"
  Overview: "Cain breaks up a shakedown when a uniformed officer 
             leans on a local kid for protection money. His words: 
             criminals keep their bargains; badges rewrite theirs."

Scene B:
  Heading: "EXT. KEYS MARINA - DUSK"
  Overview: "A smuggler offers Cain a cut to look the other way. 
             Cain refuses money but agrees to forget what he saw—
             because they had a deal years ago and he honors it."
```

#### Example 2: All Is Lost

**Beat:**
```
Type: Beat
Name: "AllIsLost"
Guidance: "The lowest point; something or someone is lost"
```

**StoryBeat (NEW - properly abstract):**
```
Type: StoryBeat
Title: "Cain Loses Evidence and Freedom"
Summary: "Cain's investigation collapses when his evidence is seized 
          and he's arrested by the very people he was investigating. 
          His trust in anyone left in Miami evaporates."
Narrative Function: "reversal"
Intent: "plot"
Stakes Change: "Protagonist loses all leverage and allies"
```

**Scenes:**
```
Scene:
  Heading: "EXT. PARKING GARAGE ROOFTOP - NIGHT"
  Overview: "Cain arrives for a handoff. Instead, unmarked units swarm. 
             Dante watches from a stairwell as Morrison's team takes 
             Cain down. The evidence disappears into a badge-holder's 
             pocket."
  Key Actions:
    - Cain spots the setup too late and tries to bolt
    - Kane appears as the violent closer
    - The thumb drive disappears
    - Dante walks away to preserve his lifestyle
```

### 2.4 Abstraction Guidelines

**StoryBeat should:**
- ✅ Describe the narrative function or thematic purpose
- ✅ Identify what emotions, information, or stakes need to shift
- ✅ Allow for multiple concrete implementations
- ✅ Be setting-agnostic (no "INT. BODY SHOP" details)
- ✅ Focus on "what needs to happen narratively"

**StoryBeat should NOT:**
- ❌ Include specific locations (those go in Scene heading)
- ❌ Include dialogue or specific actions (those go in Scene key_actions)
- ❌ Be so specific that only one scene could satisfy it
- ❌ Read like a scene synopsis

**Scene should:**
- ✅ Have a concrete heading (INT/EXT, location, time)
- ✅ Specify who's present (HAS_CHARACTER edges)
- ✅ List key actions and beats
- ✅ Define mood, pacing, and tone
- ✅ Be filmable/stageable

---

## 3. Type & Schema Changes

### 3.1 StoryBeat Type (Updated)

```typescript
export interface StoryBeat extends Node {
  type: 'StoryBeat';
  id: string;
  
  /** Human-readable title (now more abstract) */
  title: string;
  
  /** 
   * Narrative function description.
   * Describes WHAT needs to happen thematically/plot-wise.
   * Should NOT include specific settings, dialogue, or scene details.
   * 
   * Examples:
   * - "Establish protagonist's moral code and worldview"
   * - "Reveal antagonist's true identity and motivation"
   * - "Force protagonist to sacrifice something dear"
   */
  summary: string;
  
  /** 
   * Narrative function category.
   * NEW field to help classify abstraction level.
   */
  narrative_function?: 
    | 'theme_establishment'
    | 'character_introduction'
    | 'character_development'
    | 'plot_revelation'
    | 'reversal'
    | 'escalation'
    | 'resolution'
    | 'tone_setter';
  
  /** Intent: plot, character, or tone */
  intent: 'plot' | 'character' | 'tone';
  
  /** Priority for realization */
  priority?: number;
  
  /** How this beat changes story stakes (raise, lower, maintain) */
  stakes_change?: 'raise' | 'lower' | 'maintain';
  
  /** Urgency level */
  urgency?: 'low' | 'medium' | 'high';
  
  /** Status in workflow */
  status: 'proposed' | 'approved' | 'realized' | 'cut';
  
  /** Order within beat structure */
  order_index?: number;
  
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Scene Type (Updated to absorb current StoryBeat detail)

```typescript
export interface Scene extends Node {
  type: 'Scene';
  id: string;
  
  /** Scene heading (INT/EXT, location, time) */
  heading: string;
  
  /** 
   * Scene overview / logline.
   * NOW includes the level of detail currently in StoryBeats.
   * This is the "mini-story" of what happens in this scene.
   * 
   * Example:
   * "Cain breaks up a shakedown when a uniformed officer leans on 
   *  a local kid for protection money. Cain's words land: criminals 
   *  keep their bargains; badges rewrite theirs. The moment defines 
   *  his code and primes him to distrust any official story."
   */
  scene_overview: string;
  
  /** 
   * Bullet-point key actions.
   * Detailed beats within the scene.
   */
  key_actions?: string[];
  
  /** Order within the story */
  order_index: number;
  
  /** Mood/tone of the scene */
  mood?: string;
  
  /** Time of day (if specified) */
  time_of_day?: string;
  
  /** Optional title (user-facing label) */
  title?: string;
  
  /** Status in workflow */
  status: 'DRAFT' | 'APPROVED' | 'FINAL' | 'CUT';
  
  /** Where this came from */
  source_provenance?: 'USER' | 'AI' | 'IMPORT';
  
  /** Legacy beat_id (for backward compatibility) */
  beat_id?: string;
}
```

### 3.3 Edge Types (No Change)

The edge semantics remain the same:

- `ALIGNS_WITH`: StoryBeat → Beat (structural alignment)
- `SATISFIED_BY`: StoryBeat → Scene (narrative beat realized by scene)
- `PRECEDES`: StoryBeat → StoryBeat (narrative sequence)
- `HAS_CHARACTER`: Scene → Character (cast)
- `LOCATED_AT`: Scene → Location (setting)

---

## 4. Generation Workflow Changes

### 4.1 Current Problematic Flow

```
User: "Generate content for ThemeStated"
  ↓
System: Generates StoryBeat with scene-like detail
  ↓
User: Accepts StoryBeat
  ↓
User: "Now generate scenes"
  ↓
System: ??? (scene content already described in StoryBeat)
```

### 4.2 New Clean Flow

```
User: "Generate StoryBeats for ThemeStated"
  ↓
System: Generates abstract narrative functions
  - "Establish protagonist's code"
  - "Introduce protagonist's status quo"
  - "Show protagonist's competence in his domain"
  ↓
User: Selects "Establish protagonist's code"
  ↓
User: "Generate scenes for this StoryBeat"
  ↓
System: Generates multiple concrete scene options
  - Body shop confrontation
  - Marina deal refusal
  - Flashback to defining moment
  ↓
User: Selects body shop scene, refines, accepts
```

### 4.3 Generation Modes

**StoryBeat Generation** (focuses on narrative needs):
```
Input: Beat (e.g., "ThemeStated")
Context: Story themes, character arcs, gaps
Output: 3-5 abstract StoryBeat proposals

Prompt emphasis:
- "What narrative functions need to happen?"
- "What thematic/character/plot shifts are required?"
- "Describe the PURPOSE, not the execution"
```

**Scene Generation** (focuses on concrete execution):
```
Input: StoryBeat (e.g., "Establish protagonist's code")
Context: Characters, locations, story state
Output: 3-5 concrete scene options

Prompt emphasis:
- "How can this narrative function be shown?"
- "What specific settings, actions, and dialogue?"
- "Multiple approaches to the same goal"
```

---

## 5. Prompt Changes

### 5.1 StoryBeat Generation Prompt (NEW)

```typescript
export function buildStoryBeatPrompt(params: StoryBeatPromptParams): string {
  return `## StoryBeat Generator v2.0.0

Generate narrative beats that realize structural beat "${params.beatName}".

## Beat Guidance
${params.beatGuidance}

## Story Context
${params.storyContext}

## Current Gaps
${params.gaps}

## Your Task

Generate ${params.count} StoryBeat proposals that fulfill this structural beat.

**CRITICAL: StoryBeats are ABSTRACT narrative functions, NOT scene descriptions.**

Each StoryBeat should describe:
- WHAT needs to happen narratively (theme, character arc, plot shift)
- WHY this beat matters for the story
- WHAT emotions or stakes need to shift

Each StoryBeat should NOT include:
- Specific locations (no "INT. BODY SHOP")
- Specific dialogue or actions
- Scene-level details
- Execution specifics

Think: "narrative intent" not "scene synopsis"

## Examples of Good vs Bad StoryBeats

❌ BAD (too specific, scene-like):
"At his Keys body shop, Cain breaks up a shakedown when an officer 
 leans on a kid. His words: criminals keep promises; badges don't."

✅ GOOD (abstract, intent-focused):
"Establish Cain's personal code - he values honor between criminals 
 over institutional authority. Show his skepticism toward badges."

❌ BAD (scene synopsis):
"Dante meets Cain in a club hallway, shows security footage, and 
 demands protection money before handing over evidence."

✅ GOOD (narrative function):
"Introduce an informant who can provide proof of police involvement 
 but whose loyalty is transactional and unreliable."

## Output Format

\`\`\`json
{
  "storyBeats": [{
    "id": "sb_{timestamp}_{5chars}",
    "title": "Narrative function title",
    "summary": "Abstract description of what needs to happen narratively",
    "narrative_function": "theme_establishment" | "character_introduction" | ...,
    "intent": "plot" | "character" | "tone",
    "priority": 1-10,
    "stakes_change": "raise" | "lower" | "maintain"
  }]
}
\`\`\`

Generate ABSTRACT narrative functions, not concrete scenes.`;
}
```

### 5.2 Scene Generation Prompt (UPDATED)

```typescript
export function buildScenePrompt(params: ScenePromptParams): string {
  return `## Scene Generator v2.0.0

Generate concrete scenes that satisfy StoryBeat: "${params.storyBeatTitle}"

## StoryBeat Being Realized
**Title:** ${params.storyBeatTitle}
**Summary:** ${params.storyBeatSummary}
**Narrative Function:** ${params.narrativeFunction}

## Story Context
${params.storyContext}

## Available Characters
${params.characters}

## Available Locations
${params.locations}

## Your Task

Generate ${params.count} CONCRETE scene options that execute this narrative function.

Each scene should:
- Have a specific heading (INT/EXT, location, time)
- Show the narrative function through action and dialogue
- Include specific character interactions
- Define mood and pacing
- List key beats/actions within the scene

Multiple scenes can satisfy the same StoryBeat in different ways.

## Output Format

\`\`\`json
{
  "scenes": [{
    "id": "scene_{timestamp}_{5chars}",
    "heading": "INT. LOCATION - TIME",
    "scene_overview": "Detailed description of what happens in this scene",
    "key_actions": [
      "Character X does Y",
      "Character Z reacts",
      "Revelation/turn occurs"
    ],
    "mood": "tense, reflective, etc",
    "time_of_day": "morning",
    "characters": ["char_id_1", "char_id_2"],
    "location": "loc_id"
  }]
}
\`\`\`

Each scene should be a SPECIFIC, filmable execution of the abstract StoryBeat.`;
}
```

### 5.3 Validation Rules

**StoryBeat validation (new checks):**
```typescript
function validateStoryBeatAbstraction(sb: StoryBeat): ValidationResult {
  const warnings: string[] = [];
  
  // Check for scene-like indicators
  if (sb.summary.match(/INT\.|EXT\./i)) {
    warnings.push("Summary contains scene heading (INT/EXT)");
  }
  
  if (sb.summary.match(/"[^"]{20,}"/)) {
    warnings.push("Summary contains dialogue (quoted speech)");
  }
  
  if (sb.summary.length > 300) {
    warnings.push("Summary too long (>300 chars) - may be too specific");
  }
  
  // Check for location names
  const locationIndicators = ['shop', 'warehouse', 'club', 'marina', 'garage'];
  if (locationIndicators.some(loc => sb.summary.toLowerCase().includes(loc))) {
    warnings.push("Summary may contain specific locations - keep abstract");
  }
  
  return { valid: warnings.length === 0, warnings };
}
```

---

## 6. Migration Strategy

### 6.1 Identifying Scene-Like StoryBeats

Heuristics for detecting StoryBeats that should become Scenes:

1. **Contains location details**: Mentions specific settings (shop, club, garage)
2. **Contains dialogue**: Has quoted speech
3. **Over 200 characters**: Too detailed for an abstract beat
4. **Contains "when/as/while" action clauses**: Describing specific sequences
5. **Mentions specific props/actions**: "shows a thumb drive", "corners Dante"

### 6.2 Migration Algorithm

```typescript
interface MigrationResult {
  newStoryBeat: StoryBeat;
  newScene: Scene;
  preservedEdges: Edge[];
}

function migrateSceneLikeStoryBeat(
  oldStoryBeat: StoryBeat,
  graph: GraphState
): MigrationResult {
  // 1. Extract narrative function from detailed summary
  const narrativeFunction = extractNarrativeFunction(oldStoryBeat.summary);
  
  // 2. Create new abstract StoryBeat
  const newStoryBeat: StoryBeat = {
    ...oldStoryBeat,
    id: `sb_migrated_${oldStoryBeat.id}`,
    summary: narrativeFunction, // Abstracted version
    narrative_function: classifyFunction(narrativeFunction),
  };
  
  // 3. Create Scene from old detailed summary
  const newScene: Scene = {
    type: 'Scene',
    id: `scene_from_${oldStoryBeat.id}`,
    heading: extractHeading(oldStoryBeat.summary) || "INT. LOCATION - TIME",
    scene_overview: oldStoryBeat.summary, // Original detail becomes scene
    order_index: oldStoryBeat.order_index || 0,
    status: 'DRAFT',
    source_provenance: 'MIGRATION',
  };
  
  // 4. Preserve edges
  const alignsWithEdge = graph.edges.find(
    e => e.type === 'ALIGNS_WITH' && e.from === oldStoryBeat.id
  );
  
  const preservedEdges: Edge[] = [
    // Keep ALIGNS_WITH on new StoryBeat
    { ...alignsWithEdge, from: newStoryBeat.id },
    // Add new SATISFIED_BY from StoryBeat to Scene
    {
      type: 'SATISFIED_BY',
      from: newStoryBeat.id,
      to: newScene.id,
      provenance: { source: 'migration' },
    }
  ];
  
  return { newStoryBeat, newScene, preservedEdges };
}

// Helper: Extract narrative function from detailed description
function extractNarrativeFunction(detailed: string): string {
  // This could use an LLM call to summarize:
  // "Given this detailed scene description, extract the core narrative function"
  
  // Or use heuristics:
  // - Remove location details
  // - Remove specific actions
  // - Keep thematic/character intent
  
  // Example:
  // Input: "At his Keys body shop, Cain breaks up a shakedown..."
  // Output: "Establish Cain's personal code and skepticism toward authority"
}
```

### 6.3 Migration Steps

**For the neon-noir-graph.json:**

1. **Identify candidates:**
   ```
   - "Keys Code: No Badges, No Oaths"
   - "Dante sells Cain out to Morrison"
   - "Container Heist: Blue Lights, Black Masks"
   ```

2. **For each candidate:**
   - Extract narrative function → becomes new abstract StoryBeat
   - Move detailed summary → becomes Scene scene_overview
   - Create SATISFIED_BY edge: StoryBeat → Scene
   - Preserve ALIGNS_WITH edge: StoryBeat → Beat

3. **Already-abstract StoryBeats (keep as-is):**
   ```
   - "Police involvement revealed" (good abstraction)
   - "Rigo seeks help and finds Cain" (borderline, keep for now)
   ```

4. **Update generation prompts** to enforce new abstraction level

5. **Add validation** to warn when StoryBeats are too detailed

---

## 7. UI/UX Changes

### 7.1 StoryBeat Display

**Before (confusing):**
```
📍 StoryBeat: "Keys Code: No Badges, No Oaths"
   "At his Keys body shop, Cain breaks up a shakedown..."
   
   [No scenes listed below - content is already in StoryBeat]
```

**After (clear hierarchy):**
```
📋 StoryBeat: "Establish Cain's Personal Code"
   "Show that Cain lives by a personal honor system..."
   
   🎬 Scenes:
      ↳ Body Shop Confrontation
      ↳ Marina Deal Refusal [alternate]
```

### 7.2 Generation Panel Updates

**Current:**
- "Generate Story Beats" → produces scene-like content
- "Generate Scenes" → unclear what this should do

**New:**
- **"Generate Story Beats"** → "What narrative functions are needed?"
  - Shows: abstract intent-based options
  - User selects conceptual beats
  
- **"Generate Scenes for Beat"** → "How should this be executed?"
  - Shows: multiple concrete scene options
  - User can select one or generate alternatives

### 7.3 Beat Coverage View

**Current:**
```
ThemeStated
  └─ "Keys Code" [detailed description]
```

**New:**
```
ThemeStated
  └─ "Establish Cain's Code" [abstract]
      └─ Body Shop Scene [concrete]
      └─ [+ Generate more scenes]
```

---

## 8. Benefits Summary

| Benefit | Description |
|---------|-------------|
| **Clearer abstraction** | Each layer has a distinct purpose: structure → narrative intent → concrete execution |
| **Multiple scene options** | One StoryBeat can have several Scene implementations |
| **Easier generation** | LLM can focus on one abstraction level at a time |
| **Better gap analysis** | "No scenes for StoryBeat" now means something actionable |
| **More flexibility** | Writers can swap scene implementations without changing narrative structure |
| **Reusable narrative beats** | Same abstract beat can be satisfied differently in different stories |
| **Natural workflow** | Matches how writers think: premise → beats → sequences → scenes |

---

## 9. Implementation Phases

### Phase 1: Schema & Types
- [ ] Update `StoryBeat` type with `narrative_function` field
- [ ] Add abstraction guidelines to type comments
- [ ] Update `Scene` type to accommodate richer `scene_overview`
- [ ] Add validation function for StoryBeat abstraction level

### Phase 2: Generation Prompts
- [ ] Create new `buildStoryBeatPrompt` with abstraction emphasis
- [ ] Update `buildScenePrompt` to reference parent StoryBeat
- [ ] Add examples to prompts showing good vs bad abstraction
- [ ] Update prompt tests

### Phase 3: Orchestrators
- [ ] Update `storyBeatOrchestrator` to enforce abstraction
- [ ] Update `sceneOrchestrator` to reference StoryBeat context
- [ ] Add post-generation validation warnings
- [ ] Update response types

### Phase 4: Migration Tools
- [ ] Write `migrateSceneLikeStoryBeat()` function
- [ ] Add LLM-assisted narrative function extraction
- [ ] Create migration script for existing graphs
- [ ] Test on neon-noir-graph.json

### Phase 5: UI Updates
- [ ] Update StoryBeat display to show abstraction level
- [ ] Add "Generate Scenes" action to StoryBeat cards
- [ ] Show Scene options grouped under their StoryBeat
- [ ] Update gap indicators to show "Needs scenes"

### Phase 6: Documentation
- [ ] Update API docs with new abstraction guidelines
- [ ] Create user guide for StoryBeat vs Scene
- [ ] Add examples to prompt library
- [ ] Update tests and test fixtures

---

## 10. Open Questions

1. **Naming**: Should we rename "StoryBeat" to something clearer?
   - Options: "NarrativeBeat", "PlotPoint", "StoryFunction", "Sequence"
   - Lean: Keep "StoryBeat" but enforce the abstraction

2. **Automatic vs Manual Scene Generation**: 
   - Should accepting a StoryBeat automatically trigger scene generation?
   - Or should scene generation be a separate explicit step?
   - Lean: Separate step gives users control

3. **Multiple Scenes per StoryBeat**:
   - Should there be a "primary" scene and "alternates"?
   - Or are all scenes equal options?
   - Lean: Equal options, user picks which to develop

4. **Validation Strictness**:
   - Should the system reject scene-like StoryBeats?
   - Or just warn and let user override?
   - Lean: Warn but don't block (soft guidance)

5. **Scene Variants**:
   - If a user generates multiple scenes for one StoryBeat, should they all stay in the graph?
   - Or mark rejected ones as "ALTERNATE"?
   - Lean: Keep all with status marking (DRAFT/APPROVED/ALTERNATE/CUT)

---

## 11. Success Metrics

- **Abstraction compliance**: >80% of new StoryBeats pass validation
- **Scene diversity**: Average 2+ scene options per StoryBeat
- **User clarity**: Survey feedback shows clearer understanding of hierarchy
- **Generation quality**: Fewer rejected proposals due to wrong abstraction level
- **Workflow efficiency**: Users complete Beat → StoryBeat → Scene in fewer iterations

---

## Conclusion

This change creates a **cleaner separation of concerns** in the story structure:

- **Beat**: Structural requirement (Save the Cat framework)
- **StoryBeat**: Narrative intent (what needs to happen thematically/plot-wise)
- **Scene**: Concrete execution (how it's shown on screen/page)

By keeping StoryBeats properly abstract, we enable:
- Multiple scene options per narrative beat
- Clearer generation targets
- Better gap analysis
- More natural user workflow

The migration path is clear, and existing scene-like StoryBeats can be automatically split into abstract StoryBeat + concrete Scene pairs.
