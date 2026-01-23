/**
 * Stub extractor that parses input into a Patch.
 * In production, this would be an LLM call.
 *
 * This stub provides deterministic extraction for testing purposes.
 */

import type { Patch } from '../types/patch.js';
import type {
  Character,
  Location,
  Beat,
  BeatType,
  Scene,
  StoryBeat,
  StoryObject,
  Logline,
  Setting,
  GenreTone,
  Genre,
  Tone,
} from '../types/nodes.js';
import { BEAT_ACT_MAP, BEAT_POSITION_MAP } from '../types/nodes.js';

// =============================================================================
// Extractor Stub
// =============================================================================

/**
 * Extract a minimal Patch from a logline.
 * Creates protagonist and primary location.
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

// =============================================================================
// Freeform Extraction Result
// =============================================================================

export interface ExtractionProposal {
  id: string;
  title: string;
  description: string;
  patch: Patch;
  confidence: number;
  extractedEntities: Array<{
    type: string;
    name: string;
    id: string;
  }>;
}

export interface ExtractionResult {
  proposals: ExtractionProposal[];
  inputSummary: string;
  targetType: string | null;
  targetNodeId: string | null;
}

/**
 * Extract structured proposals from freeform text input.
 * In production, this would be an LLM call that analyzes the text
 * and generates appropriate patches.
 *
 * @param input - Freeform text input from user
 * @param baseVersionId - The base story version ID
 * @param targetType - Optional target node type to focus extraction
 * @param targetNodeId - Optional specific node to modify/extend
 * @returns Extraction result with proposals
 */
export function extractFromInput(
  input: string,
  baseVersionId: string,
  targetType?: string,
  targetNodeId?: string
): ExtractionResult {
  const timestamp = new Date().toISOString();
  const proposals: ExtractionProposal[] = [];

  // Simple keyword-based extraction for stub
  const lowerInput = input.toLowerCase();

  // Detect character mentions
  const characterMatches = input.match(/(?:named?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g) || [];
  const uniqueCharacters = [...new Set(characterMatches)].slice(0, 3);

  // Detect location mentions
  const locationPatterns = /(?:in|at|the)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;
  const locationMatches = [...input.matchAll(locationPatterns)].map(m => m[1]).slice(0, 2);

  // Detect scene/action descriptions
  const hasSceneContent = lowerInput.includes('scene') ||
    lowerInput.includes('INT.') || lowerInput.includes('EXT.') ||
    lowerInput.length > 100;

  // Generate proposals based on detected content
  if (targetType === 'Character' || (!targetType && uniqueCharacters.length > 0)) {
    // Character extraction proposal
    for (let i = 0; i < Math.min(uniqueCharacters.length, 2); i++) {
      const charName = uniqueCharacters[i] || 'Unknown Character';
      const charId = `char_${charName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${i}`;
      const patchId = `patch_char_${Date.now()}_${i}`;

      proposals.push({
        id: `prop_char_${i}`,
        title: `Add character: ${charName}`,
        description: `Extract "${charName}" as a new character based on the input.`,
        confidence: 0.7 + Math.random() * 0.2,
        extractedEntities: [{ type: 'Character', name: charName, id: charId }],
        patch: {
          type: 'Patch',
          id: patchId,
          base_story_version_id: baseVersionId,
          created_at: timestamp,
          ops: [
            {
              op: 'ADD_NODE',
              node: {
                type: 'Character',
                id: charId,
                name: charName,
                description: `Character extracted from: "${input.slice(0, 100)}..."`,
                status: 'ACTIVE',
              } as Character,
            },
          ],
          metadata: {
            source: 'extractorStub',
            action: 'extractFromInput',
          },
        },
      });
    }
  }

  if (targetType === 'Location' || (!targetType && locationMatches.length > 0)) {
    // Location extraction proposal
    for (let i = 0; i < Math.min(locationMatches.length, 2); i++) {
      const locName = locationMatches[i] || 'Unknown Location';
      const locId = `loc_${locName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${i}`;
      const patchId = `patch_loc_${Date.now()}_${i}`;

      proposals.push({
        id: `prop_loc_${i}`,
        title: `Add location: ${locName}`,
        description: `Extract "${locName}" as a new location based on the input.`,
        confidence: 0.65 + Math.random() * 0.2,
        extractedEntities: [{ type: 'Location', name: locName, id: locId }],
        patch: {
          type: 'Patch',
          id: patchId,
          base_story_version_id: baseVersionId,
          created_at: timestamp,
          ops: [
            {
              op: 'ADD_NODE',
              node: {
                type: 'Location',
                id: locId,
                name: locName,
                description: `Location extracted from input`,
              } as Location,
            },
          ],
          metadata: {
            source: 'extractorStub',
            action: 'extractFromInput',
          },
        },
      });
    }
  }

  if (targetType === 'Scene' || (!targetType && hasSceneContent)) {
    // Scene extraction proposal
    const sceneId = `scene_extracted_${Date.now()}`;
    const patchId = `patch_scene_${Date.now()}`;

    // Try to extract a scene heading or create one
    let heading = 'INT. LOCATION - DAY';
    const headingMatch = input.match(/(?:INT\.|EXT\.)[^\n.]+/i);
    if (headingMatch) {
      heading = headingMatch[0];
    }

    // Determine which beat this scene fulfills
    const beatId = targetNodeId || 'beat_Setup';
    const beatLabel = beatId.replace('beat_', '').replace(/([A-Z])/g, ' $1').trim();

    // Derive title from short input (under 60 chars)
    const title = input.length < 60 ? input : undefined;

    // Build ops: ADD_NODE Scene (beat_id provides the beat relationship)
    const sceneNode: Scene = {
      type: 'Scene',
      id: sceneId,
      heading,
      scene_overview: input.slice(0, 500),
      beat_id: beatId,
      order_index: 1,
      status: 'DRAFT',
      source_provenance: 'USER',
    };
    if (title) {
      sceneNode.title = title;
    }

    const ops: Patch['ops'] = [
      {
        op: 'ADD_NODE',
        node: sceneNode,
      },
    ];

    proposals.push({
      id: 'prop_scene_0',
      title: targetNodeId
        ? `Create scene for ${beatLabel}`
        : 'Create scene from input',
      description: targetNodeId
        ? `Create a new scene that fulfills the ${beatLabel} beat.`
        : 'Extract a new scene based on the input description.',
      confidence: 0.75,
      extractedEntities: [{ type: 'Scene', name: heading, id: sceneId }],
      patch: {
        type: 'Patch',
        id: patchId,
        base_story_version_id: baseVersionId,
        created_at: timestamp,
        ops,
        metadata: {
          source: 'extractorStub',
          action: 'extractFromInput',
          targetBeat: targetNodeId || undefined,
        },
      },
    });
  }

  if (targetType === 'StoryBeat' || (!targetType && (lowerInput.includes('must') || lowerInput.includes('need') || lowerInput.includes('should')))) {
    // StoryBeat extraction proposal
    const plotPointId = `pp_extracted_${Date.now()}`;
    const patchId = `patch_pp_${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Try to extract a title from the input
    const title = input.length < 60 ? input : input.slice(0, 57) + '...';

    // Determine intent based on keywords
    let intent: 'plot' | 'character' | 'tone' = 'plot';
    if (lowerInput.includes('feel') || lowerInput.includes('emotion') || lowerInput.includes('mood')) {
      intent = 'tone';
    } else if (lowerInput.includes('character') || lowerInput.includes('protagonist') || lowerInput.includes('arc')) {
      intent = 'character';
    }

    const plotPoint: StoryBeat = {
      type: 'StoryBeat',
      id: plotPointId,
      title,
      summary: input.slice(0, 300),
      intent,
      status: 'proposed',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    proposals.push({
      id: 'prop_plotpoint_0',
      title: `Create plot point: ${title.slice(0, 40)}${title.length > 40 ? '...' : ''}`,
      description: 'Extract a new plot point representing a story beat that must happen.',
      confidence: 0.7,
      extractedEntities: [{ type: 'StoryBeat', name: title, id: plotPointId }],
      patch: {
        type: 'Patch',
        id: patchId,
        base_story_version_id: baseVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'ADD_NODE',
            node: plotPoint,
          },
        ],
        metadata: {
          source: 'extractorStub',
          action: 'extractFromInput',
        },
      },
    });
  }

  if (targetType === 'Object' || (!targetType && (lowerInput.includes('object') || lowerInput.includes('prop') || lowerInput.includes('item') || lowerInput.includes('artifact')))) {
    // Object extraction proposal
    const objectId = `obj_extracted_${Date.now()}`;
    const patchId = `patch_obj_${Date.now()}`;

    // Extract name from input
    const name = input.length < 40 ? input : input.slice(0, 37) + '...';

    const storyObject: StoryObject = {
      type: 'Object',
      id: objectId,
      name,
      description: input.slice(0, 300),
    };

    proposals.push({
      id: 'prop_object_0',
      title: `Create prop: ${name.slice(0, 30)}${name.length > 30 ? '...' : ''}`,
      description: 'Extract a significant prop or item in the story.',
      confidence: 0.7,
      extractedEntities: [{ type: 'Object', name, id: objectId }],
      patch: {
        type: 'Patch',
        id: patchId,
        base_story_version_id: baseVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'ADD_NODE',
            node: storyObject,
          },
        ],
        metadata: {
          source: 'extractorStub',
          action: 'extractFromInput',
        },
      },
    });
  }

  if (targetType === 'Logline' || (!targetType && (lowerInput.includes('logline') || lowerInput.includes('this story is about')))) {
    // Logline extraction proposal
    const loglineId = `logline_${Date.now()}`;
    const patchId = `patch_logline_${Date.now()}`;

    const logline: Logline = {
      type: 'Logline',
      id: loglineId,
      text: input.trim(),
    };

    proposals.push({
      id: 'prop_logline_0',
      title: 'Create story logline',
      description: 'Extract the one-sentence story summary.',
      confidence: 0.8,
      extractedEntities: [{ type: 'Logline', name: 'Story Logline', id: loglineId }],
      patch: {
        type: 'Patch',
        id: patchId,
        base_story_version_id: baseVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'ADD_NODE',
            node: logline,
          },
        ],
        metadata: {
          source: 'extractorStub',
          action: 'extractFromInput',
        },
      },
    });
  }

  if (targetType === 'Setting' || (!targetType && (lowerInput.includes('setting') || lowerInput.includes('world') || lowerInput.includes('time period') || lowerInput.includes('era') || lowerInput.includes('takes place')))) {
    // Setting extraction proposal
    const settingId = `setting_${Date.now()}`;
    const patchId = `patch_setting_${Date.now()}`;

    // Extract name from input
    const name = input.length < 60 ? input : input.slice(0, 57) + '...';

    const setting: Setting = {
      type: 'Setting',
      id: settingId,
      name,
      description: input.slice(0, 300),
    };

    proposals.push({
      id: 'prop_setting_0',
      title: `Create setting: ${name.slice(0, 30)}${name.length > 30 ? '...' : ''}`,
      description: 'Extract the story world or time period setting.',
      confidence: 0.75,
      extractedEntities: [{ type: 'Setting', name, id: settingId }],
      patch: {
        type: 'Patch',
        id: patchId,
        base_story_version_id: baseVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'ADD_NODE',
            node: setting,
          },
        ],
        metadata: {
          source: 'extractorStub',
          action: 'extractFromInput',
        },
      },
    });
  }

  if (targetType === 'GenreTone' || (!targetType && (lowerInput.includes('genre') || lowerInput.includes('tone') || lowerInput.includes('style') || lowerInput.includes('mood of the story')))) {
    // GenreTone extraction proposal
    const genreToneId = `genretone_${Date.now()}`;
    const patchId = `patch_genretone_${Date.now()}`;

    // Try to detect genre from keywords
    const genreKeywords: Record<Genre, string[]> = {
      action: ['action', 'adventure', 'explosive'],
      comedy: ['comedy', 'funny', 'humor', 'comedic'],
      drama: ['drama', 'dramatic', 'emotional'],
      horror: ['horror', 'scary', 'terrifying'],
      thriller: ['thriller', 'suspense', 'tension'],
      romance: ['romance', 'love story', 'romantic'],
      'sci-fi': ['sci-fi', 'science fiction', 'futuristic', 'space'],
      fantasy: ['fantasy', 'magical', 'mythical'],
      noir: ['noir', 'hardboiled', 'crime'],
      western: ['western', 'frontier'],
      mystery: ['mystery', 'whodunit', 'detective'],
      adventure: ['adventure', 'quest', 'journey'],
      musical: ['musical', 'singing'],
      documentary: ['documentary', 'real story'],
      other: [],
    };

    let detectedGenre: Genre | undefined;
    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some(kw => lowerInput.includes(kw))) {
        detectedGenre = genre as Genre;
        break;
      }
    }

    // Try to detect tone from keywords
    const toneKeywords: Record<Tone, string[]> = {
      dark: ['dark', 'bleak', 'grim'],
      light: ['light', 'uplifting', 'cheerful'],
      gritty: ['gritty', 'raw', 'realistic'],
      whimsical: ['whimsical', 'playful', 'quirky'],
      satirical: ['satirical', 'satire', 'ironic'],
      earnest: ['earnest', 'sincere', 'heartfelt'],
      cynical: ['cynical', 'jaded'],
      hopeful: ['hopeful', 'optimistic'],
      melancholic: ['melancholic', 'sad', 'wistful'],
      tense: ['tense', 'suspenseful'],
      comedic: ['comedic', 'funny', 'humorous'],
      dramatic: ['dramatic', 'intense'],
      neutral: [],
    };

    let detectedTone: Tone | undefined;
    for (const [tone, keywords] of Object.entries(toneKeywords)) {
      if (keywords.some(kw => lowerInput.includes(kw))) {
        detectedTone = tone as Tone;
        break;
      }
    }

    const genreTone: GenreTone = {
      type: 'GenreTone',
      id: genreToneId,
      ...(detectedGenre && { genre: detectedGenre }),
      ...(detectedTone && { tone: detectedTone }),
      ...(!detectedTone && { tone_description: input.slice(0, 200) }),
    };

    const label = [detectedGenre, detectedTone].filter(Boolean).join(' / ') || 'Genre/Tone';

    proposals.push({
      id: 'prop_genretone_0',
      title: `Create genre/tone: ${label}`,
      description: 'Extract the story genre and tonal qualities.',
      confidence: 0.7,
      extractedEntities: [{ type: 'GenreTone', name: label, id: genreToneId }],
      patch: {
        type: 'Patch',
        id: patchId,
        base_story_version_id: baseVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'ADD_NODE',
            node: genreTone,
          },
        ],
        metadata: {
          source: 'extractorStub',
          action: 'extractFromInput',
        },
      },
    });
  }

  // If no specific extractions, create a generic plot point proposal
  if (proposals.length === 0) {
    const plotPointId = `pp_generic_${Date.now()}`;
    const patchId = `patch_generic_${Date.now()}`;
    const title = input.length < 60 ? input : input.slice(0, 57) + '...';

    proposals.push({
      id: 'prop_generic_0',
      title: 'Create plot point',
      description: 'Create a new plot point from the input.',
      confidence: 0.6,
      extractedEntities: [{ type: 'StoryBeat', name: title, id: plotPointId }],
      patch: {
        type: 'Patch',
        id: patchId,
        base_story_version_id: baseVersionId,
        created_at: timestamp,
        ops: [
          {
            op: 'ADD_NODE',
            node: {
              type: 'StoryBeat',
              id: plotPointId,
              title,
              summary: input.slice(0, 300),
              intent: 'plot',
              status: 'proposed',
              createdAt: timestamp,
              updatedAt: timestamp,
            } as StoryBeat,
          },
        ],
        metadata: {
          source: 'extractorStub',
          action: 'extractFromInput',
        },
      },
    });
  }

  return {
    proposals,
    inputSummary: input.slice(0, 100) + (input.length > 100 ? '...' : ''),
    targetType: targetType || null,
    targetNodeId: targetNodeId || null,
  };
}
