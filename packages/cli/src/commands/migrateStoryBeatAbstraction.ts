/**
 * project-apollo migrate:storybeat-abstraction
 *
 * Detect scene-like StoryBeats and split them into:
 * - New abstract StoryBeat (retaining ALIGNS_WITH)
 * - New concrete Scene (SATISFIED_BY)
 * - Mark original StoryBeat as deprecated
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
  type GraphState,
} from '@apollo/core';
import {
  loadGraph,
  updateState,
  getCurrentStoryId,
} from '../state/store.js';
import { CLIError } from '../utils/errors.js';
import { heading, success, formatPatch, formatValidationErrors } from '../utils/format.js';

function isStoryBeat(node: unknown): node is StoryBeat {
  return Boolean(node) && (node as StoryBeat).type === 'StoryBeat';
}

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

function stripQuotes(text: string): string {
  return text.replace(/"[^\"]*"/g, '').trim();
}

function extractAbstractFunction(summary?: string): string {
  if (!summary) return 'Abstract narrative function (migration placeholder)';
  // Remove screenplay headings and quoted dialogue
  let s = summary.replace(/\bINT\.|\bEXT\./gi, '').replace(/\s+-\s+[A-Z]+/g, ' ');
  s = stripQuotes(s);
  // Heuristic: keep first 2 sentences max, truncate softly
  const sentences = s.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  const trimmed = sentences.replace(/\s{2,}/g, ' ').trim();
  return trimmed.length > 0 ? trimmed.slice(0, 260) : 'Abstract narrative function (migration placeholder)';
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

// (no-op) kept for parity with other commands if needed in future

export function migrateStoryBeatAbstractionCommand(program: Command): void {
  program
    .command('migrate:storybeat-abstraction')
    .description('Split scene-like StoryBeats into abstract StoryBeat + concrete Scene and deprecate originals')
    .option('-y, --yes', 'Apply without confirmation (non-interactive)')
    .option('--dry-run', 'Show the generated patch without applying')
    .action(async (opts: { yes?: boolean; dryRun?: boolean }) => {
      const storyId = await getCurrentStoryId();
      if (!storyId) {
        throw new CLIError(
          'No story selected.',
          'Run "project-apollo list" to see stories, or "project-apollo open <id>" to select one.'
        );
      }

      const graph = await loadGraph();
      if (!graph) {
        throw new CLIError('Current story not found.');
      }

      // Collect scene-like StoryBeats
      const storyBeats: StoryBeat[] = [];
      for (const [, node] of graph.nodes) {
        if (isStoryBeat(node)) storyBeats.push(node);
      }

      const candidates = storyBeats.filter((sb) => isSceneLikeSummary(sb.summary));
      if (candidates.length === 0) {
        console.log(pc.green('No scene-like StoryBeats detected.'));
        return;
      }

      // Build a single patch with all operations
      const now = new Date().toISOString();
      const ops: Patch['ops'] = [];
      let migrated = 0;

      for (const sb of candidates) {
        const newSbId = `sb_migrated_${sb.id}`;
        const sceneId = `scene_from_${sb.id}`;
        const heading = extractHeadingFromSummary(sb.summary) ?? 'INT. LOCATION - TIME';
        const abstractSummary = extractAbstractFunction(sb.summary);
        const nf = classifyNarrativeFunction(sb.summary);

        const newStoryBeat: StoryBeat = {
          ...sb,
          id: newSbId,
          title: sb.title, // Keep title; users can refine later
          summary: abstractSummary,
          ...(nf && { narrative_function: nf }),
          status: 'proposed',
          createdAt: now,
          updatedAt: now,
        };

        const newScene: Scene = {
          type: 'Scene',
          id: sceneId,
          heading,
          scene_overview: sb.summary ?? '',
          order_index: sb.order_index ?? 1,
          status: 'DRAFT',
          source_provenance: 'MIGRATION',
        };

        // Add nodes
        ops.push({ op: 'ADD_NODE', node: newStoryBeat });
        ops.push({ op: 'ADD_NODE', node: newScene });

        // Preserve ALIGNS_WITH edge (StoryBeat -> Beat) on new StoryBeat
        const aligns = (graph as GraphState).edges.find(
          (e) => e.type === 'ALIGNS_WITH' && e.from === sb.id
        );
        if (aligns) {
          ops.push({
            op: 'ADD_EDGE',
            edge: { id: generateEdgeId(), type: 'ALIGNS_WITH', from: newSbId, to: aligns.to },
          });
        }

        // Add SATISFIED_BY: StoryBeat -> Scene
        ops.push({
          op: 'ADD_EDGE',
          edge: { id: generateEdgeId(), type: 'SATISFIED_BY', from: newSbId, to: sceneId },
        });

        // Deprecate original StoryBeat
        ops.push({ op: 'UPDATE_NODE', id: sb.id, set: { status: 'deprecated', updatedAt: now } });

        migrated += 1;
      }

      const patch: Patch = {
        type: 'Patch',
        id: `patch_migrate_storybeat_abstraction_${Date.now()}`,
        base_story_version_id: 'current',
        created_at: now,
        ops,
        metadata: { source: 'cli-migrate-storybeat-abstraction' },
      };

      // Validate patch
      const validation = validatePatch(graph, patch);
      if (!validation.success) {
        console.log();
        console.log(formatValidationErrors(validation.errors));
        process.exit(1);
      }

      // Dry-run or apply
      const summary = `Migrate StoryBeat Abstraction (${migrated} StoryBeats)`;
      heading(summary);
      console.log(pc.dim(`Detected ${candidates.length} candidate(s).`));
      console.log();
      console.log(formatPatch(patch));

      if (opts.dryRun) {
        console.log(pc.yellow('Dry-run: no changes applied.'));
        return;
      }

      if (!opts.yes) {
        // Require explicit confirmation in non-interactive mode; keep behavior simple
        console.log(pc.yellow('Run again with --yes to apply this migration.'));
        return;
      }

      const newGraph = applyPatch(graph, patch);
      await updateState(newGraph);
      success(summary);
    });
}
