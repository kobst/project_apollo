/**
 * Entity mention extraction from text content.
 */

import { escapeRegex } from './utils.js';

/**
 * Information about an entity that can be mentioned.
 */
export interface EntityInfo {
  id: string;
  type: 'Character' | 'Location' | 'Object';
  name: string;
  aliases?: string[] | undefined;
}

/**
 * A matched mention of an entity in text.
 */
export interface MentionMatch {
  entityId: string;
  entityType: 'Character' | 'Location' | 'Object';
  matchedText: string;
  confidence: number;
}

/**
 * Pattern for matching entity names with confidence.
 */
interface MatchPattern {
  regex: RegExp;
  confidence: number;
  variant: string;
}

/**
 * Build match patterns for an entity name.
 * Returns patterns ordered by specificity (most specific first).
 */
function buildPatterns(name: string, aliases: string[] = []): MatchPattern[] {
  const patterns: MatchPattern[] = [];
  
  // Exact full name match (highest confidence)
  patterns.push({
    regex: new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi'),
    confidence: 1.0,
    variant: name
  });
  
  // Possessive form of full name
  patterns.push({
    regex: new RegExp(`\\b${escapeRegex(name)}'s\\b`, 'gi'),
    confidence: 1.0,
    variant: `${name}'s`
  });
  
  // Aliases (high confidence)
  for (const alias of aliases) {
    if (alias && alias.trim()) {
      patterns.push({
        regex: new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi'),
        confidence: 0.95,
        variant: alias
      });
      // Possessive form of alias
      patterns.push({
        regex: new RegExp(`\\b${escapeRegex(alias)}'s\\b`, 'gi'),
        confidence: 0.95,
        variant: `${alias}'s`
      });
    }
  }
  
  // First name only (if name has multiple parts) - lower confidence
  const nameParts = name.split(/\s+/);
  if (nameParts.length > 1) {
    const firstName = nameParts[0];
    if (firstName && firstName.length > 2) {
      patterns.push({
        regex: new RegExp(`\\b${escapeRegex(firstName)}\\b`, 'gi'),
        confidence: 0.7,
        variant: firstName
      });
    }
    
    // Last name only (also lower confidence)
    const lastName = nameParts[nameParts.length - 1];
    if (lastName && lastName.length > 2 && lastName !== firstName) {
      patterns.push({
        regex: new RegExp(`\\b${escapeRegex(lastName)}\\b`, 'gi'),
        confidence: 0.7,
        variant: lastName
      });
    }
  }
  
  // Title + last name (e.g., "Captain Morrison")
  const titleMatch = name.match(/^(Captain|Sergeant|Detective|Dr\.|Mr\.|Mrs\.|Ms\.)\s+(.+)/i);
  if (titleMatch && titleMatch[1] && titleMatch[2]) {
    const titleVariant = `${titleMatch[1]} ${titleMatch[2].split(/\s+/).pop()}`;
    patterns.push({
      regex: new RegExp(`\\b${escapeRegex(titleVariant)}\\b`, 'gi'),
      confidence: 0.85,
      variant: titleVariant
    });
  }
  
  return patterns;
}

/**
 * Check if text matches a pattern.
 */
function matchesPattern(text: string, pattern: MatchPattern): string | null {
  const match = text.match(pattern.regex);
  return match ? match[0] : null;
}

/**
 * Extract entity mentions from text.
 * 
 * @param text - The text to search for mentions
 * @param entities - Array of entities to look for
 * @returns Array of matched mentions (one per entity, highest confidence match)
 */
export function extractMentions(
  text: string,
  entities: EntityInfo[]
): MentionMatch[] {
  if (!text || !entities.length) return [];
  
  const mentions: MentionMatch[] = [];
  
  for (const entity of entities) {
    const patterns = buildPatterns(entity.name, entity.aliases);
    
    // Try patterns in order (most specific first)
    for (const pattern of patterns) {
      const matched = matchesPattern(text, pattern);
      if (matched) {
        mentions.push({
          entityId: entity.id,
          entityType: entity.type,
          matchedText: matched,
          confidence: pattern.confidence
        });
        break; // One match per entity is enough
      }
    }
  }
  
  return mentions;
}

/**
 * Extract all text content from a node's data.
 * 
 * @param data - Node data object
 * @param fields - Fields to extract from
 * @returns Concatenated text from all fields
 */
export function extractTextFromNode(
  data: Record<string, unknown>,
  fields: string[]
): string {
  const texts: string[] = [];
  
  for (const field of fields) {
    const value = data[field];
    
    if (typeof value === 'string') {
      texts.push(value);
    } else if (Array.isArray(value)) {
      // Handle array fields like key_actions
      for (const item of value) {
        if (typeof item === 'string') {
          texts.push(item);
        }
      }
    }
  }
  
  return texts.join(' ');
}
