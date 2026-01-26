# AI Prompt Engineering Layer - Implementation Plan

**Version:** 1.0.0
**Date:** 2026-01-10
**Status:** Ready for Implementation

---

## Overview

Implement the prompt engineering layer for Apollo's AI integration. This layer sits between the LLM and the existing graph infrastructure, handling:

- **Serialization**: Converting story state into LLM-readable context
- **Prompts**: Building structured prompts for each AI phase
- **Parsing**: Validating and converting LLM responses into typed objects
- **Conversion**: Transforming NarrativePackages into Patches for graph mutation

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Context format | Structured markdown | LLMs trained heavily on markdown; natural to read and reference |
| Testing | Mocks + fixtures | Unit tests with mock responses; integration tests with sample graphs |
| ID generation | Injectable generator | Deterministic for tests, random for production |
| Conflict detection | LLM + lint validation | LLM provides best-effort flags; lint system is source of truth |
| Story Context input | Raw markdown | LLM understands markdown naturally |
| Story Context output | Structured changes | Enables programmatic application |
| AI output format | NarrativePackage → Patch | Separation of concerns; validation layer; audit trail |
| Multi-provider support | Anthropic + OpenAI | Flexibility for users; different model strengths |

### OpenAI Provider Support

OpenAI support was added with the following considerations:
- Uses `max_completion_tokens` instead of `max_tokens` (required for reasoning models)
- Reasoning models (gpt-5.x) require higher token budgets (16384+)
- Provider selection via `APOLLO_AI_PROVIDER` environment variable

---

## File Structure

```
packages/core/src/ai/
├── index.ts                    # Module exports
├── types.ts                    # AI-specific interfaces
├── config.ts                   # AIConfig, defaults, budgets
├── idGenerator.ts              # Injectable ID generation
├── contextSerializer.ts        # GraphState → structured markdown
├── systemPromptBuilder.ts      # Build cacheable system prompts with storyContext
├── ideasSerializer.ts          # Filter and serialize Ideas for prompts
├── outputParser.ts             # LLM response → typed objects
├── packageToPatches.ts         # NarrativePackage → Patch conversion
└── prompts/
    ├── index.ts                # Prompt exports
    ├── interpretationPrompt.ts # Freeform input → structured proposals
    ├── generationPrompt.ts     # Entry point → N packages
    ├── refinementPrompt.ts     # Base package + constraints → variations
    ├── expandPrompt.ts         # Node/context expansion
    ├── characterPrompt.ts      # Character generation
    ├── scenePrompt.ts          # Scene generation
    └── storyBeatPrompt.ts      # StoryBeat generation
```

### System Prompt vs User Prompt Separation

The prompt architecture separates stable content (system prompt) from dynamic content (user prompt):

| Component | Location | Purpose |
|-----------|----------|---------|
| Story identity (name, logline) | System prompt | Cacheable, high priority |
| Story Context (themes, constraints) | System prompt | Cacheable, high priority |
| Current graph state | User prompt | Dynamic, changes each request |
| Filtered ideas | User prompt | Dynamic, task-specific |
| Task instructions | User prompt | Dynamic, request-specific |

This enables Anthropic's prompt caching to reuse the system prompt across multiple generation requests.

---

## Phase 1: Foundation (Types & Config)

### 1.1 Types (`types.ts`)

Define all AI-specific interfaces. These are separate from core types.

```typescript
// =============================================================================
// Interpretation Phase Types
// =============================================================================

export interface InterpretationResult {
  interpretation: {
    summary: string;           // What the AI understood
    confidence: number;        // 0.0 - 1.0
  };
  proposals: InterpretationProposal[];
  alternatives?: {
    summary: string;
    confidence: number;
  }[];
}

export interface InterpretationProposal {
  type: 'node' | 'storyContext' | 'edge';
  operation: 'add' | 'modify';
  target_type?: string;        // Node type if applicable
  data: Record<string, unknown>;
  rationale: string;
  relates_to?: string[];       // Existing node IDs this connects to
}

// =============================================================================
// Generation Phase Types
// =============================================================================

export interface GenerationResult {
  packages: NarrativePackage[];
}

export interface NarrativePackage {
  id: string;
  title: string;
  rationale: string;
  confidence: number;          // 0.0 - 1.0

  // Refinement lineage
  parent_package_id?: string;
  refinement_prompt?: string;

  style_tags: string[];

  changes: {
    storyContext?: StoryContextChange[];
    nodes: NodeChange[];
    edges: EdgeChange[];
  };

  impact: {
    fulfills_gaps: string[];   // Gap IDs resolved
    creates_gaps: string[];    // Gap IDs introduced
    conflicts: ConflictInfo[];
  };
}

export interface NodeChange {
  operation: 'add' | 'modify' | 'delete';
  node_type: string;
  node_id: string;
  data?: Record<string, unknown>;
  previous_data?: Record<string, unknown>;
}

export interface EdgeChange {
  operation: 'add' | 'delete';
  edge_type: string;
  from: string;
  to: string;
  properties?: Record<string, unknown>;
}

export interface StoryContextChange {
  operation: 'add' | 'modify' | 'delete';
  section: string;
  content: string;
  previous_content?: string;
}

export interface ConflictInfo {
  type: 'contradicts' | 'duplicates' | 'interferes';
  existing_node_id: string;
  description: string;
  source: 'llm' | 'lint';
  resolution_included: boolean;
}

// =============================================================================
// Prompt Parameter Types
// =============================================================================

export type GenerationDepth = 'narrow' | 'medium' | 'wide';
export type GenerationCount = 'few' | 'standard' | 'many';

export interface GenerationEntryPoint {
  type: 'beat' | 'plotPoint' | 'character' | 'gap' | 'idea' | 'naked';
  targetId?: string;
  targetData?: Record<string, unknown>;
}

export interface GenerationParams {
  entryPoint: GenerationEntryPoint;
  storyContext: string;        // Serialized story state
  gaps: string;                // Serialized gaps
  direction?: string;          // User guidance
  depth: GenerationDepth;
  count: number;
}

export interface RefinementParams {
  basePackage: NarrativePackage;
  keepElements: string[];      // Node IDs to preserve
  regenerateElements: string[];
  guidance: string;
  storyContext: string;
  depth: GenerationDepth;
  count: number;
}

export interface InterpretationParams {
  userInput: string;
  storyContext: string;
  recentNodes?: string[];
}

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  nodeId?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  nodeId?: string;
}
```

### 1.2 Config (`config.ts`)

```typescript
export interface AIConfig {
  // Model settings
  model: string;
  maxTokens: number;
  temperature: number;

  // Depth budgets
  depthBudgets: {
    narrow: { maxNodes: number; maxOps: number };
    medium: { maxNodes: number; maxOps: number };
    wide: { maxNodes: number; maxOps: number };
  };

  // Count limits
  countLimits: {
    few: number;
    standard: number;
    many: number;
  };

  // Context limits
  maxContextNodes: number;
  maxStoryContextLength: number;

  // Truncation patterns
  truncationPatterns: {
    nodeList: string;          // e.g., "[{count} more {type}...]"
    edgeList: string;
    gapList: string;
  };
}

export const defaultConfig: AIConfig = {
  model: "claude-sonnet-4-20250514",  // Or "gpt-5.2" for OpenAI
  maxTokens: 16384,  // Increased for reasoning models
  temperature: 0.7,

  depthBudgets: {
    narrow: { maxNodes: 2, maxOps: 4 },
    medium: { maxNodes: 5, maxOps: 10 },
    wide: { maxNodes: 10, maxOps: 20 }
  },

  countLimits: {
    few: 3,
    standard: 5,
    many: 8
  },

  maxContextNodes: 100,
  maxStoryContextLength: 4000,

  truncationPatterns: {
    nodeList: "[{count} more {type}...]",
    edgeList: "[{count} more edges...]",
    gapList: "[{count} more gaps...]"
  }
};

export function getPackageCount(count: GenerationCount, config: AIConfig = defaultConfig): number {
  return config.countLimits[count];
}

export function getDepthBudget(depth: GenerationDepth, config: AIConfig = defaultConfig) {
  return config.depthBudgets[depth];
}
```

### 1.3 ID Generator (`idGenerator.ts`)

```typescript
export type IdGenerator = (nodeType: string) => string;

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const defaultIdGenerator: IdGenerator = (nodeType: string) => {
  const type = nodeType.toLowerCase();
  return `${type}_${Date.now()}_${randomString(5)}`;
};

// For testing - creates deterministic IDs
export function createDeterministicIdGenerator(): IdGenerator {
  const counters = new Map<string, number>();

  return (nodeType: string) => {
    const type = nodeType.toLowerCase();
    const count = (counters.get(type) ?? 0) + 1;
    counters.set(type, count);
    return `${type}_test_${count.toString().padStart(3, '0')}`;
  };
}

// Validate ID format
export function isValidNodeId(id: string): boolean {
  // Format: {type}_{timestamp}_{random} or {type}_test_{counter}
  const pattern = /^[a-z]+_(\d+_[a-z0-9]{5}|test_\d{3})$/;
  return pattern.test(id);
}
```

---

## Phase 2: Context Serialization

### 2.1 Context Serializer (`contextSerializer.ts`)

The serializer converts GraphState into structured markdown for LLM consumption.

```typescript
import type { GraphState } from '../core/graph.js';
import type { Gap } from '../coverage/types.js';
import type { KGNode, Edge } from '../types/index.js';
import { getNodesByType, getEdgesFrom, getEdgesTo } from '../core/graph.js';
import { defaultConfig, type AIConfig } from './config.js';

interface StoryMetadata {
  name?: string;
  logline?: string;
  storyContext?: string;
}

interface SerializationOptions {
  maxNodes?: number;
  includeEdges?: boolean;
  includeGaps?: boolean;
  focusNodeId?: string;
  focusDepth?: number;
}

// =============================================================================
// Main Serializers
// =============================================================================

/**
 * Serialize full story context for generation prompts
 */
export function serializeStoryContext(
  graph: GraphState,
  metadata: StoryMetadata,
  options: SerializationOptions = {}
): string {
  const config = defaultConfig;
  const maxNodes = options.maxNodes ?? config.maxContextNodes;

  const sections: string[] = [];

  // Header
  sections.push(`# Story: ${metadata.name ?? 'Untitled'}`);
  if (metadata.logline) {
    sections.push(`Logline: "${metadata.logline}"`);
  }
  sections.push('');

  // Story Context (user's creative direction)
  if (metadata.storyContext) {
    sections.push('## Story Context (Creative Direction)');
    sections.push(metadata.storyContext);
    sections.push('');
  }

  // Current State Summary
  sections.push('## Current State Summary');
  sections.push(serializeStateSummary(graph));
  sections.push('');

  // Nodes by type
  sections.push('## Nodes');
  sections.push(serializeNodesByType(graph, maxNodes));

  // Edges (optional, for focused contexts)
  if (options.includeEdges) {
    sections.push('');
    sections.push('## Relationships');
    sections.push(serializeEdges(graph));
  }

  return sections.join('\n');
}

/**
 * Serialize a focused subset around a specific node
 */
export function serializeNodeContext(
  graph: GraphState,
  nodeId: string,
  depth: number = 2
): string {
  const focusNode = graph.nodes.get(nodeId);
  if (!focusNode) {
    return `[Node ${nodeId} not found]`;
  }

  const sections: string[] = [];

  sections.push(`## Focus: ${focusNode.type} "${getNodeLabel(focusNode)}"`);
  sections.push(serializeNode(focusNode));
  sections.push('');

  // Get connected nodes up to depth
  const connectedNodes = getConnectedNodes(graph, nodeId, depth);

  if (connectedNodes.size > 0) {
    sections.push('### Connected Nodes');
    for (const connected of connectedNodes) {
      sections.push(serializeNodeBrief(connected));
    }
  }

  // Get edges involving this node
  const incomingEdges = getEdgesTo(graph, nodeId);
  const outgoingEdges = getEdgesFrom(graph, nodeId);

  if (incomingEdges.length > 0 || outgoingEdges.length > 0) {
    sections.push('');
    sections.push('### Relationships');
    for (const edge of [...incomingEdges, ...outgoingEdges]) {
      sections.push(serializeEdge(edge, graph));
    }
  }

  return sections.join('\n');
}

/**
 * Serialize gaps for generation prompts
 */
export function serializeGaps(gaps: Gap[]): string {
  if (gaps.length === 0) {
    return 'No open gaps.';
  }

  const sections: string[] = [];
  sections.push('## Gaps (Generation Opportunities)');
  sections.push('');

  // Group by tier
  const byTier = groupBy(gaps, g => g.tier);
  const tierOrder = ['premise', 'foundations', 'structure', 'plotPoints', 'scenes'];

  for (const tier of tierOrder) {
    const tierGaps = byTier.get(tier);
    if (!tierGaps || tierGaps.length === 0) continue;

    sections.push(`### ${capitalize(tier)} Tier`);
    for (const gap of tierGaps) {
      sections.push(`- **${gap.title}** (${gap.type})`);
      sections.push(`  ${gap.description}`);
      if (gap.scopeRefs.nodeIds?.length) {
        sections.push(`  Target: ${gap.scopeRefs.nodeIds.join(', ')}`);
      }
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Serialize Story Context markdown
 */
export function serializeStoryContextMd(storyContext: string | undefined): string {
  if (!storyContext) {
    return '[No Story Context defined]';
  }
  return storyContext;
}

// =============================================================================
// Helper Serializers
// =============================================================================

function serializeStateSummary(graph: GraphState): string {
  const nodeCounts = new Map<string, number>();
  for (const node of graph.nodes.values()) {
    nodeCounts.set(node.type, (nodeCounts.get(node.type) ?? 0) + 1);
  }

  const lines: string[] = [];
  const displayOrder = [
    'Character', 'Location', 'Object', 'Setting',
    'Beat', 'PlotPoint', 'Scene',
    'CharacterArc', 'Idea'
  ];

  for (const type of displayOrder) {
    const count = nodeCounts.get(type);
    if (count) {
      lines.push(`- ${type}s: ${count}`);
    }
  }

  lines.push(`- Total Edges: ${graph.edges.length}`);

  return lines.join('\n');
}

function serializeNodesByType(graph: GraphState, maxNodes: number): string {
  const sections: string[] = [];

  // Define serialization order and groupings
  const typeGroups: { header: string; types: string[] }[] = [
    { header: 'Characters', types: ['Character'] },
    { header: 'Locations & Settings', types: ['Location', 'Setting'] },
    { header: 'Objects', types: ['Object'] },
    { header: 'Structure (Beats)', types: ['Beat'] },
    { header: 'Plot Points', types: ['PlotPoint'] },
    { header: 'Scenes', types: ['Scene'] },
    { header: 'Character Arcs', types: ['CharacterArc'] },
    { header: 'Ideas (Unassigned)', types: ['Idea'] },
  ];

  let totalSerialized = 0;

  for (const group of typeGroups) {
    const nodes: KGNode[] = [];
    for (const type of group.types) {
      nodes.push(...getNodesByType(graph, type));
    }

    if (nodes.length === 0) continue;

    sections.push(`### ${group.header}`);

    const remaining = maxNodes - totalSerialized;
    const toSerialize = Math.min(nodes.length, remaining);

    for (let i = 0; i < toSerialize; i++) {
      sections.push(serializeNodeBrief(nodes[i]));
    }

    if (nodes.length > toSerialize) {
      sections.push(`[${nodes.length - toSerialize} more ${group.header.toLowerCase()}...]`);
    }

    totalSerialized += toSerialize;
    sections.push('');

    if (totalSerialized >= maxNodes) {
      sections.push('[Context truncated due to size limits]');
      break;
    }
  }

  return sections.join('\n');
}

function serializeNode(node: KGNode): string {
  const lines: string[] = [];
  lines.push(`- **ID:** ${node.id}`);
  lines.push(`- **Type:** ${node.type}`);

  // Type-specific fields
  const data = node as Record<string, unknown>;
  const skipFields = ['id', 'type', 'createdAt', 'updatedAt'];

  for (const [key, value] of Object.entries(data)) {
    if (skipFields.includes(key) || value === undefined || value === null) continue;

    if (typeof value === 'string') {
      lines.push(`- **${capitalize(key)}:** "${truncate(value, 100)}"`);
    } else if (Array.isArray(value)) {
      lines.push(`- **${capitalize(key)}:** [${value.slice(0, 5).join(', ')}${value.length > 5 ? '...' : ''}]`);
    } else if (typeof value === 'object') {
      lines.push(`- **${capitalize(key)}:** (object)`);
    } else {
      lines.push(`- **${capitalize(key)}:** ${value}`);
    }
  }

  return lines.join('\n');
}

function serializeNodeBrief(node: KGNode): string {
  const label = getNodeLabel(node);
  const data = node as Record<string, unknown>;

  let detail = '';
  if (data.description) {
    detail = `: "${truncate(String(data.description), 60)}"`;
  } else if (data.summary) {
    detail = `: "${truncate(String(data.summary), 60)}"`;
  } else if (data.scene_overview) {
    detail = `: "${truncate(String(data.scene_overview), 60)}"`;
  }

  return `- **${node.id}** (${node.type}): ${label}${detail}`;
}

function serializeEdges(graph: GraphState): string {
  const lines: string[] = [];

  for (const edge of graph.edges) {
    lines.push(serializeEdge(edge, graph));
  }

  return lines.join('\n');
}

function serializeEdge(edge: Edge, graph: GraphState): string {
  const fromNode = graph.nodes.get(edge.from);
  const toNode = graph.nodes.get(edge.to);

  const fromLabel = fromNode ? getNodeLabel(fromNode) : edge.from;
  const toLabel = toNode ? getNodeLabel(toNode) : edge.to;

  return `- ${fromLabel} -[${edge.type}]-> ${toLabel}`;
}

// =============================================================================
// Utility Functions
// =============================================================================

function getNodeLabel(node: KGNode): string {
  const data = node as Record<string, unknown>;
  return String(data.name ?? data.title ?? data.heading ?? node.id);
}

function getConnectedNodes(graph: GraphState, nodeId: string, depth: number): Set<KGNode> {
  const visited = new Set<string>([nodeId]);
  const result = new Set<KGNode>();
  let frontier = [nodeId];

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const nextFrontier: string[] = [];

    for (const id of frontier) {
      const outgoing = getEdgesFrom(graph, id);
      const incoming = getEdgesTo(graph, id);

      for (const edge of [...outgoing, ...incoming]) {
        const otherId = edge.from === id ? edge.to : edge.from;
        if (!visited.has(otherId)) {
          visited.add(otherId);
          const node = graph.nodes.get(otherId);
          if (node) {
            result.add(node);
            nextFrontier.push(otherId);
          }
        }
      }
    }

    frontier = nextFrontier;
  }

  return result;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}
```

### 2.2 System Prompt Builder (`systemPromptBuilder.ts`)

Builds cacheable system prompts containing stable story identity and creative direction.

```typescript
export interface SystemPromptParams {
  storyName?: string | undefined;
  logline?: string | undefined;
  storyContext?: string | undefined;
}

/**
 * Build a system prompt with story context for prompt caching.
 * System prompts are stable across requests, enabling Anthropic prompt caching.
 */
export function buildSystemPrompt(params: SystemPromptParams): string {
  const { storyName, logline, storyContext } = params;

  const sections: string[] = [];

  // Role and story identity
  sections.push(`You are an AI story development assistant working on "${storyName ?? 'an untitled story'}".`);

  if (logline) {
    sections.push(`\nLogline: "${logline}"`);
  }

  // Creative direction (full storyContext)
  if (storyContext) {
    sections.push('\n## Creative Direction & Story Context\n');
    sections.push(storyContext);
  }

  // Standard guidelines
  sections.push('\n## Guidelines\n');
  sections.push('- Maintain consistency with established story elements');
  sections.push('- Respect constraints defined in the Story Context');
  sections.push('- Generate content that aligns with the creative direction');
  sections.push('- Reference existing nodes by their IDs when creating relationships');

  return sections.join('\n');
}

/**
 * Check if system prompt would have meaningful content.
 */
export function hasSystemPromptContent(params: SystemPromptParams): boolean {
  return Boolean(params.storyName || params.logline || params.storyContext);
}
```

### 2.3 Ideas Serializer (`ideasSerializer.ts`)

Filters and serializes Idea nodes for inclusion in user prompts.

```typescript
import type { GraphState, Idea, IdeaCategory } from '../types.js';
import { getNodesByType, getEdgesTo } from '../core/graph.js';

export type IdeaTaskType = 'character' | 'storyBeat' | 'scene' | 'expand' | 'generate' | 'interpret' | 'refine';

export interface IdeasFilterOptions {
  category?: IdeaCategory | IdeaCategory[];
  relatedNodeIds?: string[];
  activeOnly?: boolean;  // default: true
  maxIdeas?: number;     // default: 5
}

export interface IdeasSerializationResult {
  serialized: string;
  includedCount: number;
  includedIds: string[];
}

/**
 * Get idea categories relevant to a task type.
 */
export function getCategoryForTaskType(taskType: IdeaTaskType): IdeaCategory[] {
  switch (taskType) {
    case 'character':
      return ['character', 'general'];
    case 'storyBeat':
      return ['plot', 'general'];
    case 'scene':
      return ['scene', 'plot', 'general'];
    case 'expand':
    case 'generate':
    case 'interpret':
    case 'refine':
      return ['character', 'plot', 'scene', 'worldbuilding', 'general'];
    default:
      return ['general'];
  }
}

/**
 * Filter ideas based on options.
 */
export function filterIdeas(graph: GraphState, options: IdeasFilterOptions = {}): Idea[] {
  const { category, relatedNodeIds, activeOnly = true, maxIdeas = 5 } = options;

  const ideas = getNodesByType<Idea>(graph, 'Idea');

  return ideas
    .filter(idea => {
      if (activeOnly && idea.status !== 'active') return false;
      if (category) {
        const categories = Array.isArray(category) ? category : [category];
        if (!categories.includes(idea.category)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Prioritize ideas related to specified nodes
      if (relatedNodeIds?.length) {
        const aRelated = a.relatedNodeIds?.some(id => relatedNodeIds.includes(id)) ?? false;
        const bRelated = b.relatedNodeIds?.some(id => relatedNodeIds.includes(id)) ?? false;
        if (aRelated && !bRelated) return -1;
        if (bRelated && !aRelated) return 1;
      }
      return 0;
    })
    .slice(0, maxIdeas);
}

/**
 * Serialize ideas for prompt inclusion.
 */
export function serializeIdeas(ideas: Idea[]): IdeasSerializationResult {
  if (ideas.length === 0) {
    return { serialized: '', includedCount: 0, includedIds: [] };
  }

  const lines: string[] = [];
  lines.push('## Existing Ideas to Consider');
  lines.push('The following ideas have been captured but not yet developed. Consider incorporating relevant ones:\n');

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    lines.push(`${i + 1}. [${idea.category}] ${idea.description}`);
  }

  return {
    serialized: lines.join('\n'),
    includedCount: ideas.length,
    includedIds: ideas.map(i => i.id),
  };
}

/**
 * Convenience function: filter and serialize in one call.
 */
export function getIdeasForTask(
  graph: GraphState,
  taskType: IdeaTaskType,
  entryPointNodeId?: string,
  maxIdeas: number = 5
): IdeasSerializationResult {
  const categories = getCategoryForTaskType(taskType);
  const relatedNodeIds = entryPointNodeId ? [entryPointNodeId] : undefined;

  const ideas = filterIdeas(graph, {
    category: categories,
    relatedNodeIds,
    activeOnly: true,
    maxIdeas,
  });

  return serializeIdeas(ideas);
}
```

### 2.4 Story State Serializer (`serializeStoryState`)

Added to `contextSerializer.ts` - serializes graph state WITHOUT creative direction (for user prompts when storyContext is in system prompt).

```typescript
/**
 * Serialize story state for user prompts (without creative direction).
 * Use this when storyContext is already in the system prompt.
 */
export function serializeStoryState(
  graph: GraphState,
  metadata: StoryMetadata,
  options: SerializationOptions = {}
): string {
  const config = defaultConfig;
  const maxNodes = options.maxNodes ?? config.maxContextNodes;

  const sections: string[] = [];

  // Header (without storyContext)
  sections.push(`# Story: ${metadata.name ?? 'Untitled'}`);
  if (metadata.logline) {
    sections.push(`Logline: "${metadata.logline}"`);
  }
  sections.push('');

  // Note: storyContext intentionally omitted - it's in system prompt

  // Current State Summary
  sections.push('## Current State Summary');
  sections.push(serializeStateSummary(graph));
  sections.push('');

  // Nodes by type
  sections.push('## Nodes');
  sections.push(serializeNodesByType(graph, maxNodes));

  // Edges (optional)
  if (options.includeEdges) {
    sections.push('');
    sections.push('## Relationships');
    sections.push(serializeEdges(graph));
  }

  return sections.join('\n');
}
```

---

## Phase 3: Output Parser

### 3.1 Output Parser (`outputParser.ts`)

```typescript
import type {
  InterpretationResult,
  GenerationResult,
  NarrativePackage,
  ValidationResult,
  ValidationError,
} from './types.js';
import { isValidNodeId, defaultIdGenerator } from './idGenerator.js';

// =============================================================================
// Main Parsers
// =============================================================================

/**
 * Parse interpretation response from LLM
 */
export function parseInterpretationResponse(raw: string): InterpretationResult {
  const json = extractJson(raw);
  const parsed = JSON.parse(json);

  validateInterpretationSchema(parsed);

  return parsed as InterpretationResult;
}

/**
 * Parse generation response from LLM
 */
export function parseGenerationResponse(raw: string): GenerationResult {
  const json = extractJson(raw);
  const parsed = JSON.parse(json);

  validateGenerationSchema(parsed);

  // Normalize packages
  const packages = (parsed.packages ?? []).map(normalizePackage);

  return { packages };
}

// =============================================================================
// JSON Extraction
// =============================================================================

/**
 * Extract JSON from markdown code blocks or raw text
 */
function extractJson(raw: string): string {
  // Try to extract from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return cleanJson(codeBlockMatch[1]);
  }

  // Try to find JSON object directly
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return cleanJson(jsonMatch[0]);
  }

  throw new ParseError('No JSON found in response', raw);
}

/**
 * Clean common JSON issues
 */
function cleanJson(json: string): string {
  let cleaned = json.trim();

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Fix single quotes to double quotes (careful with strings containing quotes)
  // This is a simplistic fix - may need refinement
  cleaned = cleaned.replace(/'/g, '"');

  return cleaned;
}

// =============================================================================
// Schema Validation
// =============================================================================

function validateInterpretationSchema(data: unknown): void {
  if (typeof data !== 'object' || data === null) {
    throw new ParseError('Response must be an object', data);
  }

  const obj = data as Record<string, unknown>;

  if (!obj.interpretation || typeof obj.interpretation !== 'object') {
    throw new ParseError('Missing or invalid interpretation field', data);
  }

  if (!Array.isArray(obj.proposals)) {
    throw new ParseError('Missing or invalid proposals array', data);
  }
}

function validateGenerationSchema(data: unknown): void {
  if (typeof data !== 'object' || data === null) {
    throw new ParseError('Response must be an object', data);
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.packages)) {
    throw new ParseError('Missing or invalid packages array', data);
  }

  for (let i = 0; i < obj.packages.length; i++) {
    validatePackageSchema(obj.packages[i], i);
  }
}

function validatePackageSchema(pkg: unknown, index: number): void {
  if (typeof pkg !== 'object' || pkg === null) {
    throw new ParseError(`Package ${index} must be an object`, pkg);
  }

  const p = pkg as Record<string, unknown>;

  // Required fields
  if (typeof p.id !== 'string') {
    throw new ParseError(`Package ${index} missing id`, pkg);
  }
  if (typeof p.title !== 'string') {
    throw new ParseError(`Package ${index} missing title`, pkg);
  }
  if (typeof p.rationale !== 'string') {
    throw new ParseError(`Package ${index} missing rationale`, pkg);
  }

  // Changes structure
  if (!p.changes || typeof p.changes !== 'object') {
    throw new ParseError(`Package ${index} missing changes`, pkg);
  }
}

// =============================================================================
// Normalization
// =============================================================================

function normalizePackage(pkg: Record<string, unknown>): NarrativePackage {
  return {
    id: String(pkg.id),
    title: String(pkg.title),
    rationale: String(pkg.rationale),
    confidence: normalizeConfidence(pkg.confidence),
    parent_package_id: pkg.parent_package_id as string | undefined,
    refinement_prompt: pkg.refinement_prompt as string | undefined,
    style_tags: normalizeStringArray(pkg.style_tags),
    changes: normalizeChanges(pkg.changes as Record<string, unknown>),
    impact: normalizeImpact(pkg.impact as Record<string, unknown>),
  };
}

function normalizeConfidence(value: unknown): number {
  if (typeof value === 'number') {
    return Math.max(0, Math.min(1, value));
  }
  return 0.5; // default
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(v => typeof v === 'string');
  }
  return [];
}

function normalizeChanges(changes: Record<string, unknown> | undefined) {
  if (!changes) {
    return { nodes: [], edges: [] };
  }

  return {
    storyContext: changes.storyContext as StoryContextChange[] | undefined,
    nodes: Array.isArray(changes.nodes) ? changes.nodes : [],
    edges: Array.isArray(changes.edges) ? changes.edges : [],
  };
}

function normalizeImpact(impact: Record<string, unknown> | undefined) {
  if (!impact) {
    return { fulfills_gaps: [], creates_gaps: [], conflicts: [] };
  }

  return {
    fulfills_gaps: normalizeStringArray(impact.fulfills_gaps),
    creates_gaps: normalizeStringArray(impact.creates_gaps),
    conflicts: Array.isArray(impact.conflicts) ? impact.conflicts : [],
  };
}

// =============================================================================
// ID Validation
// =============================================================================

/**
 * Validate that generated node IDs don't conflict with existing
 */
export function validateGeneratedIds(
  result: GenerationResult,
  existingIds: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();

  for (const pkg of result.packages) {
    for (const change of pkg.changes.nodes) {
      if (change.operation === 'add') {
        // Check for duplicate with existing
        if (existingIds.has(change.node_id)) {
          errors.push({
            code: 'DUPLICATE_ID',
            message: `Node ID ${change.node_id} already exists in graph`,
            nodeId: change.node_id,
          });
        }

        // Check for duplicate within package
        if (seenIds.has(change.node_id)) {
          errors.push({
            code: 'DUPLICATE_ID_IN_PACKAGE',
            message: `Node ID ${change.node_id} used multiple times in package`,
            nodeId: change.node_id,
          });
        }

        seenIds.add(change.node_id);

        // Validate ID format
        if (!isValidNodeId(change.node_id)) {
          errors.push({
            code: 'INVALID_ID_FORMAT',
            message: `Node ID ${change.node_id} has invalid format`,
            nodeId: change.node_id,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Validate that edge references point to valid nodes
 */
export function validateEdgeReferences(
  result: GenerationResult,
  existingNodeIds: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const pkg of result.packages) {
    // Collect all new node IDs from this package
    const newNodeIds = new Set<string>();
    for (const change of pkg.changes.nodes) {
      if (change.operation === 'add') {
        newNodeIds.add(change.node_id);
      }
    }

    // Validate edges
    for (const edge of pkg.changes.edges) {
      if (edge.operation === 'add') {
        const fromExists = existingNodeIds.has(edge.from) || newNodeIds.has(edge.from);
        const toExists = existingNodeIds.has(edge.to) || newNodeIds.has(edge.to);

        if (!fromExists) {
          errors.push({
            code: 'INVALID_EDGE_FROM',
            message: `Edge references non-existent node: ${edge.from}`,
            nodeId: edge.from,
          });
        }

        if (!toExists) {
          errors.push({
            code: 'INVALID_EDGE_TO',
            message: `Edge references non-existent node: ${edge.to}`,
            nodeId: edge.to,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

// =============================================================================
// ID Regeneration
// =============================================================================

/**
 * Regenerate IDs if LLM provides duplicates or invalid formats
 */
export function regenerateInvalidIds(
  result: GenerationResult,
  existingIds: Set<string>,
  idGenerator = defaultIdGenerator
): GenerationResult {
  const idMapping = new Map<string, string>();

  const newPackages = result.packages.map(pkg => {
    // Regenerate node IDs
    const newNodes = pkg.changes.nodes.map(change => {
      if (change.operation === 'add') {
        const needsNewId =
          existingIds.has(change.node_id) ||
          idMapping.has(change.node_id) ||
          !isValidNodeId(change.node_id);

        if (needsNewId) {
          const newId = idGenerator(change.node_type);
          idMapping.set(change.node_id, newId);
          return { ...change, node_id: newId };
        }
      }
      return change;
    });

    // Update edge references
    const newEdges = pkg.changes.edges.map(edge => {
      const newFrom = idMapping.get(edge.from) ?? edge.from;
      const newTo = idMapping.get(edge.to) ?? edge.to;
      return { ...edge, from: newFrom, to: newTo };
    });

    return {
      ...pkg,
      changes: { ...pkg.changes, nodes: newNodes, edges: newEdges },
    };
  });

  return { packages: newPackages };
}

// =============================================================================
// Error Class
// =============================================================================

export class ParseError extends Error {
  constructor(message: string, public rawData: unknown) {
    super(message);
    this.name = 'ParseError';
  }
}
```

---

## Phase 4: Package to Patch Conversion

### 4.1 Package to Patches (`packageToPatches.ts`)

```typescript
import type { Patch, PatchOp } from '../types/patch.js';
import type { NarrativePackage, StoryContextChange } from './types.js';
import { defaultIdGenerator } from './idGenerator.js';

interface ConversionResult {
  patch: Patch;
  storyContextUpdate?: {
    newContext: string;
    changes: StoryContextChange[];
  };
}

/**
 * Convert a NarrativePackage into a Patch for graph application
 */
export function packageToPatch(
  pkg: NarrativePackage,
  baseVersionId: string,
  currentStoryContext?: string
): ConversionResult {
  const ops: PatchOp[] = [];

  // Convert node changes
  for (const change of pkg.changes.nodes) {
    if (change.operation === 'add') {
      ops.push({
        op: 'ADD_NODE',
        node: {
          type: change.node_type,
          id: change.node_id,
          ...change.data,
        },
      });
    } else if (change.operation === 'modify') {
      ops.push({
        op: 'UPDATE_NODE',
        id: change.node_id,
        set: change.data ?? {},
      });
    } else if (change.operation === 'delete') {
      ops.push({
        op: 'DELETE_NODE',
        id: change.node_id,
      });
    }
  }

  // Convert edge changes
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add') {
      ops.push({
        op: 'ADD_EDGE',
        edge: {
          id: defaultIdGenerator('edge'),
          type: edge.edge_type,
          from: edge.from,
          to: edge.to,
          ...(edge.properties && { properties: edge.properties }),
          provenance: {
            source: 'extractor',
            packageId: pkg.id,
          },
        },
      });
    } else if (edge.operation === 'delete') {
      ops.push({
        op: 'DELETE_EDGE',
        edge: {
          type: edge.edge_type,
          from: edge.from,
          to: edge.to,
        },
      });
    }
  }

  const patch: Patch = {
    type: 'Patch',
    id: `patch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    base_story_version_id: baseVersionId,
    created_at: new Date().toISOString(),
    ops,
    metadata: {
      source: 'ai_generation',
      package_id: pkg.id,
      package_title: pkg.title,
      confidence: pkg.confidence,
    },
  };

  // Handle Story Context changes separately (not part of graph patch)
  let storyContextUpdate: ConversionResult['storyContextUpdate'];

  if (pkg.changes.storyContext && pkg.changes.storyContext.length > 0) {
    storyContextUpdate = {
      newContext: applyStoryContextChanges(currentStoryContext ?? '', pkg.changes.storyContext),
      changes: pkg.changes.storyContext,
    };
  }

  return { patch, storyContextUpdate };
}

/**
 * Apply Story Context changes to produce new markdown
 */
function applyStoryContextChanges(
  currentContext: string,
  changes: StoryContextChange[]
): string {
  let context = currentContext;

  for (const change of changes) {
    if (change.operation === 'add') {
      // Add to section or create new section
      context = addToSection(context, change.section, change.content);
    } else if (change.operation === 'modify') {
      // Replace content in section
      if (change.previous_content) {
        context = context.replace(change.previous_content, change.content);
      }
    } else if (change.operation === 'delete') {
      // Remove content from section
      context = context.replace(change.content, '').replace(/\n\n+/g, '\n\n');
    }
  }

  return context.trim();
}

/**
 * Add content to a section in Story Context markdown
 */
function addToSection(context: string, section: string, content: string): string {
  const sectionHeader = `## ${section}`;
  const sectionIndex = context.indexOf(sectionHeader);

  if (sectionIndex >= 0) {
    // Find end of section (next ## or end of string)
    const afterHeader = sectionIndex + sectionHeader.length;
    const nextSection = context.indexOf('\n## ', afterHeader);
    const insertPoint = nextSection >= 0 ? nextSection : context.length;

    // Insert content before next section
    const before = context.slice(0, insertPoint);
    const after = context.slice(insertPoint);
    return `${before.trimEnd()}\n- ${content}\n${after}`;
  } else {
    // Section doesn't exist, add it
    return `${context.trimEnd()}\n\n## ${section}\n- ${content}\n`;
  }
}

/**
 * Validate a package before conversion
 */
export function validatePackageForConversion(
  pkg: NarrativePackage,
  existingNodeIds: Set<string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for modify/delete operations on non-existent nodes
  for (const change of pkg.changes.nodes) {
    if (change.operation !== 'add' && !existingNodeIds.has(change.node_id)) {
      errors.push(`Cannot ${change.operation} non-existent node: ${change.node_id}`);
    }
  }

  // Check edge delete operations
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'delete') {
      if (!existingNodeIds.has(edge.from) || !existingNodeIds.has(edge.to)) {
        errors.push(`Cannot delete edge between non-existent nodes: ${edge.from} -> ${edge.to}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## Phase 5: Prompts

### 5.1 Interpretation Prompt (`prompts/interpretationPrompt.ts`)

```typescript
import type { InterpretationParams } from '../types.js';

export function buildInterpretationPrompt(params: InterpretationParams): string {
  const { userInput, storyContext, recentNodes } = params;

  return `You are an AI assistant helping to develop a screenplay. Your task is to interpret the user's freeform input and propose appropriate structured changes to the story.

## Your Role

1. Parse the user's input for narrative intent
2. Determine what type of story element is being described
3. Check for existing nodes that relate to or match the input
4. Propose the most appropriate structured output
5. Explain your reasoning

## Available Node Types

- **Character**: A person or entity with agency in the story
- **Location**: A physical space where scenes can occur
- **Object**: A significant prop or item with narrative relevance
- **PlotPoint**: A narrative event that must happen (story causality)
- **Scene**: A unit of dramatic action (heading + overview)
- **Idea**: An unassigned creative concept (use when uncertain)
- **Story Context addition**: Thematic/directional content (themes, constraints, motifs)

## Current Story State

${storyContext}

${recentNodes?.length ? `## Recently Modified Nodes\n${recentNodes.join('\n')}` : ''}

## User Input

"${userInput}"

## Output Format

Respond with a JSON object matching this schema:

\`\`\`json
{
  "interpretation": {
    "summary": "What you understood from the input",
    "confidence": 0.85
  },
  "proposals": [
    {
      "type": "node",
      "operation": "add",
      "target_type": "Character",
      "data": {
        "name": "...",
        "description": "..."
      },
      "rationale": "Why this interpretation makes sense",
      "relates_to": ["existing_node_id"]
    }
  ],
  "alternatives": [
    {
      "summary": "Alternative interpretation",
      "confidence": 0.6
    }
  ]
}
\`\`\`

## Guidelines

- If the input clearly describes a concrete story element, propose a specific node type
- If the input is thematic or directional ("I want more tension"), propose Story Context addition
- If uncertain, propose an Idea node that can be promoted later
- Always explain your reasoning in the rationale
- Reference existing nodes when the input relates to them
- Confidence should reflect how certain you are about the interpretation

Respond with only the JSON object.`;
}
```

### 5.2 Generation Prompt (`prompts/generationPrompt.ts`)

```typescript
import type { GenerationParams } from '../types.js';
import { getPackageCount, getDepthBudget, defaultConfig } from '../config.js';

export function buildGenerationPrompt(params: GenerationParams): string {
  const { entryPoint, storyContext, gaps, direction, depth, count } = params;
  const budget = getDepthBudget(depth);

  const entryDescription = describeEntryPoint(entryPoint);

  return `You are an AI assistant helping to develop a screenplay. Your task is to generate ${count} complete narrative packages based on the given entry point.

## Your Role

1. Understand the entry point and generation context
2. Consult the story state for thematic alignment
3. Review gaps for opportunities to fulfill
4. Generate ${count} distinct, complete packages
5. Each package must be self-contained and ready to apply

## Entry Point

${entryDescription}

## Current Story State

${storyContext}

## Open Gaps (Opportunities)

${gaps}

${direction ? `## User Direction\n\n"${direction}"\n` : ''}

## Generation Budget

- **Depth**: ${depth}
- Maximum new nodes per package: ${budget.maxNodes}
- Maximum total operations per package: ${budget.maxOps}

## Available Node Types

- **Character**: name, description, archetype, traits[]
- **Location**: name, description, parent_location_id
- **Object**: name, description
- **PlotPoint**: title, summary, intent (plot|character|tone), priority, stakes_change
- **Scene**: heading, scene_overview, order_index, mood, key_actions[]

## Available Edge Types

- HAS_CHARACTER: Scene → Character
- LOCATED_AT: Scene → Location
- FEATURES_OBJECT: Scene → Object
- ALIGNS_WITH: PlotPoint → Beat
- SATISFIED_BY: PlotPoint → Scene
- PRECEDES: PlotPoint → PlotPoint (causal ordering)
- ADVANCES: PlotPoint → CharacterArc
- PART_OF: Location → Setting

## Output Format

Respond with a JSON object matching this schema:

\`\`\`json
{
  "packages": [
    {
      "id": "pkg_12345_abc",
      "title": "Short descriptive title",
      "rationale": "Why this package makes sense for the story",
      "confidence": 0.85,
      "style_tags": ["betrayal", "dramatic"],
      "changes": {
        "storyContext": [
          {
            "operation": "add",
            "section": "Themes & Motifs",
            "content": "New thematic element"
          }
        ],
        "nodes": [
          {
            "operation": "add",
            "node_type": "Character",
            "node_id": "char_12345_xyz",
            "data": { "name": "...", "description": "..." }
          }
        ],
        "edges": [
          {
            "operation": "add",
            "edge_type": "HAS_CHARACTER",
            "from": "scene_123",
            "to": "char_12345_xyz"
          }
        ]
      },
      "impact": {
        "fulfills_gaps": ["gap_id_1"],
        "creates_gaps": ["New gap description"],
        "conflicts": [
          {
            "type": "interferes",
            "existing_node_id": "char_456",
            "description": "May overshadow existing character",
            "source": "llm",
            "resolution_included": false
          }
        ]
      }
    }
  ]
}
\`\`\`

## Guidelines

1. **Variety**: Each package should take a meaningfully different approach
2. **Completeness**: Include all supporting elements (characters, locations) needed
3. **Coherence**: All elements within a package should work together
4. **Alignment**: Respect the story's themes, tone, and constraints
5. **Gaps**: Try to fulfill open gaps when relevant
6. **Conflicts**: Flag any conflicts with existing content
7. **IDs**: Use format \`{type}_{timestamp}_{5chars}\` for new node IDs

Respond with only the JSON object.`;
}

function describeEntryPoint(entryPoint: GenerationParams['entryPoint']): string {
  switch (entryPoint.type) {
    case 'beat':
      return `Generate content to realize structural beat: ${entryPoint.targetId}
${entryPoint.targetData ? `Beat details: ${JSON.stringify(entryPoint.targetData)}` : ''}`;

    case 'plotPoint':
      return `Generate scenes and supporting elements for PlotPoint: ${entryPoint.targetId}
${entryPoint.targetData ? `PlotPoint details: ${JSON.stringify(entryPoint.targetData)}` : ''}`;

    case 'character':
      return `Generate story developments featuring Character: ${entryPoint.targetId}
${entryPoint.targetData ? `Character details: ${JSON.stringify(entryPoint.targetData)}` : ''}`;

    case 'gap':
      return `Generate content to resolve gap: ${entryPoint.targetId}
${entryPoint.targetData ? `Gap details: ${JSON.stringify(entryPoint.targetData)}` : ''}`;

    case 'idea':
      return `Develop Idea into concrete story elements: ${entryPoint.targetId}
${entryPoint.targetData ? `Idea details: ${JSON.stringify(entryPoint.targetData)}` : ''}`;

    case 'naked':
    default:
      return `Analyze the story and generate highest-value additions. No specific target - use your judgment to identify what would most benefit the story.`;
  }
}
```

### 5.3 Refinement Prompt (`prompts/refinementPrompt.ts`)

```typescript
import type { RefinementParams, NarrativePackage } from '../types.js';
import { getDepthBudget } from '../config.js';

export function buildRefinementPrompt(params: RefinementParams): string {
  const { basePackage, keepElements, regenerateElements, guidance, storyContext, depth, count } = params;
  const budget = getDepthBudget(depth);

  return `You are an AI assistant helping to develop a screenplay. Your task is to generate ${count} variations of an existing narrative package based on user feedback.

## Your Role

1. Understand the base package being refined
2. Preserve elements marked as "keep"
3. Regenerate elements marked for change, following user guidance
4. Maintain coherence between kept and new elements
5. Generate ${count} meaningfully distinct variations

## Base Package

**Title**: ${basePackage.title}
**Rationale**: ${basePackage.rationale}

### Current Changes

${formatPackageChanges(basePackage)}

## Refinement Instructions

### Elements to Keep Unchanged
${keepElements.length > 0 ? keepElements.map(id => `- ${id}`).join('\n') : 'None specified'}

### Elements to Regenerate
${regenerateElements.length > 0 ? regenerateElements.map(id => `- ${id}`).join('\n') : 'All non-kept elements'}

### User Guidance
"${guidance}"

## Current Story State

${storyContext}

## Budget

- **Depth**: ${depth}
- Maximum new nodes per variation: ${budget.maxNodes}
- Maximum total operations per variation: ${budget.maxOps}

## Output Format

Respond with a JSON object matching this schema:

\`\`\`json
{
  "packages": [
    {
      "id": "pkg_refined_12345",
      "title": "Variation title",
      "rationale": "How this variation addresses the feedback",
      "confidence": 0.85,
      "parent_package_id": "${basePackage.id}",
      "refinement_prompt": "${guidance.slice(0, 100)}...",
      "style_tags": [...],
      "changes": { ... },
      "impact": { ... }
    }
  ]
}
\`\`\`

## Guidelines

1. **Preserve**: Keep elements must appear exactly as in the base package
2. **Interpret**: Apply the user guidance creatively but faithfully
3. **Variety**: Each variation should interpret the guidance differently
4. **Coherence**: New elements must work with kept elements
5. **Lineage**: Include parent_package_id and refinement_prompt

Respond with only the JSON object.`;
}

function formatPackageChanges(pkg: NarrativePackage): string {
  const lines: string[] = [];

  if (pkg.changes.storyContext?.length) {
    lines.push('**Story Context Changes:**');
    for (const change of pkg.changes.storyContext) {
      lines.push(`- [${change.operation}] ${change.section}: "${change.content}"`);
    }
  }

  if (pkg.changes.nodes.length) {
    lines.push('\n**Node Changes:**');
    for (const change of pkg.changes.nodes) {
      const label = change.data?.name ?? change.data?.title ?? change.node_id;
      lines.push(`- [${change.operation}] ${change.node_type}: ${label} (${change.node_id})`);
    }
  }

  if (pkg.changes.edges.length) {
    lines.push('\n**Edge Changes:**');
    for (const edge of pkg.changes.edges) {
      lines.push(`- [${edge.operation}] ${edge.from} -[${edge.edge_type}]-> ${edge.to}`);
    }
  }

  return lines.join('\n');
}
```

### 5.4 Prompts Index (`prompts/index.ts`)

```typescript
export { buildInterpretationPrompt } from './interpretationPrompt.js';
export { buildGenerationPrompt } from './generationPrompt.js';
export { buildRefinementPrompt } from './refinementPrompt.js';
```

---

## Phase 6: Module Index

### 6.1 Main Index (`index.ts`)

```typescript
// Types
export type {
  InterpretationResult,
  InterpretationProposal,
  GenerationResult,
  NarrativePackage,
  NodeChange,
  EdgeChange,
  StoryContextChange,
  ConflictInfo,
  GenerationDepth,
  GenerationCount,
  GenerationEntryPoint,
  GenerationParams,
  RefinementParams,
  InterpretationParams,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types.js';

// Config
export { defaultConfig, getPackageCount, getDepthBudget } from './config.js';
export type { AIConfig } from './config.js';

// ID Generation
export {
  defaultIdGenerator,
  createDeterministicIdGenerator,
  isValidNodeId,
} from './idGenerator.js';
export type { IdGenerator } from './idGenerator.js';

// Context Serialization
export {
  serializeStoryContext,
  serializeNodeContext,
  serializeGaps,
  serializeStoryContextMd,
} from './contextSerializer.js';

// Output Parsing
export {
  parseInterpretationResponse,
  parseGenerationResponse,
  validateGeneratedIds,
  validateEdgeReferences,
  regenerateInvalidIds,
  ParseError,
} from './outputParser.js';

// Package Conversion
export {
  packageToPatch,
  validatePackageForConversion,
} from './packageToPatches.js';

// Prompts
export {
  buildInterpretationPrompt,
  buildGenerationPrompt,
  buildRefinementPrompt,
} from './prompts/index.js';
```

---

## Phase 7: Testing

### 7.1 Test Fixtures

Create the following test fixtures:

**`packages/core/src/ai/__tests__/fixtures/`**

| File | Description |
|------|-------------|
| `empty_graph.json` | Empty graph (only Beat nodes) |
| `sparse_graph.json` | Beats + 1-2 characters |
| `rich_graph.json` | Multiple characters, scenes, plot points |
| `graph_with_gaps.json` | Graph with open gaps |
| `valid_generation_response.json` | Well-formed LLM response |
| `malformed_response.json` | JSON with common issues |
| `over_budget_response.json` | Response exceeding node limits |
| `invalid_ids_response.json` | Response with duplicate/invalid IDs |

### 7.2 Test Cases

| Module | Test Cases |
|--------|------------|
| `contextSerializer.test.ts` | Empty graph, sparse graph, rich graph, truncation, node context |
| `outputParser.test.ts` | Valid JSON, markdown-wrapped JSON, malformed JSON, schema validation |
| `idGenerator.test.ts` | Format validation, deterministic mode, uniqueness |
| `packageToPatches.test.ts` | Add/modify/delete nodes, edge conversion, Story Context changes |
| `prompts/*.test.ts` | Parameter substitution, budget enforcement, entry point handling |

---

## Implementation Order

| Phase | Files | Dependencies | Est. Complexity |
|-------|-------|--------------|-----------------|
| 1 | `types.ts`, `config.ts`, `idGenerator.ts` | None | Low |
| 2 | `contextSerializer.ts` | Phase 1, existing `graph.ts` | Medium |
| 3 | `outputParser.ts` | Phase 1 | Medium |
| 4 | `packageToPatches.ts` | Phase 1, existing `patch.ts` | Low |
| 5 | `prompts/*.ts` | Phase 1, 2 | Medium |
| 6 | `index.ts` | All above | Low |
| 7 | Tests + fixtures | All above | Medium |

---

## Clarifications & Implementation Notes

### 1. Missing Import in `outputParser.ts`

Add to imports at the top of the file:

```typescript
import type { StoryContextChange } from './types.js';
```

### 2. Edge ID Generation

Edges in this codebase **do have IDs** (UUID format). The `defaultIdGenerator('edge')` approach is correct.

### 3. Idea Node Type

The `Idea` node type is already implemented in the core schema (`packages/core/src/types/nodes.ts`). No additional work needed.

### 4. Story Context Section Format

Story Context uses `##` headers (not `###`). Update `addToSection` function:

```typescript
function addToSection(context: string, section: string, content: string): string {
  const sectionHeader = `## ${section}`;  // Use ## not ###
  const sectionIndex = context.indexOf(sectionHeader);

  if (sectionIndex >= 0) {
    const afterHeader = sectionIndex + sectionHeader.length;
    const nextSection = context.indexOf('\n## ', afterHeader);  // Match ## not ###
    const insertPoint = nextSection >= 0 ? nextSection : context.length;

    const before = context.slice(0, insertPoint);
    const after = context.slice(insertPoint);
    return `${before.trimEnd()}\n- ${content}\n${after}`;
  } else {
    return `${context.trimEnd()}\n\n## ${section}\n- ${content}\n`;  // Use ## not ###
  }
}
```

### 5. Test Fixtures Content Requirements

| Fixture | Required Content |
|---------|------------------|
| `empty_graph.json` | 15 Beat nodes (always present), empty edges |
| `sparse_graph.json` | Beats + Logline + 1 Character + 1 Location |
| `rich_graph.json` | Full example: PlotPoints, Scenes, Edges, CharacterArcs |
| `graph_with_gaps.json` | Use `computeCoverage()` to derive realistic gaps |
| `valid_generation_response.json` | Well-formed 3-package response |
| `malformed_response.json` | Trailing commas, single quotes, code block wrapped |
| `over_budget_response.json` | Response with 15+ nodes (exceeds wide budget) |
| `invalid_ids_response.json` | Duplicate IDs, malformed ID formats |

### 6. Two-Step ID Regeneration (Recommended Approach)

Keep the explicit two-step process for clarity and debuggability:

```typescript
// Explicit two-step (RECOMMENDED)
let result = parseGenerationResponse(response);
const validation = validateGeneratedIds(result, existingIds);
if (!validation.valid) {
  console.log('Regenerating invalid IDs:', validation.errors);
  result = regenerateInvalidIds(result, existingIds);
}
```

This allows logging when regeneration happens and keeps parsing separate from ID fixing.

### 7. Future Enhancement: Token Estimation

Not required for v1, but consider adding later:

```typescript
// Optional future utility
export function estimateTokenCount(prompt: string): number {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(prompt.length / 4);
}
```

---

## Acceptance Criteria

- [ ] Context serialization produces readable, structured markdown
- [ ] System prompts are parameterized and produce consistent LLM behavior
- [ ] Output parser handles well-formed and slightly malformed responses
- [ ] Generated packages conform to NarrativePackage schema
- [ ] Node IDs are unique and properly formatted
- [ ] Edge references are validated against existing + proposed nodes
- [ ] Budget constraints (depth, count) are enforced in prompts
- [ ] Package-to-Patch conversion produces valid Patch objects
- [ ] Story Context changes are applied correctly to markdown (using `##` headers)
- [ ] Unit tests cover normal and edge cases
- [ ] All modules export cleanly from index.ts

---

## Usage Example

```typescript
import {
  serializeStoryContext,
  serializeGaps,
  buildGenerationPrompt,
  parseGenerationResponse,
  validateGeneratedIds,
  regenerateInvalidIds,
  packageToPatch,
} from '@apollo/core/ai';

// 1. Serialize context for LLM
const context = serializeStoryContext(graphState, metadata);
const gapsText = serializeGaps(gaps);

// 2. Build prompt
const prompt = buildGenerationPrompt({
  entryPoint: { type: 'beat', targetId: 'beat_Midpoint' },
  storyContext: context,
  gaps: gapsText,
  direction: "Focus on betrayal themes",
  depth: 'medium',
  count: 5,
});

// 3. Call LLM (external)
const response = await callLLM(prompt);

// 4. Parse response
let result = parseGenerationResponse(response);

// 5. Validate IDs
const validation = validateGeneratedIds(result, existingNodeIds);
if (!validation.valid) {
  result = regenerateInvalidIds(result, existingNodeIds);
}

// 6. Convert selected package to patch
const selectedPackage = result.packages[0];
const { patch, storyContextUpdate } = packageToPatch(
  selectedPackage,
  currentVersionId,
  currentStoryContext
);

// 7. Apply patch to graph
const updatedGraph = applyPatch(graph, patch);

// 8. Update story context if needed
if (storyContextUpdate) {
  metadata.storyContext = storyContextUpdate.newContext;
}
```
