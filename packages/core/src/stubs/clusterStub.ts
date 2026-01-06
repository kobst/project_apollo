/**
 * Stub cluster generator that creates MoveCluster proposals from Gaps.
 * In production, this would be an LLM call.
 *
 * This stub provides deterministic cluster generation for testing purposes.
 *
 * Supports both the new unified Gap model and the legacy OpenQuestion model
 * for backwards compatibility.
 */

import type { Patch, PatchOp } from '../types/patch.js';
import type {
  MoveCluster,
  NarrativeMove,
  Scene,
  PlotPoint,
  ScopeBudget,
  ClusterType,
} from '../types/nodes.js';
import type { OpenQuestion, OQPhase } from '../types/openQuestion.js';
import type { Edge } from '../types/edges.js';
import type { Gap, GapPhase } from '../coverage/types.js';

// =============================================================================
// Cluster Generation
// =============================================================================

/**
 * Generate MoveClusters from OpenQuestions.
 *
 * @param openQuestions - Array of OpenQuestions to address
 * @param baseVersionId - The base story version ID
 * @param phase - Current phase (affects scope budgets)
 * @returns Array of MoveClusters with NarrativeMoves
 */
export function generateClusters(
  openQuestions: OpenQuestion[],
  baseVersionId: string,
  phase: OQPhase = 'OUTLINE'
): ClusterResult[] {
  const timestamp = new Date().toISOString();
  const results: ClusterResult[] = [];

  // Group questions by group_key
  const grouped = groupByKey(openQuestions);

  // Generate clusters for each group (limit to 4 per spec)
  let clusterCount = 0;
  for (const [_groupKey, questions] of grouped.entries()) {
    if (clusterCount >= 4) break;

    const primaryOQ = questions[0];
    if (!primaryOQ) continue;

    const cluster = generateClusterForOQ(
      primaryOQ,
      questions.slice(1),
      baseVersionId,
      timestamp,
      phase
    );

    results.push(cluster);
    clusterCount++;
  }

  return results;
}

/**
 * Result of cluster generation, includes cluster and its moves.
 */
export interface ClusterResult {
  cluster: MoveCluster;
  moves: NarrativeMoveWithPatch[];
}

/**
 * NarrativeMove with its associated Patch.
 */
export interface NarrativeMoveWithPatch {
  move: NarrativeMove;
  patch: Patch;
}

// =============================================================================
// Internal Helpers
// =============================================================================

function groupByKey(questions: OpenQuestion[]): Map<string, OpenQuestion[]> {
  const groups = new Map<string, OpenQuestion[]>();
  for (const q of questions) {
    const existing = groups.get(q.group_key);
    if (existing) {
      existing.push(q);
    } else {
      groups.set(q.group_key, [q]);
    }
  }
  return groups;
}

function generateClusterForOQ(
  primaryOQ: OpenQuestion,
  supportingOQs: OpenQuestion[],
  baseVersionId: string,
  timestamp: string,
  phase: OQPhase
): ClusterResult {
  const clusterId = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const clusterType = mapDomainToClusterType(primaryOQ.domain, primaryOQ.type);
  const scopeBudget = getScopeBudget(clusterType, phase);

  const cluster: MoveCluster = {
    type: 'MoveCluster',
    id: clusterId,
    base_story_version_id: baseVersionId,
    created_at: timestamp,
    title: generateClusterTitle(primaryOQ),
    description: `Addresses: ${primaryOQ.message}`,
    cluster_type: clusterType,
    primary_open_question_id: primaryOQ.id,
    supporting_open_question_ids: supportingOQs.map((q) => q.id),
    scope_budget: scopeBudget,
    status: 'PROPOSED',
  };

  // Generate 3-5 diverse moves for this cluster
  const moves = generateMovesForCluster(
    cluster,
    primaryOQ,
    baseVersionId,
    timestamp
  );

  return { cluster, moves };
}

function mapDomainToClusterType(
  domain: OpenQuestion['domain'],
  oqType: OpenQuestion['type']
): ClusterType {
  switch (domain) {
    case 'STRUCTURE':
      return 'STRUCTURE';
    case 'SCENE':
      if (oqType === 'SceneHasNoCast' || oqType === 'SceneNeedsLocation') {
        return 'SCENE_QUALITY';
      }
      return 'SCENE_LIST';
    case 'CHARACTER':
      return 'CHARACTER';
    case 'CONFLICT':
      return 'CONFLICT';
    case 'THEME_MOTIF':
      return oqType === 'ThemeUngrounded' ? 'THEME' : 'MOTIF';
    default:
      return 'STRUCTURE';
  }
}

function getScopeBudget(clusterType: ClusterType, _phase: OQPhase): ScopeBudget {
  const budgets: Record<ClusterType, ScopeBudget> = {
    STRUCTURE: {
      max_ops_per_move: 6,
      max_new_nodes_per_move: 2,
      allowed_node_types: ['Scene', 'Beat'],
      allowed_depth: 'OUTLINE',
    },
    SCENE_LIST: {
      max_ops_per_move: 5,
      max_new_nodes_per_move: 1,
      allowed_node_types: ['Scene'],
      allowed_depth: 'OUTLINE',
    },
    SCENE_QUALITY: {
      max_ops_per_move: 4,
      max_new_nodes_per_move: 0,
      allowed_node_types: ['Scene'],
      allowed_depth: 'DRAFT',
    },
    CONFLICT: {
      max_ops_per_move: 6,
      max_new_nodes_per_move: 2,
      allowed_node_types: ['Conflict', 'Scene'],
      allowed_depth: 'DRAFT',
    },
    CHARACTER: {
      max_ops_per_move: 6,
      max_new_nodes_per_move: 1,
      allowed_node_types: ['CharacterArc'],
      allowed_depth: 'DRAFT',
    },
    THEME: {
      max_ops_per_move: 4,
      max_new_nodes_per_move: 0,
      allowed_node_types: ['Scene', 'Beat'],
      allowed_depth: 'REVISION',
    },
    MOTIF: {
      max_ops_per_move: 4,
      max_new_nodes_per_move: 0,
      allowed_node_types: ['Scene', 'Beat'],
      allowed_depth: 'REVISION',
    },
  };

  return budgets[clusterType];
}

function generateClusterTitle(oq: OpenQuestion): string {
  switch (oq.type) {
    case 'BeatUnrealized':
      return `Realize beat: ${oq.target_node_id?.replace('beat_', '') ?? 'Unknown'}`;
    case 'ActImbalance':
      return `Balance act structure`;
    case 'SceneHasNoCast':
      return `Add characters to scene`;
    case 'SceneNeedsLocation':
      return `Assign location to scene`;
    case 'MissingCharacterArc':
      return `Define character arc`;
    case 'ConflictNeedsParties':
      return `Assign conflict participants`;
    case 'ConflictNeedsManifestation':
      return `Show conflict in scenes`;
    case 'ThemeUngrounded':
      return `Ground theme in scenes`;
    case 'MotifUngrounded':
      return `Manifest motif in scenes`;
    default:
      return `Address: ${oq.type}`;
  }
}

function generateMovesForCluster(
  cluster: MoveCluster,
  primaryOQ: OpenQuestion,
  baseVersionId: string,
  timestamp: string
): NarrativeMoveWithPatch[] {
  const moves: NarrativeMoveWithPatch[] = [];

  // Generate 3 diverse moves based on OQ type
  const moveVariants = getMoveVariants(primaryOQ);

  for (let i = 0; i < moveVariants.length && i < 5; i++) {
    const variant = moveVariants[i];
    if (!variant) continue;

    const moveId = `mv_${Date.now()}_${i}`;
    const patchId = `patch_${Date.now()}_${i}`;

    const patch: Patch = {
      type: 'Patch',
      id: patchId,
      base_story_version_id: baseVersionId,
      created_at: timestamp,
      ops: variant.ops,
      metadata: {
        source: 'clusterStub',
        moveVariant: variant.style,
      },
    };

    const move: NarrativeMove = {
      type: 'NarrativeMove',
      id: moveId,
      cluster_id: cluster.id,
      patch_id: patchId,
      title: variant.title,
      rationale: variant.rationale,
      created_at: timestamp,
      expected_effects: [`Resolves ${primaryOQ.type}`],
      move_style_tags: variant.tags,
      resolves_open_question_ids: [primaryOQ.id],
      introduces_open_question_ids: [],
      confidence: 0.6 + Math.random() * 0.3, // 0.6-0.9
      status: 'PROPOSED',
    };

    moves.push({ move, patch });
  }

  return moves;
}

interface MoveVariant {
  title: string;
  rationale: string;
  style: string;
  tags: string[];
  ops: PatchOp[];
}

/**
 * Create ops to attach a scene to a beat through the PlotPoint hierarchy.
 * Creates: PlotPoint, ALIGNS_WITH edge, Scene, SATISFIED_BY edge
 */
function createSceneWithPlotPoint(
  beatId: string,
  sceneId: string,
  plotPointId: string,
  plotPointTitle: string,
  scene: Omit<Scene, 'type' | 'id'>
): PatchOp[] {
  const timestamp = new Date().toISOString();

  const plotPoint: PlotPoint = {
    type: 'PlotPoint',
    id: plotPointId,
    title: plotPointTitle,
    intent: 'plot',
    status: 'proposed',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const sceneNode: Scene = {
    type: 'Scene',
    id: sceneId,
    ...scene,
  };

  const alignsWithEdge: Edge = {
    id: `edge_${plotPointId}_aligns`,
    type: 'ALIGNS_WITH',
    from: plotPointId,
    to: beatId,
    status: 'approved',
    createdAt: timestamp,
  };

  const satisfiedByEdge: Edge = {
    id: `edge_${plotPointId}_satisfied`,
    type: 'SATISFIED_BY',
    from: plotPointId,
    to: sceneId,
    status: 'approved',
    createdAt: timestamp,
    properties: { order: 1 },
  };

  return [
    { op: 'ADD_NODE', node: plotPoint },
    { op: 'ADD_EDGE', edge: alignsWithEdge },
    { op: 'ADD_NODE', node: sceneNode },
    { op: 'ADD_EDGE', edge: satisfiedByEdge },
  ];
}

function getMoveVariants(oq: OpenQuestion): MoveVariant[] {
  // For BeatUnrealized, generate scene options with PlotPoint hierarchy
  if (oq.type === 'BeatUnrealized' && oq.target_node_id) {
    const beatId = oq.target_node_id;
    const beatType = beatId.replace('beat_', '');

    return [
      {
        title: `${beatType}: Dramatic confrontation`,
        rationale: 'A high-tension scene that delivers the beat through conflict.',
        style: 'dramatic',
        tags: ['dramatic', 'confrontation', 'high-stakes'],
        ops: createSceneWithPlotPoint(
          beatId,
          `scene_${beatType}_dramatic`,
          `pp_${beatType}_dramatic`,
          `${beatType} - Dramatic Confrontation`,
          {
            heading: `INT. LOCATION - ${beatType.toUpperCase()} - DAY`,
            scene_overview: `A dramatic confrontation unfolds as the protagonist faces a crucial moment in the ${beatType} beat. Stakes are raised and decisions must be made.`,
            scene_tags: ['ESCALATION', 'DECISION'],
            status: 'DRAFT',
            source_provenance: 'AI',
          }
        ),
      },
      {
        title: `${beatType}: Quiet revelation`,
        rationale: 'A contemplative scene that delivers the beat through internal discovery.',
        style: 'quiet',
        tags: ['quiet', 'revelation', 'internal'],
        ops: createSceneWithPlotPoint(
          beatId,
          `scene_${beatType}_quiet`,
          `pp_${beatType}_quiet`,
          `${beatType} - Quiet Revelation`,
          {
            heading: `INT. LOCATION - ${beatType.toUpperCase()} - NIGHT`,
            scene_overview: `In a quiet moment of reflection, the protagonist experiences a revelation that fulfills the ${beatType} beat. The scene builds through subtext and small gestures.`,
            scene_tags: ['REVEAL'],
            status: 'DRAFT',
            source_provenance: 'AI',
          }
        ),
      },
      {
        title: `${beatType}: Action sequence`,
        rationale: 'A kinetic scene that delivers the beat through physical action.',
        style: 'action',
        tags: ['action', 'kinetic', 'physical'],
        ops: createSceneWithPlotPoint(
          beatId,
          `scene_${beatType}_action`,
          `pp_${beatType}_action`,
          `${beatType} - Action Sequence`,
          {
            heading: `EXT. LOCATION - ${beatType.toUpperCase()} - DAY`,
            scene_overview: `An action-packed sequence propels the story forward through the ${beatType} beat. Physical stakes mirror emotional ones as the protagonist is pushed to their limits.`,
            scene_tags: ['ESCALATION', 'TURNING_POINT'],
            status: 'DRAFT',
            source_provenance: 'AI',
          }
        ),
      },
    ];
  }

  // Default: generic move variants
  return [
    {
      title: 'Direct resolution',
      rationale: 'Addresses the issue directly with minimal changes.',
      style: 'direct',
      tags: ['direct', 'minimal'],
      ops: [],
    },
    {
      title: 'Expanded approach',
      rationale: 'Takes a broader approach with additional context.',
      style: 'expanded',
      tags: ['expanded', 'contextual'],
      ops: [],
    },
    {
      title: 'Alternative path',
      rationale: 'Explores an alternative solution to the issue.',
      style: 'alternative',
      tags: ['alternative', 'creative'],
      ops: [],
    },
  ];
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Options for cluster generation.
 */
export interface ClusterGenerationOptions {
  /** Number of moves to generate (default: 4, max: 12) */
  count?: number;
  /** Seed for deterministic generation (for reproducibility) */
  seed?: number;
}

/**
 * Simple seeded random number generator.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Generate a single MoveCluster for a specific OpenQuestion.
 */
export function generateClusterForQuestion(
  oq: OpenQuestion,
  baseVersionId: string,
  phase: OQPhase = 'OUTLINE',
  options: ClusterGenerationOptions = {}
): ClusterResult {
  const timestamp = new Date().toISOString();
  const count = Math.min(Math.max(options.count ?? 4, 1), 12);
  const seed = options.seed ?? Date.now();

  // Use seeded random for reproducibility
  const random = seededRandom(seed);

  const clusterId = `mc_${seed}_${Math.floor(random() * 100000).toString(36)}`;
  const clusterType = mapDomainToClusterType(oq.domain, oq.type);
  const scopeBudget = getScopeBudget(clusterType, phase);

  const cluster: MoveCluster = {
    type: 'MoveCluster',
    id: clusterId,
    base_story_version_id: baseVersionId,
    created_at: timestamp,
    title: generateClusterTitle(oq),
    description: `Addresses: ${oq.message}`,
    cluster_type: clusterType,
    primary_open_question_id: oq.id,
    supporting_open_question_ids: [],
    scope_budget: scopeBudget,
    status: 'PROPOSED',
  };

  // Generate moves with the seeded random
  const moves = generateMovesForClusterWithSeed(
    cluster,
    oq,
    baseVersionId,
    timestamp,
    count,
    random
  );

  return { cluster, moves };
}

/**
 * Generate moves for a cluster with a seeded random generator.
 */
function generateMovesForClusterWithSeed(
  cluster: MoveCluster,
  primaryOQ: OpenQuestion,
  baseVersionId: string,
  timestamp: string,
  count: number,
  random: () => number
): NarrativeMoveWithPatch[] {
  const moves: NarrativeMoveWithPatch[] = [];
  const baseVariants = getMoveVariants(primaryOQ);

  // Generate up to count moves, cycling through variants if needed
  for (let i = 0; i < count; i++) {
    const variant = baseVariants[i % baseVariants.length];
    if (!variant) continue;

    // Add variation to make each move unique when count > base variants
    const variationSuffix = i >= baseVariants.length ? `_v${Math.floor(i / baseVariants.length) + 1}` : '';

    const moveId = `mv_${cluster.id.replace('mc_', '')}_${i}`;
    const patchId = `patch_${cluster.id.replace('mc_', '')}_${i}`;

    // Create patch with variation
    const patch: Patch = {
      type: 'Patch',
      id: patchId,
      base_story_version_id: baseVersionId,
      created_at: timestamp,
      ops: variant.ops.map((op) => {
        if (op.op === 'ADD_NODE' && 'node' in op) {
          const node = { ...op.node };
          if ('id' in node) {
            node.id = `${node.id}${variationSuffix}`;
          }
          return { ...op, node };
        }
        return op;
      }),
      metadata: {
        source: 'clusterStub',
        moveVariant: variant.style,
        variationIndex: i,
      },
    };

    const move: NarrativeMove = {
      type: 'NarrativeMove',
      id: moveId,
      cluster_id: cluster.id,
      patch_id: patchId,
      title: variationSuffix ? `${variant.title} (Alt ${Math.floor(i / baseVariants.length) + 1})` : variant.title,
      rationale: variant.rationale,
      created_at: timestamp,
      expected_effects: [`Resolves ${primaryOQ.type}`],
      move_style_tags: variant.tags,
      resolves_open_question_ids: [primaryOQ.id],
      introduces_open_question_ids: [],
      confidence: 0.6 + random() * 0.3, // Use seeded random for confidence (0.6-0.9 range)
      status: 'PROPOSED',
    };

    moves.push({ move, patch });
  }

  return moves;
}

// =============================================================================
// Gap-based Cluster Generation (Unified Model)
// =============================================================================

/**
 * Convert a Gap to an OpenQuestion for internal processing.
 * This bridges the new unified Gap model with existing cluster generation logic.
 */
function gapToOpenQuestion(gap: Gap): OpenQuestion {
  // Extract OQ type from gap ID (gap IDs follow pattern: gap_beat_xxx, gap_scene_cast_xxx, etc.)
  const oqType = extractOQTypeFromGap(gap);
  const targetNodeId = gap.scopeRefs.nodeIds?.[0];

  const oq: OpenQuestion = {
    id: gap.id,
    type: oqType,
    domain: gap.domain ?? 'STRUCTURE',
    severity: mapGapSeverityToOQ(gap.severity),
    phase: gap.phase ?? 'OUTLINE',
    group_key: gap.groupKey ?? `${gap.domain ?? 'STRUCTURE'}:${gap.tier}:${gap.id}`,
    message: gap.description,
  };

  // Only include target_node_id if defined
  if (targetNodeId !== undefined) {
    oq.target_node_id = targetNodeId;
  }

  return oq;
}

/**
 * Extract OpenQuestion type from Gap ID pattern.
 */
function extractOQTypeFromGap(gap: Gap): OpenQuestion['type'] {
  const id = gap.id;

  if (id.includes('beat_')) return 'BeatUnrealized';
  if (id.includes('act_')) return 'ActImbalance';
  if (id.includes('scene_cast_')) return 'SceneHasNoCast';
  if (id.includes('scene_loc_')) return 'SceneNeedsLocation';
  if (id.includes('char_desc_')) return 'CharacterUnderspecified';
  if (id.includes('char_arc_')) return 'MissingCharacterArc';
  if (id.includes('arc_ungrounded_')) return 'ArcUngrounded';
  if (id.includes('conf_parties_')) return 'ConflictNeedsParties';
  if (id.includes('conf_manifest_')) return 'ConflictNeedsManifestation';
  if (id.includes('theme_')) return 'ThemeUngrounded';
  if (id.includes('motif_')) return 'MotifUngrounded';

  // Default based on domain
  switch (gap.domain) {
    case 'STRUCTURE':
      return 'BeatUnrealized';
    case 'SCENE':
      return 'SceneHasNoCast';
    case 'CHARACTER':
      return 'CharacterUnderspecified';
    case 'CONFLICT':
      return 'ConflictNeedsParties';
    case 'THEME_MOTIF':
      return 'ThemeUngrounded';
    default:
      return 'BeatUnrealized';
  }
}

/**
 * Map Gap severity to OQ severity.
 */
function mapGapSeverityToOQ(severity: Gap['severity']): OpenQuestion['severity'] {
  switch (severity) {
    case 'blocker':
      return 'BLOCKING';
    case 'warn':
      return 'IMPORTANT';
    case 'info':
      return 'SOFT';
    default:
      return 'IMPORTANT';
  }
}

/**
 * Generate a MoveCluster for a unified Gap.
 *
 * This is the preferred entry point for cluster generation with the new
 * unified Gap model. For narrative gaps, it generates creative suggestions.
 * For structural gaps, it generates patch-based fixes.
 */
export function generateClusterForGap(
  gap: Gap,
  baseVersionId: string,
  phase: GapPhase = 'OUTLINE',
  options: ClusterGenerationOptions = {}
): ClusterResult {
  // Convert Gap to OpenQuestion for internal processing
  const oq = gapToOpenQuestion(gap);

  // Use the existing OQ-based generation (maintains all the variant logic)
  return generateClusterForQuestion(oq, baseVersionId, phase as OQPhase, options);
}

/**
 * Generate MoveClusters from an array of Gaps.
 *
 * Groups gaps by groupKey and generates clusters for each group.
 */
export function generateClustersForGaps(
  gaps: Gap[],
  baseVersionId: string,
  phase: GapPhase = 'OUTLINE'
): ClusterResult[] {
  // Filter to narrative gaps (structural gaps don't need cluster generation)
  const narrativeGaps = gaps.filter((g) => g.type === 'narrative');

  // Convert to OQs and use existing cluster generation
  const oqs = narrativeGaps.map(gapToOpenQuestion);
  return generateClusters(oqs, baseVersionId, phase as OQPhase);
}
