# Orchestration Migration Spec

**Date:** 2025-06-01  
**Status:** Proposal  
**Author:** Esh (AI Assistant) + Ed  

---

## 1. Executive Summary

Migrate from a dual-path generation system (Manual Mode vs Smart Mode toggle) to a single unified orchestration layer. The orchestrator always runs, combining structured UI controls, freeform text direction, and story state context to intelligently route generation requests.

**Key changes:**
- Remove the "Smart mode" toggle from UI
- Reframe UI controls as "intent capture" rather than "manual configuration"
- Build smarter orchestration that combines all available signals
- Integrate Impact Analysis into package results
- Specialized endpoints become internal tools, not user-facing options

---

## 2. Current State

### 2.1 Dual-Path Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   GENERATION PANEL                       │
│  ☐ Smart mode — let AI decide how to generate           │
└─────────────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   Smart Mode OFF          Smart Mode ON
        │                       │
        ▼                       ▼
   Form controls           Freeform only
   (Mode, Scope, Focus)    (Direction text)
        │                       │
        ▼                       ▼
   /propose/story-beats    /agents/run
   /propose/characters     (interpreter)
   /propose/scenes
   /propose/expand
```

### 2.2 Problems with Current State

| Problem | Impact |
|---------|--------|
| Parallel code paths | Maintenance burden, feature drift |
| User confusion | "Should I use Smart mode?" |
| Context loss | Smart mode ignores structured controls |
| No unified routing logic | Each path has its own decision-making |
| Impact analysis not integrated | Users can't see what packages fulfill/create |

---

## 3. Proposed Architecture

### 3.1 Single Orchestration Path

```
┌─────────────────────────────────────────────────────────┐
│                   GENERATION PANEL                       │
├─────────────────────────────────────────────────────────┤
│  📊 CONTEXT (read-only)                                  │
│  Gaps: Catalyst, Midpoint | Act 2 thin | Sarah orphan   │
├─────────────────────────────────────────────────────────┤
│  🎯 INTENT (structured controls)                         │
│  What: [StoryBeats ▼]  Where: [Act 2 ▼] [Catalyst ▼]   │
├─────────────────────────────────────────────────────────┤
│  💬 DIRECTION (freeform text)                            │
│  "Focus on building tension"                             │
├─────────────────────────────────────────────────────────┤
│  [Generate]                                              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              UNIFIED ORCHESTRATOR                        │
│                                                          │
│  Inputs:                                                 │
│  ├─ Story state (gaps, coverage, nodes, edges)          │
│  ├─ Structured intent (mode, scope, focus) [optional]   │
│  └─ Freeform direction (text) [optional]                │
│                                                          │
│  Logic:                                                  │
│  1. Analyze story state                                  │
│  2. Interpret user intent from all signals               │
│  3. Select generation strategy                           │
│  4. Call appropriate specialized endpoint                │
│  5. Run impact analysis on results                       │
│  6. Return packages with impact data                     │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   storyBeatOrch    characterOrch    sceneOrch    (internal)
          │               │               │
          └───────────────┴───────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              PACKAGES + IMPACT                           │
├─────────────────────────────────────────────────────────┤
│  Package 1: "Catalyst Confrontation"                     │
│  ├─ ✓ Fulfills: beat_Catalyst                           │
│  ├─ → Creates: Need intro for Detective Reyes           │
│  └─ ⚠ Temporal: Reyes mentioned at Setup, intro'd later │
├─────────────────────────────────────────────────────────┤
│  Package 2: "The Discovery"                              │
│  ├─ ✓ Fulfills: beat_Catalyst                           │
│  └─ ✓ Clean (uses existing characters)                  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Signal Hierarchy

The orchestrator combines multiple signals to determine generation strategy:

| Signal | Source | Priority | Example |
|--------|--------|----------|---------|
| Structured intent | UI controls | High | `mode: StoryBeats, focus: Catalyst` |
| Freeform direction | Text input | High | "Focus on tension" |
| Story state | Auto-analyzed | Medium | "Catalyst gap detected" |
| Defaults | System | Low | "Generate 3 packages" |

**Resolution rules:**
1. If structured intent provided → use it directly
2. If only freeform text → interpret intent from text + state
3. If neither → suggest based on state (gaps, coverage)
4. Freeform direction always passed to generation as `direction` param

### 3.3 Intent Resolution Examples

| Structured | Freeform | State | Result |
|------------|----------|-------|--------|
| `StoryBeats, Catalyst` | — | — | Call storyBeatOrch targeting Catalyst |
| — | "add a villain" | Has characters | Call characterOrch |
| — | "fill out act 2" | Act 2 gaps | Call storyBeatOrch for Act 2 beats |
| `Scenes` | "tense confrontation" | StoryBeats exist | Call sceneOrch with direction |
| — | — | Catalyst missing | Suggest: "Generate Catalyst beat?" |

---

## 4. Component Design

### 4.1 Unified Orchestrator

```typescript
// packages/api/src/ai/unifiedOrchestrator.ts

export interface OrchestrationRequest {
  storyId: string;
  
  // Structured intent (from UI controls)
  intent?: {
    mode?: 'storyBeats' | 'characters' | 'scenes' | 'expand';
    scope?: 'act1' | 'act2' | 'act3' | 'full';
    focus?: string[];  // beat IDs, node IDs, etc.
  };
  
  // Freeform direction (from text input)
  direction?: string;
  
  // Generation params
  packageCount?: number;
  creativity?: number;
}

export interface OrchestrationResponse {
  sessionId: string;
  packages: NarrativePackage[];  // With impact analysis attached
  
  // Orchestration metadata
  orchestration: {
    resolvedIntent: ResolvedIntent;
    strategyUsed: string;
    stateAnalysis: StateAnalysis;
  };
}

export interface ResolvedIntent {
  mode: 'storyBeats' | 'characters' | 'scenes' | 'expand' | 'interpret';
  targets: string[];
  direction?: string;
  confidence: number;
  reasoning: string;
}

export interface StateAnalysis {
  gaps: GapInfo[];
  coverage: CoverageInfo;
  suggestions: string[];
}
```

### 4.2 Intent Resolution

```typescript
// packages/api/src/ai/intentResolver.ts

export interface IntentResolverInput {
  structured?: OrchestrationRequest['intent'];
  freeform?: string;
  storyState: {
    gaps: GapInfo[];
    coverage: CoverageInfo;
    nodeTypes: Record<string, number>;
  };
}

export function resolveIntent(input: IntentResolverInput): ResolvedIntent {
  const { structured, freeform, storyState } = input;
  
  // Priority 1: Structured intent provided
  if (structured?.mode) {
    return {
      mode: structured.mode,
      targets: structured.focus || [],
      direction: freeform,
      confidence: 1.0,
      reasoning: 'User selected mode explicitly'
    };
  }
  
  // Priority 2: Interpret from freeform text
  if (freeform) {
    return interpretFreeformIntent(freeform, storyState);
  }
  
  // Priority 3: Suggest based on state
  return suggestFromState(storyState);
}

function interpretFreeformIntent(
  text: string, 
  state: IntentResolverInput['storyState']
): ResolvedIntent {
  // Keyword matching + state context
  const lowerText = text.toLowerCase();
  
  // Character signals
  if (lowerText.match(/character|protagonist|antagonist|villain|hero/)) {
    return {
      mode: 'characters',
      targets: [],
      direction: text,
      confidence: 0.8,
      reasoning: 'Detected character-related keywords'
    };
  }
  
  // Scene signals
  if (lowerText.match(/scene|location|setting|int\.|ext\./)) {
    return {
      mode: 'scenes',
      targets: [],
      direction: text,
      confidence: 0.8,
      reasoning: 'Detected scene-related keywords'
    };
  }
  
  // Beat/structure signals
  if (lowerText.match(/beat|catalyst|midpoint|act \d|structure/)) {
    return {
      mode: 'storyBeats',
      targets: extractBeatReferences(text),
      direction: text,
      confidence: 0.8,
      reasoning: 'Detected structure-related keywords'
    };
  }
  
  // Default: use interpret mode for ambiguous requests
  return {
    mode: 'interpret',
    targets: [],
    direction: text,
    confidence: 0.5,
    reasoning: 'No clear intent detected, using interpretation'
  };
}

function suggestFromState(
  state: IntentResolverInput['storyState']
): ResolvedIntent {
  // Find most pressing gap
  const priorityGap = state.gaps
    .sort((a, b) => b.priority - a.priority)[0];
  
  if (priorityGap) {
    return {
      mode: 'storyBeats',
      targets: [priorityGap.beatId],
      confidence: 0.6,
      reasoning: `Suggesting to fill ${priorityGap.beatType} gap`
    };
  }
  
  // No obvious suggestion
  return {
    mode: 'interpret',
    targets: [],
    confidence: 0.3,
    reasoning: 'No gaps detected, awaiting user direction'
  };
}
```

### 4.3 Orchestration Flow

```typescript
// packages/api/src/ai/unifiedOrchestrator.ts

export async function orchestrate(
  request: OrchestrationRequest,
  ctx: StorageContext,
  llmClient: LLMClient
): Promise<OrchestrationResponse> {
  const { storyId, intent, direction, packageCount, creativity } = request;
  
  // 1. Load story state
  const graph = await loadGraphById(storyId, ctx);
  const gaps = computeGaps(graph);
  const coverage = computeCoverage(graph);
  
  // 2. Resolve intent
  const resolvedIntent = resolveIntent({
    structured: intent,
    freeform: direction,
    storyState: { gaps, coverage, nodeTypes: countNodeTypes(graph) }
  });
  
  // 3. Route to appropriate generator
  let result: GenerationResult;
  
  switch (resolvedIntent.mode) {
    case 'storyBeats':
      result = await proposeStoryBeats(storyId, {
        priorityBeats: resolvedIntent.targets,
        direction: resolvedIntent.direction,
        packageCount,
        creativity
      }, ctx, llmClient);
      break;
      
    case 'characters':
      result = await proposeCharacters(storyId, {
        direction: resolvedIntent.direction,
        packageCount
      }, ctx, llmClient);
      break;
      
    case 'scenes':
      result = await proposeScenes(storyId, {
        storyBeatIds: resolvedIntent.targets,
        direction: resolvedIntent.direction,
        packageCount
      }, ctx, llmClient);
      break;
      
    case 'expand':
      result = await proposeExpand(storyId, {
        target: resolvedIntent.targets[0],
        direction: resolvedIntent.direction,
        packageCount
      }, ctx, llmClient);
      break;
      
    case 'interpret':
    default:
      result = await interpretAndGenerate(storyId, {
        userInput: resolvedIntent.direction || '',
        packageCount
      }, ctx, llmClient);
      break;
  }
  
  // 4. Run impact analysis on all packages
  const packagesWithImpact = ai.validatePackages(result.packages, graph);
  
  // 5. Optionally enrich with LLM analysis
  // (behind feature flag or user setting)
  
  return {
    sessionId: result.sessionId,
    packages: packagesWithImpact,
    orchestration: {
      resolvedIntent,
      strategyUsed: resolvedIntent.mode,
      stateAnalysis: {
        gaps,
        coverage,
        suggestions: generateSuggestions(gaps, coverage)
      }
    }
  };
}
```

---

## 5. UI Changes

### 5.1 GenerationPanel Modifications

**Remove:**
- `aiAssisted` state and "Smart mode" checkbox
- Conditional rendering based on mode

**Reframe:**
- Mode selector → "What to generate"
- Scope/Focus → "Where to focus"
- Direction → "Additional guidance"

**Add:**
- Context section showing gaps/coverage
- Impact display in package results

### 5.2 Updated Component Structure

```tsx
// packages/ui/src/components/workspace/GenerationPanel.tsx

function GenerationPanel() {
  // No more aiAssisted toggle
  
  const [intent, setIntent] = useState<GenerationIntent>({
    mode: undefined,      // Optional: user can leave unset
    scope: undefined,
    focus: []
  });
  const [direction, setDirection] = useState('');
  
  // Load story state for context display
  const { gaps, coverage } = useStoryState(storyId);
  
  const handleGenerate = async () => {
    // Single endpoint, always orchestrated
    const result = await api.post(`/stories/${storyId}/generate`, {
      intent: hasAnyIntent(intent) ? intent : undefined,
      direction: direction || undefined,
      packageCount: 3
    });
    
    setPackages(result.packages);
    setOrchestrationInfo(result.orchestration);
  };
  
  return (
    <Panel>
      {/* Context Section - Always visible */}
      <ContextSection>
        <GapIndicators gaps={gaps} />
        <CoverageSummary coverage={coverage} />
      </ContextSection>
      
      {/* Intent Section - All optional */}
      <IntentSection>
        <ModeSelector 
          value={intent.mode} 
          onChange={mode => setIntent({...intent, mode})}
          placeholder="Any (AI decides)"
        />
        <ScopeSelector 
          value={intent.scope}
          onChange={scope => setIntent({...intent, scope})}
          placeholder="Full story"
        />
        <FocusSelector
          value={intent.focus}
          onChange={focus => setIntent({...intent, focus})}
          suggestions={gaps.map(g => g.beatId)}
        />
      </IntentSection>
      
      {/* Direction - Optional freeform */}
      <DirectionInput
        value={direction}
        onChange={setDirection}
        placeholder="Additional guidance (optional)"
      />
      
      <GenerateButton onClick={handleGenerate}>
        Generate
      </GenerateButton>
      
      {/* Results with Impact */}
      {packages && (
        <PackageResults 
          packages={packages}
          orchestrationInfo={orchestrationInfo}
        />
      )}
    </Panel>
  );
}
```

### 5.3 Package Card with Impact

```tsx
function PackageCard({ pkg, orchestrationInfo }) {
  return (
    <Card>
      <Title>{pkg.title}</Title>
      <Rationale>{pkg.rationale}</Rationale>
      
      {/* Impact Section */}
      <ImpactSection>
        {pkg.impact.fulfills_gaps.length > 0 && (
          <FulfillsList>
            ✓ Fulfills: {pkg.impact.fulfills_gaps.map(formatBeat).join(', ')}
          </FulfillsList>
        )}
        
        {pkg.impact.creates_gaps.length > 0 && (
          <CreatesList>
            → Creates: {pkg.impact.creates_gaps.join(', ')}
          </CreatesList>
        )}
        
        {pkg.validation?.temporalViolations?.length > 0 && (
          <WarningsList>
            ⚠ {pkg.validation.temporalViolations.map(v => v.message).join('; ')}
          </WarningsList>
        )}
        
        {!hasIssues(pkg) && (
          <CleanBadge>✓ Clean</CleanBadge>
        )}
      </ImpactSection>
      
      <Actions>
        <AcceptButton />
        <RefineButton />
        <RejectButton />
      </Actions>
    </Card>
  );
}
```

---

## 6. API Changes

### 6.1 New Unified Endpoint

```typescript
// POST /stories/:id/generate
// Replaces the need to choose between multiple endpoints

interface GenerateRequest {
  // Structured intent (optional)
  intent?: {
    mode?: 'storyBeats' | 'characters' | 'scenes' | 'expand';
    scope?: 'act1' | 'act2' | 'act3' | 'full';
    focus?: string[];
  };
  
  // Freeform direction (optional)
  direction?: string;
  
  // Generation params
  packageCount?: number;
  creativity?: number;
}

interface GenerateResponse {
  success: boolean;
  data: {
    sessionId: string;
    packages: NarrativePackage[];  // With impact attached
    orchestration: {
      resolvedIntent: ResolvedIntent;
      strategyUsed: string;
      stateAnalysis: StateAnalysis;
    };
  };
}
```

### 6.2 Existing Endpoints (Kept as Internal)

These remain but are called by the orchestrator, not directly by UI:

| Endpoint | Status | Called By |
|----------|--------|-----------|
| `POST /propose/story-beats` | Internal | Orchestrator |
| `POST /propose/characters` | Internal | Orchestrator |
| `POST /propose/scenes` | Internal | Orchestrator |
| `POST /propose/expand` | Internal | Orchestrator |
| `POST /agents/run` | Internal | Orchestrator (interpret mode) |

### 6.3 Deprecation Path

1. **Phase 1:** Add `/generate` endpoint, keep old endpoints public
2. **Phase 2:** Update UI to use `/generate` only
3. **Phase 3:** Mark old endpoints as deprecated in docs
4. **Phase 4:** (Optional) Make old endpoints internal-only

---

## 7. Impact Analysis Integration

### 7.1 Flow

```
Generation Response
        │
        ▼
┌─────────────────────────────────────┐
│     Impact Analysis Pipeline        │
├─────────────────────────────────────┤
│ 1. computeImpact(pkg, graph)        │
│    └─ fulfills_gaps (deterministic) │
│    └─ structural conflicts          │
│                                     │
│ 2. validateProposalMentions(pkg)    │
│    └─ temporal violations           │
│                                     │
│ 3. enrichWithAgent(pkg) [optional]  │
│    └─ creates_gaps (LLM)            │
│    └─ semantic conflicts (LLM)      │
└─────────────────────────────────────┘
        │
        ▼
Package with full impact data
```

### 7.2 Impact Display Priority

| Type | Severity | Display |
|------|----------|---------|
| Fulfills gaps | Positive | ✓ Green checkmark |
| Creates gaps | Neutral | → Arrow, informational |
| Temporal violation | Warning | ⚠ Yellow warning |
| Structural conflict | Error | ❌ Red error |
| Clean (no issues) | Positive | ✓ "Clean" badge |

---

## 8. Migration Plan

### Phase 1: Backend Infrastructure (Week 1)
- [ ] Create `unifiedOrchestrator.ts`
- [ ] Create `intentResolver.ts`
- [ ] Add `POST /stories/:id/generate` endpoint
- [ ] Ensure impact analysis runs on all generation paths
- [ ] Add orchestration metadata to responses
- [ ] Unit tests for intent resolution

### Phase 2: UI Migration (Week 2)
- [ ] Remove `aiAssisted` state and toggle
- [ ] Reframe controls as intent capture
- [ ] Add context section (gaps/coverage display)
- [ ] Update GenerationPanel to use `/generate`
- [ ] Add impact display to PackageCard
- [ ] Update package carousel for new response shape

### Phase 3: Polish & Deprecation (Week 3)
- [ ] Add loading states for orchestration
- [ ] Add "AI reasoning" expandable section
- [ ] Mark old endpoints as deprecated
- [ ] Update API documentation
- [ ] End-to-end testing

### Phase 4: Enhancements (Future)
- [ ] LLM-based intent interpretation for ambiguous cases
- [ ] Multi-step orchestration (generate → refine loop)
- [ ] Proactive suggestions ("You should add a Catalyst")
- [ ] Learning from user corrections

---

## 9. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Code paths for generation | 2 (manual/smart) | 1 (unified) |
| User decision points | 1 (toggle) + N (controls) | N (controls only) |
| Impact visibility | None | 100% of packages |
| Time to first generate | ~5 clicks | ~2 clicks |

---

## 10. Open Questions

1. **Should intent resolution use LLM?**
   - Pro: Better understanding of ambiguous requests
   - Con: Added latency, cost
   - Recommendation: Start with keyword matching, add LLM as optional enhancement

2. **How to handle conflicting signals?**
   - User selects "Characters" but types "add a scene"
   - Recommendation: Structured intent takes priority, show warning

3. **Should we show orchestration reasoning to users?**
   - "I'm generating story beats because you have a Catalyst gap"
   - Recommendation: Yes, in collapsible "AI reasoning" section

4. **Proactive generation suggestions?**
   - "Your Catalyst is missing. Generate now?"
   - Recommendation: Phase 4 enhancement, not MVP
