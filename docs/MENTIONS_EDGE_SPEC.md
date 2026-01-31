# Entity Mention Tracking System (MENTIONS Edges)

**Date:** 2025-06-01  
**Status:** Proposal  
**Author:** Esh (AI Assistant)  

---

## 1. Problem Statement

### 1.1 Current Limitations

The Apollo graph tracks **structural relationships** via edges (HAS_CHARACTER, LOCATED_AT, ALIGNS_WITH), but does not track **textual references** to entities within node content.

**Example:**
```
Scene node:
  id: "scene_123"
  summary: "Cain meets Dante at the marina. Dante offers information about Morrison's crew."
  edges: [HAS_CHARACTER → char_cain, HAS_CHARACTER → char_dante, LOCATED_AT → loc_marina]
```

The edges capture that Cain and Dante are IN the scene, but the text also mentions "Morrison's crew" — a reference to `char_morrison` that isn't tracked.

### 1.2 Problems This Causes

| Problem | Description |
|---------|-------------|
| **Name changes don't propagate** | Renaming "Cain" to "Marcus" updates the Character node but leaves all text summaries stale |
| **Temporal validation is incomplete** | Can't detect "this beat mentions Flores before Flores is introduced" without parsing text |
| **Impact analysis misses dependencies** | Proposals that reference characters in text (but not via edges) have hidden dependencies |
| **Orphaned references** | Deleting a character leaves text mentioning them, with no way to find affected nodes |
| **Search is limited** | Can't query "all nodes that mention Morrison" without full-text search |

### 1.3 Goals

1. Track entity mentions in text content via structured edges
2. Enable automatic name change propagation
3. Enable temporal/continuity validation
4. Enable richer impact analysis
5. Maintain reasonable performance as graphs grow

---

## 2. Proposed Solution: MENTIONS Edges

### 2.1 Core Concept

Introduce a new edge type `MENTIONS` that links content nodes to the entities they reference in text:

```
StoryBeat --MENTIONS--> Character
Scene --MENTIONS--> Character
Scene --MENTIONS--> Location
StoryBeat --MENTIONS--> Location
* --MENTIONS--> Object
```

These edges are **derived** from text content, not manually created. They're computed when content is created or updated.

### 2.2 Edge Schema

```typescript
interface MentionsEdge {
  type: 'MENTIONS';
  from: string;           // Node ID containing the text (scene, storybeat, etc.)
  to: string;             // Entity ID being mentioned (character, location, object)
  properties: {
    field: string;        // Which field contains the mention ('summary', 'description', etc.)
    confidence: number;   // 0-1, how confident the extraction is
    variant?: string;     // The actual text matched ("Cain", "Cain's", "Mr. Cain")
  };
}
```

### 2.3 Difference from HAS_CHARACTER/LOCATED_AT

| Edge Type | Meaning | Created By | Purpose |
|-----------|---------|------------|---------|
| HAS_CHARACTER | Character participates in scene | User/LLM explicit | Structural relationship |
| LOCATED_AT | Scene takes place at location | User/LLM explicit | Structural relationship |
| MENTIONS | Entity is referenced in text | System (extracted) | Text tracking |

A scene might have:
- `HAS_CHARACTER → char_cain` (Cain is in the scene)
- `HAS_CHARACTER → char_dante` (Dante is in the scene)
- `MENTIONS → char_morrison` (Morrison is mentioned but not present)

---

## 3. Implementation Details

### 3.1 Entity Extraction

#### 3.1.1 Extraction Function

```typescript
interface MentionMatch {
  entityId: string;
  entityType: 'Character' | 'Location' | 'Object';
  matchedText: string;
  confidence: number;
}

function extractMentions(
  text: string,
  entities: Array<{ id: string; type: string; name: string; aliases?: string[] }>
): MentionMatch[] {
  const mentions: MentionMatch[] = [];
  
  for (const entity of entities) {
    // Build patterns for this entity
    const patterns = buildPatterns(entity.name, entity.aliases);
    
    for (const pattern of patterns) {
      if (matchesPattern(text, pattern)) {
        mentions.push({
          entityId: entity.id,
          entityType: entity.type as 'Character' | 'Location' | 'Object',
          matchedText: pattern.matched,
          confidence: pattern.confidence
        });
        break; // One match per entity is enough
      }
    }
  }
  
  return mentions;
}

function buildPatterns(name: string, aliases: string[] = []): Pattern[] {
  const patterns: Pattern[] = [];
  
  // Exact name match (high confidence)
  patterns.push({ regex: new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi'), confidence: 1.0 });
  
  // Possessive form
  patterns.push({ regex: new RegExp(`\\b${escapeRegex(name)}'s\\b`, 'gi'), confidence: 1.0 });
  
  // Aliases
  for (const alias of aliases) {
    patterns.push({ regex: new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi'), confidence: 0.9 });
  }
  
  // First name only (if name has multiple parts) - lower confidence
  const firstName = name.split(' ')[0];
  if (firstName !== name && firstName.length > 2) {
    patterns.push({ regex: new RegExp(`\\b${escapeRegex(firstName)}\\b`, 'gi'), confidence: 0.7 });
  }
  
  return patterns;
}
```

#### 3.1.2 Fields to Extract From

```typescript
const EXTRACTABLE_FIELDS: Record<string, string[]> = {
  'StoryBeat': ['title', 'summary'],
  'Scene': ['heading', 'scene_overview', 'key_actions'],
  'Character': ['description', 'backstory'],
  'Location': ['description'],
  'CharacterArc': ['starting_state', 'ending_state', 'key_moments'],
};
```

### 3.2 When to Extract

#### 3.2.1 On Node Create/Update

```typescript
async function onNodeChange(
  nodeId: string,
  nodeType: string,
  data: Record<string, unknown>,
  graph: GraphState
): Promise<void> {
  // Get fields to extract from
  const fields = EXTRACTABLE_FIELDS[nodeType] || [];
  
  // Get all entities that could be mentioned
  const characters = getNodesByType(graph, 'Character');
  const locations = getNodesByType(graph, 'Location');
  const objects = getNodesByType(graph, 'Object');
  const entities = [...characters, ...locations, ...objects].map(e => ({
    id: e.id,
    type: e.type,
    name: e.data.name,
    aliases: e.data.aliases
  }));
  
  // Remove existing MENTIONS edges from this node
  await removeMentionsEdges(nodeId, graph);
  
  // Extract mentions from each field
  for (const field of fields) {
    const text = data[field];
    if (typeof text === 'string') {
      const mentions = extractMentions(text, entities);
      
      for (const mention of mentions) {
        await addEdge({
          type: 'MENTIONS',
          from: nodeId,
          to: mention.entityId,
          properties: {
            field,
            confidence: mention.confidence,
            variant: mention.matchedText
          }
        }, graph);
      }
    }
    
    // Handle array fields (like key_actions)
    if (Array.isArray(text)) {
      for (const item of text) {
        if (typeof item === 'string') {
          const mentions = extractMentions(item, entities);
          // ... same as above
        }
      }
    }
  }
}
```

#### 3.2.2 On Graph Load (Migration/Rebuild)

```typescript
async function rebuildAllMentions(graph: GraphState): Promise<void> {
  // Remove all existing MENTIONS edges
  graph.edges = graph.edges.filter(e => e.type !== 'MENTIONS');
  
  // Rebuild for all content nodes
  const contentNodes = graph.nodes.filter(n => 
    EXTRACTABLE_FIELDS[n.type] !== undefined
  );
  
  for (const node of contentNodes) {
    await onNodeChange(node.id, node.type, node.data, graph);
  }
}
```

### 3.3 Name Change Propagation

```typescript
async function renameEntity(
  entityId: string,
  newName: string,
  graph: GraphState
): Promise<{ updatedNodes: string[] }> {
  const entity = getNode(entityId, graph);
  const oldName = entity.data.name;
  const entityType = entity.type;
  
  // Find all nodes that mention this entity
  const mentioningEdges = graph.edges.filter(
    e => e.type === 'MENTIONS' && e.to === entityId
  );
  
  const updatedNodes: string[] = [];
  
  for (const edge of mentioningEdges) {
    const node = getNode(edge.from, graph);
    const field = edge.properties.field;
    const variant = edge.properties.variant || oldName;
    
    // Compute the replacement for this variant
    const newVariant = computeVariantReplacement(variant, oldName, newName);
    
    // Update the field
    if (typeof node.data[field] === 'string') {
      node.data[field] = node.data[field].replace(
        new RegExp(`\\b${escapeRegex(variant)}\\b`, 'g'),
        newVariant
      );
    } else if (Array.isArray(node.data[field])) {
      node.data[field] = node.data[field].map(item =>
        typeof item === 'string'
          ? item.replace(new RegExp(`\\b${escapeRegex(variant)}\\b`, 'g'), newVariant)
          : item
      );
    }
    
    updatedNodes.push(edge.from);
  }
  
  // Update the entity itself
  entity.data.name = newName;
  
  // Rebuild MENTIONS edges for affected nodes (names might have changed patterns)
  for (const nodeId of updatedNodes) {
    const node = getNode(nodeId, graph);
    await onNodeChange(nodeId, node.type, node.data, graph);
  }
  
  return { updatedNodes };
}

function computeVariantReplacement(variant: string, oldName: string, newName: string): string {
  // Handle possessives
  if (variant.endsWith("'s")) {
    return newName + "'s";
  }
  // Handle other patterns as needed
  return newName;
}
```

### 3.4 Temporal Validation

```typescript
interface TemporalViolation {
  nodeId: string;
  nodeType: string;
  mentionedEntity: string;
  mentionedEntityName: string;
  atBeat: string;
  introducedAtBeat: string;
  message: string;
}

function validateTemporalConsistency(
  graph: GraphState
): TemporalViolation[] {
  const violations: TemporalViolation[] = [];
  
  // Get beat ordering
  const beatOrder = getBeatOrder(graph); // Returns map of beatId -> position
  
  // Get character introduction points
  const introductions = computeIntroductionPoints(graph);
  
  // Check each StoryBeat
  const storyBeats = getNodesByType(graph, 'StoryBeat');
  
  for (const beat of storyBeats) {
    const alignedTo = getAlignedBeat(beat.id, graph);
    if (!alignedTo) continue;
    
    const beatPosition = beatOrder.get(alignedTo);
    if (beatPosition === undefined) continue;
    
    // Get characters mentioned in this beat
    const mentions = graph.edges.filter(
      e => e.type === 'MENTIONS' && e.from === beat.id
    );
    
    for (const mention of mentions) {
      const entityIntro = introductions.get(mention.to);
      if (!entityIntro) continue; // Entity not tracked or always available
      
      const introPosition = beatOrder.get(entityIntro);
      if (introPosition === undefined) continue;
      
      if (introPosition > beatPosition) {
        const entity = getNode(mention.to, graph);
        violations.push({
          nodeId: beat.id,
          nodeType: 'StoryBeat',
          mentionedEntity: mention.to,
          mentionedEntityName: entity.data.name,
          atBeat: alignedTo,
          introducedAtBeat: entityIntro,
          message: `"${entity.data.name}" mentioned at ${alignedTo} (position ${beatPosition}) but introduced at ${entityIntro} (position ${introPosition})`
        });
      }
    }
  }
  
  return violations;
}

function computeIntroductionPoints(graph: GraphState): Map<string, string> {
  const introductions = new Map<string, string>();
  const beatOrder = getBeatOrder(graph);
  
  // For each character, find their earliest appearance
  const characters = getNodesByType(graph, 'Character');
  
  for (const char of characters) {
    let earliestBeat: string | null = null;
    let earliestPosition = Infinity;
    
    // Check HAS_CHARACTER edges (character participates in scene)
    const sceneEdges = graph.edges.filter(
      e => e.type === 'HAS_CHARACTER' && e.to === char.id
    );
    
    for (const edge of sceneEdges) {
      const scene = getNode(edge.from, graph);
      const sceneBeat = getSceneAlignedBeat(scene.id, graph);
      if (sceneBeat) {
        const pos = beatOrder.get(sceneBeat) ?? Infinity;
        if (pos < earliestPosition) {
          earliestPosition = pos;
          earliestBeat = sceneBeat;
        }
      }
    }
    
    // Check MENTIONS edges (character mentioned in story beat)
    const mentionEdges = graph.edges.filter(
      e => e.type === 'MENTIONS' && e.to === char.id
    );
    
    for (const edge of mentionEdges) {
      const node = getNode(edge.from, graph);
      if (node.type === 'StoryBeat') {
        const alignedBeat = getAlignedBeat(node.id, graph);
        if (alignedBeat) {
          const pos = beatOrder.get(alignedBeat) ?? Infinity;
          if (pos < earliestPosition) {
            earliestPosition = pos;
            earliestBeat = alignedBeat;
          }
        }
      }
    }
    
    if (earliestBeat) {
      introductions.set(char.id, earliestBeat);
    }
  }
  
  return introductions;
}
```

### 3.5 Proposal Validation (Pre-commit)

```typescript
interface ProposalValidationResult {
  valid: boolean;
  temporalViolations: TemporalViolation[];
  missingDependencies: Array<{
    nodeId: string;
    mentionedName: string;
    message: string;
  }>;
}

function validateProposal(
  pkg: NarrativePackage,
  graph: GraphState
): ProposalValidationResult {
  const violations: TemporalViolation[] = [];
  const missingDeps: Array<{ nodeId: string; mentionedName: string; message: string }> = [];
  
  // Get all existing + proposed entities
  const existingEntities = getAllEntities(graph);
  const proposedEntities = pkg.changes.nodes
    .filter(n => ['Character', 'Location', 'Object'].includes(n.node_type))
    .map(n => ({
      id: n.node_id,
      type: n.node_type,
      name: n.data.name,
      aliases: n.data.aliases
    }));
  const allEntities = [...existingEntities, ...proposedEntities];
  
  // Get beat ordering
  const beatOrder = getBeatOrder(graph);
  
  // Get introduction points (existing + what this proposal would introduce)
  const introductions = computeIntroductionPoints(graph);
  
  // Add proposed introductions
  for (const node of pkg.changes.nodes) {
    if (node.node_type === 'StoryBeat') {
      const alignedEdge = pkg.changes.edges.find(
        e => e.edge_type === 'ALIGNS_WITH' && e.from === node.node_id
      );
      if (alignedEdge) {
        // Characters mentioned here are "introduced" at this beat (for proposal purposes)
        const mentions = extractMentions(node.data.summary || '', allEntities);
        for (const mention of mentions) {
          if (!introductions.has(mention.entityId)) {
            introductions.set(mention.entityId, alignedEdge.to);
          }
        }
      }
    }
  }
  
  // Validate each proposed StoryBeat
  for (const node of pkg.changes.nodes) {
    if (node.node_type === 'StoryBeat') {
      const alignedEdge = pkg.changes.edges.find(
        e => e.edge_type === 'ALIGNS_WITH' && e.from === node.node_id
      );
      if (!alignedEdge) continue;
      
      const targetBeat = alignedEdge.to;
      const beatPosition = beatOrder.get(targetBeat);
      if (beatPosition === undefined) continue;
      
      // Extract mentions
      const textToCheck = [
        node.data.title,
        node.data.summary
      ].filter(Boolean).join(' ');
      
      const mentions = extractMentions(textToCheck, allEntities);
      
      for (const mention of mentions) {
        const introBeat = introductions.get(mention.entityId);
        
        if (!introBeat) {
          // Entity not found - might be a new name not in our entities list
          // This could be a missing dependency or just a non-entity word
          // Flag with lower confidence
          continue;
        }
        
        const introPosition = beatOrder.get(introBeat);
        if (introPosition !== undefined && introPosition > beatPosition) {
          const entity = allEntities.find(e => e.id === mention.entityId);
          violations.push({
            nodeId: node.node_id,
            nodeType: 'StoryBeat',
            mentionedEntity: mention.entityId,
            mentionedEntityName: entity?.name || mention.entityId,
            atBeat: targetBeat,
            introducedAtBeat: introBeat,
            message: `"${entity?.name}" referenced at ${targetBeat} (position ${beatPosition}) but first appears at ${introBeat} (position ${introPosition})`
          });
        }
      }
    }
  }
  
  return {
    valid: violations.length === 0 && missingDeps.length === 0,
    temporalViolations: violations,
    missingDependencies: missingDeps
  };
}
```

---

## 4. Integration Points

### 4.1 Graph Operations

| Operation | MENTIONS Handling |
|-----------|-------------------|
| `addNode` | Extract mentions, create MENTIONS edges |
| `updateNode` | Remove old MENTIONS edges, re-extract, create new edges |
| `deleteNode` | Remove all MENTIONS edges from/to this node |
| `renameEntity` | Propagate name change, update text, rebuild MENTIONS |

### 4.2 Orchestrator Integration

```typescript
// In storyBeatOrchestrator.ts (and others)
export async function proposeStoryBeats(...): Promise<ProposeStoryBeatsResponse> {
  // ... existing generation code ...
  
  // After parsing LLM response, validate proposals
  const validatedPackages = packages.map(pkg => {
    const validation = validateProposal(pkg, graph);
    return {
      ...pkg,
      validation: {
        temporalViolations: validation.temporalViolations,
        missingDependencies: validation.missingDependencies
      }
    };
  });
  
  return {
    sessionId: session.id,
    packages: validatedPackages,
    missingBeats
  };
}
```

### 4.3 Prompt Enhancement

Add introduction context to prompts:

```typescript
function serializeCharactersWithIntroductions(
  graph: GraphState
): string {
  const characters = getNodesByType(graph, 'Character');
  const introductions = computeIntroductionPoints(graph);
  
  return characters.map(char => {
    const intro = introductions.get(char.id);
    const introLabel = intro ? `[introduced: ${intro}]` : '[not yet introduced]';
    return `- **${char.data.name}** (${char.data.archetype || 'unknown'}) ${introLabel}: ${truncate(char.data.description, 80)}`;
  }).join('\n');
}
```

Update prompt templates:
```diff
## Characters (reference only)
+ **Note:** Only reference characters at or after their introduction point.
+ 
- - **Cain** (PROTAGONIST): Retired gangster...
+ - **Cain** (PROTAGONIST) [introduced: beat_Setup]: Retired gangster...
+ - **Flores** (Loose Cannon) [introduced: beat_FunAndGames]: Ex-marine...
```

---

## 5. API Changes

### 5.1 New Endpoints

```typescript
// Rename an entity with text propagation
POST /stories/:id/entities/:entityId/rename
Body: { newName: string }
Response: { 
  success: boolean;
  updatedNodes: string[];
  entity: Entity;
}

// Get all mentions of an entity
GET /stories/:id/entities/:entityId/mentions
Response: {
  mentions: Array<{
    nodeId: string;
    nodeType: string;
    field: string;
    context: string; // Snippet of text around the mention
  }>;
}

// Validate temporal consistency
GET /stories/:id/validate/temporal
Response: {
  valid: boolean;
  violations: TemporalViolation[];
}

// Rebuild all MENTIONS edges (admin/migration)
POST /stories/:id/mentions/rebuild
Response: {
  edgesCreated: number;
  nodesProcessed: number;
}
```

### 5.2 Modified Response Schemas

```typescript
// Proposal packages now include validation
interface NarrativePackage {
  // ... existing fields ...
  validation?: {
    temporalViolations: TemporalViolation[];
    missingDependencies: MissingDependency[];
  };
}
```

---

## 6. Migration Strategy

### 6.1 For Existing Stories

1. Add migration script to rebuild MENTIONS edges for all existing stories
2. Run as a one-time operation or on-demand
3. MENTIONS edges are derived data — can always be rebuilt

```typescript
// Migration script
async function migrateAllStories() {
  const stories = await listAllStories();
  for (const storyId of stories) {
    const graph = await loadGraph(storyId);
    await rebuildAllMentions(graph);
    await saveGraph(storyId, graph);
    console.log(`Migrated ${storyId}: created ${countMentionsEdges(graph)} MENTIONS edges`);
  }
}
```

### 6.2 Schema Version

Add to story metadata:
```typescript
interface StoryMetadata {
  // ...
  schemaVersion: number; // Increment when MENTIONS system is added
}
```

---

## 7. Performance Considerations

### 7.1 Extraction Cost

- Entity extraction is O(entities × text_length) per field
- For a story with 20 characters, 10 locations, processing a 500-char summary: ~15,000 comparisons
- This is fast (<10ms) but should be batched for bulk operations

### 7.2 Edge Storage

- MENTIONS edges are lightweight (just IDs and small properties)
- A scene mentioning 3 characters = 3 additional edges
- Estimated: 2-5 MENTIONS edges per content node
- For a 200-node story: ~500-1000 MENTIONS edges

### 7.3 Query Patterns

Index recommendations:
- `edges.type` — for filtering MENTIONS edges
- `edges.to` — for "who mentions entity X?" queries
- `edges.from` — for "what does node Y mention?" queries

---

## 8. Future Enhancements

### 8.1 Fuzzy Matching

- Handle misspellings: "Cain" vs "Cian"
- Handle partial matches: "the Captain" → Captain Morrison
- Use edit distance or phonetic matching

### 8.2 Pronoun Resolution

- "He walked in" — who is "he"?
- Requires NLP co-reference resolution
- Could use LLM for ambiguous cases

### 8.3 Relationship Extraction

- "Cain met with Rigo's lieutenant" → relationship edge?
- Extract not just mentions but relationships from text

### 8.4 Mention Highlighting in UI

- Show mentions as clickable links in text
- Hover to see entity card
- Click to navigate to entity

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
describe('extractMentions', () => {
  it('finds exact name matches', () => {
    const text = 'Cain walked into the bar.';
    const entities = [{ id: 'char_1', type: 'Character', name: 'Cain' }];
    const mentions = extractMentions(text, entities);
    expect(mentions).toHaveLength(1);
    expect(mentions[0].entityId).toBe('char_1');
  });
  
  it('finds possessive forms', () => {
    const text = "Cain's gun was on the table.";
    const entities = [{ id: 'char_1', type: 'Character', name: 'Cain' }];
    const mentions = extractMentions(text, entities);
    expect(mentions).toHaveLength(1);
  });
  
  it('does not match partial words', () => {
    const text = 'The captain gave orders.';
    const entities = [{ id: 'char_1', type: 'Character', name: 'Cap' }];
    const mentions = extractMentions(text, entities);
    expect(mentions).toHaveLength(0);
  });
  
  it('handles multiple entities', () => {
    const text = 'Cain met Dante at the marina.';
    const entities = [
      { id: 'char_1', type: 'Character', name: 'Cain' },
      { id: 'char_2', type: 'Character', name: 'Dante' },
      { id: 'loc_1', type: 'Location', name: 'marina' }
    ];
    const mentions = extractMentions(text, entities);
    expect(mentions).toHaveLength(3);
  });
});

describe('renameEntity', () => {
  it('propagates name change to all mentioning nodes', async () => {
    const graph = createTestGraph();
    // Add a scene that mentions "Cain"
    // ...
    
    await renameEntity('char_cain', 'Marcus', graph);
    
    const scene = getNode('scene_1', graph);
    expect(scene.data.summary).toContain('Marcus');
    expect(scene.data.summary).not.toContain('Cain');
  });
});

describe('validateTemporalConsistency', () => {
  it('detects character used before introduction', () => {
    const graph = createTestGraph();
    // Flores introduced at beat_FunAndGames
    // StoryBeat at beat_Catalyst mentions Flores
    
    const violations = validateTemporalConsistency(graph);
    expect(violations).toHaveLength(1);
    expect(violations[0].mentionedEntityName).toBe('Flores');
  });
});
```

### 9.2 Integration Tests

- Test full flow: create story → add characters → add scenes → validate mentions
- Test migration: load old story → rebuild mentions → verify correctness
- Test rename: rename character → verify all text updated

---

## 10. Implementation Checklist

- [ ] Add MENTIONS edge type to schema
- [ ] Implement `extractMentions()` function
- [ ] Implement `onNodeChange()` hook for mention extraction
- [ ] Implement `renameEntity()` with text propagation
- [ ] Implement `computeIntroductionPoints()` 
- [ ] Implement `validateTemporalConsistency()`
- [ ] Implement `validateProposal()` for pre-commit validation
- [ ] Update orchestrators to include validation in response
- [ ] Update prompts with introduction context
- [ ] Add migration script for existing stories
- [ ] Add API endpoints (rename, mentions, validate)
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Update UI to display validation warnings (separate task)

---

## 11. Open Questions

1. **Should MENTIONS edges be persisted or computed on-demand?**
   - Persisting is faster for queries but requires maintenance
   - Computing on-demand is simpler but slower for large graphs
   - Recommendation: Persist, with rebuild capability

2. **How to handle ambiguous names?**
   - "The Captain" could be Morrison or a generic reference
   - Recommendation: Lower confidence score, let user confirm

3. **Should we extract from LLM output before committing?**
   - Could validate proposals before user sees them
   - Or let user see raw output, show warnings
   - Recommendation: Show warnings, don't auto-fix

4. **How to handle aliases/nicknames?**
   - Character "Captain Frank Morrison" might be called "Frank", "Morrison", "the Captain"
   - Recommendation: Add `aliases` field to Character schema
