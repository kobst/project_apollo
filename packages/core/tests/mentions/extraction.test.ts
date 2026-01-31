/**
 * Tests for entity mention extraction
 */

import { describe, it, expect } from 'vitest';
import { extractMentions, type EntityInfo } from '../../src/mentions/extraction.js';

describe('extractMentions', () => {
  describe('exact name matching', () => {
    it('should find exact character name match', () => {
      const entities: EntityInfo[] = [
        { id: 'char_1', type: 'Character', name: 'John Smith' }
      ];
      
      const text = 'John Smith walked into the room.';
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        entityId: 'char_1',
        entityType: 'Character',
        matchedText: 'John Smith',
        confidence: 1.0
      });
    });

    it('should find multiple different entities', () => {
      const entities: EntityInfo[] = [
        { id: 'char_1', type: 'Character', name: 'John' },
        { id: 'loc_1', type: 'Location', name: 'Central Park' }
      ];
      
      const text = 'John walked through Central Park.';
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(2);
      expect(mentions.map(m => m.entityId)).toContain('char_1');
      expect(mentions.map(m => m.entityId)).toContain('loc_1');
    });

    it('should be case insensitive', () => {
      const entities: EntityInfo[] = [
        { id: 'char_1', type: 'Character', name: 'John Smith' }
      ];
      
      const text = 'JOHN SMITH entered. Then john smith sat down.';
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.entityId).toBe('char_1');
    });

    it('should not match partial words', () => {
      const entities: EntityInfo[] = [
        { id: 'char_1', type: 'Character', name: 'Ann' }
      ];
      
      const text = 'The banner was raised by Annabelle.';
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(0);
    });
  });

  describe('possessive forms', () => {
    it('should match possessive form', () => {
      const entities: EntityInfo[] = [
        { id: 'char_1', type: 'Character', name: 'John' }
      ];
      
      const text = "John's car was parked outside.";
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.confidence).toBe(1.0);
    });
  });

  describe('aliases', () => {
    it('should match alias with high confidence', () => {
      const entities: EntityInfo[] = [
        { 
          id: 'char_1', 
          type: 'Character', 
          name: 'Robert Johnson',
          aliases: ['Bob', 'Bobby']
        }
      ];
      
      const text = 'Bob called out to the others.';
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        entityId: 'char_1',
        matchedText: 'Bob',
        confidence: 0.95
      });
    });

    it('should prefer exact name over alias', () => {
      const entities: EntityInfo[] = [
        { 
          id: 'char_1', 
          type: 'Character', 
          name: 'Robert Johnson',
          aliases: ['Bob']
        }
      ];
      
      const text = 'Robert Johnson and Bob were there.';
      const mentions = extractMentions(text, entities);
      
      // Should match Robert Johnson with higher confidence
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.matchedText).toBe('Robert Johnson');
      expect(mentions[0]?.confidence).toBe(1.0);
    });
  });

  describe('partial name matching', () => {
    it('should match first name with lower confidence', () => {
      const entities: EntityInfo[] = [
        { id: 'char_1', type: 'Character', name: 'John Smith' }
      ];
      
      // No full name match, only first name
      const text = 'John walked away.';
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        entityId: 'char_1',
        matchedText: 'John',
        confidence: 0.7
      });
    });

    it('should match last name with lower confidence', () => {
      const entities: EntityInfo[] = [
        { id: 'char_1', type: 'Character', name: 'John Smith' }
      ];
      
      const text = 'Smith nodded.';
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        entityId: 'char_1',
        matchedText: 'Smith',
        confidence: 0.7
      });
    });
  });

  describe('locations and objects', () => {
    it('should find location mentions', () => {
      const entities: EntityInfo[] = [
        { id: 'loc_1', type: 'Location', name: 'The Dusty Saloon' }
      ];
      
      const text = 'They met at The Dusty Saloon.';
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.entityType).toBe('Location');
    });

    it('should find object mentions', () => {
      const entities: EntityInfo[] = [
        { id: 'obj_1', type: 'Object', name: 'Ancient Scroll' }
      ];
      
      const text = 'She picked up the Ancient Scroll.';
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]?.entityType).toBe('Object');
    });
  });

  describe('edge cases', () => {
    it('should return empty for empty text', () => {
      const entities: EntityInfo[] = [
        { id: 'char_1', type: 'Character', name: 'John' }
      ];
      
      const mentions = extractMentions('', entities);
      expect(mentions).toHaveLength(0);
    });

    it('should return empty for no entities', () => {
      const mentions = extractMentions('Some text here.', []);
      expect(mentions).toHaveLength(0);
    });

    it('should handle special characters in names', () => {
      const entities: EntityInfo[] = [
        { id: 'char_1', type: 'Character', name: "O'Brien" }
      ];
      
      const text = "O'Brien stepped forward.";
      const mentions = extractMentions(text, entities);
      
      expect(mentions).toHaveLength(1);
    });
  });
});
