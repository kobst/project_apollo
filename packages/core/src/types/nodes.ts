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
// 2. Patch (defined in patch.ts, re-exported here for KGNode union)
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
export type SourceProvenance = 'USER' | 'AI' | 'MIXED' | 'MIGRATION';

export interface Scene extends BaseNode {
  type: 'Scene';
  heading: string;
  title?: string;
  scene_overview: string;
  /** @deprecated Use SATISFIED_BY edge to StoryBeat instead */
  beat_id?: string;
  /** Auto-computed order based on StoryBeat attachment. Undefined if unattached. */
  order_index?: number;
  int_ext?: IntExt;
  time_of_day?: string;
  mood?: string;
  key_actions?: string[];
  notable_dialogue?: string[];
  scene_tags?: SceneTag[];
  /** Extended statuses; existing values remain valid */
  status?: SceneStatus | 'APPROVED' | 'FINAL' | 'CUT';
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
// 14. StoryBeat (formerly PlotPoint)
// =============================================================================

export type StoryBeatIntent = 'plot' | 'character' | 'tone';
export type StoryBeatPriority = 'low' | 'medium' | 'high';
export type StoryBeatUrgency = 'low' | 'medium' | 'high';
export type StoryBeatStakesChange = 'up' | 'down' | 'steady';
export type StoryBeatStatus = 'proposed' | 'approved' | 'deprecated';
export type StoryBeatNarrativeFunction =
  | 'theme_establishment'
  | 'character_introduction'
  | 'character_development'
  | 'plot_revelation'
  | 'reversal'
  | 'escalation'
  | 'resolution'
  | 'tone_setter';

export interface StoryBeat extends BaseNode {
  type: 'StoryBeat';
  /** Short, imperative title (e.g., "Begin revenge tour") */
  title: string;
  /** 1-3 sentences describing the intended event */
  summary?: string;
  /** Narrative function category (abstract intent classifier) */
  narrative_function?: StoryBeatNarrativeFunction;
  /** Primary purpose of this story beat */
  intent?: StoryBeatIntent;
  /** Auto-computed order based on Beat alignment. Undefined if unaligned. */
  order_index?: number;
  /** Importance level */
  priority?: StoryBeatPriority;
  /** How soon this needs to be addressed */
  urgency?: StoryBeatUrgency;
  /** How stakes change at this point */
  stakes_change?: StoryBeatStakesChange;
  /** Lifecycle status (defaults to 'proposed') */
  status?: StoryBeatStatus;
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
// 15-17. Logline, Setting, GenreTone - REMOVED
// =============================================================================
// Logline is now stored in StoryContext.constitution.logline
// Setting is now stored in StoryContext.constitution.setting
// GenreTone is now stored in StoryContext.constitution.genre and .toneEssence

// =============================================================================
// 18. Idea
// =============================================================================

/**
 * Idea - Story ideas that are more formalized than Story Context prose
 * but not yet ready to be StoryBeats or Scenes.
 * Serves as an intermediate stage in the idea lifecycle.
 */
export type IdeaSource = 'user' | 'ai';
export type IdeaSuggestedType = 'StoryBeat' | 'Scene' | 'Character' | 'Location' | 'Object';
export type IdeaStatus = 'active' | 'promoted' | 'dismissed';
export type IdeaCategory = 'character' | 'plot' | 'scene' | 'worldbuilding' | 'general';

// Enhanced Ideas - Planning Layer additions
export type IdeaKind =
  | 'proposal'    // Default / legacy behavior
  | 'question'
  | 'direction'
  | 'constraint'
  | 'note';

export type IdeaResolutionStatus =
  | 'open'
  | 'discussed'
  | 'resolved'
  | 'archived';

export interface Idea extends BaseNode {
  type: 'Idea';
  /** Short label, e.g., "Max's betrayal reveal" */
  title: string;
  /** 1-3 sentences explaining the idea */
  description: string;
  /** Who created it */
  source: IdeaSource;
  /** What it might become when promoted */
  suggestedType?: IdeaSuggestedType;
  /** Lifecycle status (defaults to 'active') */
  status?: IdeaStatus;
  /** Category for organization */
  category?: IdeaCategory;
  /** If created from AI generation, the source package ID */
  sourcePackageId?: string;
  /** Related node IDs (optional, for context) */
  relatedNodeIds?: string[];
  /** ISO timestamp of creation */
  createdAt: string;

  // === New optional planning fields (backward compatible) ===
  /** Planning mode for the idea */
  kind?: IdeaKind; // default interpret as 'proposal' if undefined
  /** Lifecycle status for questions/directions */
  resolutionStatus?: IdeaResolutionStatus; // default interpret as 'open' if undefined
  /** Resolution text (answer/decision) */
  resolution?: string;
  /** Refinement lineage */
  parent_idea_id?: string;
  refinement_guidance?: string;
  /** Targeting for deterministic filtering */
  targetBeat?: string;
  targetAct?: 1 | 2 | 3 | 4 | 5;
  targetScene?: string;
  /** Thematic tags */
  themes?: string[];
  moods?: string[];
  /** Generation-time tagging for traceability */
  generationContext?: {
    task: string;
    timestamp: string;
    promptSnippet?: string;
  };
  /** Provenance: artifacts this idea informed */
  informedArtifacts?: Array<{
    artifactId: string;
    artifactType: 'StoryBeat' | 'Scene' | 'Character';
    packageId: string;
    timestamp: string;
  }>;
  /** Usage metrics */
  lastReviewedAt?: string;
  lastUsedInPrompt?: string;
  usageCount?: number;
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
  | Beat
  | Scene
  | Character
  | Location
  | StoryObject
  | CharacterArc
  | StoryBeat
  | Idea;

/**
 * All valid node type strings
 */
export type NodeType =
  | 'StoryVersion'
  | 'Patch'
  | 'Beat'
  | 'Scene'
  | 'Character'
  | 'Location'
  | 'Object'
  | 'CharacterArc'
  | 'StoryBeat'
  | 'Idea';

/**
 * List of all node types for validation
 */
export const NODE_TYPES: NodeType[] = [
  'StoryVersion',
  'Patch',
  'Beat',
  'Scene',
  'Character',
  'Location',
  'Object',
  'CharacterArc',
  'StoryBeat',
  'Idea',
];
