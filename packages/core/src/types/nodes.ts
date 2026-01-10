/**
 * Node type definitions for the screenplay knowledge graph.
 * Matches the schema in spec/projectSpec.md
 */

// =============================================================================
// Base Types
// =============================================================================

export interface BaseNode {
  type: string;
  id: string;
}

// =============================================================================
// 1. StoryVersion
// =============================================================================

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

// =============================================================================
// 2. MoveCluster
// =============================================================================

export interface ScopeBudget {
  max_ops_per_move: number;
  max_new_nodes_per_move: number;
  allowed_node_types: string[];
  allowed_depth: 'OUTLINE' | 'DRAFT' | 'REVISION';
}

export type ClusterType =
  | 'STRUCTURE'
  | 'SCENE_LIST'
  | 'SCENE_QUALITY'
  | 'CHARACTER';

export type ClusterStatus = 'PROPOSED' | 'ARCHIVED';

export interface MoveCluster extends BaseNode {
  type: 'MoveCluster';
  base_story_version_id: string;
  created_at: string;
  title: string;
  description?: string;
  cluster_type?: ClusterType;
  primary_open_question_id?: string;
  supporting_open_question_ids?: string[];
  scope_budget: ScopeBudget;
  status?: ClusterStatus;
}

// =============================================================================
// 3. NarrativeMove
// =============================================================================

export type MoveStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED';

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
  status?: MoveStatus;
  human_edits?: string;
}

// =============================================================================
// 4. Patch (defined in patch.ts, re-exported here for KGNode union)
// =============================================================================

// Note: Patch interface is defined in patch.ts to avoid circular imports
// It will be included in the KGNode union via the index.ts re-export

// =============================================================================
// 5. Beat
// =============================================================================

export type BeatType =
  | 'OpeningImage'
  | 'ThemeStated'
  | 'Setup'
  | 'Catalyst'
  | 'Debate'
  | 'BreakIntoTwo'
  | 'BStory'
  | 'FunAndGames'
  | 'Midpoint'
  | 'BadGuysCloseIn'
  | 'AllIsLost'
  | 'DarkNightOfSoul'
  | 'BreakIntoThree'
  | 'Finale'
  | 'FinalImage';

export type BeatStatus = 'EMPTY' | 'PLANNED' | 'REALIZED';

export interface Beat extends BaseNode {
  type: 'Beat';
  beat_type: BeatType;
  act: 1 | 2 | 3 | 4 | 5;
  position_index: number;
  guidance?: string;
  status?: BeatStatus;
  notes?: string;
}

/**
 * Beat to Act mapping per Film Crit Hulk 5-Act structure
 */
export const BEAT_ACT_MAP: Record<BeatType, 1 | 2 | 3 | 4 | 5> = {
  OpeningImage: 1,
  ThemeStated: 1,
  Setup: 1,
  Catalyst: 1,
  Debate: 1,
  BreakIntoTwo: 2,
  BStory: 2,
  FunAndGames: 2,
  Midpoint: 3,
  BadGuysCloseIn: 3,
  AllIsLost: 4,
  DarkNightOfSoul: 4,
  BreakIntoThree: 5,
  Finale: 5,
  FinalImage: 5,
};

/**
 * Beat to position_index mapping
 */
export const BEAT_POSITION_MAP: Record<BeatType, number> = {
  OpeningImage: 1,
  ThemeStated: 2,
  Setup: 3,
  Catalyst: 4,
  Debate: 5,
  BreakIntoTwo: 6,
  BStory: 7,
  FunAndGames: 8,
  Midpoint: 9,
  BadGuysCloseIn: 10,
  AllIsLost: 11,
  DarkNightOfSoul: 12,
  BreakIntoThree: 13,
  Finale: 14,
  FinalImage: 15,
};

// =============================================================================
// 6. Scene
// =============================================================================

export type SceneTag =
  | 'SETUP'
  | 'PAYOFF'
  | 'REVEAL'
  | 'REVERSAL'
  | 'DECISION'
  | 'ESCALATION'
  | 'LOSS'
  | 'VICTORY'
  | 'INTRO_CHARACTER'
  | 'INTRO_OBJECT'
  | 'TURNING_POINT';

export type IntExt = 'INT' | 'EXT' | 'OTHER';
export type SceneStatus = 'DRAFT' | 'REVISED';
export type SourceProvenance = 'USER' | 'AI' | 'MIXED';

export interface Scene extends BaseNode {
  type: 'Scene';
  heading: string;
  title?: string;
  scene_overview: string;
  /** @deprecated Use SATISFIED_BY edge to PlotPoint instead */
  beat_id?: string;
  /** Auto-computed order based on PlotPoint attachment. Undefined if unattached. */
  order_index?: number;
  int_ext?: IntExt;
  time_of_day?: string;
  mood?: string;
  key_actions?: string[];
  notable_dialogue?: string[];
  scene_tags?: SceneTag[];
  status?: SceneStatus;
  source_provenance?: SourceProvenance;
}

// =============================================================================
// 7. Character
// =============================================================================

export type CharacterStatus = 'ACTIVE' | 'INACTIVE';

export interface Character extends BaseNode {
  type: 'Character';
  name: string;
  description?: string;
  archetype?: string;
  traits?: string[];
  notes?: string;
  status?: CharacterStatus;
}

// =============================================================================
// 8. Location
// =============================================================================

export interface Location extends BaseNode {
  type: 'Location';
  name: string;
  parent_location_id?: string | null;
  description?: string;
  tags?: string[];
}

// =============================================================================
// 9. Object (StoryObject to avoid JS Object conflict)
// =============================================================================

export interface StoryObject extends BaseNode {
  type: 'Object';
  name: string;
  description?: string;
  introduced_in_scene_id?: string;
  tags?: string[];
}

// =============================================================================
// 10-11. Theme and Motif - REMOVED
// =============================================================================
// Themes and Motifs are now stored as prose in Story Context (StoryMetadata.storyContext)
// rather than formal graph nodes. This acknowledges they are interpretive concepts
// *about* the story rather than concrete entities *in* the story.

// =============================================================================
// 12. CharacterArc
// =============================================================================

export interface TurnRef {
  beat_id?: string;
  scene_id?: string;
  note?: string;
}

export type ArcStatus = 'FLOATING' | 'PARTIAL' | 'GROUNDED';

export interface CharacterArc extends BaseNode {
  type: 'CharacterArc';
  character_id: string;
  arc_type?: string;
  start_state?: string;
  end_state?: string;
  turn_refs?: TurnRef[];
  status?: ArcStatus;
}

// =============================================================================
// 13. Conflict - REMOVED
// =============================================================================
// Conflicts are now stored as prose in Story Context (StoryMetadata.storyContext).
// Concrete interpersonal conflicts may be represented as Character-to-Character
// edge relationships in a future iteration.

// =============================================================================
// 14. PlotPoint
// =============================================================================

export type PlotPointIntent = 'plot' | 'character' | 'tone';
export type PlotPointPriority = 'low' | 'medium' | 'high';
export type PlotPointUrgency = 'low' | 'medium' | 'high';
export type PlotPointStakesChange = 'up' | 'down' | 'steady';
export type PlotPointStatus = 'proposed' | 'approved' | 'deprecated';

export interface PlotPoint extends BaseNode {
  type: 'PlotPoint';
  /** Short, imperative title (e.g., "Begin revenge tour") */
  title: string;
  /** 1-3 sentences describing the intended event */
  summary?: string;
  /** Primary purpose of this plot point */
  intent?: PlotPointIntent;
  /** Auto-computed order based on Beat alignment. Undefined if unaligned. */
  order_index?: number;
  /** Importance level */
  priority?: PlotPointPriority;
  /** How soon this needs to be addressed */
  urgency?: PlotPointUrgency;
  /** How stakes change at this point */
  stakes_change?: PlotPointStakesChange;
  /** Lifecycle status (defaults to 'proposed') */
  status?: PlotPointStatus;
  /** Which act this belongs to */
  act?: 1 | 2 | 3 | 4 | 5;
  /** Importance in overall plan (0-1) */
  weight?: number;
  /** Planning confidence (0-1) */
  confidence?: number;
  /** Categorical tags */
  tags?: string[];
  /** FK to Character or user who owns this */
  ownerId?: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

// =============================================================================
// 15. Logline
// =============================================================================

/**
 * Logline - The one-sentence story summary (one per story)
 * Top of the pyramid - everything else serves the logline
 *
 * Note: Replaces the old Premise node. Extended concept/hook/notes
 * are now stored in Story Context (StoryMetadata.storyContext).
 */
export interface Logline extends BaseNode {
  type: 'Logline';
  /** The logline text - one sentence story summary */
  text: string;
}

// =============================================================================
// 16. Setting
// =============================================================================

/**
 * Setting - Generalized world/time period container
 * Can represent: "1920s Chicago", "Post-apocalyptic wasteland", "Victorian London"
 * Locations are PART_OF a Setting
 */
export interface Setting extends BaseNode {
  type: 'Setting';
  /** Name of the setting/world */
  name: string;
  /** Description of atmosphere, rules, feel */
  description?: string;
  /** Time period if applicable */
  time_period?: string;
  /** Visual/atmospheric keywords */
  atmosphere?: string;
  /** Notes about the setting */
  notes?: string;
}

// =============================================================================
// 17. GenreTone
// =============================================================================

/**
 * GenreTone - Combined genre and tone declaration
 * Handles: pure genre, pure tone, or genre-with-implied-tone
 */
export type Genre =
  | 'action'
  | 'comedy'
  | 'drama'
  | 'horror'
  | 'thriller'
  | 'romance'
  | 'sci-fi'
  | 'fantasy'
  | 'noir'
  | 'western'
  | 'mystery'
  | 'adventure'
  | 'musical'
  | 'documentary'
  | 'other';

export type Tone =
  | 'dark'
  | 'light'
  | 'gritty'
  | 'whimsical'
  | 'satirical'
  | 'earnest'
  | 'cynical'
  | 'hopeful'
  | 'melancholic'
  | 'tense'
  | 'comedic'
  | 'dramatic'
  | 'neutral';

export interface GenreTone extends BaseNode {
  type: 'GenreTone';
  /** Primary genre (optional - some stories defy genre) */
  genre?: Genre;
  /** Secondary/hybrid genre */
  secondary_genre?: Genre;
  /** Tone description */
  tone?: Tone;
  /** Freeform tone description for nuanced cases */
  tone_description?: string;
  /** Genre conventions this story follows or subverts */
  conventions?: string;
  /** Notes */
  notes?: string;
}

// =============================================================================
// Union Types
// =============================================================================

/**
 * All node types that can appear in the knowledge graph.
 * Note: Patch is defined separately to avoid circular imports.
 */
export type ContentNode =
  | StoryVersion
  | MoveCluster
  | NarrativeMove
  | Beat
  | Scene
  | Character
  | Location
  | StoryObject
  | CharacterArc
  | PlotPoint
  | Logline
  | Setting
  | GenreTone;

/**
 * All valid node type strings
 */
export type NodeType =
  | 'StoryVersion'
  | 'MoveCluster'
  | 'NarrativeMove'
  | 'Patch'
  | 'Beat'
  | 'Scene'
  | 'Character'
  | 'Location'
  | 'Object'
  | 'CharacterArc'
  | 'PlotPoint'
  | 'Logline'
  | 'Setting'
  | 'GenreTone';

/**
 * List of all node types for validation
 */
export const NODE_TYPES: NodeType[] = [
  'StoryVersion',
  'MoveCluster',
  'NarrativeMove',
  'Patch',
  'Beat',
  'Scene',
  'Character',
  'Location',
  'Object',
  'CharacterArc',
  'PlotPoint',
  'Logline',
  'Setting',
  'GenreTone',
];
