/**
 * project-apollo normalize:abstraction
 *
 * 1) Normalize migrated StoryBeats (sb_migrated_*) to abstract summaries.
 * 2) Convert stash StoryBeats (no ALIGNS_WITH) with scene-like summaries into Scenes.
 */

import type { Command } from 'commander';
import pc from 'picocolors';
import {
  applyPatch,
  validatePatch,
  generateEdgeId,
  type Patch,
  type StoryBeat,
  type Scene,
} from '@apollo/core';
import { loadGraph, updateState, getCurrentStoryId } from '../state/store.js';
import { CLIError } from '../utils/errors.js';
import { heading, success, formatPatch, formatValidationErrors } from '../utils/format.js';

function isStoryBeat(node: unknown): node is StoryBeat { return !!node && (node as StoryBeat).type === 'StoryBeat'; }

function isSceneLikeSummary(summary?: string): boolean {
  if (!summary) return false;
  const s = summary.trim();
  if (!s) return false;
  const hasSceneHeading = /\bINT\.|\bEXT\./i.test(s);
  const hasLongDialogue = /"[^"]{20,}"/.test(s);
  const tooLong = s.length > 300;
  const locationIndicators = ['shop', 'warehouse', 'club', 'marina', 'garage'];
  const hasLocation = locationIndicators.some((w) => s.toLowerCase().includes(w));
  return hasSceneHeading || hasLongDialogue || tooLong || hasLocation;
}

function extractHeadingFromSummary(summary?: string): string | null {
  if (!summary) return null;
  const match = summary.match(/\b(INT\.|EXT\.)[^\n]+/i);
  return match ? match[0].toUpperCase() : null;
}

function stripQuotes(text: string): string { return text.replace(/"[^\"]*"/g, '').trim(); }

function extractAbstract(summary?: string): string | undefined {
  if (!summary) return undefined;
  let s = summary.replace(/\bINT\.|\bEXT\./gi, '').replace(/\s+-\s+[A-Z]+/g, ' ');
  s = stripQuotes(s);
  const sentences = s.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  const trimmed = sentences.replace(/\s{2,}/g, ' ').trim();
  return trimmed.length > 0 ? trimmed.slice(0, 260) : undefined;
}

type NarrativeFunction =
  | 'theme_establishment'
  | 'character_introduction'
  | 'character_development'
  | 'plot_revelation'
  | 'reversal'
  | 'escalation'
  | 'resolution'
  | 'tone_setter';

function classifyNarrativeFunction(summary?: string): NarrativeFunction | undefined {
  if (!summary) return undefined;
  const s = summary.toLowerCase();
  if (/(introduce|meets?\b|first appears|arrives)/.test(s)) return 'character_introduction';
  if (/(reveal|learns|realizes|exposed|uncover)/.test(s)) return 'plot_revelation';
  if (/(decides|chooses|changes|growth|confesses)/.test(s)) return 'character_development';
  if (/(arrest|loses|taken|seized|ambush|all is lost|betray)/.test(s)) return 'reversal';
  if (/(escalat|pressure|tension|tightens|complication)/.test(s)) return 'escalation';
  if (/(resolve|concludes|final|reconciles|closure)/.test(s)) return 'resolution';
  if (/(theme|code|ethos|credo|worldview|skeptic|tone)/.test(s)) return 'theme_establishment';
  if (/(mood|vibe|atmosphere|style)/.test(s)) return 'tone_setter';
  return undefined;
}

export function normalizeAbstractionCommand(program: Command): void {
  program
    .command('normalize:abstraction')
    .description('Normalize StoryBeat abstraction and convert stash scene-like StoryBeats to Scenes')
    .option('--dry-run', 'Preview changes without applying')
    .option('-y, --yes', 'Apply without confirmation step')
    .action(async (opts: { dryRun?: boolean; yes?: boolean }) => {
      const storyId = await getCurrentStoryId();
      if (!storyId) throw new CLIError('No story selected.', 'Run "project-apollo open <id>" first.');
      const graph = await loadGraph();
      if (!graph) throw new CLIError('Current story not found.');

      const now = new Date().toISOString();
      const ops: Patch['ops'] = [];

      // Build edge lookups
      const alignsWith = graph.edges.filter((e) => e.type === 'ALIGNS_WITH');
      const alignedSbIds = new Set(alignsWith.map((e) => e.from));

      // 1) Normalize migrated StoryBeats (sb_migrated_*) to abstract summaries
      for (const [, node] of graph.nodes) {
        if (!isStoryBeat(node)) continue;
        if (!String(node.id).startsWith('sb_migrated_')) continue;

        const abstract = extractAbstract(node.summary);
        const nf = classifyNarrativeFunction(abstract ?? node.summary);
        const set: Record<string, unknown> = {};
        if (abstract && abstract !== node.summary) set.summary = abstract;
        if (nf && node.narrative_function !== nf) set.narrative_function = nf;
        if (Object.keys(set).length > 0) {
          set.updatedAt = now;
          ops.push({ op: 'UPDATE_NODE', id: node.id, set });
        }
      }

      // 2) Convert stash StoryBeats (no ALIGNS_WITH) with scene-like summary into Scenes (unattached)
      for (const [, node] of graph.nodes) {
        if (!isStoryBeat(node)) continue;
        if (alignedSbIds.has(node.id)) continue; // skip aligned
        if (!isSceneLikeSummary(node.summary)) continue;

        const heading = extractHeadingFromSummary(node.summary) ?? 'INT. LOCATION - TIME';
        const sceneId = `scene_from_stash_${node.id}`;
        const scene: Scene = {
          type: 'Scene',
          id: sceneId,
          heading,
          scene_overview: node.summary ?? '',
          order_index: node.order_index ?? 1,
          status: 'DRAFT',
          source_provenance: 'MIGRATION',
        };
        ops.push({ op: 'ADD_NODE', node: scene });
        ops.push({ op: 'DELETE_NODE', id: node.id });
      }

      if (ops.length === 0) {
        console.log(pc.green('No changes needed. StoryBeats appear properly abstract; stash contains no scene-like StoryBeats.'));
        return;
      }

      const patch: Patch = {
        type: 'Patch',
        id: `patch_normalize_abstraction_${Date.now()}`,
        base_story_version_id: 'current',
        created_at: now,
        ops,
        metadata: { source: 'cli-normalize-abstraction' },
      };

      // Validate
      const validation = validatePatch(graph, patch);
      if (!validation.success) {
        console.log(formatValidationErrors(validation.errors));
        process.exit(1);
      }

      // Preview
      const summary = `Normalize Abstraction (${ops.length} ops)`;
      heading(summary);
      console.log(formatPatch(patch));

      if (opts.dryRun) {
        console.log(pc.yellow('Dry-run: no changes applied.'));
        return;
      }
      if (!opts.yes) {
        console.log(pc.yellow('Run again with --yes to apply.'));
        return;
      }

      const newGraph = applyPatch(graph, patch);
      await updateState(newGraph);
      success(summary);
    });
}

