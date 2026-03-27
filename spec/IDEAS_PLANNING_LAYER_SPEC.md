# Ideas as Planning Layer - Specification

**Date:** 2026-02-01  
**Status:** Proposal  
**Supersedes:** `idea_board.md`  
**Author:** Esh (AI Assistant)  

---

## 1. Executive Summary

**Problem:** There's a gap between loose user thoughts ("I want Act 1 to end with comic relief before violence") and concrete artifacts (PlotPoints, Scenes). The current workflow forces users to jump directly from vague direction to concrete proposals, without a space to explore, discuss, and clarify intent first.

**Solution:** Enhance the existing `Idea` node type to serve as a flexible planning and discussion layer (UI: **"Planning"** section). Ideas become a scratchpad where users can:
- Ask questions ("Who committed the crime and why?")
- State directions ("Act 1 should end with humanizing moment")
- Capture constraints ("No supernatural elements")
- Discuss with AI before generating artifacts
- Track which ideas informed which artifacts (provenance)

**Why not a new "Intent" node type?** Ideas already exist, have UI, have API endpoints, and are already filtered/serialized for prompts. Extending Ideas is simpler than creating parallel infrastructure.

**Why not the "Intent Board" UI proposal?** A planning board for PlotPoints is UI polish, not a solution to the core problem (need for pre-artifact discussion). We can add that later if needed, but it doesn't address the workflow gap.

---

## 2. Core Problem Analysis

### 2.1 Current Workflow (Forced Leap)

```
User thought: "I want comic relief before the violence"
  ↓ (no intermediate step)
PlotPoint generation: "Generate beats for Catalyst"
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
| **PlotPoints** | Too concrete; requires commitment to structure before exploration |
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
  suggestedType?: 'PlotPoint' | 'Scene' | 'Character' | 'Location' | 'Object';
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
  
  /** Refinement lineage (tracks iteration) */
  parent_idea_id?: string;           // If refined from another idea
  refinement_guidance?: string;      // User guidance that created this
  
  /** Targeted context (generation filtering) */
  targetBeat?: string;           // "beat_Catalyst"
  targetAct?: 1 | 2 | 3 | 4 | 5; // Act 1, 2, etc
  targetScene?: string;          // Specific scene this relates to
  
  /** Thematic tags for filtering */
  themes?: string[];             // ["betrayal", "redemption"]
  moods?: string[];              // ["tense", "reflective"]
  
  /** Generation tracking */
  generationContext?: {
    task: string;                // "generate-plotpoints-for-catalyst"
    timestamp: string;
    promptSnippet?: string;      // First 200 chars of user input
  };
  
  /** Provenance: which artifacts used this idea */
  informedArtifacts?: Array<{
    artifactId: string;          // "plotpoint_xyz"
    artifactType: 'PlotPoint' | 'Scene' | 'Character';
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
    case 'PlotPoint': {
      // Check if there's a PlotPoint with similar title
      const beats = getNodesByType<PlotPoint>(graph, 'PlotPoint');
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
  | 'plotPoint'
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
  if (['plotPoint', 'scene', 'generate', 'expand'].includes(taskType)) {
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

## 7. Idea Refinement (Conversational Iteration)

### 7.1 The Refine Pattern for Ideas

Instead of a separate discussion thread, we **reuse the existing refine pattern** already built for PlotPoints and Scenes. This provides structured iteration without building new infrastructure.

**Core concept:** User provides guidance → System generates 2-3 refined variants → User picks one or refines further

### 7.2 Refinement Flow

```typescript
POST /stories/:id/ideas/:ideaId/refine
{
  guidance: "Consider Morrison's military background and Flores' loyalty",
  generateArtifacts?: boolean  // Also suggest concrete PlotPoints/Scenes?
}

Response:
{
  sessionId: "session_xyz",
  variants: [
    {
      id: "idea_refined_1",
      parent_idea_id: "idea_original",
      kind: "question",
      title: "Why would Flores follow Morrison's orders?",
      description: "Given Morrison's military background as Flores' former CO...",
      resolution: "Loyalty from military service + guilt over past mission",
      resolutionStatus: "resolved",
      confidence: 0.85
    },
    {
      id: "idea_refined_2",
      kind: "direction",
      title: "Establish Morrison-Flores military connection early",
      description: "Show flashback or reference in Act 1...",
      suggestedArtifacts: [
        {
          type: "PlotPoint",
          title: "Flores follows orders without question",
          summary: "Scene showing Flores' automatic deference to Morrison",
          rationale: "Establishes their dynamic before the heist"
        }
      ]
    }
  ]
}
```

### 7.3 Refinement Modes by Idea Kind

**For QUESTION ideas:**
- Generate more specific sub-questions, OR
- Suggest resolution with reasoning, OR
- Clarify what the question is really asking

**For DIRECTION ideas:**
- Make more specific and actionable, OR
- Suggest concrete PlotPoints that realize it, OR
- Identify prerequisites to achieve it

**For CONSTRAINT ideas:**
- Clarify the boundaries, OR
- Add concrete examples of violations/compliance

### 7.4 Implementation

**Reuse existing `refineOrchestrator` pattern:**

```typescript
// New: ideasRefineOrchestrator.ts
export async function refineIdea(
  storyId: string,
  ideaId: string,
  guidance: string,
  ctx: StorageContext,
  llmClient: LLMClient,
  options?: { generateArtifacts?: boolean }
): Promise<{
  sessionId: string;
  variants: Idea[];
  suggestedArtifacts?: NarrativePackage[];
}> {
  // 1. Load idea and context
  const graph = await loadGraphById(storyId, ctx);
  const idea = getNode(graph, ideaId) as Idea;
  const storyContext = serializeStoryState(graph, metadata);
  
  // 2. Get constraints and related ideas
  const constraints = filterIdeas(graph, { kind: 'constraint' });
  const relatedIdeas = filterIdeas(graph, { 
    relatedNodeIds: idea.relatedNodeIds,
    maxIdeas: 5 
  });
  
  // 3. Build refinement prompt
  const prompt = buildIdeaRefinementPrompt({
    idea,
    guidance,
    storyContext,
    relatedIdeas,
    constraints
  });
  
  // 4. Call LLM (same as PlotPoint refine)
  const response = await llmClient.complete(prompt);
  const parsed = parseIdeaRefinementResponse(response.content);
  
  // 5. Create variant Idea nodes
  const variants: Idea[] = parsed.variants.map(v => ({
    type: 'Idea',
    id: v.id,
    title: v.title,
    description: v.description,
    kind: v.kind,
    source: 'ai',
    parent_idea_id: ideaId,           // NEW: track lineage
    refinement_guidance: guidance,     // NEW: what prompted this
    resolution: v.resolution,
    resolutionStatus: v.resolution ? 'resolved' : 'discussed',
    confidence: v.confidence,
    createdAt: new Date().toISOString(),
    // Inherit context from parent
    targetBeat: idea.targetBeat,
    targetAct: idea.targetAct,
    themes: idea.themes,
    category: idea.category,
  }));
  
  // 6. Create session to hold variants
  const session = await createGenerationSession(
    storyId,
    { type: 'idea_refinement', ideaId },
    { depth: 'narrow', count: variants.length },
    ctx
  );
  
  // 7. Optionally generate artifacts from suggestions
  let suggestedArtifacts: NarrativePackage[] | undefined;
  if (options?.generateArtifacts && parsed.variants.some(v => v.suggestedArtifacts?.length)) {
    suggestedArtifacts = await generatePackagesFromIdeaSuggestions(
      parsed.variants,
      graph,
      llmClient
    );
  }
  
  return { sessionId: session.id, variants, suggestedArtifacts };
}
```

### 7.5 Refinement Prompt

```typescript
// New: prompts/ideaRefinementPrompt.ts
export function buildIdeaRefinementPrompt(params: {
  idea: Idea;
  guidance: string;
  storyContext: string;
  relatedIdeas: Idea[];
  constraints: Idea[];
}): string {
  const { idea, guidance, storyContext, relatedIdeas, constraints } = params;
  
  return `## Idea Refinement v1.0.0

Refine this planning idea based on user guidance.

## Original Idea
**Kind:** ${idea.kind || 'proposal'}
**Title:** ${idea.title}
**Description:** ${idea.description}
${idea.resolution ? `**Current Resolution:** ${idea.resolution}` : ''}

## User Guidance
"${guidance}"

## Story Context
${storyContext}

${constraints.length > 0 ? `
## Constraints (must respect)
${constraints.map(c => `- ${c.title}: ${c.description}`).join('\n')}
` : ''}

${relatedIdeas.length > 0 ? `
## Related Ideas
${relatedIdeas.map(i => `- ${i.title}: ${i.description.slice(0, 100)}`).join('\n')}
` : ''}

## Your Task

Based on the guidance, generate 2-3 refined variants of this idea:

1. **If QUESTION:** Provide more specific sub-questions OR suggest resolution OR clarify intent
2. **If DIRECTION:** Make more specific and actionable OR suggest concrete PlotPoints
3. **If CONSTRAINT:** Clarify boundaries OR add concrete examples

## Output Format

\`\`\`json
{
  "variants": [
    {
      "id": "idea_refined_{timestamp}_{chars}",
      "kind": "question" | "direction" | "constraint" | "note",
      "title": "Refined title",
      "description": "More specific description incorporating guidance",
      "resolution": "If question, suggested answer",
      "confidence": 0.0-1.0,
      "suggestedArtifacts": [
        {
          "type": "PlotPoint" | "Scene",
          "title": "...",
          "summary": "...",
          "rationale": "Why this realizes the idea"
        }
      ]
    }
  ]
}
\`\`\`

Each variant should incorporate the user's guidance and move toward either:
- A clearer question with possible resolution
- A more specific, actionable direction
- Concrete artifacts that realize the idea

Output JSON only.`;
}
```

### 7.6 Why This Is Better Than Chat

| Aspect | Chat/Discussion | Refine Pattern |
|--------|-----------------|----------------|
| **Infrastructure** | New endpoints, storage for threads | Reuses existing refine system |
| **UX** | Open-ended conversation | Structured convergence |
| **Output** | Text thread | Concrete Idea variants |
| **Progress** | Can circle endlessly | Each step moves forward |
| **Artifacts** | Manual bridge | Natural transition to PlotPoints |
| **Complexity** | Medium | Low (existing code) |

### 7.7 Workflow Example

```
1. User creates Question Idea:
   "Who committed the crime?"

2. User provides guidance:
   "Consider Morrison's military background"

3. System generates variants:
   - Variant A: "Why would Morrison risk his career for this?"
   - Variant B: Resolved: "Morrison organized it using police authority"
   - Variant C: Direction: "Reveal Morrison gradually in Act 2"

4. User picks Variant B (resolved question)
   → Marks as resolved
   → Next generation includes: "Established: Morrison organized crime"

5. User picks Variant C (direction)
   → Clicks "Generate PlotPoint from this"
   → System creates beat with this direction
```

---

## 8. Provenance Tracking

### 8.1 Track Which Ideas Informed Artifacts

When generation uses ideas, record provenance:

```typescript
// During generation (in orchestrator)
const ideasResult = getIdeasForTask(graph, 'plotPoint', { targetBeat: 'beat_Catalyst' });

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
- "Used in 3 PlotPoints" (link to artifacts)
- "Last used: 2 hours ago"

**PlotPoint/Scene shows:**
- "Informed by Ideas: [link] [link]"

**Benefits:**
- See which ideas are actually useful
- Understand why artifacts were generated
- Clean up unused ideas

---

## 9. API Endpoints

### 9.1 API Path Naming

**Options:**

1. **Keep `/ideas` paths** (node type name):
   - `POST /stories/:id/ideas`
   - `GET /stories/:id/ideas`
   - Backend consistency (node type = Idea)

2. **Change to `/planning` paths** (UI label):
   - `POST /stories/:id/planning`
   - `GET /stories/:id/planning`
   - Frontend clarity (matches UI)

**Recommendation:** Keep `/ideas` for API paths (node type), use "Planning" for UI labels only. This keeps backend/frontend concerns separated.

**Note:** If you prefer full alignment, changing API paths is fine since backward compatibility is not a constraint.

### 9.2 Core Endpoints

**POST /stories/:id/ideas** (enhanced, breaking changes):
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

### 9.3 New Endpoints

**POST /stories/:id/ideas/:ideaId/refine**
```typescript
Request:
{
  guidance: "Consider Morrison's military background",
  generateArtifacts?: boolean  // Also suggest PlotPoints/Scenes?
}

Response:
{
  sessionId: "session_xyz",
  variants: [
    {
      id: "idea_refined_1",
      parent_idea_id: "idea_original",
      kind: "question",
      title: "...",
      description: "...",
      resolution: "...",
      confidence: 0.85
    }
  ],
  suggestedArtifacts?: [...] // If generateArtifacts: true
}
```

**GET /stories/:id/ideas/:ideaId/refinement-history**
```typescript
Response:
{
  idea: {...},
  refinements: [
    {
      id: "idea_refined_1",
      guidance: "Consider Morrison...",
      createdAt: "...",
      confidence: 0.85
    }
  ]
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
      id: 'plotpoint_xyz',
      type: 'PlotPoint',
      title: '...',
      packageId: 'pkg_...',
      createdAt: '...'
    }
  ],
  usageHistory: [
    {
      task: 'generate-plotpoints-catalyst',
      timestamp: '...',
      included: true
    }
  ]
}
```

---

## 10. UI Changes

### 10.1 Naming: "Ideas" → "Planning"

**UI Label Change:**
- Section name: "Ideas" → **"Planning"**
- Dropdown: "Ideas" → **"Planning"**
- Empty state: "No ideas yet" → **"No planning notes yet"**
- Create button: "+ New Idea" → **"+ Add to Planning"**

**Why "Planning":**
- Clear distinction from "Elements" section (planning vs concrete)
- Matches spec purpose: "Ideas as Planning Layer"
- Broad enough to cover questions, directions, constraints, proposals
- Professional and actionable

**Stash Dropdown (updated):**
```
Stash:
├─ Plot Points (3)
├─ Scenes (5)
└─ Planning (12)    ← renamed from "Ideas"
```

### 10.2 Planning Section Layout

**Enhanced Planning UI:**
```
Planning

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
│    [Edit] [Generate PlotPoint]      │
└─────────────────────────────────────┘

┌─ PROPOSALS (existing behavior) ────┐
│ 💡 Character: Elena Marquez (IA)   │
│ 💡 Scene: Marina meeting            │
└─────────────────────────────────────┘

[+ New Idea]
```

### 10.3 Planning Card Details

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
│ [Refine with AI] [Mark Resolved]   │
│                                     │
│ Refinements (2):                    │
│  ↳ More specific question           │
│  ↳ Proposed resolution              │
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
│ [Generate PlotPoint from this]     │
│                                     │
│ Informed: plotpoint_xyz (2h ago)   │
└────────────────────────────────────┘
```

### 10.3 Refinement Flow UI

**When user clicks "Refine with AI" on an Idea:**
```
┌─ Refine This Idea ────────────────┐
│ Original: "Who committed the     │
│ crime?"                           │
│                                    │
│ [Add guidance to clarify this...] │
│ "Consider Morrison's military     │
│  background"                       │
│                                    │
│ [Refine] [Cancel]                 │
└────────────────────────────────────┘

After refinement:

┌─ Refined Variants (3) ────────────┐
│                                    │
│ ✓ Option 1: RESOLVED QUESTION     │
│ "Morrison organized crime using   │
│  his police authority"            │
│  Confidence: 85%                  │
│  [Accept & Mark Resolved]         │
│                                    │
│ ⟳ Option 2: SUB-QUESTIONS         │
│ "Why would Morrison risk this?"   │
│ "Who else is involved?"           │
│  [Refine This Further]            │
│                                    │
│ 📍 Option 3: DIRECTION             │
│ "Reveal Morrison gradually in     │
│  Act 2 via Dante"                 │
│  → Suggests PlotPoint              │
│  [Accept & Generate PlotPoint]    │
└────────────────────────────────────┘
```

### 10.6 Generation Flow Integration

**When user clicks "Generate PlotPoints":**
```
┌─ Generate PlotPoints ──────────────┐
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
✓ Generated 3 PlotPoints

These ideas were used:
• Direction: "Act 1 comic relief" ✓
• Proposal: "Dante as informant" ✓

These questions need answers:
• "Who committed the crime?" [Refine to clarify]
```

### 10.7 Bulk Actions

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

### 11.1 Question → Refinement → Resolution → Generation

```
1. User creates Question Idea:
   Title: "Who committed the crime?"
   Description: "Need motivation and method"
   Kind: question
   Status: open

2. User clicks "Refine with AI", provides guidance:
   "Consider Morrison's military background"
   
3. System generates 3 variants:
   - Variant A: "Why would Morrison risk his career?"
   - Variant B: Resolved: "Morrison organized it using police authority"
   - Variant C: "Why would Flores specifically help Morrison?"
   
4. User refines Variant C further:
   "Focus on their military connection"
   
5. System generates refined variants:
   - Resolved: "Flores is ex-military, Morrison was his CO. Loyalty + guilt."
   
6. User accepts resolution
   Status: resolved

7. Next generation automatically includes:
   "Established Context: Flores helps Morrison due to military loyalty and guilt"
   
8. Generated PlotPoint references this context in rationale
```

### 11.2 Direction → Targeted Generation

```
1. User creates Direction Idea:
   Title: "Act 1 ends with humanizing moment"
   Description: "Need comic relief with Dante before violence"
   Kind: direction
   TargetBeat: beat_Catalyst
   TargetAct: 1

2. User clicks "Generate PlotPoint from this"
   System filters ideas:
   - Includes this direction
   - Includes other Act 1 / Catalyst ideas
   - Includes constraints
   
3. Generation prompt includes:
   "## Story Direction
    - Act 1 ends with humanizing moment: Need comic relief with Dante before violence"
   
4. LLM generates PlotPoint aligned with this direction

5. Provenance tracked:
   idea.informedArtifacts.push({
     artifactId: 'plotpoint_xyz',
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

### 12.1 Clean Slate Approach

**Philosophy:** No backward compatibility constraints. Clean migration with data cleanup.

**Migration Steps:**

1. **Audit existing Idea nodes:**
   ```bash
   # CLI tool to inspect
   project-apollo ideas:audit --story <id>
   
   Output:
   - 25 Idea nodes found
   - 10 have suggestedType (proposals)
   - 15 have no suggestedType (unclear)
   - 3 have sourcePackageId (from rejected packages)
   ```

2. **Classify or delete:**
   ```bash
   # Auto-classify where possible
   project-apollo ideas:migrate --story <id> --classify
   
   # Infers kind from content:
   - "Who..." → question
   - "Must not..." → constraint
   - "Act 1 should..." → direction
   - Has suggestedType → proposal
   
   # Delete unclassifiable/old
   project-apollo ideas:clean --older-than 90d --unused
   ```

3. **Fresh schema:**
   ```typescript
   // All new Ideas MUST have:
   {
     kind: IdeaKind,  // Required, no default
     resolutionStatus: 'open',  // Required
     createdAt: string,  // Required
     // Old optional fields now ignored/stripped
   }
   ```

4. **UI migration:**
   - Update all "Ideas" labels → "Planning"
   - Add kind selector (required on create)
   - Remove support for schemaless Ideas

**Data Loss Acceptable:**
- Old unclear Ideas can be deleted
- User can recreate important ones with proper structure
- Better to start clean than maintain legacy ambiguity

### 12.2 Migration CLI Commands

**Audit:**
```bash
project-apollo ideas:audit --story neon-noir-test

Output:
┌─────────────────────────────────────────┐
│ Idea Audit Report                       │
├─────────────────────────────────────────┤
│ Total Ideas: 25                         │
│                                          │
│ Classifiable (auto-migrate):      15    │
│  - As proposals: 10                     │
│  - As questions: 3                      │
│  - As directions: 2                     │
│                                          │
│ Ambiguous (review needed):       7      │
│  - Empty descriptions                   │
│  - No suggestedType or clear pattern   │
│                                          │
│ Old (90+ days, unused):          3      │
│  - Candidates for deletion              │
└─────────────────────────────────────────┘

[Review ambiguous] [Auto-migrate classifiable] [Clean old]
```

**Auto-Migrate:**
```bash
project-apollo ideas:migrate --story neon-noir-test --auto

Actions:
✓ Migrated 10 proposals (added kind: 'proposal')
✓ Migrated 3 questions (added kind: 'question')
✓ Migrated 2 directions (added kind: 'direction')
⚠ 7 ambiguous ideas require manual review
⚠ 3 old ideas flagged for deletion

Review ambiguous at: /stories/neon-noir-test/ideas?status=needs_review
```

**Clean:**
```bash
project-apollo ideas:clean --story neon-noir-test --older-than 90d --unused --dry-run

Will delete 3 ideas:
- idea_abc123 (Created: 2025-10-15, Last used: never)
- idea_def456 (Created: 2025-09-20, Last used: never)
- idea_ghi789 (Created: 2025-08-10, Last used: 2025-08-12)

Run without --dry-run to delete.
```

### 12.3 API Breaking Changes (Acceptable)

**Old API (deprecated):**
```typescript
POST /stories/:id/ideas
{
  title: "...",
  description: "...",
  // kind optional, defaults to proposal
}
```

**New API (required fields):**
```typescript
POST /stories/:id/ideas
{
  title: "...",
  description: "...",
  kind: "question" | "direction" | "constraint" | "note" | "proposal",  // REQUIRED
  resolutionStatus?: "open",  // Default
  // Other fields...
}

// Returns 400 if kind missing
```

**Frontend must update** - no backward compatibility in API.

### 12.4 Schema Enforcement

**Old Idea (loose, optional):**
```typescript
{
  type: 'Idea',
  id: string,
  title: string,
  description: string,
  source: 'user' | 'ai',
  suggestedType?: string,  // Optional
  status?: string,          // Optional
  category?: string,        // Optional
  // Everything else optional
}
```

**New Idea (strict, required fields):**
```typescript
{
  type: 'Idea',
  id: string,
  title: string,
  description: string,
  source: 'user' | 'ai',
  kind: IdeaKind,                    // REQUIRED
  resolutionStatus: IdeaResolutionStatus,  // REQUIRED, default 'open'
  createdAt: string,                 // REQUIRED
  // Optional but structured:
  resolution?: string,
  parent_idea_id?: string,
  refinement_guidance?: string,
  targetBeat?: string,
  targetAct?: number,
  themes?: string[],
  // ... other optional metadata
}
```

**Validation on create/update:**
- `kind` is required, no default
- `resolutionStatus` defaults to 'open'
- Old Ideas without `kind` are flagged for migration/deletion

**Database-level:** No migration of old rows required; they can be deleted. Fresh start.

### 12.5 Rollout Strategy (Clean Migration)

**Phase 0: Audit & Clean** (2-3 days)
- Run migration audit on all stories
- Auto-classify where possible
- Delete ambiguous/old Ideas
- User communication: "Planning section getting an upgrade, old notes will be cleaned"

**Phase 1: Schema + API Breaking Change** (1 week)
- Deploy new strict schema (kind required)
- Update API to reject requests without kind
- Migration CLI tools available
- Remove old schemaless Ideas from database

**Phase 2: UI Overhaul** (1 week)
- Rename "Ideas" → "Planning" everywhere
- Add kind selector (required on create)
- Kind badges on cards
- Filtering by kind/status
- Remove support for schemaless display

**Phase 3: Filtering + Generation** (1 week)
- Implement enhanced filterIdeas() with all new fields
- Update getIdeasForTask() 
- Auto-tag AI-generated ideas with context
- Track provenance in orchestrators

**Phase 4: Refinement Feature** (1 week)
- Add ideasRefineOrchestrator
- Add /refine endpoint
- "Refine with AI" UI
- Variant selection
- Resolution workflow

**Phase 5: Polish** (ongoing)
- Bulk actions
- Advanced filters
- Provenance visualization
- Analytics

**User Impact:**
- ⚠️ Old Ideas may be deleted (acceptable)
- ✅ Fresh start with clear structure
- ✅ No legacy ambiguity

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
- [ ] ideasRefineOrchestrator functional
- [ ] /refine endpoint returns variants
- [ ] Refinement variants display in UI
- [ ] Resolution workflow complete
- [ ] Lineage tracking works (parent_idea_id)

---

## 19. Conclusion

This spec proposes enhancing the existing `Idea` node type to serve as a flexible planning layer (UI label: **"Planning"**) between loose user thoughts and concrete story artifacts. By adding:

1. **Kind taxonomy** (question, direction, constraint, note, proposal)
2. **Smart deterministic filtering** (no LLM pre-filter needed)
3. **Generation-time tagging** (automatic context capture)
4. **Provenance tracking** (which ideas informed which artifacts)
5. **Refinement iteration** (reuses existing refine pattern for clarity)

We create a space for users to **explore, clarify, and document intent** before jumping to generation, without adding new node types, complex UIs, or latency overhead.

**This directly addresses your core complaint:** "I want something like a scratchpad where I can discuss questions or issues before generating tangible artifacts."

**Next step:** Approve for implementation or discuss modifications.
