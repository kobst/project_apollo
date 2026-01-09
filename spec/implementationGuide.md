# Project Apollo — Implementation Guide v1.0

## Overview

This guide instructs the implementation of the Project Apollo screenplay knowledge graph system. The goal is to build an executable "contract test" repository that validates the schema before introducing database or LLM complexity.

**Assumptions:**
- Spec documents already exist in `/spec/` directory
- TypeScript project with modern tooling (Node 20+, pnpm/npm)
- Tests use Vitest or Jest

---

## Phase 1: Repository Structure

Create the following directory structure:
```
project-apollo/
├── spec/
│   ├── kg_schema_v1.md          # Schema contract (provided)
│   ├── oq_cluster_policy_v1.md  # OpenQuestion policy (provided)
│   └── mvp_loop_v1.md           # MVP loop spec (provided)
├── src/
│   ├── types/
│   │   ├── nodes.ts             # Node type definitions
│   │   ├── edges.ts             # Edge type definitions
│   │   ├── patch.ts             # Patch operation types
│   │   ├── openQuestion.ts      # OpenQuestion types
│   │   └── index.ts             # Re-exports
│   ├── core/
│   │   ├── graph.ts             # In-memory graph store
│   │   ├── validator.ts         # Patch validation logic
│   │   ├── applyPatch.ts        # Patch application logic
│   │   ├── deriveOpenQuestions.ts  # OQ derivation
│   │   └── index.ts
│   ├── stubs/
│   │   ├── extractorStub.ts     # Stub: input → Patch
│   │   └── clusterStub.ts       # Stub: OQ → MoveCluster[]
│   └── cli.ts                   # CLI entry point
├── tests/
│   ├── validator.test.ts
│   ├── applyPatch.test.ts
│   ├── deriveOpenQuestions.test.ts
│   └── e2e.test.ts              # End-to-end loop test
├── package.json
├── tsconfig.json
└── README.md
```

---

## Phase 2: Type Definitions

### 2.1 `src/types/nodes.ts`

Define TypeScript interfaces for all 13 node types matching the schema exactly.
```typescript
// Base node interface
export interface BaseNode {
  type: string;
  id: string;
}

// StoryVersion
export interface StoryVersion extends BaseNode {
  type: 'StoryVersion';
  parent_story_version_id: string | null;
  created_at: string;
  label: string;
  summary?: string;
  logline?: string;
  premise?: string;
  genre_tone?: string;
  tags?: string[];
  author_notes?: string;
}

// Beat
export type BeatType = 
  | 'OpeningImage' | 'ThemeStated' | 'Setup' | 'Catalyst' | 'Debate'
  | 'BreakIntoTwo' | 'BStory' | 'FunAndGames' | 'Midpoint'
  | 'BadGuysCloseIn' | 'AllIsLost' | 'DarkNightOfSoul'
  | 'BreakIntoThree' | 'Finale' | 'FinalImage';

export type BeatStatus = 'EMPTY' | 'PLANNED' | 'REALIZED';

export interface Beat extends BaseNode {
  type: 'Beat';
  beat_type: BeatType;
  act: 1 | 2 | 3 | 4 | 5;
  position_index: number; // 1-15
  guidance?: string;
  status?: BeatStatus;
  notes?: string;
}

// Scene
export type SceneTag =
  | 'SETUP' | 'PAYOFF' | 'REVEAL' | 'REVERSAL' | 'DECISION'
  | 'ESCALATION' | 'LOSS' | 'VICTORY' | 'INTRO_CHARACTER'
  | 'INTRO_OBJECT' | 'TURNING_POINT';

export interface Scene extends BaseNode {
  type: 'Scene';
  heading: string;
  scene_overview: string;
  beat_id?: string; // DEPRECATED: Use PlotPoint attachment via SATISFIED_BY edge
  order_index?: number; // Auto-computed when attached to PlotPoint
  int_ext?: 'INT' | 'EXT' | 'OTHER';
  time_of_day?: string;
  mood?: string;
  key_actions?: string[];
  notable_dialogue?: string[];
  scene_tags?: SceneTag[];
  status?: 'DRAFT' | 'REVISED';
  source_provenance?: 'USER' | 'AI' | 'MIXED';
}

// PlotPoint - bridges Beats and Scenes
export interface PlotPoint extends BaseNode {
  type: 'PlotPoint';
  title: string;
  description?: string;
  order_index?: number; // Auto-computed when attached to Beat via ALIGNS_WITH
  status?: 'UNSATISFIED' | 'SATISFIED';
  notes?: string;
}

// Character
export interface Character extends BaseNode {
  type: 'Character';
  name: string;
  description?: string;
  archetype?: string;
  traits?: string[];
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

// Location
export interface Location extends BaseNode {
  type: 'Location';
  name: string;
  parent_location_id?: string | null;
  description?: string;
  tags?: string[];
}

// Object
export interface StoryObject extends BaseNode {
  type: 'Object';
  name: string;
  description?: string;
  significance?: string;
  introduced_in_scene_id?: string;
  tags?: string[];
}

// Theme
export interface Theme extends BaseNode {
  type: 'Theme';
  statement: string;
  notes?: string;
  priority?: 'HIGH' | 'MED' | 'LOW';
  status?: 'FLOATING' | 'GROUNDED';
}

// Motif
export interface Motif extends BaseNode {
  type: 'Motif';
  name: string;
  description?: string;
  motif_type?: 'PATTERN' | 'IMAGE' | 'SYMBOL';
  status?: 'FLOATING' | 'GROUNDED';
}

// CharacterArc
export interface TurnRef {
  beat_id?: string;
  scene_id?: string;
  note?: string;
}

export interface CharacterArc extends BaseNode {
  type: 'CharacterArc';
  character_id: string;
  arc_type?: string;
  start_state?: string;
  end_state?: string;
  turn_refs?: TurnRef[];
  status?: 'FLOATING' | 'PARTIAL' | 'GROUNDED';
}

// Conflict
export type ConflictType = 
  | 'interpersonal' | 'internal' | 'societal' 
  | 'ideological' | 'systemic' | 'nature' | 'technological';

export interface Conflict extends BaseNode {
  type: 'Conflict';
  name: string;
  conflict_type: ConflictType;
  description: string;
  stakes?: string;
  intensity?: 1 | 2 | 3 | 4 | 5;
  status?: 'FLOATING' | 'ACTIVE' | 'RESOLVED';
  start_beat_id?: string;
  end_beat_id?: string;
  notes?: string;
}

// MoveCluster
export interface ScopeBudget {
  max_ops_per_move: number;
  max_new_nodes_per_move: number;
  allowed_node_types: string[];
  allowed_depth: 'OUTLINE' | 'DRAFT' | 'REVISION';
}

export interface MoveCluster extends BaseNode {
  type: 'MoveCluster';
  base_story_version_id: string;
  created_at: string;
  title: string;
  description?: string;
  cluster_type?: 'STRUCTURE' | 'SCENE_LIST' | 'SCENE_QUALITY' | 'CONFLICT' | 'CHARACTER' | 'THEME' | 'MOTIF';
  primary_open_question_id?: string;
  supporting_open_question_ids?: string[];
  scope_budget: ScopeBudget;
  status?: 'PROPOSED' | 'ARCHIVED';
}

// NarrativeMove
export interface NarrativeMove extends BaseNode {
  type: 'NarrativeMove';
  cluster_id: string;
  patch_id: string;
  title: string;
  rationale: string;
  created_at: string;
  expected_effects?: string[];
  move_style_tags?: string[];
  resolves_open_question_ids?: string[];
  introduces_open_question_ids?: string[];
  confidence?: number;
  status?: 'PROPOSED' | 'ACCEPTED' | 'REJECTED';
  human_edits?: string;
}

// Patch (see patch.ts)

// Union type for all nodes
export type KGNode =
  | StoryVersion | MoveCluster | NarrativeMove | Patch
  | Beat | Scene | PlotPoint | Character | Location | StoryObject
  | Theme | Motif | CharacterArc | Conflict;
```

### 2.2 `src/types/edges.ts`
```typescript
export type EdgeType =
  | 'FULFILLS'        // Scene → Beat (DEPRECATED: use PlotPoint hierarchy)
  | 'ALIGNS_WITH'     // PlotPoint → Beat (triggers order computation)
  | 'SATISFIED_BY'    // PlotPoint → Scene (triggers order computation)
  | 'HAS_CHARACTER'   // Scene → Character
  | 'LOCATED_AT'      // Scene → Location
  | 'FEATURES_OBJECT' // Scene → Object
  | 'INVOLVES'        // Conflict → Character
  | 'MANIFESTS_IN'    // Conflict → Scene
  | 'HAS_ARC'         // Character → CharacterArc
  | 'EXPRESSED_IN'    // Theme → Scene | Beat
  | 'APPEARS_IN';     // Motif → Scene

export interface Edge {
  type: EdgeType;
  from: string;
  to: string;
  createdAt?: string; // Used for ordering tie-breaking
}

// Edge validation rules
export const EDGE_RULES: Record<EdgeType, { source: string[]; target: string[] }> = {
  FULFILLS: { source: ['Scene'], target: ['Beat'] }, // DEPRECATED
  ALIGNS_WITH: { source: ['PlotPoint'], target: ['Beat'] },
  SATISFIED_BY: { source: ['PlotPoint'], target: ['Scene'] },
  HAS_CHARACTER: { source: ['Scene'], target: ['Character'] },
  LOCATED_AT: { source: ['Scene'], target: ['Location'] },
  FEATURES_OBJECT: { source: ['Scene'], target: ['Object'] },
  INVOLVES: { source: ['Conflict'], target: ['Character'] },
  MANIFESTS_IN: { source: ['Conflict'], target: ['Scene'] },
  HAS_ARC: { source: ['Character'], target: ['CharacterArc'] },
  EXPRESSED_IN: { source: ['Theme'], target: ['Scene', 'Beat'] },
  APPEARS_IN: { source: ['Motif'], target: ['Scene'] },
};
```

### 2.3 `src/types/patch.ts`
```typescript
import { KGNode } from './nodes';
import { Edge } from './edges';

export interface AddNodeOp {
  op: 'ADD_NODE';
  node: KGNode;
}

export interface UpdateNodeOp {
  op: 'UPDATE_NODE';
  id: string;
  set: Record<string, unknown>;
  unset?: string[];
}

export interface DeleteNodeOp {
  op: 'DELETE_NODE';
  id: string;
}

export interface AddEdgeOp {
  op: 'ADD_EDGE';
  edge: Edge;
}

export interface DeleteEdgeOp {
  op: 'DELETE_EDGE';
  edge: Edge;
}

export type PatchOp = AddNodeOp | UpdateNodeOp | DeleteNodeOp | AddEdgeOp | DeleteEdgeOp;

export interface Patch {
  type: 'Patch';
  id: string;
  base_story_version_id: string;
  created_at: string;
  ops: PatchOp[];
  metadata?: Record<string, unknown>;
  notes?: string;
}
```

### 2.4 `src/types/openQuestion.ts`
```typescript
export type OQSeverity = 'BLOCKING' | 'IMPORTANT' | 'SOFT';
export type OQPhase = 'OUTLINE' | 'DRAFT' | 'REVISION';
export type OQDomain = 'STRUCTURE' | 'SCENE' | 'CHARACTER' | 'CONFLICT' | 'THEME_MOTIF';

export type OQType = 
  // Structure
  | 'BeatUnrealized' | 'ActImbalance' | 'SceneUnplaced'
  // Scene
  | 'SceneNeedsOverview' | 'SceneHasNoCast' | 'SceneNeedsLocation'
  // Character
  | 'CharacterUnderspecified' | 'MissingCharacterArc' | 'ArcUngrounded'
  // Conflict
  | 'ConflictNeedsParties' | 'ConflictNeedsManifestation'
  // Theme/Motif
  | 'ThemeUngrounded' | 'MotifUngrounded';

export interface OpenQuestion {
  id: string;
  type: OQType;
  domain: OQDomain;
  severity: OQSeverity;
  phase: OQPhase;
  group_key: string;
  target_node_id?: string;
  message: string;
}
```

---

## Phase 3: Core Implementation

### 3.1 `src/core/graph.ts` — In-Memory Graph Store
```typescript
import { KGNode } from '../types/nodes';
import { Edge } from '../types/edges';

export interface GraphState {
  nodes: Map<string, KGNode>;
  edges: Edge[];
}

export function createEmptyGraph(): GraphState {
  return {
    nodes: new Map(),
    edges: [],
  };
}

export function getNode(graph: GraphState, id: string): KGNode | undefined {
  return graph.nodes.get(id);
}

export function getNodesByType<T extends KGNode>(graph: GraphState, type: string): T[] {
  return Array.from(graph.nodes.values()).filter(n => n.type === type) as T[];
}

export function getEdgesFrom(graph: GraphState, nodeId: string): Edge[] {
  return graph.edges.filter(e => e.from === nodeId);
}

export function getEdgesTo(graph: GraphState, nodeId: string): Edge[] {
  return graph.edges.filter(e => e.to === nodeId);
}

export function hasEdge(graph: GraphState, type: string, from: string, to: string): boolean {
  return graph.edges.some(e => e.type === type && e.from === from && e.to === to);
}

export function cloneGraph(graph: GraphState): GraphState {
  return {
    nodes: new Map(graph.nodes),
    edges: [...graph.edges],
  };
}
```

### 3.2 `src/core/applyPatch.ts` — Patch Application
```typescript
import { GraphState, cloneGraph } from './graph';
import { Patch, PatchOp } from '../types/patch';
import { KGNode } from '../types/nodes';

export function applyPatch(graph: GraphState, patch: Patch): GraphState {
  const newGraph = cloneGraph(graph);
  
  for (const op of patch.ops) {
    applyOp(newGraph, op);
  }
  
  return newGraph;
}

function applyOp(graph: GraphState, op: PatchOp): void {
  switch (op.op) {
    case 'ADD_NODE':
      graph.nodes.set(op.node.id, op.node);
      break;
      
    case 'UPDATE_NODE': {
      const existing = graph.nodes.get(op.id);
      if (!existing) throw new Error(`Node ${op.id} not found`);
      
      const updated = { ...existing, ...op.set };
      if (op.unset) {
        for (const field of op.unset) {
          delete (updated as Record<string, unknown>)[field];
        }
      }
      graph.nodes.set(op.id, updated as KGNode);
      break;
    }
    
    case 'DELETE_NODE':
      graph.nodes.delete(op.id);
      // Remove incident edges
      graph.edges = graph.edges.filter(e => e.from !== op.id && e.to !== op.id);
      break;
      
    case 'ADD_EDGE':
      graph.edges.push(op.edge);
      break;
      
    case 'DELETE_EDGE':
      graph.edges = graph.edges.filter(
        e => !(e.type === op.edge.type && e.from === op.edge.from && e.to === op.edge.to)
      );
      break;
  }
}
```

### 3.3 `src/core/validator.ts` — Patch Validation
```typescript
import { GraphState, getNode, getNodesByType, getEdgesFrom } from './graph';
import { Patch } from '../types/patch';
import { applyPatch } from './applyPatch';
import { EDGE_RULES, Edge } from '../types/edges';
import { Beat, Scene, Character, CharacterArc, Conflict } from '../types/nodes';

export interface ValidationError {
  code: string;
  message: string;
  node_id?: string;
  field?: string;
  op_index?: number;
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
}

export function validatePatch(graph: GraphState, patch: Patch): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Apply patch to get resulting state
  let resultGraph: GraphState;
  try {
    resultGraph = applyPatch(graph, patch);
  } catch (e) {
    return {
      success: false,
      errors: [{ code: 'APPLY_FAILED', message: (e as Error).message }],
    };
  }
  
  // 1. Check FK integrity
  errors.push(...checkFKIntegrity(resultGraph));
  
  // 2. Check for duplicate IDs (handled by Map)
  
  // 3. Check edge validity
  errors.push(...checkEdgeValidity(resultGraph));
  
  // 4. Check node-specific rules
  errors.push(...checkNodeRules(resultGraph));
  
  // 5. Check structural constraints
  errors.push(...checkStructuralConstraints(resultGraph));
  
  return {
    success: errors.length === 0,
    errors,
  };
}

function checkFKIntegrity(graph: GraphState): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Scene.beat_id must exist
  for (const scene of getNodesByType<Scene>(graph, 'Scene')) {
    if (!getNode(graph, scene.beat_id)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Scene ${scene.id} references non-existent Beat ${scene.beat_id}`,
        node_id: scene.id,
        field: 'beat_id',
      });
    }
  }
  
  // CharacterArc.character_id must exist
  for (const arc of getNodesByType<CharacterArc>(graph, 'CharacterArc')) {
    if (!getNode(graph, arc.character_id)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `CharacterArc ${arc.id} references non-existent Character ${arc.character_id}`,
        node_id: arc.id,
        field: 'character_id',
      });
    }
  }
  
  // Edge endpoints must exist
  for (const edge of graph.edges) {
    if (!getNode(graph, edge.from)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Edge ${edge.type} from non-existent node ${edge.from}`,
      });
    }
    if (!getNode(graph, edge.to)) {
      errors.push({
        code: 'FK_INTEGRITY',
        message: `Edge ${edge.type} to non-existent node ${edge.to}`,
      });
    }
  }
  
  return errors;
}

function checkEdgeValidity(graph: GraphState): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Set<string>();
  
  for (const edge of graph.edges) {
    // Check for unknown edge types
    if (!(edge.type in EDGE_RULES)) {
      errors.push({
        code: 'INVALID_EDGE_TYPE',
        message: `Unknown edge type: ${edge.type}`,
      });
      continue;
    }
    
    // Check source/target types
    const rule = EDGE_RULES[edge.type];
    const fromNode = getNode(graph, edge.from);
    const toNode = getNode(graph, edge.to);
    
    if (fromNode && !rule.source.includes(fromNode.type)) {
      errors.push({
        code: 'INVALID_EDGE_SOURCE',
        message: `Edge ${edge.type} cannot have source type ${fromNode.type}`,
      });
    }
    
    if (toNode && !rule.target.includes(toNode.type)) {
      errors.push({
        code: 'INVALID_EDGE_TARGET',
        message: `Edge ${edge.type} cannot have target type ${toNode.type}`,
      });
    }
    
    // Check for duplicates
    const key = `${edge.type}:${edge.from}:${edge.to}`;
    if (seen.has(key)) {
      errors.push({
        code: 'DUPLICATE_EDGE',
        message: `Duplicate edge: ${edge.type} from ${edge.from} to ${edge.to}`,
      });
    }
    seen.add(key);
  }
  
  return errors;
}

function checkNodeRules(graph: GraphState): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Beat validation
  for (const beat of getNodesByType<Beat>(graph, 'Beat')) {
    if (beat.act < 1 || beat.act > 5) {
      errors.push({
        code: 'OUT_OF_RANGE',
        message: `Beat ${beat.id} has invalid act: ${beat.act}`,
        node_id: beat.id,
        field: 'act',
      });
    }
    if (beat.position_index < 1 || beat.position_index > 15) {
      errors.push({
        code: 'OUT_OF_RANGE',
        message: `Beat ${beat.id} has invalid position_index: ${beat.position_index}`,
        node_id: beat.id,
        field: 'position_index',
      });
    }
  }
  
  // Scene validation
  for (const scene of getNodesByType<Scene>(graph, 'Scene')) {
    if (!scene.scene_overview || scene.scene_overview.length < 20) {
      errors.push({
        code: 'CONSTRAINT_VIOLATION',
        message: `Scene ${scene.id} has scene_overview shorter than 20 characters`,
        node_id: scene.id,
        field: 'scene_overview',
      });
    }
  }
  
  // Note: Conflict.intensity and Conflict.stakes were removed from schema
  // AI infers these from narrative context rather than storing as fields

  return errors;
}

function checkStructuralConstraints(graph: GraphState): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check exactly 15 beats per StoryVersion
  const beats = getNodesByType<Beat>(graph, 'Beat');
  if (beats.length > 0 && beats.length !== 15) {
    errors.push({
      code: 'CONSTRAINT_VIOLATION',
      message: `Expected 15 beats, found ${beats.length}`,
    });
  }
  
  // Check unique position_index within beats
  const positionIndices = new Set<number>();
  for (const beat of beats) {
    if (positionIndices.has(beat.position_index)) {
      errors.push({
        code: 'CONSTRAINT_VIOLATION',
        message: `Duplicate beat position_index: ${beat.position_index}`,
        node_id: beat.id,
      });
    }
    positionIndices.add(beat.position_index);
  }
  
  return errors;
}
```

### 3.4 `src/core/deriveOpenQuestions.ts` — OpenQuestion Derivation
```typescript
import { GraphState, getNodesByType, getEdgesFrom, getEdgesTo } from './graph';
import { OpenQuestion, OQType, OQSeverity, OQPhase, OQDomain } from '../types/openQuestion';
import { Beat, Scene, Character, Conflict, Theme, Motif, CharacterArc } from '../types/nodes';

export function deriveOpenQuestions(graph: GraphState, phase: OQPhase = 'OUTLINE'): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  
  // STRUCTURE domain
  questions.push(...deriveBeatUnrealized(graph));
  questions.push(...deriveActImbalance(graph));
  
  // SCENE domain
  if (phase === 'DRAFT' || phase === 'REVISION') {
    questions.push(...deriveSceneQuality(graph));
  }
  
  // CHARACTER domain
  questions.push(...deriveCharacterQuestions(graph, phase));
  
  // CONFLICT domain
  if (phase === 'DRAFT' || phase === 'REVISION') {
    questions.push(...deriveConflictQuestions(graph));
  }
  
  // THEME_MOTIF domain
  if (phase === 'REVISION') {
    questions.push(...deriveThemeMotifQuestions(graph));
  }
  
  return questions;
}

function deriveBeatUnrealized(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const beats = getNodesByType<Beat>(graph, 'Beat');
  const scenes = getNodesByType<Scene>(graph, 'Scene');
  
  for (const beat of beats) {
    const scenesForBeat = scenes.filter(s => s.beat_id === beat.id);
    if (scenesForBeat.length === 0) {
      questions.push({
        id: `oq_beat_${beat.id}`,
        type: 'BeatUnrealized',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: `STRUCTURE:BEAT:${beat.beat_type}`,
        target_node_id: beat.id,
        message: `Beat "${beat.beat_type}" has no scenes assigned`,
      });
    }
  }
  
  return questions;
}

function deriveActImbalance(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const scenes = getNodesByType<Scene>(graph, 'Scene');
  const beats = getNodesByType<Beat>(graph, 'Beat');
  
  // Count scenes per act
  const scenesPerAct: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  for (const scene of scenes) {
    const beat = beats.find(b => b.id === scene.beat_id);
    if (beat) {
      scenesPerAct[beat.act]++;
    }
  }
  
  // Check for imbalance
  for (let act = 1; act <= 5; act++) {
    const prevAct = act > 1 ? scenesPerAct[act - 1] : 0;
    const nextAct = act < 5 ? scenesPerAct[act + 1] : 0;
    
    if (scenesPerAct[act] === 0 && (prevAct >= 2 || nextAct >= 2)) {
      questions.push({
        id: `oq_act_${act}`,
        type: 'ActImbalance',
        domain: 'STRUCTURE',
        severity: 'IMPORTANT',
        phase: 'OUTLINE',
        group_key: `STRUCTURE:ACT:${act}`,
        message: `Act ${act} has no scenes while neighboring acts have content`,
      });
    }
  }
  
  return questions;
}

function deriveSceneQuality(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const scenes = getNodesByType<Scene>(graph, 'Scene');
  
  for (const scene of scenes) {
    // Check for missing characters
    const characterEdges = graph.edges.filter(
      e => e.type === 'HAS_CHARACTER' && e.from === scene.id
    );
    if (characterEdges.length === 0) {
      questions.push({
        id: `oq_scene_cast_${scene.id}`,
        type: 'SceneHasNoCast',
        domain: 'SCENE',
        severity: 'IMPORTANT',
        phase: 'DRAFT',
        group_key: `SCENE:QUALITY:${scene.id}`,
        target_node_id: scene.id,
        message: `Scene "${scene.heading}" has no characters assigned`,
      });
    }
    
    // Check for missing location
    const locationEdges = graph.edges.filter(
      e => e.type === 'LOCATED_AT' && e.from === scene.id
    );
    if (locationEdges.length === 0) {
      questions.push({
        id: `oq_scene_loc_${scene.id}`,
        type: 'SceneNeedsLocation',
        domain: 'SCENE',
        severity: 'IMPORTANT',
        phase: 'DRAFT',
        group_key: `SCENE:QUALITY:${scene.id}`,
        target_node_id: scene.id,
        message: `Scene "${scene.heading}" has no location assigned`,
      });
    }
  }
  
  return questions;
}

function deriveCharacterQuestions(graph: GraphState, phase: OQPhase): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const characters = getNodesByType<Character>(graph, 'Character');
  const scenes = getNodesByType<Scene>(graph, 'Scene');
  
  for (const char of characters) {
    // Count scene appearances
    const appearances = graph.edges.filter(
      e => e.type === 'HAS_CHARACTER' && e.to === char.id
    ).length;
    
    // CharacterUnderspecified
    if (!char.description && appearances >= 2) {
      questions.push({
        id: `oq_char_desc_${char.id}`,
        type: 'CharacterUnderspecified',
        domain: 'CHARACTER',
        severity: 'SOFT',
        phase: 'OUTLINE',
        group_key: `CHARACTER:DETAIL:${char.id}`,
        target_node_id: char.id,
        message: `Character "${char.name}" appears in ${appearances} scenes but has no description`,
      });
    }
    
    // MissingCharacterArc
    if (phase === 'DRAFT' || phase === 'REVISION') {
      const hasArc = graph.edges.some(
        e => e.type === 'HAS_ARC' && e.from === char.id
      );
      if (!hasArc && appearances >= 3) {
        questions.push({
          id: `oq_char_arc_${char.id}`,
          type: 'MissingCharacterArc',
          domain: 'CHARACTER',
          severity: 'IMPORTANT',
          phase: 'DRAFT',
          group_key: `CHARACTER:ARC:${char.id}`,
          target_node_id: char.id,
          message: `Character "${char.name}" appears in ${appearances} scenes but has no arc defined`,
        });
      }
    }
  }
  
  return questions;
}

function deriveConflictQuestions(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const conflicts = getNodesByType<Conflict>(graph, 'Conflict');
  
  for (const conflict of conflicts) {
    // ConflictNeedsParties
    const involvesEdges = graph.edges.filter(
      e => e.type === 'INVOLVES' && e.from === conflict.id
    );
    if (involvesEdges.length === 0) {
      questions.push({
        id: `oq_conf_parties_${conflict.id}`,
        type: 'ConflictNeedsParties',
        domain: 'CONFLICT',
        severity: 'IMPORTANT',
        phase: 'DRAFT',
        group_key: `CONFLICT:SETUP:${conflict.id}`,
        target_node_id: conflict.id,
        message: `Conflict "${conflict.name}" has no characters involved`,
      });
    }
    
    // ConflictNeedsManifestation
    const manifestsEdges = graph.edges.filter(
      e => e.type === 'MANIFESTS_IN' && e.from === conflict.id
    );
    if (manifestsEdges.length === 0) {
      questions.push({
        id: `oq_conf_manifest_${conflict.id}`,
        type: 'ConflictNeedsManifestation',
        domain: 'CONFLICT',
        severity: 'IMPORTANT',
        phase: 'DRAFT',
        group_key: `CONFLICT:SHOW:${conflict.id}`,
        target_node_id: conflict.id,
        message: `Conflict "${conflict.name}" doesn't manifest in any scene`,
      });
    }
  }
  
  return questions;
}

function deriveThemeMotifQuestions(graph: GraphState): OpenQuestion[] {
  const questions: OpenQuestion[] = [];

  // ThemeUngrounded - status field removed, now determined by edge presence
  const themes = getNodesByType<Theme>(graph, 'Theme');
  for (const theme of themes) {
    const expressedEdges = graph.edges.filter(
      e => e.type === 'EXPRESSED_IN' && e.from === theme.id
    );
    if (expressedEdges.length === 0) {
      questions.push({
        id: `oq_theme_${theme.id}`,
        type: 'ThemeUngrounded',
        domain: 'THEME_MOTIF',
        severity: 'SOFT',
        phase: 'REVISION',
        group_key: `THEME:GROUND:${theme.id}`,
        target_node_id: theme.id,
        message: `Theme "${theme.statement}" is not expressed in any scene`,
      });
    }
  }

  // MotifUngrounded - status field removed, now determined by edge presence
  const motifs = getNodesByType<Motif>(graph, 'Motif');
  for (const motif of motifs) {
    const appearsEdges = graph.edges.filter(
      e => e.type === 'APPEARS_IN' && e.from === motif.id
    );
    if (appearsEdges.length === 0) {
      questions.push({
        id: `oq_motif_${motif.id}`,
        type: 'MotifUngrounded',
        domain: 'THEME_MOTIF',
        severity: 'SOFT',
        phase: 'REVISION',
        group_key: `MOTIF:GROUND:${motif.id}`,
        target_node_id: motif.id,
        message: `Motif "${motif.name}" doesn't appear in any scene`,
      });
    }
  }

  return questions;
}
```

### 3.5 `src/core/computeOrder.ts` — Auto-computed Ordering

This module computes `order_index` for PlotPoints and Scenes based on their edge relationships.

```typescript
import { GraphState, getNodesByType, getNode } from './graph';
import { Beat, PlotPoint, Scene } from '../types/nodes';
import { Edge } from '../types/edges';
import { UpdateNodeOp } from '../types/patch';

export interface ComputeOrderResult {
  plotPointOrders: Map<string, number | undefined>;
  sceneOrders: Map<string, number | undefined>;
  ops: UpdateNodeOp[]; // Patches to apply for changed orders
}

/**
 * Computes order_index for PlotPoints and Scenes based on edge relationships:
 * - PlotPoints get order from ALIGNS_WITH edges to Beats (Beat.position_index)
 * - Scenes get order from SATISFIED_BY edges to PlotPoints
 * - Unattached items have order_index = undefined
 */
export function computeOrder(graph: GraphState): ComputeOrderResult {
  const plotPointOrders = new Map<string, number | undefined>();
  const sceneOrders = new Map<string, number | undefined>();
  const ops: UpdateNodeOp[] = [];

  // Get beats sorted by position_index
  const beats = getNodesByType<Beat>(graph, 'Beat')
    .sort((a, b) => a.position_index - b.position_index);

  // Get all ALIGNS_WITH edges (PlotPoint → Beat)
  const alignsWithEdges = graph.edges.filter(e => e.type === 'ALIGNS_WITH');

  // Get all SATISFIED_BY edges (PlotPoint → Scene)
  const satisfiedByEdges = graph.edges.filter(e => e.type === 'SATISFIED_BY');

  let ppOrderCounter = 0;
  let sceneOrderCounter = 0;

  // Process each beat in order
  for (const beat of beats) {
    // Get PlotPoints aligned to this beat
    const ppEdges = alignsWithEdges.filter(e => e.to === beat.id);

    // Sort by edge createdAt, then by PlotPoint ID for tie-breaking
    const sortedPPEdges = ppEdges.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }
      return a.from.localeCompare(b.from);
    });

    for (const ppEdge of sortedPPEdges) {
      ppOrderCounter++;
      const ppId = ppEdge.from;
      plotPointOrders.set(ppId, ppOrderCounter);

      // Get scenes attached to this PlotPoint
      const sceneEdges = satisfiedByEdges.filter(e => e.from === ppId);

      // Sort scenes by edge createdAt, then by Scene ID
      const sortedSceneEdges = sceneEdges.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return a.createdAt.localeCompare(b.createdAt);
        }
        return a.to.localeCompare(b.to);
      });

      for (const sceneEdge of sortedSceneEdges) {
        sceneOrderCounter++;
        sceneOrders.set(sceneEdge.to, sceneOrderCounter);
      }
    }
  }

  // Set undefined for unattached PlotPoints
  for (const pp of getNodesByType<PlotPoint>(graph, 'PlotPoint')) {
    if (!plotPointOrders.has(pp.id)) {
      plotPointOrders.set(pp.id, undefined);
    }
    // Generate update op if order changed
    const newOrder = plotPointOrders.get(pp.id);
    if (pp.order_index !== newOrder) {
      ops.push({
        op: 'UPDATE_NODE',
        id: pp.id,
        set: newOrder !== undefined ? { order_index: newOrder } : {},
        unset: newOrder === undefined ? ['order_index'] : [],
      });
    }
  }

  // Set undefined for unattached Scenes
  for (const scene of getNodesByType<Scene>(graph, 'Scene')) {
    if (!sceneOrders.has(scene.id)) {
      sceneOrders.set(scene.id, undefined);
    }
    // Generate update op if order changed
    const newOrder = sceneOrders.get(scene.id);
    if (scene.order_index !== newOrder) {
      ops.push({
        op: 'UPDATE_NODE',
        id: scene.id,
        set: newOrder !== undefined ? { order_index: newOrder } : {},
        unset: newOrder === undefined ? ['order_index'] : [],
      });
    }
  }

  return { plotPointOrders, sceneOrders, ops };
}

/**
 * Applies computed order updates to the graph
 */
export function applyOrderUpdates(
  graph: GraphState,
  result: ComputeOrderResult
): GraphState {
  // Apply each update op to the graph
  for (const op of result.ops) {
    const node = graph.nodes.get(op.id);
    if (node) {
      const updated = { ...node, ...op.set };
      if (op.unset) {
        for (const field of op.unset) {
          delete (updated as Record<string, unknown>)[field];
        }
      }
      graph.nodes.set(op.id, updated);
    }
  }
  return graph;
}
```

**Usage in API handlers:**

When ALIGNS_WITH or SATISFIED_BY edges are added, updated, or deleted, call `computeOrder()` and apply the resulting updates:

```typescript
// In edges.ts or bulkAttach.ts handlers:
import { computeOrder, applyOrderUpdates } from '@apollo/core';

// After edge changes:
const orderResult = computeOrder(graph);
if (orderResult.ops.length > 0) {
  graph = applyOrderUpdates(graph, orderResult);
}
```

---

## Phase 4: Stubs for MVP Testing

### 4.1 `src/stubs/extractorStub.ts`
```typescript
import { Patch } from '../types/patch';
import { Beat, Scene, Character, Conflict, Location } from '../types/nodes';

/**
 * Stub extractor that parses a logline into a minimal Patch.
 * In production, this would be an LLM call.
 */
export function extractFromLogline(logline: string, baseVersionId: string): Patch {
  const timestamp = new Date().toISOString();
  
  return {
    type: 'Patch',
    id: `patch_${Date.now()}`,
    base_story_version_id: baseVersionId,
    created_at: timestamp,
    ops: [
      // Add protagonist
      {
        op: 'ADD_NODE',
        node: {
          type: 'Character',
          id: 'char_protagonist',
          name: 'PROTAGONIST',
          description: 'Extracted from logline',
          status: 'ACTIVE',
        } as Character,
      },
      // Add central conflict
      {
        op: 'ADD_NODE',
        node: {
          type: 'Conflict',
          id: 'conf_central',
          name: 'Central Conflict',
          conflict_type: 'societal',
          description: logline,
          status: 'ACTIVE',
        } as Conflict,
      },
      // Add primary location
      {
        op: 'ADD_NODE',
        node: {
          type: 'Location',
          id: 'loc_primary',
          name: 'PRIMARY LOCATION',
          description: 'Extracted from logline',
        } as Location,
      },
      // Link conflict to protagonist
      {
        op: 'ADD_EDGE',
        edge: { type: 'INVOLVES', from: 'conf_central', to: 'char_protagonist' },
      },
    ],
  };
}
```

### 4.2 `