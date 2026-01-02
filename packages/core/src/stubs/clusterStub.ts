/**
 * Stub cluster generator that creates MoveCluster proposals from OpenQuestions.
 * In production, this would be an LLM call.
 *
 * This stub provides deterministic cluster generation for testing purposes.
 */

import type { Patch, PatchOp } from '../types/patch.js';
import type {
  MoveCluster,
  NarrativeMove,
  Scene,
  ScopeBudget,
  ClusterType,
} from '../types/nodes.js';
import type { OpenQuestion, OQPhase } from '../types/openQuestion.js';

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

function getMoveVariants(oq: OpenQuestion): MoveVariant[] {
  // For BeatUnrealized, generate scene options
  if (oq.type === 'BeatUnrealized' && oq.target_node_id) {
    const beatId = oq.target_node_id;
    const beatType = beatId.replace('beat_', '');

    return [
      {
        title: `${beatType}: Dramatic confrontation`,
        rationale: 'A high-tension scene that delivers the beat through conflict.',
        style: 'dramatic',
        tags: ['dramatic', 'confrontation', 'high-stakes'],
        ops: [
          {
            op: 'ADD_NODE',
            node: {
              type: 'Scene',
              id: `scene_${beatType}_dramatic`,
              heading: `INT. LOCATION - ${beatType.toUpperCase()} - DAY`,
              scene_overview: `A dramatic confrontation unfolds as the protagonist faces a crucial moment in the ${beatType} beat. Stakes are raised and decisions must be made.`,
              beat_id: beatId,
              order_index: 1,
              scene_tags: ['ESCALATION', 'DECISION'],
              status: 'DRAFT',
              source_provenance: 'AI',
            } as Scene,
          },
        ],
      },
      {
        title: `${beatType}: Quiet revelation`,
        rationale: 'A contemplative scene that delivers the beat through internal discovery.',
        style: 'quiet',
        tags: ['quiet', 'revelation', 'internal'],
        ops: [
          {
            op: 'ADD_NODE',
            node: {
              type: 'Scene',
              id: `scene_${beatType}_quiet`,
              heading: `INT. LOCATION - ${beatType.toUpperCase()} - NIGHT`,
              scene_overview: `In a quiet moment of reflection, the protagonist experiences a revelation that fulfills the ${beatType} beat. The scene builds through subtext and small gestures.`,
              beat_id: beatId,
              order_index: 1,
              scene_tags: ['REVEAL'],
              status: 'DRAFT',
              source_provenance: 'AI',
            } as Scene,
          },
        ],
      },
      {
        title: `${beatType}: Action sequence`,
        rationale: 'A kinetic scene that delivers the beat through physical action.',
        style: 'action',
        tags: ['action', 'kinetic', 'physical'],
        ops: [
          {
            op: 'ADD_NODE',
            node: {
              type: 'Scene',
              id: `scene_${beatType}_action`,
              heading: `EXT. LOCATION - ${beatType.toUpperCase()} - DAY`,
              scene_overview: `An action-packed sequence propels the story forward through the ${beatType} beat. Physical stakes mirror emotional ones as the protagonist is pushed to their limits.`,
              beat_id: beatId,
              order_index: 1,
              scene_tags: ['ESCALATION', 'TURNING_POINT'],
              status: 'DRAFT',
              source_provenance: 'AI',
            } as Scene,
          },
        ],
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
      confidence: 0.5 + random() * 0.4, // Use seeded random for confidence
      status: 'PROPOSED',
    };

    moves.push({ move, patch });
  }

  return moves;
}
