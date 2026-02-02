# Ideas as Planning Layer - Specification

**Date:** 2026-02-01  
**Status:** Proposal  
**Supersedes:** `idea_board.md`  
**Author:** Esh (AI Assistant)  

---

## 1. Executive Summary

**Problem:** There's a gap between loose user thoughts ("I want Act 1 to end with comic relief before violence") and concrete artifacts (StoryBeats, Scenes). The current workflow forces users to jump directly from vague direction to concrete proposals, without a space to explore, discuss, and clarify intent first.

**Solution:** Enhance the existing `Idea` node type to serve as a flexible planning and discussion layer. Ideas become a scratchpad where users can:
- Ask questions ("Who committed the crime and why?")
- State directions ("Act 1 should end with humanizing moment")
- Capture constraints ("No supernatural elements")
- Discuss with AI before generating artifacts
- Track which ideas informed which artifacts (provenance)

**Why not a new "Intent" node type?** Ideas already exist, have UI, have API endpoints, and are already filtered/serialized for prompts. Extending Ideas is simpler than creating parallel infrastructure.

**Why not the "Intent Board" UI proposal?** A planning board for StoryBeats is UI polish, not a solution to the core problem (need for pre-artifact discussion). We can add that later if needed, but it doesn't address the workflow gap.

---

## 2. Core Problem Analysis

### 2.1 Current Workflow (Forced Leap)

```
User thought: "I want comic relief before the violence"
  ↓ (no intermediate step)
StoryBeat generation: "Generate beats for Catalyst"
  ↓
LLM generates: Concrete beat with specific characters/actions
  ↓
User: "Not quite what I meant..." ❌
```

**Missing:** Space to clarify what "comic relief" means, which character provides it, how it relates to existing story elements.

### 2.2 What Users Actually Want

Based on your description:

1. **Questions:** "Who did the crime? What's their motivation?"
2. **Directions:** "Act 1 ends with Dante making Cain uncomfortable"
3. **Constraints:** "No magic/supernatural, stays grounded"
4. **Hypotheses:** "What if Cain already suspects Morrison?"
5. **Notes:** "The body shop scene should feel safe before Miami chaos"

**Common thread:** These are all thoughts **before** committing to artifacts. They're exploratory, revisable, and need to inform generation without being generation themselves.

### 2.3 Why Current System Falls Short

| Current Tool | Why It Doesn't Work |
|--------------|---------------------|
| **StoryContext** | Too high-level (themes, tone); gets serialized into every prompt (bloat); not meant for Q&A |
| **Ideas** | Underutilized; seen as "rejected proposals" not planning notes; lacks structure for questions/directions |
| **StoryBeats** | Too concrete; requires commitment to structure before exploration |
| **Comments/Notes** | If they exist, they're disconnected from generation |

---

## 3. Proposed Solution: Enhanced Ideas

### 3.1 Core Concept

**Ideas become a planning layer with three modes:**

1. **Question Mode:** "Who committed the crime?"
   - Can be discussed with AI
   - Resolution tracked
   - Informs later generation

2. **Direction Mode:** "Act 1 ends with [specific intent]"
   - Captures user's vision
   - Tags with relevant beats/acts/themes
   - Referenced during generation

3. **Constraint Mode:** "No supernatural elements"
   - Enforces boundaries
   - Validated during generation
   - Surfaced as lint warnings if violated

**Ideas already exist as nodes**, already have UI, already get filtered for prompts. We just need to:
- Add fields for planning metadata
- Improve filtering logic
- Add discussion capability
- Track provenance to artifacts

### 3.2 Why This Works

✅ **No new node types** - extends existing `Idea`  
✅ **No complex UI** - enhance existing Ideas section  
✅ **No prompt bloat** - smart filtering includes only relevant ideas  
✅ **No latency** - deterministic filtering, optional AI discussion  
✅ **Provenance** - track which ideas informed which artifacts  
✅ **Flexible** - questions, directions, constraints all supported  

---

## 4. Enhanced Idea Type Schema

### 4.1 New Fields

```typescript
export type IdeaKind = 
  | 'proposal'    // Default: "Add character Flores" (existing behavior)
  | 'question'    // "Who committed the crime and why?"
  | 'direction'   // "Act 1 ends with comic relief moment"
  | 'constraint'  // "Keep story grounded, no magic"
  | 'note';       // "Dante should feel slimy but charming"

export type IdeaResolutionStatus = 
  | 'open'        // Still needs attention
  | 'discussed'   // AI or user has weighed in
  | 'resolved'    // Question answered or decision made
  | 'archived';   // No longer relevant

export interface Idea extends BaseNode {
  type: 'Idea';
  
  // === EXISTING FIELDS (keep as-is) ===
  title: string;
  description: string;
  source: 'user' | 'ai';
  suggestedType?: 'StoryBeat' | 'Scene' | 'Character' | 'Location' | 'Object';
  status?: 'active' | 'promoted' | 'dismissed';
  category?: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
  sourcePackageId?: string;
  relatedNodeIds?: string[];
  createdAt: string;
  
  // === NEW FIELDS ===
  
  /** What kind of planning artifact is this? */
  kind?: IdeaKind;  // Defaults to 'proposal' for backward compat
  
  /** Lifecycle for questions/directions */
  resolutionStatus?: IdeaResolutionStatus;  // Defaults to 'open'
  
  /** Answer to question or final decision */
  resolution?: string;
  
  /** Discussion thread (optional) */
  discussion?: Array<{
    from: 'user' | 'agent';
    text: string;
    timestamp: string;
  }>;
  
  /** Targeted context (generation filtering) */
  targetBeat?: string;           // "beat_Catalyst"
  targetAct?: 1 | 2 | 3 | 4 | 5; // Act 1, 2, etc
  targetScene?: string;          // Specific scene this relates to
  
  /** Thematic tags for filtering */
  themes?: string[];             // ["betrayal", "redemption"]
  moods?: string[];              // ["tense", "reflective"]
  
  /** Generation tracking */
  generationContext?: {
    task: string;                // "generate-storybeats-for-catalyst"
    timestamp: string;
    promptSnippet?: string;      // First 200 chars of user input
  };
  
  /** Provenance: which artifacts used this idea */
  informedArtifacts?: Array<{
    artifactId: string;          // "storybeat_xyz"
    artifactType: 'StoryBeat' | 'Scene' | 'Character';
    packageId: string;           // Which package generated it
    timestamp: string;
  }>;
  
  /** Lifecycle tracking */
  lastReviewedAt?: string;       // When user last interacted
  lastUsedInPrompt?: string;     // When last included in generation
  usageCount?: number;           // Times included in prompts
}
```

### 4.2 Backward Compatibility

```typescript
// Existing Ideas without new fields:
{
  kind: undefined → treated as 'proposal'
  resolutionStatus: undefined → treated as 'open'
  // All other new fields optional
}
```

---

## 5. Filtering & Selection Logic

### 5.1 Deterministic Filtering (No LLM, No Latency)

```typescript
export interface EnhancedIdeasFilterOptions {
  // === EXISTING ===
  category?: IdeaCategory | IdeaCategory[];
  relatedNodeIds?: string[];
  activeOnly?: boolean;
  maxIdeas?: number;
  
  // === NEW ===
  kind?: IdeaKind | IdeaKind[];            // Filter by planning mode
  resolutionStatus?: IdeaResolutionStatus | IdeaResolutionStatus[];
  targetBeat?: string;                     // Only ideas for this beat
  targetAct?: number;                      // Only ideas for this act
  themes?: string[];                       // Match story themes
  includeConstraints?: boolean;            // Always include constraints
  minFreshnessScore?: number;              // Quality filter (0-1)
}

export function filterIdeas(
  graph: GraphState,
  options: EnhancedIdeasFilterOptions,
  storyContext?: StoryContext
): Idea[] {
  let ideas = getNodesByType<Idea>(graph, 'Idea');
  
  // 1. Status filter (keep existing)
  if (options.activeOnly !== false) {
    ideas = ideas.filter(i => 
      (i.status || 'active') === 'active' &&
      (i.resolutionStatus || 'open') !== 'archived'
    );
  }
  
  // 2. Kind filter (NEW)
  if (options.kind) {
    const kinds = Array.isArray(options.kind) ? options.kind : [options.kind];
    ideas = ideas.filter(i => {
      const k = i.kind || 'proposal';
      return kinds.includes(k);
    });
  }
  
  // 3. Resolution filter (NEW)
  if (options.resolutionStatus) {
    const statuses = Array.isArray(options.resolutionStatus) 
      ? options.resolutionStatus 
      : [options.resolutionStatus];
    ideas = ideas.filter(i => {
      const rs = i.resolutionStatus || 'open';
      return statuses.includes(rs);
    });
  }
  
  // 4. Auto-fulfilled check (NEW)
  ideas = ideas.filter(i => !isIdeaFulfilled(i, graph));
  
  // 5. Category filter (keep existing)
  if (options.category) {
    const categories = Array.isArray(options.category) ? options.category : [options.category];
    ideas = ideas.filter(i => !i.category || categories.includes(i.category));
  }
  
  // 6. Beat/Act targeting (NEW)
  if (options.targetBeat) {
    ideas = ideas.filter(i => 
      !i.targetBeat || i.targetBeat === options.targetBeat
    );
  }
  
  if (options.targetAct) {
    ideas = ideas.filter(i => 
      !i.targetAct || i.targetAct === options.targetAct
    );
  }
  
  // 7. Theme overlap (NEW)
  if (options.themes?.length && storyContext) {
    ideas = ideas.filter(i => {
      if (!i.themes?.length) return true; // No themes = matches all
      return i.themes.some(t => options.themes!.includes(t));
    });
  }
  
  // 8. Related nodes (keep existing)
  if (options.relatedNodeIds?.length > 0) {
    const relatedSet = new Set(options.relatedNodeIds);
    ideas = ideas.filter(i => 
      !i.relatedNodeIds?.length || 
      i.relatedNodeIds.some(id => relatedSet.has(id))
    );
  }
  
  // 9. Always include constraints if requested (NEW)
  let constraints: Idea[] = [];
  if (options.includeConstraints) {
    constraints = ideas.filter(i => (i.kind || 'proposal') === 'constraint');
    ideas = ideas.filter(i => (i.kind || 'proposal') !== 'constraint');
  }
  
  // 10. Compute freshness scores (NEW)
  ideas = ideas.map(i => ({
    ...i,
    _freshnessScore: computeFreshnessScore(i)
  }));
  
  // 11. Filter by minimum freshness (NEW)
  if (options.minFreshnessScore !== undefined) {
    ideas = ideas.filter(i => (i._freshnessScore || 0) >= options.minFreshnessScore!);
  }
  
  // 12. Sort by freshness score (not just recency)
  ideas.sort((a, b) => (b._freshnessScore || 0) - (a._freshnessScore || 0));
  
  // 13. Limit results
  const limited = ideas.slice(0, options.maxIdeas || 10);
  
  // 14. Re-add constraints at the front (always included)
  return [...constraints, ...limited];
}

// === Helper Functions ===

function isIdeaFulfilled(idea: Idea, graph: GraphState): boolean {
  if (!idea.suggestedType || !idea.title) return false;
  
  switch (idea.suggestedType) {
    case 'Character': {
      const chars = getNodesByType<Character>(graph, 'Character');
      return chars.some(c => 
        c.name.toLowerCase().includes(idea.title.toLowerCase()) ||
        idea.title.toLowerCase().includes(c.name.toLowerCase())
      );
    }
    case 'Location': {
      const locs = getNodesByType<Location>(graph, 'Location');
      return locs.some(l => 
        l.name.toLowerCase().includes(idea.title.toLowerCase())
      );
    }
    case 'StoryBeat': {
      // Check if there's a StoryBeat with similar title
      const beats = getNodesByType<StoryBeat>(graph, 'StoryBeat');
      return beats.some(b => 
        b.title.toLowerCase().includes(idea.title.toLowerCase()) ||
        idea.title.toLowerCase().includes(b.title.toLowerCase())
      );
    }
    default:
      return false;
  }
}

function computeFreshnessScore(idea: Idea): number {
  const now = Date.now();
  const created = new Date(idea.createdAt).getTime();
  const age = (now - created) / (1000 * 60 * 60 * 24); // days
  
  // Base score: newer ideas score higher
  let score = Math.max(0, 1 - (age / 90)); // 0 after 90 days
  
  // Bump recently reviewed ideas
  if (idea.lastReviewedAt) {
    const reviewAge = (now - new Date(idea.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (reviewAge < 7) score += 0.3;  // Recently reviewed = still relevant
    else if (reviewAge < 30) score += 0.1;
  }
  
  // Bump recently used in prompts
  if (idea.lastUsedInPrompt) {
    const usageAge = (now - new Date(idea.lastUsedInPrompt).getTime()) / (1000 * 60 * 60 * 24);
    if (usageAge < 7) score += 0.2;  // Recently useful
  }
  
  // Penalize never-used old ideas
  if (!idea.usageCount && age > 30) {
    score *= 0.5;  // Old and never used = probably not relevant
  }
  
  // Boost constraints and resolved questions (always relevant)
  if (idea.kind === 'constraint') score += 0.5;
  if (idea.kind === 'question' && idea.resolutionStatus === 'resolved') score += 0.3;
  
  // AI-suggested ideas slightly boosted (more contextual)
  if (idea.source === 'ai') score += 0.1;
  
  return Math.min(1, score); // Cap at 1.0
}
```

### 5.2 Task-Specific Filtering

```typescript
export type IdeaTaskType =
  | 'character'
  | 'storyBeat'
  | 'scene'
  | 'expand'
  | 'generate'
  | 'interpret'
  | 'refine';

export function getIdeasForTask(
  graph: GraphState,
  taskType: IdeaTaskType,
  context: {
    entryPointNodeId?: string;
    targetBeat?: string;
    targetAct?: number;
    themes?: string[];
  },
  maxIdeas: number = 10
): IdeasSerializationResult {
  const categories = getCategoryForTaskType(taskType);
  
  // Determine relevant kinds based on task
  const relevantKinds: IdeaKind[] = ['proposal']; // Always include proposals
  
  // Questions and directions are useful for all generation tasks
  if (['storyBeat', 'scene', 'generate', 'expand'].includes(taskType)) {
    relevantKinds.push('question', 'direction', 'note');
  }
  
  const filterOptions: EnhancedIdeasFilterOptions = {
    category: categories,
    kind: relevantKinds,
    activeOnly: true,
    maxIdeas,
    includeConstraints: true,  // Always include constraints
    minFreshnessScore: 0.2,    // Filter out very stale ideas
    ...(context.targetBeat && { targetBeat: context.targetBeat }),
    ...(context.targetAct && { targetAct: context.targetAct }),
    ...(context.themes && { themes: context.themes }),
  };
  
  if (context.entryPointNodeId) {
    filterOptions.relatedNodeIds = [context.entryPointNodeId];
  }
  
  const filteredIdeas = filterIdeas(graph, filterOptions);
  
  // Track usage
  const now = new Date().toISOString();
  filteredIdeas.forEach(i => {
    i.lastUsedInPrompt = now;
    i.usageCount = (i.usageCount || 0) + 1;
  });
  
  return serializeIdeas(filteredIdeas);
}
```

### 5.3 Serialization Format

```typescript
export function serializeIdeas(ideas: Idea[]): IdeasSerializationResult {
  if (ideas.length === 0) {
    return { serialized: '', includedCount: 0, includedIds: [] };
  }
  
  const lines: string[] = [];
  lines.push('## Planning Context');
  lines.push('');
  
  // Group by kind
  const byKind = ideas.reduce((acc, i) => {
    const kind = i.kind || 'proposal';
    if (!acc[kind]) acc[kind] = [];
    acc[kind].push(i);
    return acc;
  }, {} as Record<IdeaKind, Idea[]>);
  
  // Constraints first (always respected)
  if (byKind.constraint?.length) {
    lines.push('### Constraints (must follow)');
    byKind.constraint.forEach(i => {
      lines.push(`- ${i.title}`);
      if (i.description) lines.push(`  ${truncate(i.description, 100)}`);
    });
    lines.push('');
  }
  
  // Resolved questions next (established facts)
  const resolvedQuestions = byKind.question?.filter(i => i.resolutionStatus === 'resolved');
  if (resolvedQuestions?.length) {
    lines.push('### Established Context');
    resolvedQuestions.forEach(i => {
      lines.push(`- **${i.title}**`);
      if (i.resolution) lines.push(`  Resolution: ${truncate(i.resolution, 150)}`);
    });
    lines.push('');
  }
  
  // Open questions (need attention)
  const openQuestions = byKind.question?.filter(i => i.resolutionStatus === 'open');
  if (openQuestions?.length) {
    lines.push('### Open Questions');
    openQuestions.forEach(i => {
      lines.push(`- ${i.title}`);
      if (i.description) lines.push(`  ${truncate(i.description, 100)}`);
    });
    lines.push('');
  }
  
  // Directions (user intent)
  if (byKind.direction?.length) {
    lines.push('### Story Direction');
    byKind.direction.forEach(i => {
      lines.push(`- ${i.title}`);
      if (i.description) lines.push(`  ${truncate(i.description, 150)}`);
    });
    lines.push('');
  }
  
  // Notes
  if (byKind.note?.length) {
    lines.push('### Creative Notes');
    byKind.note.forEach(i => {
      lines.push(`- ${i.title}: ${truncate(i.description, 100)}`);
    });
    lines.push('');
  }
  
  // Proposals (existing behavior)
  if (byKind.proposal?.length) {
    lines.push('### Story Ideas');
    byKind.proposal.forEach(i => {
      const catTag = i.category ? ` [${i.category}]` : '';
      lines.push(`- **${i.title}**${catTag}`);
      lines.push(`  ${truncate(i.description, 150)}`);
      if (i.relatedNodeIds?.length) {
        lines.push(`  Related: ${i.relatedNodeIds.slice(0, 3).join(', ')}`);
      }
    });
  }
  
  return {
    serialized: lines.join('\n'),
    includedCount: ideas.length,
    includedIds: ideas.map(i => i.id),
  };
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}
```

---

## 6. Generation-Time Tagging

### 6.1 Auto-Tag Ideas When Generated

When AI generates ideas (via `stashedIdeas` in packages or `from-package` endpoint), automatically populate context:

```typescript
// In packageToPatches.ts or generation orchestrators
function convertStashedIdeasToNodes(
  ideas: StashedIdea[], 
  sourcePackageId: string,
  generationContext: {
    task: string;
    targetBeat?: string;
    targetAct?: number;
    themes?: string[];
    promptSnippet?: string;
  }
): Idea[] {
  const timestamp = new Date().toISOString();
  
  return ideas.map((stashedIdea) => {
    const ideaNode: Idea = {
      type: 'Idea',
      id: stashedIdea.id.startsWith('idea_') ? stashedIdea.id : `idea_${Date.now()}_${randomString(4)}`,
      title: stashedIdea.content.slice(0, 50) + (stashedIdea.content.length > 50 ? '...' : ''),
      description: stashedIdea.content,
      source: 'ai',
      status: 'active',
      category: stashedIdea.category,
      sourcePackageId,
      createdAt: timestamp,
      
      // NEW: Auto-populate context
      kind: inferKindFromContent(stashedIdea.content),
      targetBeat: generationContext.targetBeat,
      targetAct: generationContext.targetAct,
      themes: generationContext.themes,
      relatedNodeIds: stashedIdea.relatedNodeIds,
      generationContext: {
        task: generationContext.task,
        timestamp,
        promptSnippet: generationContext.promptSnippet?.slice(0, 200),
      },
    };
    
    return ideaNode;
  });
}

function inferKindFromContent(content: string): IdeaKind {
  const lower = content.toLowerCase();
  
  // Question patterns
  if (/^(who|what|when|where|why|how|should|could|is|are|does)\b/i.test(content)) {
    return 'question';
  }
  
  // Constraint patterns
  if (/\b(must|should not|cannot|avoid|never|no |don't)\b/i.test(lower)) {
    return 'constraint';
  }
  
  // Direction patterns
  if (/\b(act \d|scene|beat|should|needs to|has to|make sure)\b/i.test(lower)) {
    return 'direction';
  }
  
  // Default to proposal
  return 'proposal';
}
```

### 6.2 User-Created Ideas with Context

When users create ideas manually, prompt for relevant context:

```typescript
// API endpoint enhancement
POST /stories/:id/ideas
{
  title: "Who committed the crime?",
  description: "Need to figure out motivation and method",
  kind: "question",                    // NEW: User selects
  category: "plot",
  targetBeat: "beat_Catalyst",         // NEW: Optional targeting
  targetAct: 1,                        // NEW: Optional act
  themes: ["mystery", "betrayal"]      // NEW: Optional themes
}
```

---

## 7. Discussion Feature (Optional)

### 7.1 Discussion Flow

For `kind: 'question'` or `kind: 'direction'` ideas, users can discuss with AI:

```typescript
POST /stories/:id/ideas/:ideaId/discuss
{
  message: "Why would Flores betray Morrison?"
}

Response:
{
  reply: "Flores might betray Morrison if he discovers Morrison is...",
  suggestedResolution: "Flores discovers Morrison plans to eliminate him",
  suggestedArtifacts: [
    {
      type: "StoryBeat",
      title: "Flores discovers betrayal",
      summary: "..."
    }
  ]
}
```

The discussion is appended to `idea.discussion` array and can optionally update `idea.resolution` and `idea.resolutionStatus`.

### 7.2 Implementation Strategy

**Low-latency approach:**
- Discussion is **async** (doesn't block generation)
- User can continue working while AI thinks
- AI response appears as notification/update

**Workflow:**
1. User creates Question idea: "Who did the crime?"
2. User clicks "Discuss with AI"
3. AI considers story context + existing ideas
4. AI responds with thoughts + suggests resolution
5. User can accept, edit, or continue discussion
6. Once satisfied, mark as `resolved`
7. Resolved ideas automatically included in next generation

**No latency impact on generation** - discussion is separate workflow

---

## 8. Provenance Tracking

### 8.1 Track Which Ideas Informed Artifacts

When generation uses ideas, record provenance:

```typescript
// During generation (in orchestrator)
const ideasResult = getIdeasForTask(graph, 'storyBeat', { targetBeat: 'beat_Catalyst' });

// After successful generation and user accepts package
const pkg = result.packages[0];

// Update ideas with provenance
for (const ideaId of ideasResult.includedIds) {
  const idea = getNode(graph, ideaId) as Idea;
  if (!idea.informedArtifacts) idea.informedArtifacts = [];
  
  // Add entries for each artifact in the package
  for (const nodeChange of pkg.changes.nodes) {
    if (nodeChange.operation === 'add') {
      idea.informedArtifacts.push({
        artifactId: nodeChange.node_id,
        artifactType: nodeChange.node_type as any,
        packageId: pkg.id,
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  // Update idea in graph (via patch)
}
```

### 8.2 Display Provenance in UI

**Idea card shows:**
- "Used in 3 StoryBeats" (link to artifacts)
- "Last used: 2 hours ago"

**StoryBeat/Scene shows:**
- "Informed by Ideas: [link] [link]"

**Benefits:**
- See which ideas are actually useful
- Understand why artifacts were generated
- Clean up unused ideas

---

## 9. API Endpoints

### 9.1 Enhanced Existing Endpoints

**POST /stories/:id/ideas** (already exists, enhance body):
```typescript
{
  title, description,
  kind?: 'proposal' | 'question' | 'direction' | 'constraint' | 'note',
  resolutionStatus?: 'open' | 'discussed' | 'resolved',
  resolution?: string,
  targetBeat?: string,
  targetAct?: number,
  themes?: string[],
  // ... existing fields ...
}
```

**GET /stories/:id/ideas** (already exists, add filters):
```typescript
?kind=question
&resolutionStatus=open
&targetBeat=beat_Catalyst
&targetAct=1
&minFreshnessScore=0.5
```

**PATCH /stories/:id/ideas/:ideaId** (already exists):
```typescript
{
  changes: {
    resolutionStatus: 'resolved',
    resolution: 'Butler did it with arsenic',
    lastReviewedAt: '2026-02-01T...'
  }
}
```

### 9.2 New Endpoints

**POST /stories/:id/ideas/:ideaId/discuss**
```typescript
Request:
{
  message: "Why would this character betray?"
}

Response:
{
  reply: "Given the story context...",
  confidence: 0.8,
  suggestedResolution?: "Concrete answer",
  suggestedArtifacts?: [...], // Optional follow-up generation
  updatedIdea: {...} // Idea with discussion appended
}
```

**POST /stories/:id/ideas/bulk-update**
```typescript
Request:
{
  updates: [
    { id: 'idea_1', resolutionStatus: 'archived' },
    { id: 'idea_2', lastReviewedAt: '...' }
  ]
}

Response:
{
  updated: 2,
  newVersionId: 'ver_...'
}
```

**GET /stories/:id/ideas/:ideaId/provenance**
```typescript
Response:
{
  idea: {...},
  informedArtifacts: [
    {
      id: 'storybeat_xyz',
      type: 'StoryBeat',
      title: '...',
      packageId: 'pkg_...',
      createdAt: '...'
    }
  ],
  usageHistory: [
    {
      task: 'generate-storybeats-catalyst',
      timestamp: '...',
      included: true
    }
  ]
}
```

---

## 10. UI Changes

### 10.1 Ideas Section Enhancements

**Existing Ideas UI:**
```
Ideas (Stash)
├─ [Card] Character: Flores backstory
├─ [Card] Scene: Body shop confrontation  
└─ [Card] Plot: Dante's betrayal
```

**Enhanced Ideas UI:**
```
Ideas (Planning)

[Tabs: All | Questions | Directions | Constraints | Proposals]

[Filters: ▼ Act | ▼ Beat | ▼ Status | ▼ Freshness]

┌─ CONSTRAINTS (always visible) ─────┐
│ • No supernatural elements          │
│ • Keep Cain morally gray            │
└─────────────────────────────────────┘

┌─ OPEN QUESTIONS ───────────────────┐
│ ❓ Who committed the crime?         │
│    [Discuss] [Mark Resolved]        │
│                                      │
│ ❓ Why would Flores help Morrison?  │
│    [Discuss] [Mark Resolved]        │
└─────────────────────────────────────┘

┌─ DIRECTIONS ───────────────────────┐
│ 📍 Act 1: Comic relief before      │
│    violence (beat_Catalyst)         │
│    [Edit] [Generate StoryBeat]      │
└─────────────────────────────────────┘

┌─ PROPOSALS (existing behavior) ────┐
│ 💡 Character: Elena Marquez (IA)   │
│ 💡 Scene: Marina meeting            │
└─────────────────────────────────────┘

[+ New Idea]
```

### 10.2 Idea Card Details

**Question Card:**
```
┌────────────────────────────────────┐
│ ❓ QUESTION                         │
│ Who committed the crime and why?   │
│                                     │
│ Description: Need to establish...  │
│                                     │
│ Status: [Open ▼]                   │
│ Target: Act 1 • Catalyst           │
│                                     │
│ [Discuss with AI] [Mark Resolved]  │
│                                     │
│ Discussion (2):                     │
│  User: "What about Morrison?"      │
│  AI: "Morrison makes sense because"│
│                                     │
│ Resolution: [Save answer...]       │
└────────────────────────────────────┘
```

**Direction Card:**
```
┌────────────────────────────────────┐
│ 📍 DIRECTION                        │
│ Act 1 ends with comic relief       │
│                                     │
│ Dante makes Cain uncomfortable in  │
│ a way that breaks tension before   │
│ the violence of the heist reveal.  │
│                                     │
│ Target: beat_Catalyst • Act 1      │
│ Themes: tension, irony             │
│                                     │
│ [Generate StoryBeat from this]     │
│                                     │
│ Informed: storybeat_xyz (2h ago)   │
└────────────────────────────────────┘
```

### 10.3 Generation Flow Integration

**When user clicks "Generate StoryBeats":**
```
┌─ Generate StoryBeats ──────────────┐
│ For: beat_Catalyst (Act 1)         │
│                                     │
│ Relevant Planning Context:         │
│  ✓ 2 constraints                   │
│  ✓ 1 direction (comic relief)      │
│  ✓ 3 open questions                │
│  ✓ 5 proposals                     │
│                                     │
│ [Review Context] [Generate]        │
└────────────────────────────────────┘
```

After generation:
```
✓ Generated 3 StoryBeats

These ideas were used:
• Direction: "Act 1 comic relief" ✓
• Proposal: "Dante as informant" ✓

These questions need answers:
• "Who committed the crime?" [Discuss now]
```

### 10.4 Bulk Actions

```
[Select: All Open Questions]
  └─ [Archive] [Mark Resolved] [Export]

[Select: Old Unused Ideas (90+ days)]
  └─ [Archive] [Review]

[Show: Ideas Never Used in Prompts]
  └─ 12 ideas found [Review for relevance]
```

---

## 11. Workflow Examples

### 11.1 Question → Resolution → Generation

```
1. User creates Question Idea:
   Title: "Who committed the crime?"
   Description: "Need motivation and method"
   Kind: question
   Status: open

2. User clicks "Discuss with AI"
   AI: "Given Morrison's setup, the corrupt cops make sense as perpetrators..."
   
3. User adds follow-up:
   "Why would Flores help Morrison specifically?"
   
4. AI responds with analysis
   
5. User marks resolved:
   Resolution: "Flores is ex-military, Morrison is his former CO. Loyalty + guilt."
   Status: resolved

6. Next generation automatically includes:
   "Established Context: Flores helps Morrison due to military loyalty and guilt"
   
7. Generated StoryBeat references this context in rationale
```

### 11.2 Direction → Targeted Generation

```
1. User creates Direction Idea:
   Title: "Act 1 ends with humanizing moment"
   Description: "Need comic relief with Dante before violence"
   Kind: direction
   TargetBeat: beat_Catalyst
   TargetAct: 1

2. User clicks "Generate StoryBeat from this"
   System filters ideas:
   - Includes this direction
   - Includes other Act 1 / Catalyst ideas
   - Includes constraints
   
3. Generation prompt includes:
   "## Story Direction
    - Act 1 ends with humanizing moment: Need comic relief with Dante before violence"
   
4. LLM generates StoryBeat aligned with this direction

5. Provenance tracked:
   idea.informedArtifacts.push({
     artifactId: 'storybeat_xyz',
     ...
   })
```

### 11.3 Constraint → Validation

```
1. User creates Constraint Idea:
   Title: "No supernatural elements"
   Description: "Story stays grounded, no magic"
   Kind: constraint

2. Every generation includes:
   "## Constraints (must follow)
    - No supernatural elements: Story stays grounded"

3. If LLM generates something supernatural:
   Lint check flags violation
   "Warning: Package suggests paranormal element, 
    violates constraint 'No supernatural elements'"

4. User can override or reject package
```

---

## 12. Migration Strategy

### 12.1 Backward Compatibility

All new fields are optional:
- Existing Ideas continue to work
- Default `kind: 'proposal'` maintains current behavior
- UI gracefully handles Ideas without new fields

### 12.2 Gradual Rollout

**Phase 1: Core Type + API** (1 week)
- Add new fields to Idea type
- Update API endpoints to accept/return new fields
- Update filtering logic
- No UI changes yet

**Phase 2: Filtering + Generation** (1 week)
- Implement enhanced filterIdeas()
- Update getIdeasForTask() with new logic
- Auto-tag AI-generated ideas
- Track provenance in orchestrators

**Phase 3: UI Basics** (1 week)
- Add kind selector to Create Idea form
- Display kind badges on Idea cards
- Add targetBeat/targetAct pickers
- Show provenance ("Used in 3 StoryBeats")

**Phase 4: Discussion Feature** (1 week)
- Add /discuss endpoint
- Add "Discuss with AI" button
- Show discussion thread in card
- Resolution workflow

**Phase 5: Polish** (ongoing)
- Bulk actions UI
- Advanced filters
- Provenance visualization
- Analytics (which ideas are most useful)

---

## 13. Performance & Cost Analysis

### 13.1 Latency Impact

| Operation | Current | With Enhancement | Delta |
|-----------|---------|------------------|-------|
| Load ideas | ~5-10ms | ~5-10ms | **+0ms** (deterministic) |
| Filter ideas | ~5ms | ~8-12ms | **+3-7ms** (more checks, negligible) |
| Serialize ideas | ~5ms | ~10-15ms | **+5-10ms** (grouping by kind) |
| Generation call | ~1-3s | ~1-3s | **+0ms** (token count similar) |
| **Total** | ~1.5-3.5s | ~1.5-3.5s | **~10-20ms** (imperceptible) |

**Discussion feature:** Async, doesn't block generation

### 13.2 Token Impact

```
Before (5 ideas × 150 chars):
  ~750 chars = ~200 tokens

After (10 ideas × 150 chars, structured):
  ~1,500 chars + headers = ~450 tokens
  
Delta: +250 tokens ≈ +$0.00075 per generation
```

**Negligible cost increase**, significant quality improvement

### 13.3 Storage Impact

```
Per Idea node:
  Existing: ~500 bytes
  New fields: ~300 bytes (optional, sparse)
  
  Total: ~800 bytes per idea
  
For 100 ideas: ~80 KB (trivial)
```

---

## 14. Success Metrics

### 14.1 Adoption Metrics
- % of users creating non-proposal ideas (questions, directions)
- Average ideas per story
- % of ideas used in generation (provenance tracking)

### 14.2 Quality Metrics
- % reduction in "rejected packages" after using ideas
- User satisfaction: "Ideas helped clarify my vision" (survey)
- % of questions marked "resolved" within 7 days

### 14.3 Efficiency Metrics
- Time from "vague idea" to "accepted artifact"
- % of generations that reference ideas in rationale
- % of old/unused ideas archived (cleanup effectiveness)

---

## 15. Open Questions

1. **Should we use LLM for discussion by default, or make it opt-in?**
   - Recommendation: Opt-in initially ("Discuss with AI" button)
   - Avoids latency/cost for users who don't need it

2. **How aggressive should auto-archiving be?**
   - Ideas unused for 90 days + freshness score < 0.2
   - Or require manual review?
   - Recommendation: Surface for review, don't auto-archive

3. **Should resolved questions auto-promote to StoryContext?**
   - Could move to `storyContext.workingNotes` when resolved
   - Keeps them out of idea filtering
   - Recommendation: Manual promotion only

4. **How to handle contradictory directions?**
   - "Act 1 ends with violence" vs "Act 1 ends with calm"
   - Lint warning? Force resolution?
   - Recommendation: Warn, let user resolve

---

## 16. Future Enhancements (Post-MVP)

### 16.1 Idea Templates
```
Template: "Crime Mystery Setup"
- Question: "Who committed the crime?"
- Question: "What was the method?"
- Question: "What's the motivation?"
- Constraint: "Clues must be present by Act 2"
```

### 16.2 Idea Linking
```
DEPENDS_ON: Idea → Idea
CONTRADICTS: Idea ↔ Idea
RESOLVES: Idea → Idea
```

### 16.3 AI Idea Suggestions
```
"Based on your story, you might want to clarify:
 - How does Cain know Rigo's location?
 - Why does Morrison risk everything for this scheme?"
 
[Create Question Ideas]
```

### 16.4 Idea Board UI
```
Kanban board view:
[Open Questions] [In Discussion] [Resolved] [Promoted]
```

---

## 17. Comparison to Alternatives

| Approach | Pros | Cons |
|----------|------|------|
| **Enhanced Ideas (this spec)** | Uses existing infra; no new types; flexible; low latency | Requires careful filtering; ideas can still accumulate |
| **New "Intent" node type** | Clean separation; custom edges | Duplicate infra; parallel UI; more complexity |
| **Intent Board UI** | Visual organization | UI-only; doesn't solve pre-artifact discussion gap |
| **StoryContext discussion** | Central location | Bloats prompts; not first-class; hard to filter |
| **Do nothing** | No work | Problem persists: users jump from vague → concrete |

**Winner: Enhanced Ideas** - addresses root cause, minimal overhead, uses existing infrastructure

---

## 18. Acceptance Criteria

**Phase 1 Complete When:**
- [ ] Idea type has all new fields
- [ ] API endpoints accept/return new fields
- [ ] filterIdeas() implements enhanced logic
- [ ] getIdeasForTask() uses new filtering
- [ ] Tests pass for filtering edge cases

**Phase 2 Complete When:**
- [ ] Auto-tagging works for AI-generated ideas
- [ ] Provenance tracked on package acceptance
- [ ] Ideas show "Used in N artifacts"
- [ ] Freshness scores computed correctly

**Phase 3 Complete When:**
- [ ] UI shows kind badges
- [ ] Create form has kind selector
- [ ] Idea cards display new fields
- [ ] Provenance links work

**Phase 4 Complete When:**
- [ ] /discuss endpoint functional
- [ ] Discussion thread displays
- [ ] Resolution workflow complete
- [ ] Async processing works

---

## 19. Conclusion

This spec proposes enhancing the existing `Idea` node type to serve as a flexible planning layer between loose user thoughts and concrete story artifacts. By adding:

1. **Kind taxonomy** (question, direction, constraint, note, proposal)
2. **Smart deterministic filtering** (no LLM pre-filter needed)
3. **Generation-time tagging** (automatic context capture)
4. **Provenance tracking** (which ideas informed which artifacts)
5. **Optional discussion feature** (async AI conversation)

We create a space for users to **explore, clarify, and document intent** before jumping to generation, without adding new node types, complex UIs, or latency overhead.

**This directly addresses your core complaint:** "I want something like a scratchpad where I can discuss questions or issues before generating tangible artifacts."

**Next step:** Approve for implementation or discuss modifications.
