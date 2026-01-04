/**
 * Unit tests for soft lint rules (warnings)
 *
 * Tests cover:
 * - Violation detection (positive cases)
 * - No false positives (negative cases)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphState } from '../../src/core/graph.js';
import {
  SCENE_HAS_CHARACTER,
  SCENE_HAS_LOCATION,
  THEME_NOT_ORPHANED,
  MOTIF_NOT_ORPHANED,
} from '../../src/rules/softRules.js';
import {
  createGraphWith15Beats,
  createScene,
  createCharacter,
  createLocation,
  createTheme,
  createMotif,
  resetIdCounter,
  edges,
} from '../helpers/index.js';

describe('Soft Rules', () => {
  let graph: GraphState;

  beforeEach(() => {
    resetIdCounter();
    graph = createGraphWith15Beats();
  });

  // ===========================================================================
  // SCENE_HAS_CHARACTER
  // ===========================================================================

  describe('SCENE_HAS_CHARACTER', () => {
    it('should warn when scene has no characters', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(scene.id, scene);

      const violations = SCENE_HAS_CHARACTER.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('SCENE_HAS_CHARACTER');
      expect(violations[0].severity).toBe('soft');
      expect(violations[0].message).toContain('no characters assigned');
    });

    it('should not warn when scene has a character', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      const character = createCharacter({ id: 'char_1' });
      graph.nodes.set(scene.id, scene);
      graph.nodes.set(character.id, character);
      graph.edges.push(edges.hasCharacter(scene.id, character.id));

      const violations = SCENE_HAS_CHARACTER.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should warn for each scene without characters', () => {
      graph.nodes.set('s1', createScene('beat_Catalyst', { id: 's1' }));
      graph.nodes.set('s2', createScene('beat_Midpoint', { id: 's2' }));
      graph.nodes.set('s3', createScene('beat_Finale', { id: 's3' }));

      const violations = SCENE_HAS_CHARACTER.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(3);
    });
  });

  // ===========================================================================
  // SCENE_HAS_LOCATION
  // ===========================================================================

  describe('SCENE_HAS_LOCATION', () => {
    it('should warn when scene has no location', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(scene.id, scene);

      const violations = SCENE_HAS_LOCATION.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('SCENE_HAS_LOCATION');
      expect(violations[0].severity).toBe('soft');
      expect(violations[0].message).toContain('no location assigned');
    });

    it('should not warn when scene has a location', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      const location = createLocation({ id: 'loc_1' });
      graph.nodes.set(scene.id, scene);
      graph.nodes.set(location.id, location);
      graph.edges.push(edges.locatedAt(scene.id, location.id));

      const violations = SCENE_HAS_LOCATION.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });
  });

  // ===========================================================================
  // THEME_NOT_ORPHANED
  // ===========================================================================

  describe('THEME_NOT_ORPHANED', () => {
    it('should warn when theme has no EXPRESSED_IN edges', () => {
      const theme = createTheme({ id: 'theme_1', statement: 'Love conquers all' });
      graph.nodes.set(theme.id, theme);

      const violations = THEME_NOT_ORPHANED.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('THEME_NOT_ORPHANED');
      expect(violations[0].severity).toBe('soft');
      expect(violations[0].message).toContain('Love conquers all');
      expect(violations[0].message).toContain('not expressed');
    });

    it('should not warn when theme is expressed in a scene', () => {
      const theme = createTheme({ id: 'theme_1' });
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(theme.id, theme);
      graph.nodes.set(scene.id, scene);
      graph.edges.push(edges.expressedIn(theme.id, scene.id));

      const violations = THEME_NOT_ORPHANED.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });

    it('should not warn when theme is expressed in a beat', () => {
      const theme = createTheme({ id: 'theme_1' });
      graph.nodes.set(theme.id, theme);
      graph.edges.push(edges.expressedIn(theme.id, 'beat_Midpoint'));

      const violations = THEME_NOT_ORPHANED.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });
  });

  // ===========================================================================
  // MOTIF_NOT_ORPHANED
  // ===========================================================================

  describe('MOTIF_NOT_ORPHANED', () => {
    it('should warn when motif has no APPEARS_IN edges', () => {
      const motif = createMotif({ id: 'motif_1', name: 'Water imagery' });
      graph.nodes.set(motif.id, motif);

      const violations = MOTIF_NOT_ORPHANED.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('MOTIF_NOT_ORPHANED');
      expect(violations[0].severity).toBe('soft');
      expect(violations[0].message).toContain('Water imagery');
      expect(violations[0].message).toContain('does not appear');
    });

    it('should not warn when motif appears in a scene', () => {
      const motif = createMotif({ id: 'motif_1' });
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(motif.id, motif);
      graph.nodes.set(scene.id, scene);
      graph.edges.push(edges.appearsIn(motif.id, scene.id));

      const violations = MOTIF_NOT_ORPHANED.evaluate(graph, { mode: 'full' });

      expect(violations).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Combined scenarios
  // ===========================================================================

  describe('Combined scenarios', () => {
    it('should detect multiple rule violations on same scene', () => {
      // Scene with no character and no location
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      graph.nodes.set(scene.id, scene);

      const charViolations = SCENE_HAS_CHARACTER.evaluate(graph, { mode: 'full' });
      const locViolations = SCENE_HAS_LOCATION.evaluate(graph, { mode: 'full' });

      expect(charViolations).toHaveLength(1);
      expect(locViolations).toHaveLength(1);
    });

    it('should handle complete scene with no warnings', () => {
      const scene = createScene('beat_Catalyst', { id: 'scene_1' });
      const character = createCharacter({ id: 'char_1' });
      const location = createLocation({ id: 'loc_1' });
      graph.nodes.set(scene.id, scene);
      graph.nodes.set(character.id, character);
      graph.nodes.set(location.id, location);
      graph.edges.push(edges.hasCharacter(scene.id, character.id));
      graph.edges.push(edges.locatedAt(scene.id, location.id));

      const charViolations = SCENE_HAS_CHARACTER.evaluate(graph, { mode: 'full' });
      const locViolations = SCENE_HAS_LOCATION.evaluate(graph, { mode: 'full' });

      expect(charViolations).toHaveLength(0);
      expect(locViolations).toHaveLength(0);
    });
  });
});
