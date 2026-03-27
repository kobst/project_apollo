/**
 * Parses LLM critique responses into PackageCritique objects.
 */

import type { PackageCritique } from './types.js';

/**
 * Parse a critique response string (JSON) into an array of PackageCritique objects.
 *
 * Handles:
 * - Raw JSON array
 * - JSON wrapped in markdown code blocks
 * - Partial/malformed responses (returns what can be parsed)
 */
export function parseCritiqueResponse(response: string): PackageCritique[] {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1]!.trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      // Single critique object — wrap in array
      if (parsed && typeof parsed === 'object' && parsed.packageId) {
        return [normalizeCritique(parsed)];
      }
      return [];
    }

    return parsed
      .filter((item: unknown) => item && typeof item === 'object')
      .map((item: unknown) => normalizeCritique(item as Record<string, unknown>));
  } catch {
    // Try to extract individual JSON objects if the array parse failed
    const objectMatches = cleaned.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    const results: PackageCritique[] = [];
    for (const match of objectMatches) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj.packageId) {
          results.push(normalizeCritique(obj));
        }
      } catch {
        // Skip unparseable objects
      }
    }
    return results;
  }
}

/**
 * Normalize a raw parsed object into a PackageCritique.
 * Provides defaults for missing fields.
 */
function normalizeCritique(raw: Record<string, unknown>): PackageCritique {
  return {
    packageId: String(raw.packageId ?? ''),
    strengths: normalizeStringArray(raw.strengths),
    weaknesses: normalizeStringArray(raw.weaknesses),
    thematicFit: normalizeThematicFit(raw.thematicFit),
    structuralRisks: normalizeStringArray(raw.structuralRisks),
    tradeoffProfile: String(raw.tradeoffProfile ?? 'No tradeoff analysis provided.'),
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return [];
}

function normalizeThematicFit(value: unknown): 'strong' | 'moderate' | 'weak' {
  if (value === 'strong' || value === 'moderate' || value === 'weak') {
    return value;
  }
  return 'moderate'; // default
}
