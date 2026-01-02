/**
 * Fixture loader utilities
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyGraph } from '../../src/core/graph.js';
import type { GraphState } from '../../src/core/graph.js';
import type { Patch, KGNode } from '../../src/types/patch.js';
import type { Edge } from '../../src/types/edges.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FixtureData {
  description: string;
  storyVersion?: KGNode;
  nodes: KGNode[];
  edges: Edge[];
}

/**
 * Load a fixture JSON file
 */
export function loadFixture(name: string): FixtureData {
  const path = join(__dirname, `${name}.json`);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as FixtureData;
}

/**
 * Load fixture as GraphState
 */
export function loadFixtureAsGraph(name: string): GraphState {
  const data = loadFixture(name);
  const graph = createEmptyGraph();

  if (data.storyVersion) {
    graph.nodes.set(data.storyVersion.id, data.storyVersion);
  }

  for (const node of data.nodes) {
    graph.nodes.set(node.id, node);
  }

  graph.edges.push(...data.edges);

  return graph;
}

/**
 * Load a patch fixture
 */
export function loadPatchFixture(name: string): Patch {
  const path = join(__dirname, `${name}.json`);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as Patch;
}

/**
 * Pre-loaded fixtures for convenience
 */
export const fixtures = {
  /** Load empty story with 15 beats */
  emptyStory: (): GraphState => loadFixtureAsGraph('empty_story_sv0'),

  /** Load the seed patch (adds Character/Conflict/Location) */
  seedPatch: (): Patch => loadPatchFixture('seed_from_input_patch'),

  /** Load story state after first scene added */
  afterAcceptance: (): GraphState => loadFixtureAsGraph('after_acceptance_sv1'),
};
