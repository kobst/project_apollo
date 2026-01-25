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
 *
 * Supports two structures:
 * 1. Legacy: Uses `changes` object with nodes/edges arrays
 * 2. Enhanced: Uses `primary`/`supporting`/`suggestions` for categorized output
 *
 * The `packageToPatch` function handles both structures.
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

  /** All changes included in this package (legacy structure) */
  changes: {
    /** Story Context modifications */
    storyContext?: StoryContextChange[];
    /** Node additions/modifications/deletions */
    nodes: NodeChange[];
    /** Edge additions/deletions */
    edges: EdgeChange[];
  };

  // === Enhanced Structure (optional, takes precedence if present) ===

  /** Primary output - the main generated content (enhanced structure) */
  primary?: PrimaryOutput;

  /** Supporting output - auxiliary content like Characters, Locations (enhanced structure) */
  supporting?: SupportingOutput;

  /** Suggestions - lightweight ideas and hints (enhanced structure) */
  suggestions?: PackageSuggestions;

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
  type: 'beat' | 'storyBeat' | 'character' | 'gap' | 'idea' | 'naked';
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

// =============================================================================
// Unified Propose Types
// =============================================================================

/**
 * Proposal mode - simplified user-facing selector.
 * - add: Create exactly what is described (low creativity, strict, 1 node)
 * - expand: Build out from a starting point (medium creativity, 4 nodes)
 * - explore: Generate creative options (high creativity, 6 nodes)
 */
export type ProposalMode = 'add' | 'expand' | 'explore';

/**
 * Intent for a propose request.
 * - add: Create new story elements
 * - edit: Modify existing elements
 * - expand: Build out from selection
 * - link: Connect elements together
 */
export type ProposeIntent = 'add' | 'edit' | 'expand' | 'link';

/**
 * Entry point type for propose requests.
 * Determines routing strategy in the orchestrator.
 */
export type ProposeEntryPointType =
  | 'freeText'    // User typed text (low creativity → interpret path)
  | 'node'        // Existing node selected
  | 'beat'        // Beat selected
  | 'gap'         // Gap selected
  | 'document';   // Document upload

/**
 * Scope defines what the propose request is targeting.
 */
export interface ProposeScope {
  /** Entry point type determines routing */
  entryPoint: ProposeEntryPointType;
  /** Target node type for 'add' intent */
  targetType?: string;
  /** Target node IDs for edit/expand/link intents */
  targetIds?: string[];
}

/**
 * Input data for a propose request.
 */
export interface ProposeInput {
  /** Free-form text description */
  text?: string;
  /** Pre-filled structured fields */
  structured?: Record<string, unknown>;
  /** Reference to uploaded document */
  documentId?: string;
}

/**
 * Structure respect mode.
 * - strict: Respect existing act structure exactly
 * - soft: May suggest minor structural adjustments
 */
export type StructureRespect = 'strict' | 'soft';

/**
 * Constraints for package generation.
 * All fields are optional - defaults come from mode or system defaults.
 */
export interface ProposeConstraints {
  /** Creativity level (0-1). Lower = conservative, higher = inventive */
  creativity?: number;
  /** Whether AI can create new supporting entities */
  inventNewEntities?: boolean;
  /** How strictly to respect existing structure */
  respectStructure?: StructureRespect;
}

/**
 * Options for propose request.
 * All fields are optional - defaults come from mode or system defaults.
 */
export interface ProposeOptions {
  /** Number of package alternatives to generate */
  packageCount?: number;
  /** Maximum nodes per package (replaces depth) */
  maxNodesPerPackage?: number;
}

/**
 * Unified propose request.
 * Replaces separate /interpret, /generate, /refine endpoints.
 */
export interface ProposeRequest {
  /** What action to take */
  intent: ProposeIntent;
  /** What is being targeted */
  scope: ProposeScope;
  /** User-provided input data */
  input?: ProposeInput;
  /** Proposal mode - sets default constraints and options */
  mode?: ProposalMode;
  /** Generation constraints (optional - defaults from mode or system) */
  constraints?: ProposeConstraints;
  /** Generation options (optional - defaults from mode or system) */
  options?: ProposeOptions;
}

/**
 * Response from a propose request.
 */
export interface ProposeResponse {
  /** Session ID for the generated packages */
  sessionId: string;
  /** Generated package alternatives */
  packages: NarrativePackage[];
  /** Interpretation summary (for freeText entry point with low creativity) */
  interpretation?: {
    summary: string;
    confidence: number;
    alternatives?: Array<{ summary: string; confidence: number }>;
  };
}

// =============================================================================
// Unified Generation API Types
// =============================================================================

/**
 * Expansion scope controls how much supporting content is generated.
 * - 'constrained': Only primary output type, no supporting nodes
 * - 'flexible': Primary output with supporting Characters, Locations, etc.
 */
export type ExpansionScope = 'constrained' | 'flexible';

/**
 * Story context section identifiers.
 */
export type ContextSection = 'themes' | 'conflicts' | 'motifs' | 'tone' | 'constraints';

/**
 * Context additions suggested by generation.
 * These are lightweight suggestions for Story Context updates.
 */
export interface ContextAddition {
  /** Unique identifier */
  id: string;
  /** Which Story Context section to add to */
  section: ContextSection;
  /** Content to add */
  content: string;
  /** Action is always 'append' for now */
  action: 'append';
}

/**
 * Stashed ideas are lightweight notes, not full graph nodes.
 * Used for capturing ideas that may be developed later.
 */
export interface StashedIdea {
  /** Unique identifier */
  id: string;
  /** The idea content */
  content: string;
  /** Category for organizing ideas */
  category: 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';
  /** Optional references to related nodes */
  relatedNodeIds?: string[];
}

/**
 * Lightweight hint for a potential StoryBeat.
 * Generated as suggestions, not full nodes.
 */
export interface StoryBeatHint {
  /** Suggested title for the story beat */
  title: string;
  /** Brief summary of what could happen */
  summary: string;
  /** Suggested beat type alignment (e.g., 'Catalyst', 'Midpoint') */
  suggestedBeat?: string;
  /** Suggested act placement */
  act?: 1 | 2 | 3 | 4 | 5;
}

/**
 * Character generation focus options.
 */
export type CharacterFocus =
  | 'develop_existing'
  | 'new_protagonist'
  | 'new_antagonist'
  | 'new_supporting'
  | 'fill_gaps';

/**
 * Summary of an existing character for response metadata.
 */
export interface CharacterSummary {
  /** Character node ID */
  id: string;
  /** Character name */
  name: string;
  /** Character archetype if defined */
  archetype?: string;
  /** Number of scenes featuring this character */
  sceneCount: number;
}

/**
 * Information about a validated StoryBeat for scene generation.
 */
export interface ValidatedBeatInfo {
  /** StoryBeat node ID */
  storyBeatId: string;
  /** StoryBeat title */
  title: string;
  /** Beat type it aligns with */
  alignedTo: string;
}

/**
 * Information about a rejected StoryBeat for scene generation.
 */
export interface RejectedBeatInfo {
  /** StoryBeat node ID that was rejected */
  storyBeatId: string;
  /** Reason for rejection */
  reason: 'not_found' | 'not_committed' | 'already_has_scenes';
}

/**
 * Target for expand operations.
 */
export type ExpandTarget =
  | { type: 'node'; nodeId: string }
  | { type: 'story-context' }
  | { type: 'story-context-section'; section: ContextSection };

/**
 * Common parameters shared across all generation endpoints.
 */
export interface CommonGenerationParams {
  /** User guidance for generation */
  direction?: string;
  /** Number of package alternatives to generate */
  packageCount?: number;
  /** Creativity level 0-1 */
  creativity?: number;
  /** Expansion scope for supporting content */
  expansionScope?: ExpansionScope;
}

// =============================================================================
// Enhanced NarrativePackage Structure
// =============================================================================

/**
 * Primary output type indicator for categorized packages.
 */
export type PrimaryOutputType = 'StoryBeat' | 'Character' | 'Scene' | 'Mixed';

/**
 * Primary output section of a NarrativePackage.
 * Contains the main generated content.
 */
export interface PrimaryOutput {
  /** Type of primary output */
  type: PrimaryOutputType;
  /** Primary node changes */
  nodes: NodeChange[];
  /** Primary edge changes */
  edges: EdgeChange[];
}

/**
 * Supporting output section of a NarrativePackage.
 * Contains auxiliary content like new Characters, Locations.
 */
export interface SupportingOutput {
  /** Supporting node changes (Characters, Locations, Objects) */
  nodes: NodeChange[];
  /** Supporting edge changes */
  edges: EdgeChange[];
}

/**
 * Suggestions section of a NarrativePackage.
 * Contains lightweight suggestions that aren't full graph changes.
 */
export interface PackageSuggestions {
  /** Suggested Story Context additions */
  contextAdditions?: ContextAddition[];
  /** Ideas to stash for later */
  stashedIdeas?: StashedIdea[];
  /** Hints for potential StoryBeats */
  storyBeatHints?: StoryBeatHint[];
}

// =============================================================================
// Endpoint-Specific Request/Response Types
// =============================================================================

/**
 * Request for POST /propose/story-beats (enhanced).
 */
export interface ProposeStoryBeatsRequest extends CommonGenerationParams {
  /** Beat IDs or BeatTypes to prioritize */
  priorityBeats?: string[];
  /** Max StoryBeats per package */
  maxStoryBeatsPerPackage?: number;
  /** Target specific act */
  targetAct?: 1 | 2 | 3 | 4 | 5;
}

/**
 * Request for POST /propose/characters.
 */
export interface ProposeCharactersRequest extends CommonGenerationParams {
  /** Character generation focus */
  focus: CharacterFocus;
  /** Existing character ID for 'develop_existing' focus */
  characterId?: string;
  /** Whether to include character arcs */
  includeArcs?: boolean;
  /** Max characters per package */
  maxCharactersPerPackage?: number;
}

/**
 * Response for POST /propose/characters.
 */
export interface ProposeCharactersResponse {
  /** Session ID for the generated packages */
  sessionId: string;
  /** Generated packages */
  packages: NarrativePackage[];
  /** Summary of existing characters for reference */
  existingCharacters: CharacterSummary[];
}

/**
 * Request for POST /propose/scenes.
 */
export interface ProposeScenesRequest extends CommonGenerationParams {
  /** StoryBeat IDs to generate scenes for (must be committed) */
  storyBeatIds: string[];
  /** Number of scenes per StoryBeat */
  scenesPerBeat?: number;
  /** Max scenes per package */
  maxScenesPerPackage?: number;
}

/**
 * Response for POST /propose/scenes.
 */
export interface ProposeScenesResponse {
  /** Session ID for the generated packages */
  sessionId: string;
  /** Generated packages */
  packages: NarrativePackage[];
  /** StoryBeats that were validated and used */
  validatedBeats: ValidatedBeatInfo[];
  /** StoryBeats that were rejected with reasons */
  rejectedBeats: RejectedBeatInfo[];
}

/**
 * Request for POST /propose/expand.
 */
export interface ProposeExpandRequest extends CommonGenerationParams {
  /** Target to expand */
  target: ExpandTarget;
  /** Depth of expansion */
  depth?: 'surface' | 'deep';
  /** Max nodes per package */
  maxNodesPerPackage?: number;
}

/**
 * Response for POST /propose/expand.
 */
export interface ProposeExpandResponse {
  /** Session ID for the generated packages */
  sessionId: string;
  /** Generated packages */
  packages: NarrativePackage[];
  /** Information about what was expanded */
  expandedTarget: {
    type: 'node' | 'story-context';
    nodeId?: string;
    nodeType?: string;
    section?: ContextSection;
  };
}
