# Impact Analysis Workflow

**Date:** 2025-06-01  
**Status:** Proposal  
**Author:** Esh (AI Assistant)  

---

## 1. Problem Statement

### 1.1 Current State

The generation prompts ask the LLM to produce an `impact` field for each package:

```json
{
  "impact": {
    "fulfills_gaps": ["beat_Catalyst"],
    "creates_gaps": ["Need scene for this beat"],
    "conflicts": []
  }
}
```

However, in practice:
- LLM often returns empty arrays or minimal content
- Quality is inconsistent between generation and refinement calls
- Impact data is purely what the LLM returns — no server-side validation
- Interpretation-sourced proposals hardcode empty impact arrays

### 1.2 Problems This Causes

| Problem | Description |
|---------|-------------|
| **Unreliable data** | Users can't trust the impact analysis shown in UI |
| **Wasted tokens** | Prompts include impact schema/instructions but output is often empty |
| **No validation** | `fulfills_gaps` isn't checked against actual gap/beat alignment |
| **Missing insights** | `creates_gaps` requires reasoning the LLM doesn't reliably do |
| **Inconsistent UX** | Some packages have rich impact, others have nothing |

### 1.3 Goals

1. Provide reliable, accurate impact analysis for every proposal
2. Reduce prompt token usage by removing unreliable impact instructions
3. Compute `fulfills_gaps` deterministically from edges
4. Optionally enrich `creates_gaps` via focused analysis
5. Enable impact as an interactive "commentary layer" for users

---

## 2. Proposed Solution: Separated Impact Analysis

### 2.1 Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Generation Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [User Request]                                              │
│       ↓                                                      │
│  [Generation Prompt] ← Simplified (no impact instructions)   │
│       ↓                                                      │
│  [LLM Response] → nodes, edges, rationale (no impact)        │
│       ↓                                                      │
│  [Deterministic Impact] → fulfills_gaps computed from edges  │
│       ↓                                                      │
│  [Optional: Impact Agent] → creates_gaps, conflicts analysis │
│       ↓                                                      │
│  [Complete Package] → returned to user with full impact      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Impact Computation Tiers

| Tier | What | How | Reliability |
|------|------|-----|-------------|
| **Tier 1: Deterministic** | `fulfills_gaps` | Computed from ALIGNS_WITH edges | 100% accurate |
| **Tier 2: Deterministic** | `conflicts` (structural) | Edge validation, duplicate detection | 100% accurate |
| **Tier 3: LLM-assisted** | `creates_gaps` | Semantic analysis agent | ~80% useful |
| **Tier 4: LLM-assisted** | `conflicts` (semantic) | Constitution/theme analysis | ~80% useful |

---

## 3. Implementation Details

### 3.1 Remove Impact from Generation Prompts

#### 3.1.1 Prompt Changes

Remove impact from JSON schema examples in all generation prompts:

**Before:**
```json
{"packages": [{
  "id": "pkg_{ts}_{5char}",
  "title": "...",
  "rationale": "...",
  "confidence": 0.85,
  "style_tags": ["..."],
  "primary": {...},
  "supporting": {...},
  "impact": {"fulfills_gaps": [], "creates_gaps": [], "conflicts": []}
}]}
```

**After:**
```json
{"packages": [{
  "id": "pkg_{ts}_{5char}",
  "title": "...",
  "rationale": "...",
  "confidence": 0.85,
  "style_tags": ["..."],
  "primary": {...},
  "supporting": {...}
}]}
```

#### 3.1.2 Files to Modify

| File | Change |
|------|--------|
| `storyBeatPrompt.ts` | Remove impact from schema example |
| `characterPrompt.ts` | Remove impact from schema example |
| `scenePrompt.ts` | Remove impact from schema example |
| `expandPrompt.ts` | Remove impact from schema example |
| `generationPrompt.ts` | Remove impact from schema example |
| `refinementPrompt.ts` | Remove impact from schema example (or keep for context) |

#### 3.1.3 Prompt Diff Example (storyBeatPrompt.ts)

```diff
## Output
**JSON Output Rules:**
- NO newlines inside strings (use spaces or \n escape sequences)
- Escape special characters: \" for quotes, \\ for backslashes
- NO trailing commas
- Output ONLY valid JSON, no markdown blocks or explanation

```json
{"packages": [{
  "id": "pkg_{ts}_{5char}",
  "title": "...",
  "rationale": "Why this fits the story",
  "confidence": 0.85,
  "style_tags": ["..."],
  "primary": {
    "type": "StoryBeat",
    "nodes": [...],
    "edges": [...]
  },
- "supporting": {"nodes": [], "edges": []},
- "impact": {"fulfills_gaps": [], "creates_gaps": [], "conflicts": []}
+ "supporting": {"nodes": [], "edges": []}
}]}
```

Output JSON only. No markdown blocks or explanation.
```

### 3.2 Update Output Parser

#### 3.2.1 Make Impact Optional

```typescript
// In outputParser.ts

function validatePackageSchema(pkg: unknown, index: number): void {
  // ... existing validation ...
  
  // Remove this check (impact no longer required from LLM)
  // if (!p.impact || typeof p.impact !== 'object') {
  //   throw new ParseError(`Package ${index} missing impact`, pkg);
  // }
}

function normalizePackage(pkg: Record<string, unknown>): NarrativePackage {
  // ... existing normalization ...
  
  const result: NarrativePackage = {
    id: String(pkg.id),
    title: String(pkg.title),
    rationale: String(pkg.rationale ?? pkg.summary ?? ''),
    confidence: normalizeConfidence(pkg.confidence),
    style_tags: normalizeStringArray(pkg.style_tags),
    changes,
    // Impact will be computed server-side, but accept LLM's if provided
    impact: pkg.impact 
      ? normalizeImpact(pkg.impact as Record<string, unknown>)
      : { fulfills_gaps: [], creates_gaps: [], conflicts: [] }
  };
  
  return result;
}
```

### 3.3 Deterministic Impact Computation

#### 3.3.1 Core Function

```typescript
// New file: packages/core/src/ai/impactAnalyzer.ts

import type { NarrativePackage, GraphState, Impact, ConflictInfo } from './types.js';

export interface ComputedImpact extends Impact {
  // Extend with computation metadata
  computed: true;
  computedAt: number;
}

export interface ImpactAnalysisOptions {
  /** Include semantic analysis via LLM */
  enrichWithAgent?: boolean;
  /** Graph state for context */
  graph: GraphState;
  /** Missing beats/gaps to check against */
  missingBeats?: string[];
  /** Story constitution for conflict checking */
  constitution?: StoryContextConstitution;
}

/**
 * Compute impact for a narrative package.
 * 
 * Tier 1 (always): Deterministic fulfills_gaps from edges
 * Tier 2 (always): Deterministic structural conflicts
 * Tier 3 (optional): LLM-assisted creates_gaps
 * Tier 4 (optional): LLM-assisted semantic conflicts
 */
export function computeImpact(
  pkg: NarrativePackage,
  options: ImpactAnalysisOptions
): ComputedImpact {
  const { graph, missingBeats = [], constitution } = options;
  
  // Tier 1: Compute fulfills_gaps from ALIGNS_WITH edges
  const fulfills_gaps = computeFulfillsGaps(pkg, missingBeats);
  
  // Tier 2: Compute structural conflicts
  const structuralConflicts = computeStructuralConflicts(pkg, graph);
  
  // Merge with any LLM-provided impact (gives LLM chance to add insights)
  const llmImpact = pkg.impact || { fulfills_gaps: [], creates_gaps: [], conflicts: [] };
  
  return {
    fulfills_gaps: dedupeArray([...fulfills_gaps, ...llmImpact.fulfills_gaps]),
    creates_gaps: llmImpact.creates_gaps, // Keep LLM's if present, will be enriched separately
    conflicts: dedupeConflicts([...structuralConflicts, ...llmImpact.conflicts]),
    computed: true,
    computedAt: Date.now()
  };
}
```

#### 3.3.2 Compute Fulfills Gaps

```typescript
/**
 * Determine which gaps/beats a package fulfills based on edges.
 */
function computeFulfillsGaps(
  pkg: NarrativePackage,
  missingBeats: string[]
): string[] {
  const fulfilled: string[] = [];
  const missingBeatSet = new Set(missingBeats);
  
  // Check ALIGNS_WITH edges in the package
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'ALIGNS_WITH') {
      const targetBeat = edge.to;
      if (missingBeatSet.has(targetBeat)) {
        fulfilled.push(targetBeat);
      }
    }
  }
  
  // Check SATISFIED_BY edges (Scene satisfies StoryBeat)
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'SATISFIED_BY') {
      // Scene satisfies a story beat - check if that beat was a gap
      const targetStoryBeat = edge.to;
      // Add to fulfilled if this was a gap
      fulfilled.push(`storybeat:${targetStoryBeat}`);
    }
  }
  
  return [...new Set(fulfilled)]; // Dedupe
}
```

#### 3.3.3 Compute Structural Conflicts

```typescript
interface ConflictInfo {
  type: 'duplicate_node' | 'invalid_edge' | 'missing_dependency' | 'constitution_violation' | 'semantic';
  severity: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
  edgeInfo?: { from: string; to: string; type: string };
}

/**
 * Detect structural conflicts in a package.
 */
function computeStructuralConflicts(
  pkg: NarrativePackage,
  graph: GraphState
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const existingNodeIds = new Set(graph.nodes.map(n => n.id));
  const existingNodeNames = new Map(
    graph.nodes
      .filter(n => n.data?.name)
      .map(n => [n.data.name.toLowerCase(), n.id])
  );
  
  // Track proposed nodes for cross-reference
  const proposedNodeIds = new Set(pkg.changes.nodes.map(n => n.node_id));
  
  // Check for duplicate node names
  for (const node of pkg.changes.nodes) {
    if (node.operation === 'add' && node.data?.name) {
      const nameLower = node.data.name.toLowerCase();
      if (existingNodeNames.has(nameLower)) {
        const existingId = existingNodeNames.get(nameLower);
        conflicts.push({
          type: 'duplicate_node',
          severity: 'warning',
          message: `Character/Location "${node.data.name}" already exists (${existingId})`,
          nodeId: node.node_id
        });
      }
    }
  }
  
  // Check for invalid edge references
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add') {
      const fromExists = existingNodeIds.has(edge.from) || proposedNodeIds.has(edge.from);
      const toExists = existingNodeIds.has(edge.to) || proposedNodeIds.has(edge.to);
      
      if (!fromExists) {
        conflicts.push({
          type: 'invalid_edge',
          severity: 'error',
          message: `Edge references non-existent source node: ${edge.from}`,
          edgeInfo: { from: edge.from, to: edge.to, type: edge.edge_type }
        });
      }
      
      if (!toExists) {
        conflicts.push({
          type: 'invalid_edge',
          severity: 'error',
          message: `Edge references non-existent target node: ${edge.to}`,
          edgeInfo: { from: edge.from, to: edge.to, type: edge.edge_type }
        });
      }
    }
  }
  
  // Check for missing required edges
  for (const node of pkg.changes.nodes) {
    if (node.operation === 'add') {
      if (node.node_type === 'StoryBeat') {
        // StoryBeats should have ALIGNS_WITH edge
        const hasAlignment = pkg.changes.edges.some(
          e => e.edge_type === 'ALIGNS_WITH' && e.from === node.node_id
        );
        if (!hasAlignment) {
          conflicts.push({
            type: 'missing_dependency',
            severity: 'warning',
            message: `StoryBeat "${node.data?.title || node.node_id}" has no ALIGNS_WITH edge to a Beat`,
            nodeId: node.node_id
          });
        }
      }
      
      if (node.node_type === 'Scene') {
        // Scenes should have LOCATED_AT edge
        const hasLocation = pkg.changes.edges.some(
          e => e.edge_type === 'LOCATED_AT' && e.from === node.node_id
        );
        if (!hasLocation) {
          conflicts.push({
            type: 'missing_dependency',
            severity: 'info',
            message: `Scene "${node.data?.heading || node.node_id}" has no LOCATED_AT edge`,
            nodeId: node.node_id
          });
        }
      }
    }
  }
  
  return conflicts;
}

function dedupeArray(arr: string[]): string[] {
  return [...new Set(arr)];
}

function dedupeConflicts(conflicts: ConflictInfo[]): ConflictInfo[] {
  const seen = new Set<string>();
  return conflicts.filter(c => {
    const key = `${c.type}:${c.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

### 3.4 Impact Enrichment Agent (Optional)

#### 3.4.1 Agent Prompt

```typescript
// packages/core/src/ai/prompts/impactAnalysisPrompt.ts

export interface ImpactAnalysisParams {
  package: NarrativePackage;
  storyContext: string;
  existingGaps: string[];
  constitution?: string;
}

export function buildImpactAnalysisPrompt(params: ImpactAnalysisParams): string {
  const { package: pkg, storyContext, existingGaps, constitution } = params;
  
  return `## Impact Analyzer v1.0.0

Analyze the impact of this narrative proposal on the story.

## Proposal
**Title:** ${pkg.title}
**Rationale:** ${pkg.rationale}

### Changes
${formatChanges(pkg.changes)}

## Story Context
${storyContext}

## Known Gaps
${existingGaps.length > 0 ? existingGaps.map(g => `- ${g}`).join('\n') : '[No gaps identified]'}

${constitution ? `## Constitution\n${constitution}\n` : ''}

## Analysis Required

Analyze this proposal and identify:

1. **Creates Gaps** — What new needs or gaps does this introduce?
   - New characters that will need development?
   - Scenes that will need to be written?
   - Plot threads that need resolution?
   - Missing context or setup?

2. **Semantic Conflicts** — Does this conflict with story themes or established content?
   - Contradicts character motivations?
   - Breaks established facts?
   - Violates tonal consistency?
   - Undermines thematic pillars?

Be specific. Reference node IDs and existing content.

## Output
Return JSON only:

\`\`\`json
{
  "creates_gaps": [
    "Character 'X' needs introduction scene before beat Y",
    "Location 'Z' referenced but not established"
  ],
  "semantic_conflicts": [
    {
      "type": "semantic",
      "severity": "warning",
      "message": "Cain's action contradicts his established reluctance to use violence"
    }
  ]
}
\`\`\`

Output JSON only. No explanation.`;
}

function formatChanges(changes: NarrativePackage['changes']): string {
  const lines: string[] = [];
  
  for (const node of changes.nodes) {
    const label = node.data?.name || node.data?.title || node.node_id;
    lines.push(`- [${node.operation}] ${node.node_type}: ${label}`);
  }
  
  for (const edge of changes.edges) {
    lines.push(`- [${edge.operation}] ${edge.from} --${edge.edge_type}--> ${edge.to}`);
  }
  
  return lines.join('\n') || '[No changes]';
}
```

#### 3.4.2 Agent Function

```typescript
// In impactAnalyzer.ts

export interface EnrichmentResult {
  creates_gaps: string[];
  semantic_conflicts: ConflictInfo[];
}

/**
 * Enrich impact analysis with LLM-powered semantic analysis.
 * 
 * This is optional and adds latency/cost, but provides deeper insights.
 */
export async function enrichImpactWithAgent(
  pkg: NarrativePackage,
  options: {
    storyContext: string;
    existingGaps: string[];
    constitution?: string;
    llmClient: LLMClient;
  }
): Promise<EnrichmentResult> {
  const { storyContext, existingGaps, constitution, llmClient } = options;
  
  const prompt = buildImpactAnalysisPrompt({
    package: pkg,
    storyContext,
    existingGaps,
    constitution
  });
  
  const response = await llmClient.complete(prompt);
  
  try {
    const parsed = JSON.parse(extractJson(response.content));
    return {
      creates_gaps: parsed.creates_gaps || [],
      semantic_conflicts: (parsed.semantic_conflicts || []).map((c: any) => ({
        type: 'semantic',
        severity: c.severity || 'warning',
        message: c.message
      }))
    };
  } catch (error) {
    console.warn('[impactAnalyzer] Failed to parse enrichment response:', error);
    return { creates_gaps: [], semantic_conflicts: [] };
  }
}
```

### 3.5 Orchestrator Integration

#### 3.5.1 Updated Flow

```typescript
// In storyBeatOrchestrator.ts (and similar for other orchestrators)

export async function proposeStoryBeats(
  storyId: string,
  request: ProposeStoryBeatsRequest,
  ctx: StorageContext,
  llmClient: LLMClient,
  streamCallbacks?: StreamCallbacks
): Promise<ProposeStoryBeatsResponse> {
  // ... existing code to load graph, build prompt, call LLM ...
  
  // Parse response (impact now optional in schema)
  let result = ai.parseGenerationResponse(response);
  
  // ... existing validation (ID generation, etc.) ...
  
  // NEW: Compute impact for each package
  const packagesWithImpact = result.packages.map(pkg => {
    const computedImpact = computeImpact(pkg, {
      graph,
      missingBeats: missingBeats.map(b => b.beatId),
      constitution: state.metadata?.storyContext?.constitution
    });
    
    return {
      ...pkg,
      impact: computedImpact
    };
  });
  
  // Optional: Enrich with agent (could be behind a flag or setting)
  if (request.enrichImpact) {
    for (const pkg of packagesWithImpact) {
      const enrichment = await enrichImpactWithAgent(pkg, {
        storyContext,
        existingGaps: missingBeats.map(b => b.beatId),
        constitution: constitutionText,
        llmClient
      });
      
      pkg.impact.creates_gaps = [
        ...pkg.impact.creates_gaps,
        ...enrichment.creates_gaps
      ];
      pkg.impact.conflicts = [
        ...pkg.impact.conflicts,
        ...enrichment.semantic_conflicts
      ];
    }
  }
  
  // ... rest of function (session management, return) ...
  
  return {
    sessionId: session.id,
    packages: packagesWithImpact,
    missingBeats
  };
}
```

#### 3.5.2 Request Options

```typescript
// Add to request types

export interface ProposeStoryBeatsRequest {
  // ... existing fields ...
  
  /** Whether to enrich impact with LLM analysis (adds latency) */
  enrichImpact?: boolean;
}
```

---

## 4. Types and Schemas

### 4.1 Impact Type (Updated)

```typescript
// In types.ts

export interface Impact {
  /** Gaps/beats that this package fulfills */
  fulfills_gaps: string[];
  
  /** New gaps or needs this package creates */
  creates_gaps: string[];
  
  /** Conflicts with existing content */
  conflicts: ConflictInfo[];
}

export interface ConflictInfo {
  /** Type of conflict */
  type: 'duplicate_node' | 'invalid_edge' | 'missing_dependency' | 'constitution_violation' | 'temporal_violation' | 'semantic';
  
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  
  /** Human-readable message */
  message: string;
  
  /** Related node ID (if applicable) */
  nodeId?: string;
  
  /** Related edge info (if applicable) */
  edgeInfo?: {
    from: string;
    to: string;
    type: string;
  };
}

export interface ComputedImpact extends Impact {
  /** Flag indicating this was computed server-side */
  computed: true;
  
  /** Timestamp of computation */
  computedAt: number;
  
  /** Source of each field */
  sources?: {
    fulfills_gaps: 'deterministic';
    creates_gaps: 'llm' | 'deterministic' | 'none';
    conflicts: ('deterministic' | 'llm')[];
  };
}
```

### 4.2 Package Type (Updated)

```typescript
export interface NarrativePackage {
  id: string;
  title: string;
  rationale: string;
  confidence: number;
  style_tags: string[];
  
  // Refinement lineage
  parent_package_id?: string;
  refinement_prompt?: string;
  
  changes: {
    storyContext?: StoryContextChange[];
    nodes: NodeChange[];
    edges: EdgeChange[];
  };
  
  // Impact is now always present (computed server-side)
  impact: Impact | ComputedImpact;
  
  // Validation results (from MENTIONS system, temporal checks, etc.)
  validation?: {
    temporalViolations?: TemporalViolation[];
    missingDependencies?: MissingDependency[];
  };
}
```

---

## 5. API Changes

### 5.1 Generation Endpoints (Modified)

All generation endpoints now:
1. Accept optional `enrichImpact` parameter
2. Return packages with computed impact
3. Impact is always populated (never empty)

```typescript
// Request
POST /stories/:id/propose/story-beats
{
  // ... existing params ...
  "enrichImpact": true  // Optional, default false
}

// Response
{
  "success": true,
  "data": {
    "packages": [
      {
        "id": "pkg_123",
        "title": "...",
        "impact": {
          "fulfills_gaps": ["beat_Catalyst"],  // Computed from edges
          "creates_gaps": ["Need scene for Cain's decision"],  // From agent if enrichImpact=true
          "conflicts": [
            {
              "type": "missing_dependency",
              "severity": "warning",
              "message": "StoryBeat has no ALIGNS_WITH edge"
            }
          ],
          "computed": true,
          "computedAt": 1706745600000
        }
      }
    ]
  }
}
```

### 5.2 New Endpoint: Analyze Impact

For analyzing impact on-demand (e.g., after user edits a package):

```typescript
// Analyze impact for a specific package
POST /stories/:id/packages/:packageId/analyze-impact
{
  "enrich": true  // Whether to use LLM enrichment
}

// Response
{
  "success": true,
  "data": {
    "impact": {
      "fulfills_gaps": [...],
      "creates_gaps": [...],
      "conflicts": [...],
      "computed": true,
      "computedAt": 1706745600000
    }
  }
}
```

### 5.3 New Endpoint: Batch Recompute

For recomputing impact across all packages in a session:

```typescript
POST /stories/:id/sessions/:sessionId/recompute-impact
{
  "enrich": false
}

// Response
{
  "success": true,
  "data": {
    "packagesUpdated": 5
  }
}
```

---

## 6. UI Integration

### 6.1 Impact Display

The UI can now reliably display impact data:

```tsx
interface ImpactPanelProps {
  impact: Impact | ComputedImpact;
}

function ImpactPanel({ impact }: ImpactPanelProps) {
  return (
    <div className="impact-panel">
      {impact.fulfills_gaps.length > 0 && (
        <section className="fulfills">
          <h4>✓ Fulfills</h4>
          <ul>
            {impact.fulfills_gaps.map(gap => (
              <li key={gap}>{formatBeatName(gap)}</li>
            ))}
          </ul>
        </section>
      )}
      
      {impact.creates_gaps.length > 0 && (
        <section className="creates">
          <h4>→ Creates</h4>
          <ul>
            {impact.creates_gaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </section>
      )}
      
      {impact.conflicts.length > 0 && (
        <section className="conflicts">
          <h4>⚠ Conflicts</h4>
          <ul>
            {impact.conflicts.map((conflict, i) => (
              <li key={i} className={`severity-${conflict.severity}`}>
                {conflict.message}
              </li>
            ))}
          </ul>
        </section>
      )}
      
      {'computed' in impact && (
        <div className="computed-badge">
          Computed {new Date(impact.computedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
```

### 6.2 Interactive Impact Actions

Users can interact with impact items:

```tsx
function ConflictItem({ conflict, onResolve }: { conflict: ConflictInfo; onResolve: () => void }) {
  return (
    <li className={`conflict severity-${conflict.severity}`}>
      <span className="message">{conflict.message}</span>
      <div className="actions">
        {conflict.type === 'missing_dependency' && (
          <button onClick={onResolve}>Auto-fix</button>
        )}
        {conflict.type === 'semantic' && (
          <button onClick={() => refineWithGuidance(conflict.message)}>
            Refine to address
          </button>
        )}
        <button onClick={() => dismissConflict(conflict)}>Ignore</button>
      </div>
    </li>
  );
}
```

---

## 7. Performance Considerations

### 7.1 Deterministic Computation

- `computeFulfillsGaps`: O(edges) — very fast
- `computeStructuralConflicts`: O(nodes + edges) — very fast
- Total: <10ms for typical packages

### 7.2 Agent Enrichment

- Adds one LLM call per package
- ~500-1000 tokens prompt, ~200-500 tokens response
- Latency: 1-3 seconds per package
- Can be parallelized across packages

### 7.3 Recommended Defaults

| Scenario | enrichImpact | Rationale |
|----------|--------------|-----------|
| Initial generation | `false` | Fast feedback, basic impact is enough |
| User clicks "Analyze" | `true` | On-demand deeper analysis |
| Refinement | `true` | User is committed to this package |
| Batch operations | `false` | Performance priority |

---

## 8. Migration Strategy

### 8.1 Backward Compatibility

- Existing packages with LLM-provided impact continue to work
- `computeImpact` merges computed + LLM impact
- No migration required for stored data

### 8.2 Prompt Updates

1. Deploy new prompts without impact schema
2. Parser accepts missing impact field
3. Server computes impact for all new packages
4. Old prompts continue to work (impact is merged)

### 8.3 Rollout Phases

| Phase | Change | Risk |
|-------|--------|------|
| 1 | Add `computeImpact` function | None (new code) |
| 2 | Make impact optional in parser | Low (additive) |
| 3 | Call `computeImpact` in orchestrators | Low (enhances output) |
| 4 | Remove impact from prompts | Low (tokens saved) |
| 5 | Add enrichment agent | None (opt-in) |

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
describe('computeFulfillsGaps', () => {
  it('detects fulfilled beats from ALIGNS_WITH edges', () => {
    const pkg = createPackage({
      edges: [
        { operation: 'add', edge_type: 'ALIGNS_WITH', from: 'sb_1', to: 'beat_Catalyst' }
      ]
    });
    const missingBeats = ['beat_Catalyst', 'beat_Debate'];
    
    const fulfilled = computeFulfillsGaps(pkg, missingBeats);
    
    expect(fulfilled).toContain('beat_Catalyst');
    expect(fulfilled).not.toContain('beat_Debate');
  });
  
  it('ignores beats not in missing list', () => {
    const pkg = createPackage({
      edges: [
        { operation: 'add', edge_type: 'ALIGNS_WITH', from: 'sb_1', to: 'beat_Setup' }
      ]
    });
    const missingBeats = ['beat_Catalyst']; // beat_Setup not missing
    
    const fulfilled = computeFulfillsGaps(pkg, missingBeats);
    
    expect(fulfilled).toHaveLength(0);
  });
});

describe('computeStructuralConflicts', () => {
  it('detects duplicate character names', () => {
    const graph = createGraph({
      nodes: [{ id: 'char_1', type: 'Character', data: { name: 'Cain' } }]
    });
    const pkg = createPackage({
      nodes: [
        { operation: 'add', node_type: 'Character', node_id: 'char_2', data: { name: 'Cain' } }
      ]
    });
    
    const conflicts = computeStructuralConflicts(pkg, graph);
    
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('duplicate_node');
  });
  
  it('detects missing ALIGNS_WITH for StoryBeats', () => {
    const graph = createGraph({ nodes: [], edges: [] });
    const pkg = createPackage({
      nodes: [
        { operation: 'add', node_type: 'StoryBeat', node_id: 'sb_1', data: { title: 'Test' } }
      ],
      edges: [] // No ALIGNS_WITH
    });
    
    const conflicts = computeStructuralConflicts(pkg, graph);
    
    expect(conflicts.some(c => c.type === 'missing_dependency')).toBe(true);
  });
  
  it('detects invalid edge references', () => {
    const graph = createGraph({ nodes: [], edges: [] });
    const pkg = createPackage({
      nodes: [],
      edges: [
        { operation: 'add', edge_type: 'HAS_CHARACTER', from: 'scene_1', to: 'char_999' }
      ]
    });
    
    const conflicts = computeStructuralConflicts(pkg, graph);
    
    expect(conflicts.some(c => c.type === 'invalid_edge')).toBe(true);
  });
});

describe('enrichImpactWithAgent', () => {
  it('returns creates_gaps from LLM analysis', async () => {
    const mockLLM = createMockLLMClient({
      response: JSON.stringify({
        creates_gaps: ['Need introduction scene for Flores'],
        semantic_conflicts: []
      })
    });
    
    const result = await enrichImpactWithAgent(pkg, {
      storyContext: '...',
      existingGaps: [],
      llmClient: mockLLM
    });
    
    expect(result.creates_gaps).toContain('Need introduction scene for Flores');
  });
});
```

### 9.2 Integration Tests

```typescript
describe('proposeStoryBeats with impact', () => {
  it('returns computed impact for all packages', async () => {
    const response = await proposeStoryBeats(storyId, {
      packageCount: 3,
      direction: 'Focus on Act 1'
    }, ctx, llmClient);
    
    for (const pkg of response.packages) {
      expect(pkg.impact).toBeDefined();
      expect(pkg.impact.fulfills_gaps).toBeInstanceOf(Array);
      expect(pkg.impact.conflicts).toBeInstanceOf(Array);
      expect((pkg.impact as ComputedImpact).computed).toBe(true);
    }
  });
  
  it('enriches impact when requested', async () => {
    const response = await proposeStoryBeats(storyId, {
      packageCount: 1,
      enrichImpact: true
    }, ctx, llmClient);
    
    // Should have more detailed creates_gaps
    expect(response.packages[0].impact.creates_gaps.length).toBeGreaterThan(0);
  });
});
```

---

## 10. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `impactAnalyzer.ts` with `computeImpact` function
- [ ] Implement `computeFulfillsGaps` (deterministic)
- [ ] Implement `computeStructuralConflicts` (deterministic)
- [ ] Add unit tests for impact computation

### Phase 2: Parser Updates
- [ ] Make `impact` optional in `validatePackageSchema`
- [ ] Update `normalizePackage` to default empty impact
- [ ] Add tests for parsing packages without impact

### Phase 3: Orchestrator Integration
- [ ] Add `computeImpact` call to `storyBeatOrchestrator`
- [ ] Add `computeImpact` call to `characterOrchestrator`
- [ ] Add `computeImpact` call to `sceneOrchestrator`
- [ ] Add `computeImpact` call to `expandOrchestrator`
- [ ] Add `computeImpact` call to `generateOrchestrator`
- [ ] Add `enrichImpact` option to request types
- [ ] Add integration tests

### Phase 4: Prompt Updates
- [ ] Remove impact from `storyBeatPrompt.ts` schema
- [ ] Remove impact from `characterPrompt.ts` schema
- [ ] Remove impact from `scenePrompt.ts` schema
- [ ] Remove impact from `expandPrompt.ts` schema
- [ ] Remove impact from `generationPrompt.ts` schema
- [ ] Update `refinementPrompt.ts` (keep impact context for base package)

### Phase 5: Enrichment Agent
- [ ] Create `impactAnalysisPrompt.ts`
- [ ] Implement `enrichImpactWithAgent` function
- [ ] Add to orchestrators behind flag
- [ ] Add API endpoint for on-demand analysis

### Phase 6: API & UI
- [ ] Add `/analyze-impact` endpoint
- [ ] Add `/recompute-impact` endpoint
- [ ] Update API response schemas
- [ ] (UI team) Update impact display components

---

## 11. Open Questions

1. **Should enrichment be automatic or on-demand?**
   - Automatic: Better UX, higher cost/latency
   - On-demand: User clicks "Analyze", more control
   - Recommendation: On-demand for initial gen, automatic for refine

2. **How to handle enrichment failures?**
   - Fail silently with logged warning
   - Return partial impact (deterministic parts only)
   - Recommendation: Partial impact, flag in response

3. **Should we cache enrichment results?**
   - Packages are mutable (user can edit)
   - Cache invalidation is complex
   - Recommendation: No caching initially, recompute on demand

4. **Integration with MENTIONS system?**
   - Could use MENTIONS to detect "creates_gaps" for unintroduced characters
   - Recommendation: Yes, integrate after both systems are implemented
