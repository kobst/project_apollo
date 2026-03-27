/**
 * Tests for critique prompt builder and parser.
 */
import { describe, it, expect } from 'vitest';
import { buildCritiquePrompt } from '../../src/ai/prompts/critiquePrompt.js';
import { parseCritiqueResponse } from '../../src/ai/critiqueParser.js';
import type { CritiqueParams } from '../../src/ai/prompts/critiquePrompt.js';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Prompt Builder Tests
// =============================================================================

describe('buildCritiquePrompt', () => {
  const baseParams: CritiqueParams = {
    packages: [
      {
        id: 'pkg_001',
        title: 'Dark Reveal',
        rationale: 'Creates dramatic tension',
        nodesSummary: 'PlotPoint: "Discovery of truth"\nScene: "INT. LAB - NIGHT"',
      },
      {
        id: 'pkg_002',
        title: 'Slow Burn',
        rationale: 'Builds suspense gradually',
        nodesSummary: 'PlotPoint: "Gradual realization"\nScene: "EXT. STREET - DAY"',
      },
    ],
    storyContext: 'A neo-noir thriller set in a cyberpunk city.',
    coverageSummary: 'Structure: 40% | Scenes: 20% | 9 unrealized beats',
  };

  it('should include all packages in the prompt', () => {
    const prompt = buildCritiquePrompt(baseParams);
    expect(prompt).toContain('Dark Reveal');
    expect(prompt).toContain('Slow Burn');
    expect(prompt).toContain('pkg_001');
    expect(prompt).toContain('pkg_002');
  });

  it('should include story context and coverage', () => {
    const prompt = buildCritiquePrompt(baseParams);
    expect(prompt).toContain('neo-noir thriller');
    expect(prompt).toContain('9 unrealized beats');
  });

  it('should include evaluation criteria', () => {
    const prompt = buildCritiquePrompt(baseParams);
    expect(prompt).toContain('Strengths');
    expect(prompt).toContain('Weaknesses');
    expect(prompt).toContain('Thematic fit');
    expect(prompt).toContain('Structural risks');
    expect(prompt).toContain('Tradeoff profile');
  });

  it('should include impact diff when provided', () => {
    const params: CritiqueParams = {
      ...baseParams,
      packages: [{
        ...baseParams.packages[0]!,
        impactDiff: {
          dischargedGaps: [{ id: 'g1', type: 'narrative', tier: 'structure', title: 'Beat Unrealized: Catalyst', description: '', scopeRefs: {}, source: 'derived', status: 'open' }],
          introducedGaps: [],
          tierChanges: [{ tier: 'structure', label: 'Structure', before: 40, after: 47, delta: 7 }],
          netGapDelta: -1,
          before: { summary: [], gaps: [] },
          after: { summary: [], gaps: [] },
        },
      }],
    };
    const prompt = buildCritiquePrompt(params);
    expect(prompt).toContain('Resolves 1 gap');
    expect(prompt).toContain('Beat Unrealized: Catalyst');
    expect(prompt).toContain('Structure: 40% → 47%');
  });

  it('should request JSON output', () => {
    const prompt = buildCritiquePrompt(baseParams);
    expect(prompt).toContain('packageId');
    expect(prompt).toContain('tradeoffProfile');
    expect(prompt).toContain('JSON');
  });
});

// =============================================================================
// Parser Tests
// =============================================================================

describe('parseCritiqueResponse', () => {
  it('should parse valid fixture response', () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/ai/valid_critique_response.json');
    const raw = fs.readFileSync(fixturePath, 'utf-8');
    const critiques = parseCritiqueResponse(raw);

    expect(critiques).toHaveLength(3);
    expect(critiques[0]!.packageId).toBe('pkg_catalyst_test');
    expect(critiques[0]!.strengths.length).toBeGreaterThan(0);
    expect(critiques[0]!.thematicFit).toBe('strong');
    expect(critiques[0]!.tradeoffProfile).toContain('dramatic impact');

    expect(critiques[1]!.packageId).toBe('pkg_debate_bare');
    expect(critiques[1]!.weaknesses.length).toBeGreaterThan(0);

    expect(critiques[2]!.packageId).toBe('pkg_empty');
    expect(critiques[2]!.thematicFit).toBe('weak');
  });

  it('should handle markdown-wrapped JSON', () => {
    const wrapped = '```json\n[{"packageId":"p1","strengths":["good"],"weaknesses":[],"thematicFit":"strong","structuralRisks":[],"tradeoffProfile":"test"}]\n```';
    const critiques = parseCritiqueResponse(wrapped);
    expect(critiques).toHaveLength(1);
    expect(critiques[0]!.packageId).toBe('p1');
  });

  it('should handle single object (not array)', () => {
    const single = '{"packageId":"p1","strengths":["good"],"weaknesses":[],"thematicFit":"moderate","structuralRisks":[],"tradeoffProfile":"test"}';
    const critiques = parseCritiqueResponse(single);
    expect(critiques).toHaveLength(1);
  });

  it('should provide defaults for missing fields', () => {
    const minimal = '[{"packageId":"p1"}]';
    const critiques = parseCritiqueResponse(minimal);
    expect(critiques).toHaveLength(1);
    expect(critiques[0]!.strengths).toEqual([]);
    expect(critiques[0]!.weaknesses).toEqual([]);
    expect(critiques[0]!.thematicFit).toBe('moderate');
    expect(critiques[0]!.structuralRisks).toEqual([]);
  });

  it('should return empty array for completely invalid input', () => {
    const critiques = parseCritiqueResponse('not json at all');
    expect(critiques).toEqual([]);
  });
});
