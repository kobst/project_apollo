/**
 * Text similarity utilities for comparing proposal content against existing nodes.
 *
 * Provides functions for:
 * - Text normalization
 * - Levenshtein distance calculation
 * - Similarity scoring (0-1 scale)
 */

// =============================================================================
// Text Normalization
// =============================================================================

/**
 * Normalize text for comparison.
 * Lowercases, removes punctuation, and collapses whitespace.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// Levenshtein Distance
// =============================================================================

/**
 * Calculate the Levenshtein (edit) distance between two strings.
 * Uses dynamic programming for O(m*n) time and O(min(m,n)) space.
 */
export function levenshteinDistance(a: string, b: string): number {
  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const m = a.length;
  const n = b.length;

  // Use single array optimization
  let prev = new Array(m + 1);
  let curr = new Array(m + 1);

  // Initialize base case
  for (let i = 0; i <= m; i++) {
    prev[i] = i;
  }

  // Fill the matrix
  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,      // deletion
        curr[i - 1] + 1,  // insertion
        prev[i - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}

// =============================================================================
// Similarity Types
// =============================================================================

export type SimilarityType = 'exact' | 'fuzzy' | 'partial';

export interface SimilarityResult {
  score: number;
  type: SimilarityType;
}

// =============================================================================
// Similarity Calculation
// =============================================================================

/** Threshold for "partial" matches (substring containment) */
const PARTIAL_MATCH_THRESHOLD = 0.8;

/** Threshold for considering a match significant */
const SIMILARITY_THRESHOLD = 0.5;

/**
 * Calculate similarity score between two strings.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Similarity result with score (0-1) and match type
 */
export function calculateSimilarity(a: string, b: string): SimilarityResult {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  // Handle empty strings
  if (!normA || !normB) {
    return { score: 0, type: 'fuzzy' };
  }

  // Exact match
  if (normA === normB) {
    return { score: 1.0, type: 'exact' };
  }

  // Partial match (substring containment)
  if (normA.includes(normB) || normB.includes(normA)) {
    // Score based on how much of the longer string is covered
    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length >= normB.length ? normA : normB;
    const coverage = shorter.length / longer.length;
    return { score: Math.max(coverage, PARTIAL_MATCH_THRESHOLD), type: 'partial' };
  }

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  const score = 1 - (distance / maxLen);

  return { score: Math.max(0, score), type: 'fuzzy' };
}

/**
 * Check if similarity score is above threshold.
 */
export function isSimilar(score: number, threshold = SIMILARITY_THRESHOLD): boolean {
  return score >= threshold;
}

// =============================================================================
// Batch Comparison
// =============================================================================

export interface ComparisonResult {
  value: string;
  score: number;
  type: SimilarityType;
}

/**
 * Compare a query string against multiple candidates.
 *
 * @param query - The string to match
 * @param candidates - Array of strings to compare against
 * @param threshold - Minimum similarity score to include (default 0.5)
 * @returns Array of matches above threshold, sorted by score descending
 */
export function findSimilarStrings(
  query: string,
  candidates: string[],
  threshold = SIMILARITY_THRESHOLD
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  for (const candidate of candidates) {
    const { score, type } = calculateSimilarity(query, candidate);
    if (score >= threshold) {
      results.push({ value: candidate, score, type });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Find mentions of any candidate strings within a text.
 * Useful for detecting references to existing nodes in descriptions.
 *
 * @param text - The text to search in
 * @param candidates - Array of strings to look for
 * @returns Array of found candidates with their positions
 */
export function findMentions(
  text: string,
  candidates: string[]
): Array<{ value: string; position: number }> {
  const normalizedText = normalizeText(text);
  const results: Array<{ value: string; position: number }> = [];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate);
    if (!normalizedCandidate) continue;

    const position = normalizedText.indexOf(normalizedCandidate);
    if (position !== -1) {
      results.push({ value: candidate, position });
    }
  }

  // Sort by position in text
  results.sort((a, b) => a.position - b.position);

  return results;
}
