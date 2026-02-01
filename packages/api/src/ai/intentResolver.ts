/**
 * Intent Resolver
 *
 * Lightweight heuristic resolver that combines optional structured intent
 * with freeform text and story state to select a generation strategy.
 */

// Avoid tight coupling to core types for coverage/gaps in this layer

export type ResolvedMode = 'storyBeats' | 'characters' | 'scenes' | 'expand' | 'interpret';

export interface OrchestrationIntent {
  mode?: 'storyBeats' | 'characters' | 'scenes' | 'expand';
  scope?: 'act1' | 'act2' | 'act3' | 'full';
  focus?: string[]; // beat IDs, node IDs, etc.
}

export interface IntentResolverInput {
  structured?: OrchestrationIntent;
  freeform?: string;
  storyState: {
    gaps: any[];
    coverage: unknown;
    nodeTypes?: Record<string, number>;
  };
}

export interface ResolvedIntent {
  mode: ResolvedMode;
  targets: string[];
  direction?: string;
  confidence: number;
  reasoning: string;
}

export function resolveIntent(input: IntentResolverInput): ResolvedIntent {
  const { structured, freeform, storyState } = input;

  // Priority 1: Structured intent provided
  if (structured?.mode) {
    const base = {
      mode: structured.mode,
      targets: structured.focus || [],
      confidence: 1.0,
      reasoning: 'User selected mode explicitly',
    } as ResolvedIntent;
    if (freeform && freeform.trim()) (base as any).direction = freeform;
    return base;
  }

  // Priority 2: Interpret from freeform text
  if (freeform && freeform.trim()) {
    return interpretFreeformIntent(freeform, storyState);
  }

  // Priority 3: Suggest based on state
  return suggestFromState(storyState);
}

function interpretFreeformIntent(
  text: string,
  _state: IntentResolverInput['storyState']
): ResolvedIntent {
  const lowerText = text.toLowerCase();

  if (/character|protagonist|antagonist|villain|hero/.test(lowerText)) {
    return {
      mode: 'characters',
      targets: [],
      direction: text,
      confidence: 0.8,
      reasoning: 'Detected character-related keywords',
    };
  }

  if (/scene|location|setting|int\.|ext\./.test(lowerText)) {
    return {
      mode: 'scenes',
      targets: [],
      direction: text,
      confidence: 0.8,
      reasoning: 'Detected scene-related keywords',
    };
  }

  if (/beat|catalyst|midpoint|act \d|structure/.test(lowerText)) {
    return {
      mode: 'storyBeats',
      targets: [],
      direction: text,
      confidence: 0.8,
      reasoning: 'Detected structure-related keywords',
    };
  }

  const base = {
    mode: 'interpret' as const,
    targets: [],
    confidence: 0.5,
    reasoning: 'No clear intent detected, using interpretation',
  };
  return text ? { ...base, direction: text } : base;
}

function suggestFromState(
  state: IntentResolverInput['storyState']
): ResolvedIntent {
  const priorityGap = [...(state.gaps ?? [])].sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  if (priorityGap && (priorityGap as any).beatId) {
    return {
      mode: 'storyBeats',
      targets: [(priorityGap as any).beatId as string],
      confidence: 0.6,
      reasoning: `Suggesting to fill ${String((priorityGap as any).beatType ?? 'structure')} gap`,
    };
  }
  return {
    mode: 'interpret',
    targets: [],
    confidence: 0.3,
    reasoning: 'No gaps detected, awaiting user direction',
  };
}
