/**
 * Package Validation
 * 
 * Validates NarrativePackages against the graph state,
 * including temporal consistency via the mentions system.
 */

import type { GraphState } from '../core/graph.js';
import type { NarrativePackage, TemporalViolationInfo, MissingDependencyInfo } from './types.js';
import { validateProposalMentions } from '../mentions/validation.js';

/**
 * Validation result for a package.
 */
export interface PackageValidationResult {
  /** Whether the package is valid (no errors) */
  valid: boolean;
  /** Temporal violations (warnings, not blocking) */
  temporalViolations: TemporalViolationInfo[];
  /** Missing dependencies (warnings, not blocking) */
  missingDependencies: MissingDependencyInfo[];
  /** Total warning count */
  warningCount: number;
}

/**
 * Validate a single package against the graph state.
 * 
 * Checks:
 * - Temporal consistency (entities mentioned before introduction)
 * - Missing dependencies (referenced entities that don't exist)
 */
export function validatePackage(
  pkg: NarrativePackage,
  graph: GraphState
): PackageValidationResult {
  // Run temporal validation via mentions system
  const mentionsViolations = validateProposalMentions(pkg, graph);
  
  // Convert to TemporalViolationInfo format
  const temporalViolations: TemporalViolationInfo[] = mentionsViolations.map(v => ({
    nodeId: v.nodeId,
    nodeType: v.nodeType,
    entityId: v.mentionedEntity,
    entityName: v.mentionedEntityName,
    atBeat: v.atBeat,
    atPosition: v.atPosition,
    introducedAtBeat: v.introducedAtBeat,
    introducedAtPosition: v.introducedAtPosition,
    message: v.message
  }));
  
  // Check for missing dependencies (entities referenced but not in graph or proposal)
  const missingDependencies = findMissingDependencies(pkg, graph);
  
  const warningCount = temporalViolations.length + missingDependencies.length;
  
  return {
    valid: true, // Warnings don't block, only errors would
    temporalViolations,
    missingDependencies,
    warningCount
  };
}

/**
 * Validate packages and attach validation results to each.
 * Returns the packages with validation field populated.
 */
export function validatePackages(
  packages: NarrativePackage[],
  graph: GraphState
): NarrativePackage[] {
  return packages.map(pkg => {
    const validation = validatePackage(pkg, graph);
    
    // Only attach validation if there are warnings
    if (validation.warningCount === 0) {
      return pkg;
    }
    
    // Build validation object, only including non-empty arrays
    const validationResult: NonNullable<NarrativePackage['validation']> = {};
    
    if (validation.temporalViolations.length > 0) {
      validationResult.temporalViolations = validation.temporalViolations;
    }
    if (validation.missingDependencies.length > 0) {
      validationResult.missingDependencies = validation.missingDependencies;
    }
    
    return {
      ...pkg,
      validation: validationResult
    };
  });
}

/**
 * Find missing dependencies in a package.
 * Checks edge references to entities that don't exist.
 */
function findMissingDependencies(
  pkg: NarrativePackage,
  graph: GraphState
): MissingDependencyInfo[] {
  const missing: MissingDependencyInfo[] = [];
  
  // Build set of existing node IDs
  const existingIds = new Set(graph.nodes.keys());
  
  // Build set of proposed node IDs
  const proposedIds = new Set(
    pkg.changes.nodes
      .filter(n => n.operation === 'add')
      .map(n => n.node_id)
  );
  
  // Check edges for references to non-existent nodes
  for (const edge of pkg.changes.edges) {
    if (edge.operation !== 'add') continue;
    
    // Check 'from' reference
    if (!existingIds.has(edge.from) && !proposedIds.has(edge.from)) {
      missing.push({
        nodeId: edge.from,
        nodeType: 'unknown',
        dependencyType: 'missing_edge',
        dependencyId: edge.from,
        message: `Edge references non-existent source node: ${edge.from}`
      });
    }
    
    // Check 'to' reference (for entity-related edges)
    if (!existingIds.has(edge.to) && !proposedIds.has(edge.to)) {
      // Skip Beat references (expected to exist)
      if (edge.to.startsWith('beat_')) continue;
      
      missing.push({
        nodeId: edge.to,
        nodeType: 'unknown',
        dependencyType: 'missing_edge',
        dependencyId: edge.to,
        message: `Edge references non-existent target node: ${edge.to}`
      });
    }
  }
  
  // Check HAS_CHARACTER edges specifically for character introductions
  for (const edge of pkg.changes.edges) {
    if (edge.operation === 'add' && edge.edge_type === 'HAS_CHARACTER') {
      const charId = edge.to;
      const charExists = existingIds.has(charId) || proposedIds.has(charId);
      
      if (!charExists) {
        // Get character name from proposed nodes if available
        const proposedChar = pkg.changes.nodes.find(
          n => n.node_id === charId && n.node_type === 'Character'
        );
        const charName = (proposedChar?.data as Record<string, unknown>)?.name as string;
        
        missing.push({
          nodeId: edge.from, // The scene
          nodeType: 'Scene',
          dependencyType: 'character_not_introduced',
          dependencyId: charId,
          dependencyName: charName,
          message: `Scene references character "${charName || charId}" that doesn't exist`
        });
      }
    }
  }
  
  // Deduplicate by dependencyId
  const seen = new Set<string>();
  return missing.filter(m => {
    const key = m.dependencyId || m.nodeId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get a summary of validation warnings for logging.
 */
export function getValidationSummary(packages: NarrativePackage[]): string {
  let totalTemporal = 0;
  let totalMissing = 0;
  
  for (const pkg of packages) {
    totalTemporal += pkg.validation?.temporalViolations?.length ?? 0;
    totalMissing += pkg.validation?.missingDependencies?.length ?? 0;
  }
  
  if (totalTemporal === 0 && totalMissing === 0) {
    return 'No validation warnings';
  }
  
  const parts: string[] = [];
  if (totalTemporal > 0) {
    parts.push(`${totalTemporal} temporal violation${totalTemporal > 1 ? 's' : ''}`);
  }
  if (totalMissing > 0) {
    parts.push(`${totalMissing} missing dependenc${totalMissing > 1 ? 'ies' : 'y'}`);
  }
  
  return parts.join(', ');
}
