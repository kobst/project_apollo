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
import type { GenerationResult, InterpretationResult } from '../../src/ai/types.js';

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

// =============================================================================
// AI Fixture Loaders
// =============================================================================

interface MalformedResponseCases {
  with_markdown_block: string;
  with_unmarked_block: string;
  trailing_commas: string;
  raw_json: string;
  with_preamble: string;
  missing_packages_field: string;
  missing_required_fields: string;
  not_json: string;
  empty_object: string;
  interpretation_with_block: string;
}

interface InvalidIdsFixture {
  description: string;
  packages: GenerationResult['packages'];
}

/**
 * Load AI-specific fixtures
 */
export const aiFixtures = {
  /** Valid generation response with 3 packages */
  validGenerationResponse: (): GenerationResult => {
    const path = join(__dirname, 'ai/valid_generation_response.json');
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as GenerationResult;
  },

  /** Valid interpretation response */
  validInterpretationResponse: (): InterpretationResult => {
    const path = join(__dirname, 'ai/valid_interpretation_response.json');
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as InterpretationResult;
  },

  /** Malformed response cases for parser testing */
  malformedResponses: (): MalformedResponseCases => {
    const path = join(__dirname, 'ai/malformed_response.json');
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content) as { cases: MalformedResponseCases };
    return data.cases;
  },

  /** Invalid ID response cases */
  invalidIdsResponse: (): InvalidIdsFixture => {
    const path = join(__dirname, 'ai/invalid_ids_response.json');
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as InvalidIdsFixture;
  },

  /** Sample graph for serialization testing */
  sampleGraph: (): GraphState => loadFixtureAsGraph('ai/sample_graph'),
};
