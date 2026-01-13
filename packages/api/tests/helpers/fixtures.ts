/**
 * Test fixtures for API tests.
 */

import type { NarrativePackage } from '@apollo/core';
import type { GenerationEntryPoint } from '../../src/session.js';

// =============================================================================
// Story Fixtures
// =============================================================================

/**
 * Create a mock versioned state.
 */
export function createMockVersionedState(overrides: Partial<{
  metadata: Record<string, unknown>;
  history: {
    currentVersionId: string;
    versions: Record<string, unknown>;
  };
}> = {}) {
  return {
    metadata: {
      name: 'Test Story',
      logline: 'A test story for unit tests',
      storyContext: '## Themes\n- Testing',
      ...overrides.metadata,
    },
    history: {
      currentVersionId: 'sv_001',
      versions: {
        sv_001: {
          id: 'sv_001',
          graph: {
            nodes: [],
            edges: [],
          },
        },
      },
      ...overrides.history,
    },
  };
}

// =============================================================================
// Generation Fixtures
// =============================================================================

/**
 * Create a mock generation entry point.
 */
export function createMockEntryPoint(
  type: GenerationEntryPoint['type'] = 'beat',
  targetId?: string
): GenerationEntryPoint {
  return {
    type,
    targetId: targetId ?? (type === 'naked' ? undefined : `${type}_001`),
  };
}

/**
 * Create a mock narrative package.
 */
export function createMockNarrativePackage(overrides: Partial<NarrativePackage> = {}): NarrativePackage {
  return {
    id: overrides.id ?? `pkg_${Date.now()}_test`,
    title: overrides.title ?? 'Test Package',
    rationale: overrides.rationale ?? 'Test rationale',
    confidence: overrides.confidence ?? 0.85,
    style_tags: overrides.style_tags ?? ['test'],
    changes: overrides.changes ?? {
      nodes: [],
      edges: [],
    },
    impact: overrides.impact ?? {
      fulfills_gaps: [],
      creates_gaps: [],
      conflicts: [],
    },
    ...overrides,
  };
}

/**
 * Create a mock generation session.
 */
export function createMockGenerationSession(overrides: Partial<{
  id: string;
  storyId: string;
  status: 'active' | 'accepted' | 'abandoned';
  entryPoint: GenerationEntryPoint;
  packages: NarrativePackage[];
  currentPackageId?: string;
}> = {}) {
  return {
    id: overrides.id ?? 'session_001',
    storyId: overrides.storyId ?? 'story_001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: overrides.status ?? 'active',
    entryPoint: overrides.entryPoint ?? createMockEntryPoint(),
    initialParams: {
      depth: 'medium',
      count: 'few',
    },
    packages: overrides.packages ?? [createMockNarrativePackage()],
    currentPackageId: overrides.currentPackageId,
  };
}

// =============================================================================
// LLM Response Fixtures
// =============================================================================

/**
 * Create a mock generation LLM response.
 */
export function createMockGenerationLLMResponse(packages: NarrativePackage[] = []): string {
  const pkgs = packages.length > 0 ? packages : [createMockNarrativePackage()];
  return JSON.stringify({ packages: pkgs });
}

/**
 * Create a mock interpretation LLM response.
 */
export function createMockInterpretationLLMResponse(): string {
  return JSON.stringify({
    interpretation: {
      summary: 'User wants to add a scene',
      confidence: 0.9,
    },
    proposals: [
      {
        type: 'node',
        operation: 'add',
        target_type: 'Scene',
        data: {
          heading: 'INT. TEST LOCATION - DAY',
          scene_overview: 'A test scene',
        },
        rationale: 'Input describes a scene',
        relates_to: [],
      },
    ],
  });
}

/**
 * Create a mock refinement LLM response.
 */
export function createMockRefinementLLMResponse(
  basePackageId: string,
  variationCount: number = 2
): string {
  const packages: NarrativePackage[] = [];
  for (let i = 0; i < variationCount; i++) {
    packages.push(
      createMockNarrativePackage({
        id: `pkg_refined_${i}`,
        title: `Variation ${i + 1}`,
        parent_package_id: basePackageId,
        refinement_prompt: 'Test refinement',
      })
    );
  }
  return JSON.stringify({ packages });
}
