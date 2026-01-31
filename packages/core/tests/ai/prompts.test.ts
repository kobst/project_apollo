/**
 * Tests for AI prompt builders.
 */

import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt } from '../../src/ai/prompts/generationPrompt.js';
import { buildInterpretationPrompt } from '../../src/ai/prompts/interpretationPrompt.js';
import { buildRefinementPrompt } from '../../src/ai/prompts/refinementPrompt.js';
import type {
  GenerationParams,
  InterpretationParams,
  RefinementParams,
  NarrativePackage,
} from '../../src/ai/types.js';

describe('prompts', () => {
  describe('buildGenerationPrompt', () => {
    const baseParams: GenerationParams = {
      entryPoint: { type: 'beat', targetId: 'beat_Midpoint' },
      storyContext: '# Story: Test\n\nSome context',
      gaps: 'No gaps',
      depth: 'medium',
      count: 3,
    };

    it('should include the count in prompt', () => {
      const prompt = buildGenerationPrompt(baseParams);

      expect(prompt).toContain('exactly 3 complete narrative packages');
    });

    it('should include entry point description', () => {
      const prompt = buildGenerationPrompt(baseParams);

      expect(prompt).toContain('## Entry Point');
      expect(prompt).toContain('beat_Midpoint');
    });

    it('should include story context', () => {
      const prompt = buildGenerationPrompt(baseParams);

      expect(prompt).toContain('## Story State');
      expect(prompt).toContain('# Story: Test');
    });

    it('should include gaps', () => {
      const params: GenerationParams = {
        ...baseParams,
        gaps: '## Gaps\n- Missing midpoint scene',
      };

      const prompt = buildGenerationPrompt(params);

      expect(prompt).toContain('## Open Gaps');
      expect(prompt).toContain('Missing midpoint scene');
    });

    it('should include direction when provided', () => {
      const params: GenerationParams = {
        ...baseParams,
        direction: 'Focus on betrayal themes',
      };

      const prompt = buildGenerationPrompt(params);

      expect(prompt).toContain('## Direction');
      expect(prompt).toContain('Focus on betrayal themes');
    });

    it('should not include direction section when not provided', () => {
      const prompt = buildGenerationPrompt(baseParams);

      expect(prompt).not.toContain('## Direction');
    });

    it('should include budget limits for depth', () => {
      const prompt = buildGenerationPrompt(baseParams);

      expect(prompt).toContain('## Budget');
      expect(prompt).toContain('Depth: medium');
      // medium depth: maxNodes=5, maxOps=10
      expect(prompt).toContain('Max nodes/pkg: 5');
      expect(prompt).toContain('Max ops/pkg: 10');
    });

    it('should include narrow depth budget', () => {
      const params: GenerationParams = { ...baseParams, depth: 'narrow' };
      const prompt = buildGenerationPrompt(params);

      expect(prompt).toContain('Depth: narrow');
      expect(prompt).toContain('Max nodes/pkg: 2');
    });

    it('should include wide depth budget', () => {
      const params: GenerationParams = { ...baseParams, depth: 'wide' };
      const prompt = buildGenerationPrompt(params);

      expect(prompt).toContain('Depth: wide');
      expect(prompt).toContain('Max nodes/pkg: 10');
    });

    it('should include available node types', () => {
      const prompt = buildGenerationPrompt(baseParams);

      expect(prompt).toContain('## Node Types');
      expect(prompt).toContain('Character');
      expect(prompt).toContain('Location');
      expect(prompt).toContain('StoryBeat');
      expect(prompt).toContain('Scene');
    });

    it('should include available edge types', () => {
      const prompt = buildGenerationPrompt(baseParams);

      expect(prompt).toContain('## Edge Types');
      expect(prompt).toContain('HAS_CHARACTER');
      expect(prompt).toContain('LOCATED_AT');
      expect(prompt).toContain('ALIGNS_WITH');
    });

    it('should include JSON output schema', () => {
      const prompt = buildGenerationPrompt(baseParams);

      expect(prompt).toContain('## Output');
      expect(prompt).toContain('```json');
      expect(prompt).toContain('"packages"');
    });

    describe('entry point descriptions', () => {
      it('should describe beat entry point', () => {
        const params: GenerationParams = {
          ...baseParams,
          entryPoint: { type: 'beat', targetId: 'beat_Catalyst' },
        };

        const prompt = buildGenerationPrompt(params);

        expect(prompt).toContain('structural beat: beat_Catalyst');
      });

      it('should describe storyBeat entry point', () => {
        const params: GenerationParams = {
          ...baseParams,
          entryPoint: { type: 'storyBeat', targetId: 'sb_001' },
        };

        const prompt = buildGenerationPrompt(params);

        expect(prompt).toContain('scenes for StoryBeat: sb_001');
      });

      it('should describe character entry point', () => {
        const params: GenerationParams = {
          ...baseParams,
          entryPoint: { type: 'character', targetId: 'char_mike' },
        };

        const prompt = buildGenerationPrompt(params);

        expect(prompt).toContain('story for Character: char_mike');
      });

      it('should describe gap entry point', () => {
        const params: GenerationParams = {
          ...baseParams,
          entryPoint: { type: 'gap', targetId: 'gap_midpoint' },
        };

        const prompt = buildGenerationPrompt(params);

        expect(prompt).toContain('Resolve gap: gap_midpoint');
      });

      it('should describe idea entry point', () => {
        const params: GenerationParams = {
          ...baseParams,
          entryPoint: { type: 'idea', targetId: 'idea_twist' },
        };

        const prompt = buildGenerationPrompt(params);

        expect(prompt).toContain('Develop Idea: idea_twist');
      });

      it('should describe naked entry point', () => {
        const params: GenerationParams = {
          ...baseParams,
          entryPoint: { type: 'naked' },
        };

        const prompt = buildGenerationPrompt(params);

        expect(prompt).toContain('Analyze story and generate highest-value additions');
      });

      it('should include targetData in description when provided', () => {
        const params: GenerationParams = {
          ...baseParams,
          entryPoint: {
            type: 'character',
            targetId: 'char_mike',
            targetData: { name: 'Mike', archetype: 'protagonist' },
          },
        };

        const prompt = buildGenerationPrompt(params);

        expect(prompt).toContain('Details:');
        expect(prompt).toContain('"name"');
        expect(prompt).toContain('Mike');
      });
    });
  });

  describe('buildInterpretationPrompt', () => {
    const baseParams: InterpretationParams = {
      userInput: 'I want a scene where Mike discovers the truth',
      storyContext: '# Story: Test\n\nContext here',
    };

    it('should include user input', () => {
      const prompt = buildInterpretationPrompt(baseParams);

      expect(prompt).toContain('## User Input');
      expect(prompt).toContain('I want a scene where Mike discovers the truth');
    });

    it('should include story context', () => {
      const prompt = buildInterpretationPrompt(baseParams);

      expect(prompt).toContain('## Story State');
      expect(prompt).toContain('# Story: Test');
    });

    it('should include available node types', () => {
      const prompt = buildInterpretationPrompt(baseParams);

      expect(prompt).toContain('## Node Types');
      expect(prompt).toContain('Character');
      expect(prompt).toContain('Location');
      expect(prompt).toContain('StoryBeat');
      expect(prompt).toContain('Scene');
      expect(prompt).toContain('Idea');
    });

    it('should include recent nodes when provided', () => {
      const params: InterpretationParams = {
        ...baseParams,
        recentNodes: ['- Character: Mike', '- Scene: Opening'],
      };

      const prompt = buildInterpretationPrompt(params);

      expect(prompt).toContain('## Recent Nodes');
      expect(prompt).toContain('- Character: Mike');
      expect(prompt).toContain('- Scene: Opening');
    });

    it('should not include recent nodes section when not provided', () => {
      const prompt = buildInterpretationPrompt(baseParams);

      expect(prompt).not.toContain('## Recent Nodes');
    });

    it('should include JSON output schema', () => {
      const prompt = buildInterpretationPrompt(baseParams);

      expect(prompt).toContain('## Output');
      expect(prompt).toContain('```json');
      expect(prompt).toContain('"interpretation"');
      expect(prompt).toContain('"proposals"');
      expect(prompt).toContain('"alternatives"');
    });

    it('should include guidelines', () => {
      const prompt = buildInterpretationPrompt(baseParams);

      expect(prompt).toContain('Concrete element');
      expect(prompt).toContain('Thematic/directional');
      expect(prompt).toContain('Idea node');
    });
  });

  describe('buildRefinementPrompt', () => {
    const basePackage: NarrativePackage = {
      id: 'pkg_base_001',
      title: 'The Betrayal',
      rationale: 'Introduces a key plot twist',
      confidence: 0.85,
      style_tags: ['dramatic', 'noir'],
      changes: {
        nodes: [
          {
            operation: 'add',
            node_type: 'Character',
            node_id: 'char_torres',
            data: { name: 'Agent Torres', description: 'Internal Affairs' },
          },
          {
            operation: 'add',
            node_type: 'Scene',
            node_id: 'scene_reveal',
            data: { heading: 'INT. OFFICE - NIGHT' },
          },
        ],
        edges: [
          {
            operation: 'add',
            edge_type: 'HAS_CHARACTER',
            from: 'scene_reveal',
            to: 'char_torres',
          },
        ],
      },
      impact: { fulfills_gaps: [], creates_gaps: [], conflicts: [] },
    };

    const baseParams: RefinementParams = {
      basePackage,
      keepElements: ['char_torres'],
      regenerateElements: ['scene_reveal'],
      guidance: 'Make Torres more sympathetic',
      storyContext: '# Story: Test',
      depth: 'medium',
      count: 3,
    };

    it('should include count in prompt', () => {
      const prompt = buildRefinementPrompt(baseParams);

      expect(prompt).toContain('Generate 3 variations');
    });

    it('should include base package title and rationale', () => {
      const prompt = buildRefinementPrompt(baseParams);

      expect(prompt).toContain('## Base Package');
      expect(prompt).toContain('**Title**: The Betrayal');
      expect(prompt).toContain('**Rationale**: Introduces a key plot twist');
    });

    it('should format package changes', () => {
      const prompt = buildRefinementPrompt(baseParams);

      expect(prompt).toContain('### Current Changes');
      expect(prompt).toContain('**Nodes:**');
      expect(prompt).toContain('[add] Character: Agent Torres');
      expect(prompt).toContain('**Edges:**');
      expect(prompt).toContain('scene_reveal → char_torres');
    });

    it('should include keep elements', () => {
      const prompt = buildRefinementPrompt(baseParams);

      expect(prompt).toContain('Keep:');
      expect(prompt).toContain('char_torres');
    });

    it('should show "None specified" when no keep elements', () => {
      const params: RefinementParams = {
        ...baseParams,
        keepElements: [],
      };

      const prompt = buildRefinementPrompt(params);

      expect(prompt).toContain('None specified');
    });

    it('should include regenerate elements', () => {
      const prompt = buildRefinementPrompt(baseParams);

      expect(prompt).toContain('Regenerate:');
      expect(prompt).toContain('scene_reveal');
    });

    it('should show default message when no regenerate elements', () => {
      const params: RefinementParams = {
        ...baseParams,
        regenerateElements: [],
      };

      const prompt = buildRefinementPrompt(params);

      expect(prompt).toContain('All non-kept elements');
    });

    it('should include user guidance', () => {
      const prompt = buildRefinementPrompt(baseParams);

      expect(prompt).toContain('Guidance:');
      expect(prompt).toContain('Make Torres more sympathetic');
    });

    it('should include story context', () => {
      const prompt = buildRefinementPrompt(baseParams);

      expect(prompt).toContain('## Story State');
      expect(prompt).toContain('# Story: Test');
    });

    it('should include budget limits', () => {
      const prompt = buildRefinementPrompt(baseParams);

      expect(prompt).toContain('## Budget');
      expect(prompt).toContain('Depth: medium');
      expect(prompt).toContain('Max nodes: 5');
    });

    it('should include JSON output schema with parent lineage', () => {
      const prompt = buildRefinementPrompt(baseParams);

      expect(prompt).toContain('## Output');
      expect(prompt).toContain(`"parent_package_id": "${basePackage.id}"`);
      expect(prompt).toContain('"refinement_prompt"');
    });

    it('should truncate long guidance in JSON example', () => {
      const params: RefinementParams = {
        ...baseParams,
        guidance: 'A'.repeat(200), // Very long guidance
      };

      const prompt = buildRefinementPrompt(params);

      // Should truncate to first 100 chars + "..."
      expect(prompt).toContain('A'.repeat(100) + '...');
    });

    it('should escape special characters in guidance for JSON', () => {
      const params: RefinementParams = {
        ...baseParams,
        guidance: 'Make it "darker" with\nnew line',
      };

      const prompt = buildRefinementPrompt(params);

      // Should escape quotes and newlines
      expect(prompt).toContain('\\"darker\\"');
      expect(prompt).toContain('\\n');
    });

    it('should include story context changes when present', () => {
      const pkgWithContext: NarrativePackage = {
        ...basePackage,
        changes: {
          ...basePackage.changes,
          storyContext: [
            { operation: { type: 'addThematicPillar', pillar: 'New theme' } },
          ],
        },
      };

      const params: RefinementParams = {
        ...baseParams,
        basePackage: pkgWithContext,
      };

      const prompt = buildRefinementPrompt(params);

      expect(prompt).toContain('**Context:**');
      expect(prompt).toContain('[add pillar]: "New theme"');
    });
  });
});
