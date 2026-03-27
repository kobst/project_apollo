/**
 * Converts Gap objects to human-readable problem statements.
 *
 * Used to auto-populate the `problemStatement` field on generation requests
 * when the user triggers generation from a coverage gap.
 */

import type { Gap } from './types.js';

/**
 * Convert a Gap to a human-readable narrative problem statement.
 *
 * The statement frames the gap as a creative problem to solve,
 * not just a missing checkbox. This helps the LLM generate
 * purpose-driven content rather than just filling a slot.
 */
export function gapToStatement(gap: Gap): string {
  const title = gap.title;
  const desc = gap.description;

  // Match known gap patterns and produce richer statements

  // --- Structure tier ---

  if (title.includes('Beat Unrealized') || title.includes('BeatUnrealized')) {
    const beatMatch = desc.match(/Beat "(\w+)"/);
    const beatName = beatMatch ? beatMatch[1] : 'this beat';
    return `The ${beatName} beat has no scenes realizing it — this story moment is undefined and needs creative development.`;
  }

  if (title.includes('ActImbalance') || (title.includes('Act') && desc.includes('no scenes'))) {
    const actMatch = desc.match(/Act (\d)/);
    const actNum = actMatch ? actMatch[1] : '?';
    return `Act ${actNum} has no scenes while neighboring acts have content — there is a structural gap in the story's progression.`;
  }

  // --- Scene tier ---

  if (desc.includes('no characters') || title.includes('Cast') || title.includes('No Cast')) {
    const sceneMatch = desc.match(/Scene "([^"]+)"/);
    const sceneName = sceneMatch ? sceneMatch[1] : 'a scene';
    return `Scene "${sceneName}" has no characters assigned — it cannot be dramatized without agents driving the action.`;
  }

  if (desc.includes('no location')) {
    const sceneMatch = desc.match(/Scene "([^"]+)"/);
    const sceneName = sceneMatch ? sceneMatch[1] : 'a scene';
    return `Scene "${sceneName}" has no location — it needs a physical setting to ground the action.`;
  }

  if (title.includes('Unlinked') || desc.includes('not connected to any PlotPoint')) {
    const sceneMatch = desc.match(/Scene "([^"]+)"/);
    const sceneName = sceneMatch ? sceneMatch[1] : 'a scene';
    return `Scene "${sceneName}" is not connected to any plot point — it exists outside the story's causal structure and has no narrative justification.`;
  }

  // --- Foundations tier ---

  if (title.includes('Missing Object') || desc.includes('No Object node')) {
    return `The story has no significant objects or props defined — items that carry symbolic weight, drive plot mechanics, or serve as setup/payoff anchors are absent.`;
  }

  if (title.includes('CharacterUnderspecified') || desc.includes('no description')) {
    const charMatch = desc.match(/Character "([^"]+)"/);
    const charName = charMatch ? charMatch[1] : 'a character';
    return `Character "${charName}" appears in multiple scenes but has no description — readers and the AI cannot reason about their behavior, appearance, or motivations.`;
  }

  if (title.includes('Missing Character Arc') || title.includes('MissingCharacterArc') || desc.includes('no arc defined')) {
    const charMatch = desc.match(/Character "([^"]+)"/);
    const charName = charMatch ? charMatch[1] : 'a character';
    return `Character "${charName}" appears in several scenes but has no defined arc — their transformation or trajectory through the story is unspecified.`;
  }

  if (title.includes('ArcUngrounded') || desc.includes('no turn')) {
    return `A character arc has no grounding in specific beats or scenes — it exists as an abstract intention but isn't connected to narrative moments.`;
  }

  // --- PlotPoint tier ---

  if ((title.includes('PlotPoint') || title.includes('Plot Point')) && desc.includes('no scenes')) {
    const ppMatch = desc.match(/PlotPoint "([^"]+)"/);
    const ppName = ppMatch ? ppMatch[1] : 'a plot point';
    return `Plot point "${ppName}" is approved but has no scenes realizing it — this narrative promise remains unfulfilled.`;
  }

  // --- Fallback ---
  return `Narrative gap: ${desc}`;
}

/**
 * Convert multiple gaps into a combined problem statement.
 * Groups related gaps and produces a concise multi-problem statement.
 */
export function gapsToStatement(gaps: Gap[]): string {
  if (gaps.length === 0) return '';
  if (gaps.length === 1) return gapToStatement(gaps[0]!);

  const statements = gaps.map(g => `- ${gapToStatement(g)}`);
  return `Multiple narrative problems to address:\n${statements.join('\n')}`;
}
