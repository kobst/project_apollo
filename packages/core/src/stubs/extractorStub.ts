/**
 * Stub extractor that parses input into a Patch.
 * In production, this would be an LLM call.
 *
 * This stub provides deterministic extraction for testing purposes.
 */

import type { Patch } from '../types/patch.js';
import type {
  Character,
  Conflict,
  Location,
  Beat,
  BeatType,
} from '../types/nodes.js';
import { BEAT_ACT_MAP, BEAT_POSITION_MAP } from '../types/nodes.js';

// =============================================================================
// Extractor Stub
// =============================================================================

/**
 * Extract a minimal Patch from a logline.
 * Creates protagonist, central conflict, and primary location.
 *
 * @param logline - The story logline/premise
 * @param baseVersionId - The base story version ID
 * @returns A Patch containing extracted entities
 */
export function extractFromLogline(
  logline: string,
  baseVersionId: string
): Patch {
  const timestamp = new Date().toISOString();
  const patchId = `patch_${Date.now()}`;

  return {
    type: 'Patch',
    id: patchId,
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
          description: 'Main character extracted from logline',
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
          description: logline.length >= 20 ? logline : logline.padEnd(20, '.'),
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
          description: 'Main setting extracted from logline',
        } as Location,
      },
      // Link conflict to protagonist
      {
        op: 'ADD_EDGE',
        edge: {
          type: 'INVOLVES',
          from: 'conf_central',
          to: 'char_protagonist',
        },
      },
    ],
    metadata: {
      source: 'extractorStub',
      logline,
    },
  };
}

/**
 * Create a Patch that seeds all 15 beats for a new story.
 *
 * @param baseVersionId - The base story version ID
 * @returns A Patch containing all 15 beats
 */
export function seedBeats(baseVersionId: string): Patch {
  const timestamp = new Date().toISOString();
  const patchId = `patch_beats_${Date.now()}`;

  const beatTypes: BeatType[] = [
    'OpeningImage',
    'ThemeStated',
    'Setup',
    'Catalyst',
    'Debate',
    'BreakIntoTwo',
    'BStory',
    'FunAndGames',
    'Midpoint',
    'BadGuysCloseIn',
    'AllIsLost',
    'DarkNightOfSoul',
    'BreakIntoThree',
    'Finale',
    'FinalImage',
  ];

  const beatGuidance: Record<BeatType, string> = {
    OpeningImage: 'The opening snapshot that sets tone and stakes.',
    ThemeStated: 'Someone states the theme, often to the protagonist.',
    Setup: 'Introduce the protagonist and their world.',
    Catalyst: 'The event that launches the story problem.',
    Debate: 'The protagonist debates whether to accept the challenge.',
    BreakIntoTwo: 'The protagonist commits to the journey.',
    BStory: 'A subplot, often romantic or mentorship.',
    FunAndGames: 'The promise of the premise delivered.',
    Midpoint: 'A false victory or defeat that raises stakes.',
    BadGuysCloseIn: 'External and internal pressures mount.',
    AllIsLost: 'The lowest point; something or someone is lost.',
    DarkNightOfSoul: 'Wallowing in hopelessness before breakthrough.',
    BreakIntoThree: 'The solution is found; the protagonist commits.',
    Finale: 'The climax and resolution of all storylines.',
    FinalImage: 'The closing snapshot, showing transformation.',
  };

  return {
    type: 'Patch',
    id: patchId,
    base_story_version_id: baseVersionId,
    created_at: timestamp,
    ops: beatTypes.map((beatType) => ({
      op: 'ADD_NODE' as const,
      node: {
        type: 'Beat' as const,
        id: `beat_${beatType}`,
        beat_type: beatType,
        act: BEAT_ACT_MAP[beatType],
        position_index: BEAT_POSITION_MAP[beatType],
        guidance: beatGuidance[beatType],
        status: 'EMPTY' as const,
      } as Beat,
    })),
    metadata: {
      source: 'extractorStub',
      action: 'seedBeats',
    },
  };
}

/**
 * Create a combined Patch that seeds beats and extracts from logline.
 *
 * @param logline - The story logline/premise
 * @param baseVersionId - The base story version ID
 * @returns A Patch containing beats and extracted entities
 */
export function initializeStory(
  logline: string,
  baseVersionId: string
): Patch {
  const timestamp = new Date().toISOString();
  const patchId = `patch_init_${Date.now()}`;

  const beatsPatch = seedBeats(baseVersionId);
  const extractPatch = extractFromLogline(logline, baseVersionId);

  return {
    type: 'Patch',
    id: patchId,
    base_story_version_id: baseVersionId,
    created_at: timestamp,
    ops: [...beatsPatch.ops, ...extractPatch.ops],
    metadata: {
      source: 'extractorStub',
      action: 'initializeStory',
      logline,
    },
  };
}
