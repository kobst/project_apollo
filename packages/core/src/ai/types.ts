/**
 * AI-specific type definitions for the prompt engineering layer.
 *
 * These types define the interfaces for:
 * - Interpretation phase (freeform input → structured proposals)
 * - Generation phase (entry point → N packages)
 * - Refinement phase (base package + constraints → variations)
 */

// =============================================================================
// Interpretation Phase Types
// =============================================================================

/**
 * Result from the interpretation phase.
 * Transforms freeform user input into structured proposals.
 */
export interface InterpretationResult {
  interpretation: {
    /** What the AI understood from the input */
    summary: string;
    /** Confidence score (0.0 - 1.0) */
    confidence: number;
  };
  /** Proposed changes based on the interpretation */
  proposals: InterpretationProposal[];
  /** Alternative interpretations that were considered */
  alternatives?: {
    summary: string;
    confidence: number;
  }[];
}

/**
 * A single proposal from the interpretation phase.
 */
export interface InterpretationProposal {
  /** Type of change being proposed */
  type: 'node' | 'storyContext' | 'edge';
  /** Operation to perform */
  operation: 'add' | 'modify';
  /** Node type if type is 'node' */
  target_type?: string;
  /** Data for the proposed change */
  data: Record<string, unknown>;
  /** Explanation of why this interpretation was chosen */
  rationale: string;
  /** Existing node IDs this proposal relates to */
  relates_to?: string[];
}

// =============================================================================
// Generation Phase Types
// =============================================================================

/**
 * Result from the generation phase.
 * Contains N complete narrative packages.
 */
export interface GenerationResult {
  packages: NarrativePackage[];
}

/**
 * A complete, self-contained set of proposed changes.
 * Ready to be applied to the story graph.
 */
export interface NarrativePackage {
  /** Unique identifier for this package */
  id: string;
  /** Short descriptive title */
  title: string;
  /** Explanation of why this package makes sense */
  rationale: string;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;

  // Refinement lineage
  /** Parent package ID if this is a refinement */
  parent_package_id?: string;
  /** User guidance that produced this refinement */
  refinement_prompt?: string;

  /** Style/thematic tags for categorization */
  style_tags: string[];

  /** All changes included in this package */
  changes: {
    /** Story Context modifications */
    storyContext?: StoryContextChange[];
    /** Node additions/modifications/deletions */
    nodes: NodeChange[];
    /** Edge additions/deletions */
    edges: EdgeChange[];
  };

  /** Pre-computed impact analysis */
  impact: {
    /** Gap IDs that would be resolved */
    fulfills_gaps: string[];
    /** New gaps that would be created */
    creates_gaps: string[];
    /** Conflicts with existing content */
    conflicts: ConflictInfo[];
  };
}

/**
 * A change to a node in the story graph.
 */
export interface NodeChange {
  /** Type of operation */
  operation: 'add' | 'modify' | 'delete';
  /** Node type (e.g., 'Character', 'Scene') */
  node_type: string;
  /** Node ID (generated for add, existing for modify/delete) */
  node_id: string;
  /** Node data for add/modify operations */
  data?: Record<string, unknown>;
  /** Previous data for modify operations (shows what changed) */
  previous_data?: Record<string, unknown>;
}

/**
 * A change to an edge in the story graph.
 */
export interface EdgeChange {
  /** Type of operation */
  operation: 'add' | 'delete';
  /** Edge type (e.g., 'HAS_CHARACTER', 'LOCATED_AT') */
  edge_type: string;
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Human-readable name of source node (resolved from graph) */
  from_name?: string;
  /** Human-readable name of target node (resolved from graph) */
  to_name?: string;
  /** Optional edge properties */
  properties?: Record<string, unknown>;
}

/**
 * A change to the Story Context markdown.
 */
export interface StoryContextChange {
  /** Type of operation */
  operation: 'add' | 'modify' | 'delete';
  /** Section name (e.g., 'Thematic Concerns', 'Central Conflicts') */
  section: string;
  /** Content to add/modify/delete */
  content: string;
  /** Previous content for modify operations */
  previous_content?: string;
}

/**
 * Information about a conflict with existing content.
 */
export interface ConflictInfo {
  /** Type of conflict */
  type: 'contradicts' | 'duplicates' | 'interferes';
  /** ID of the existing node that conflicts */
  existing_node_id: string;
  /** Human-readable description of the conflict */
  description: string;
  /** Source of the conflict detection */
  source: 'llm' | 'lint';
  /** Whether a resolution is included in the package */
  resolution_included: boolean;
}

// =============================================================================
// Prompt Parameter Types
// =============================================================================

/** Depth setting for generation */
export type GenerationDepth = 'narrow' | 'medium' | 'wide';

/** Count setting for generation */
export type GenerationCount = 'few' | 'standard' | 'many';

/**
 * Entry point for generation.
 * Specifies what the generation is anchored to.
 */
export interface GenerationEntryPoint {
  /** Type of entry point */
  type: 'beat' | 'plotPoint' | 'character' | 'gap' | 'idea' | 'naked';
  /** Target ID if applicable */
  targetId?: string;
  /** Additional data about the target */
  targetData?: Record<string, unknown>;
}

/**
 * Parameters for the generation prompt.
 */
export interface GenerationParams {
  /** Entry point for generation */
  entryPoint: GenerationEntryPoint;
  /** Serialized story context */
  storyContext: string;
  /** Serialized gaps */
  gaps: string;
  /** Optional user guidance */
  direction?: string;
  /** Depth setting */
  depth: GenerationDepth;
  /** Number of packages to generate */
  count: number;
}

/**
 * Parameters for the refinement prompt.
 */
export interface RefinementParams {
  /** Base package being refined */
  basePackage: NarrativePackage;
  /** Node IDs to preserve unchanged */
  keepElements: string[];
  /** Node IDs to regenerate */
  regenerateElements: string[];
  /** User's refinement guidance */
  guidance: string;
  /** Serialized story context */
  storyContext: string;
  /** Depth setting for variations */
  depth: GenerationDepth;
  /** Number of variations to generate */
  count: number;
}

/**
 * Parameters for the interpretation prompt.
 */
export interface InterpretationParams {
  /** Raw user input to interpret */
  userInput: string;
  /** Serialized story context */
  storyContext: string;
  /** Recently modified node IDs for context */
  recentNodes?: string[];
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Result of validating AI output.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors (block application) */
  errors: ValidationError[];
  /** Validation warnings (allow with acknowledgment) */
  warnings: ValidationWarning[];
}

/**
 * A validation error that blocks application.
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** JSON path to the error location */
  path?: string;
  /** Node ID involved in the error */
  nodeId?: string;
}

/**
 * A validation warning that allows application.
 */
export interface ValidationWarning {
  /** Warning code for programmatic handling */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Node ID involved in the warning */
  nodeId?: string;
}
