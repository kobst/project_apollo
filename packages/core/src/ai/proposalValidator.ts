/**
 * Proposal Validator
 *
 * Pre-flight validation for AI interpretation proposals.
 * Analyzes proposals against the existing knowledge graph to provide:
 * - Similarity detection (potential conflicts)
 * - Gap fulfillment analysis
 * - Connection suggestions
 * - Actionable warnings
 */

import type { GraphState } from '../core/graph.js';
import { getNodesByType, getAllNodes } from '../core/graph.js';
import type { Gap, GapTier } from '../coverage/types.js';
import type { EdgeType } from '../types/edges.js';
import type { InterpretationProposal } from './types.js';
import {
  calculateSimilarity,
  findMentions,
  type SimilarityType,
} from './textSimilarity.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of validating a proposal against the knowledge graph.
 */
export interface ProposalValidation {
  /** Similar existing nodes that might conflict */
  similarities: SimilarityMatch[];
  /** Gaps that would be fulfilled by this proposal */
  fulfillsGaps: GapMatch[];
  /** Suggested nodes to connect to */
  suggestedConnections: ConnectionSuggestion[];
  /** Warnings about the proposal */
  warnings: ProposalWarning[];
  /** Overall validation score (0-1, higher is better) */
  score: number;
}

/**
 * A match between proposed content and an existing node.
 */
export interface SimilarityMatch {
  /** ID of the existing node */
  existingNodeId: string;
  /** Type of the existing node */
  existingNodeType: string;
  /** Name/title of the existing node */
  existingNodeName: string;
  /** Which field matched (name, title, description, etc.) */
  matchedField: string;
  /** Similarity score (0-1) */
  similarity: number;
  /** Type of match */
  type: SimilarityType;
}

/**
 * A gap that would be fulfilled by the proposal.
 */
export interface GapMatch {
  /** ID of the gap */
  gapId: string;
  /** Title of the gap */
  gapTitle: string;
  /** Tier of the gap */
  gapTier: GapTier;
  /** How completely the proposal fulfills the gap */
  fulfillment: 'full' | 'partial';
  /** Explanation of the match */
  reason: string;
}

/**
 * A suggested connection to an existing node.
 */
export interface ConnectionSuggestion {
  /** ID of the node to connect to */
  nodeId: string;
  /** Type of the node */
  nodeType: string;
  /** Name/title of the node */
  nodeName: string;
  /** Suggested edge type */
  edgeType: EdgeType;
  /** Direction: 'from' means new node → existing, 'to' means existing → new node */
  direction: 'from' | 'to';
  /** Why this connection is suggested */
  reason: string;
  /** Confidence in the suggestion (0-1) */
  confidence: number;
}

/**
 * A warning about the proposal.
 */
export interface ProposalWarning {
  /** Warning code for programmatic handling */
  code: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'error';
  /** Human-readable message */
  message: string;
  /** Optional suggestion for resolution */
  suggestion?: string;
}

// =============================================================================
// Configuration
// =============================================================================

/** Minimum similarity score to report as a potential conflict */
const SIMILARITY_WARNING_THRESHOLD = 0.6;

/** Similarity score for exact match warnings */
const EXACT_MATCH_THRESHOLD = 0.95;

/** Mapping from node types to their coverage tier */
const NODE_TYPE_TO_TIER: Record<string, GapTier> = {
  Logline: 'premise',
  Setting: 'foundations',
  GenreTone: 'foundations',
  Character: 'foundations',
  Location: 'foundations',
  Object: 'foundations',
  Beat: 'structure',
  StoryBeat: 'storyBeats',
  Scene: 'scenes',
};

/** Fields to check for similarity by node type */
const SIMILARITY_FIELDS: Record<string, string[]> = {
  Character: ['name', 'archetype'],
  Location: ['name'],
  Object: ['name'],
  Scene: ['heading', 'title'],
  StoryBeat: ['title'],
  Idea: ['title'],
  Setting: ['name'],
  GenreTone: ['genre', 'tone'],
};

/** Valid edges from new node type to existing target types */
const OUTGOING_EDGES: Record<string, Array<{ edgeType: EdgeType; targetType: string }>> = {
  Scene: [
    { edgeType: 'HAS_CHARACTER', targetType: 'Character' },
    { edgeType: 'LOCATED_AT', targetType: 'Location' },
    { edgeType: 'FEATURES_OBJECT', targetType: 'Object' },
    { edgeType: 'SET_IN', targetType: 'Setting' },
  ],
  Character: [
    { edgeType: 'HAS_ARC', targetType: 'CharacterArc' },
  ],
  Location: [
    { edgeType: 'PART_OF', targetType: 'Setting' },
  ],
  StoryBeat: [
    { edgeType: 'ALIGNS_WITH', targetType: 'Beat' },
    { edgeType: 'PRECEDES', targetType: 'StoryBeat' },
    { edgeType: 'ADVANCES', targetType: 'CharacterArc' },
  ],
};

/** Valid edges from existing source types to new node */
const INCOMING_EDGES: Record<string, Array<{ edgeType: EdgeType; sourceType: string }>> = {
  Character: [
    { edgeType: 'HAS_CHARACTER', sourceType: 'Scene' },
  ],
  Location: [
    { edgeType: 'LOCATED_AT', sourceType: 'Scene' },
  ],
  Object: [
    { edgeType: 'FEATURES_OBJECT', sourceType: 'Scene' },
  ],
  CharacterArc: [
    { edgeType: 'HAS_ARC', sourceType: 'Character' },
    { edgeType: 'ADVANCES', sourceType: 'StoryBeat' },
  ],
  Beat: [
    { edgeType: 'ALIGNS_WITH', sourceType: 'StoryBeat' },
  ],
  Scene: [
    { edgeType: 'SATISFIED_BY', sourceType: 'StoryBeat' },
  ],
  Setting: [
    { edgeType: 'PART_OF', sourceType: 'Location' },
    { edgeType: 'SET_IN', sourceType: 'Scene' },
  ],
};

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate a proposal against the knowledge graph.
 *
 * @param graph - Current story graph state
 * @param proposal - The interpretation proposal to validate
 * @param gaps - Current gaps in the story
 * @returns Validation results with similarities, gaps, connections, and warnings
 */
export function validateProposal(
  graph: GraphState,
  proposal: InterpretationProposal,
  gaps: Gap[]
): ProposalValidation {
  // Only validate node proposals
  if (proposal.type !== 'node' || !proposal.target_type) {
    return {
      similarities: [],
      fulfillsGaps: [],
      suggestedConnections: [],
      warnings: [],
      score: 1.0,
    };
  }

  const nodeType = proposal.target_type;
  const data = proposal.data;

  // Run validation checks
  const similarities = findSimilarNodes(graph, nodeType, data);
  const fulfillsGaps = checkGapFulfillment(gaps, nodeType, data);
  const suggestedConnections = suggestConnections(graph, nodeType, data);
  const warnings = generateWarnings(similarities, fulfillsGaps, suggestedConnections, nodeType);

  // Calculate overall score
  const score = calculateScore(similarities, fulfillsGaps, warnings);

  return {
    similarities,
    fulfillsGaps,
    suggestedConnections,
    warnings,
    score,
  };
}

// =============================================================================
// Similarity Detection
// =============================================================================

/**
 * Find existing nodes that are similar to the proposed node.
 */
export function findSimilarNodes(
  graph: GraphState,
  nodeType: string,
  data: Record<string, unknown>
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = [];

  // Get fields to check for this node type
  const fieldsToCheck = SIMILARITY_FIELDS[nodeType] ?? ['name', 'title'];

  // Get proposed values for each field
  const proposedValues: Record<string, string> = {};
  for (const field of fieldsToCheck) {
    const value = data[field];
    if (typeof value === 'string' && value.trim()) {
      proposedValues[field] = value.trim();
    }
  }

  if (Object.keys(proposedValues).length === 0) {
    return matches;
  }

  // Get existing nodes of the same type to compare
  const existingNodes = getNodesByType(graph, nodeType);

  for (const node of existingNodes) {
    const nodeData = node as unknown as Record<string, unknown>;

    for (const [field, proposedValue] of Object.entries(proposedValues)) {
      const existingValue = nodeData[field];
      if (typeof existingValue !== 'string' || !existingValue.trim()) {
        continue;
      }

      const { score, type } = calculateSimilarity(proposedValue, existingValue);

      if (score >= SIMILARITY_WARNING_THRESHOLD) {
        matches.push({
          existingNodeId: node.id,
          existingNodeType: node.type,
          existingNodeName: getNodeNameOrId(nodeData),
          matchedField: field,
          similarity: score,
          type,
        });
      }
    }
  }

  // Sort by similarity score descending
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches;
}

// =============================================================================
// Gap Fulfillment
// =============================================================================

/**
 * Check if a gap title indicates the node type is what's MISSING (primary subject).
 * Returns true for patterns like "Missing Character", "No Character defined"
 * Returns false for patterns like "Scene Without Character" (the gap is about Scene, not Character)
 */
function gapIndicatesMissingType(gapTitle: string, nodeType: string): boolean {
  const title = gapTitle.toLowerCase();
  const type = nodeType.toLowerCase();

  // Patterns where the node type is the PRIMARY missing element
  const missingPatterns = [
    new RegExp(`^missing\\s+${type}`, 'i'),      // "Missing Character..."
    new RegExp(`^no\\s+${type}`, 'i'),           // "No Character..."
    new RegExp(`^${type}\\s+missing`, 'i'),      // "Character missing..."
    new RegExp(`^${type}\\s+needed`, 'i'),       // "Character needed..."
    new RegExp(`^add\\s+${type}`, 'i'),          // "Add Character..."
    new RegExp(`^create\\s+${type}`, 'i'),       // "Create Character..."
    new RegExp(`^needs?\\s+${type}$`, 'i'),      // "Need Character" (exact)
  ];

  for (const pattern of missingPatterns) {
    if (pattern.test(title)) {
      return true;
    }
  }

  // Patterns where the node type is mentioned but NOT the primary subject
  // (the gap is about something else that needs/lacks this type)
  const secondaryPatterns = [
    new RegExp(`without\\s+${type}`, 'i'),       // "Scene Without Character"
    new RegExp(`needs?\\s+${type}`, 'i'),        // "Scene Needs Character" (but not "Needs Character" alone)
    new RegExp(`lacks?\\s+${type}`, 'i'),        // "Scene Lacks Character"
    new RegExp(`missing\\s+${type}\\s+connection`, 'i'), // "Missing Character Connection"
  ];

  // If it matches a secondary pattern but NOT a missing pattern, it's not a direct match
  for (const pattern of secondaryPatterns) {
    if (pattern.test(title)) {
      return false;
    }
  }

  // Fallback: if the type appears but none of our patterns match,
  // it's probably not a direct "missing this type" gap
  return false;
}

/**
 * Check which gaps would be fulfilled by adding this node.
 */
export function checkGapFulfillment(
  gaps: Gap[],
  nodeType: string,
  _data: Record<string, unknown>
): GapMatch[] {
  const matches: GapMatch[] = [];

  // Get the tier this node type belongs to
  const nodeTier = NODE_TYPE_TO_TIER[nodeType];
  if (!nodeTier) {
    return matches;
  }

  // Filter to open gaps only
  const openGaps = gaps.filter((g) => g.status === 'open');

  for (const gap of openGaps) {
    // Check if the gap specifically indicates this type is MISSING (primary subject)
    const typeIsMissing = gapIndicatesMissingType(gap.title, nodeType);

    // Check for tier match
    const tierMatch = gap.tier === nodeTier;

    if (typeIsMissing) {
      matches.push({
        gapId: gap.id,
        gapTitle: gap.title,
        gapTier: gap.tier,
        fulfillment: 'full',
        reason: `Adding a ${nodeType} directly addresses this gap`,
      });
    } else if (tierMatch && gap.type === 'structural') {
      // Partial match: same tier structural gap (only if no secondary pattern match)
      const title = gap.title.toLowerCase();
      const type = nodeType.toLowerCase();
      // Skip if this gap is about something ELSE needing this type
      const isSecondaryReference =
        title.includes(`without ${type}`) ||
        title.includes(`needs ${type}`) ||
        title.includes(`lacks ${type}`);

      if (!isSecondaryReference) {
        matches.push({
          gapId: gap.id,
          gapTitle: gap.title,
          gapTier: gap.tier,
          fulfillment: 'partial',
          reason: `This ${nodeType} may help address ${gap.tier} tier gaps`,
        });
      }
    }
  }

  // Sort by fulfillment (full first) then by tier order
  const tierOrder: GapTier[] = ['premise', 'foundations', 'structure', 'storyBeats', 'scenes'];
  matches.sort((a, b) => {
    if (a.fulfillment !== b.fulfillment) {
      return a.fulfillment === 'full' ? -1 : 1;
    }
    return tierOrder.indexOf(a.gapTier) - tierOrder.indexOf(b.gapTier);
  });

  return matches;
}

// =============================================================================
// Connection Suggestions
// =============================================================================

/**
 * Suggest connections to existing nodes based on content and type.
 */
export function suggestConnections(
  graph: GraphState,
  nodeType: string,
  data: Record<string, unknown>
): ConnectionSuggestion[] {
  const suggestions: ConnectionSuggestion[] = [];

  // Get description/overview text to scan for mentions
  const textToScan = getDescriptionText(data);

  // Build a map of node names to nodes for mention detection
  const allNodes = getAllNodes(graph);
  const nameToNode = new Map<string, { id: string; type: string; name: string }>();

  for (const node of allNodes) {
    const nodeData = node as unknown as Record<string, unknown>;
    const name = getNodeName(nodeData);
    if (name) {
      nameToNode.set(name, { id: node.id, type: node.type, name });
    }
  }

  // Find mentions in description text
  if (textToScan) {
    const nodeNames = Array.from(nameToNode.keys());
    const mentions = findMentions(textToScan, nodeNames);

    for (const mention of mentions) {
      const nodeInfo = nameToNode.get(mention.value);
      if (!nodeInfo) continue;

      // Determine valid edge type for this connection
      const edgeInfo = getValidEdge(nodeType, nodeInfo.type);
      if (edgeInfo) {
        suggestions.push({
          nodeId: nodeInfo.id,
          nodeType: nodeInfo.type,
          nodeName: nodeInfo.name,
          edgeType: edgeInfo.edgeType,
          direction: edgeInfo.direction,
          reason: `"${nodeInfo.name}" is mentioned in the description`,
          confidence: 0.8,
        });
      }
    }
  }

  // Suggest structural connections based on node type
  const outgoing = OUTGOING_EDGES[nodeType] ?? [];
  for (const { edgeType, targetType } of outgoing) {
    const targets = getNodesByType(graph, targetType);

    // Filter to nodes with meaningful names and limit suggestions
    let suggestionsAdded = 0;
    const maxSuggestionsPerType = 3;

    for (const target of targets) {
      if (suggestionsAdded >= maxSuggestionsPerType) break;

      const targetData = target as unknown as Record<string, unknown>;
      const targetName = getNodeName(targetData);

      // Skip nodes without meaningful names
      if (!targetName) continue;

      // Skip if already suggested via mention
      if (suggestions.some((s) => s.nodeId === target.id)) {
        continue;
      }

      suggestions.push({
        nodeId: target.id,
        nodeType: target.type,
        nodeName: targetName,
        edgeType,
        direction: 'from',
        reason: `${nodeType} nodes typically connect to ${targetType} nodes`,
        confidence: 0.5,
      });
      suggestionsAdded++;
    }
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  // Limit to top 5 suggestions
  return suggestions.slice(0, 5);
}

// =============================================================================
// Warning Generation
// =============================================================================

/**
 * Generate warnings based on validation results.
 */
export function generateWarnings(
  similarities: SimilarityMatch[],
  gapMatches: GapMatch[],
  connections: ConnectionSuggestion[],
  nodeType: string
): ProposalWarning[] {
  const warnings: ProposalWarning[] = [];

  // Exact or near-exact match warnings
  const exactMatches = similarities.filter((s) => s.similarity >= EXACT_MATCH_THRESHOLD);
  if (exactMatches.length > 0) {
    for (const match of exactMatches) {
      warnings.push({
        code: 'EXACT_DUPLICATE',
        severity: 'error',
        message: `A ${match.existingNodeType} with the same ${match.matchedField} "${match.existingNodeName}" already exists`,
        suggestion: `Consider modifying the existing node instead of creating a duplicate`,
      });
    }
  }

  // High similarity warnings
  const highSimilarity = similarities.filter(
    (s) => s.similarity >= SIMILARITY_WARNING_THRESHOLD && s.similarity < EXACT_MATCH_THRESHOLD
  );
  if (highSimilarity.length > 0) {
    const names = highSimilarity.map((s) => s.existingNodeName).join(', ');
    warnings.push({
      code: 'SIMILAR_EXISTS',
      severity: 'warning',
      message: `Similar ${nodeType}(s) already exist: ${names}`,
      suggestion: `Review existing nodes to ensure this isn't a duplicate`,
    });
  }

  // No gap fulfillment info message
  if (gapMatches.length === 0) {
    warnings.push({
      code: 'NO_GAP_MATCH',
      severity: 'info',
      message: `This ${nodeType} doesn't directly address any current story gaps`,
    });
  }

  // Connection suggestions info
  if (connections.length > 0) {
    const connectionNames = connections.slice(0, 3).map((c) => c.nodeName).join(', ');
    warnings.push({
      code: 'CONNECTION_AVAILABLE',
      severity: 'info',
      message: `Consider connecting to: ${connectionNames}`,
    });
  }

  return warnings;
}

// =============================================================================
// Score Calculation
// =============================================================================

/**
 * Calculate an overall validation score.
 * Higher is better (1.0 = no issues, lower = more concerns).
 */
function calculateScore(
  similarities: SimilarityMatch[],
  gapMatches: GapMatch[],
  warnings: ProposalWarning[]
): number {
  let score = 1.0;

  // Deduct for exact duplicates
  const exactMatches = similarities.filter((s) => s.similarity >= EXACT_MATCH_THRESHOLD);
  score -= exactMatches.length * 0.3;

  // Deduct for high similarity
  const highSimilarity = similarities.filter(
    (s) => s.similarity >= SIMILARITY_WARNING_THRESHOLD && s.similarity < EXACT_MATCH_THRESHOLD
  );
  score -= highSimilarity.length * 0.1;

  // Bonus for gap fulfillment
  const fullFulfillment = gapMatches.filter((g) => g.fulfillment === 'full');
  score += fullFulfillment.length * 0.1;

  // Deduct for error-level warnings
  const errors = warnings.filter((w) => w.severity === 'error');
  score -= errors.length * 0.2;

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a display name for a node.
 * Returns null if no meaningful name can be found (only ID available).
 */
function getNodeName(nodeData: Record<string, unknown>): string | null {
  // Try common name fields
  const name = nodeData.name ?? nodeData.title ?? nodeData.heading ?? nodeData.text;
  if (name && typeof name === 'string' && name.trim()) {
    return name.trim();
  }
  // No meaningful name found
  return null;
}

/**
 * Get a display name for a node, with fallback to ID.
 */
function getNodeNameOrId(nodeData: Record<string, unknown>): string {
  const name = getNodeName(nodeData);
  if (name) return name;

  // Fall back to node ID (truncated for readability)
  const id = nodeData.id;
  if (id && typeof id === 'string') {
    // Format: "char_abc123" -> "char_abc..."
    if (id.length > 15) {
      return id.substring(0, 12) + '...';
    }
    return id;
  }
  return 'Untitled';
}

/**
 * Get description text from node data.
 */
function getDescriptionText(data: Record<string, unknown>): string {
  const parts: string[] = [];

  if (typeof data.description === 'string') parts.push(data.description);
  if (typeof data.scene_overview === 'string') parts.push(data.scene_overview);
  if (typeof data.summary === 'string') parts.push(data.summary);
  if (typeof data.content === 'string') parts.push(data.content);

  return parts.join(' ');
}

/**
 * Get valid edge type between two node types.
 */
function getValidEdge(
  sourceType: string,
  targetType: string
): { edgeType: EdgeType; direction: 'from' | 'to' } | null {
  // Check outgoing edges from source type
  const outgoing = OUTGOING_EDGES[sourceType] ?? [];
  for (const { edgeType, targetType: t } of outgoing) {
    if (t === targetType) {
      return { edgeType, direction: 'from' };
    }
  }

  // Check incoming edges to source type
  const incoming = INCOMING_EDGES[sourceType] ?? [];
  for (const { edgeType, sourceType: s } of incoming) {
    if (s === targetType) {
      return { edgeType, direction: 'to' };
    }
  }

  return null;
}
