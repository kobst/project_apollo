# Apollo Changelog - January 2026

## Overview

January 2026 was a transformational month for Apollo. The project evolved from a basic knowledge-graph story editor into a full AI-assisted story development platform. Major arcs include: graph model simplification, AI generation integration, workspace UX overhaul, prompt optimization, structured StoryContext, and the MENTIONS edge system.

---

## Week 1 (Jan 1-5): Graph Model Simplification & Coverage

### Context Layer Nodes
- Added `Premise`, `Setting`, and `GenreTone` context-layer nodes for story metadata
- Auto-computed ordering for PlotPoints and Scenes within beat columns

### Unified Gap Model
- Replaced separate "Open Questions" and "Coverage" systems with a single unified Gap model
- Added Coverage Tab with visual gap indicators

### Node Taxonomy Cleanup
- Replaced the Contract tab with a Stories tab for multi-story management
- Redesigned Workspace with card grid layout and modal detail views
- Added Staging Area for unassigned PlotPoints and Scenes
- Added Story Context (freeform markdown creative direction) and renamed `Premise` to `Logline`
- **Removed `Conflict`, `Theme`, and `Motif` node types** -- these concepts moved into Story Context as freeform content rather than discrete graph nodes
- Added Ideas node type for unassigned creative fragments
- Removed severity/phase gating from rules engine

---

## Week 2 (Jan 6-14): AI Generation Integration

### Core AI Module
- Integrated Anthropic Claude as the AI generation backend
- Built three prompt builders: `buildGenerationPrompt`, `buildInterpretationPrompt`, `buildRefinementPrompt`
- Built three orchestrators: generate, interpret, refine
- Added output parser with robust JSON extraction (handles markdown blocks, trailing commas, preamble text)
- Added ID validation and regeneration for LLM outputs
- Added comprehensive AI module test suite

### Multi-Provider LLM Support
- Abstracted LLM client behind `ILLMClient` interface
- Added OpenAI GPT provider alongside Anthropic Claude
- Provider selection via `APOLLO_AI_PROVIDER` environment variable
- Factory-based client creation (`createLLMClient()`) replacing direct class instantiation

### Generation Tab UI
- Added Generation tab for AI-assisted story development
- Built pre-flight validation for interpretation proposals
- Added robust JSON parsing with `jsonrepair` for malformed LLM outputs
- Added full prompt logging for debugging

### Inline Editing & Packages
- Added inline element editing within the workspace
- Added saved packages system for storing and managing AI-generated proposals
- Improved relationship display with human-readable node names
- Added cascading name changes across references

---

## Week 3 (Jan 15-22): Workspace Redesign & Package Pipeline

### Workspace Architecture
- **3-zone layout**: redesigned workspace with sidebar, main content, and generation panel
- **Elements board**: card-based UI for browsing story elements
- **Premise panel**: card-based editing for story premise/logline
- **Unified propose pipeline**: mode-based generation (Explore, Expand, Focus, Refine)
- Replaced tab-based workspace with unified Story Bible layout
- Integrated generation panel directly into workspace

### Package Management
- Added package actions (accept, reject, save, refine) to workspace
- Saved package staging area for reviewing before commit
- Display proposed nodes inline within beat columns and element grids
- Detailed proposed change counts in TOC navigation
- Remove action for individual elements within packages

### PlotPoint -> StoryBeat Rename
- Renamed `PlotPoint` to `StoryBeat` throughout codebase and UI
- Added StoryBeat-only generation API endpoint
- Added EditPanel fields for StoryBeat properties

### Four-Mode Generation
- Implemented four generation modes: Explore (naked), Expand (from node), Focus (from beat), Refine (from package)
- Backend support for all four modes with proper entry point routing
- Node selection UI for Expand mode

---

## Week 4 (Jan 23-28): StoryContext Restructuring & Legacy Cleanup

### System Prompt Architecture
- Added system prompt caching for stable creative direction (constitution)
- Story Context changes now applied on package accept
- Stashed ideas support with unified Stash section
- Delete functionality for assigned story beats and scenes

### StoryContext Restructuring
- **Refactored StoryContext from freeform markdown string to structured type**:
  - `constitution`: stable creative direction (logline, premise, genre, setting, thematic pillars, hard rules, tone essence, banned elements) -- cached in system prompt
  - `operational`: dynamic soft guidelines with tags, filtered per-task type
- Consolidated Premise section into StoryContext constitution
- Inline proposed changes display for StoryContext modifications
- Typed `StoryContextChangeOperation` discriminated union replacing flat `{ operation, section, content }` format

### Legacy Pipeline Removal
- Removed Clusters/Moves pipeline entirely (endpoints, UI, types, client code)
- Removed unused preview components (PatchPreview, ValidationStatus)
- Migrated documentation to StoryBeat + package-first staging model

### UI Improvements
- Completed Review section in GenerationPanel with accept/reject workflow
- "Send to Ideas" action for StoryBeats and Scenes
- Removed Staging tab (replaced by inline staging)
- Two-tier package carousel with collapsible review sections

---

## Week 5 (Jan 29-31): Prompt Optimization & MENTIONS System

### Prompt Engineering
- **Reduced prompt verbosity by 48%** through compact formatting:
  - Shorter section headers (`## Story State` instead of `## Current Story State`, `## Budget` instead of `## Generation Budget`, etc.)
  - Inline `|`-separated budget format instead of multi-line
  - Arrow notation (`→`) for edges instead of `from -[TYPE]-> to`
  - Inline constraint lists (`Keep:`, `Regenerate:`, `Guidance:`) instead of sub-sections
- Removed redundant role definitions from user prompts (handled by system prompt)
- Fixed LLM node/edge field normalization for refinement variations

### MENTIONS Edge System
- Designed and implemented MENTIONS edge infrastructure in `@apollo/core`:
  - `MENTIONS` edge type for linking nodes that reference each other in text fields
  - Extraction: automatic mention detection from node text content
  - Rebuild: full graph mention recomputation
  - Rename: cascading mention updates when nodes are renamed
  - Validation: mention consistency checks integrated into orchestrators
- 37 unit tests covering extraction, rebuild, rename, and validation
- API endpoints for mention operations (rebuild, stats)
- Migration script for adding MENTIONS edges to existing stories

### Test Suite Fixes (uncommitted)
- Fixed 59+ failing tests across 8 files to match current implementations:
  - `llmClient.test.ts`: Updated to use `createLLMClient()` factory instead of `new LLMClient()`
  - `prompts.test.ts`: Updated all string assertions for compact prompt format
  - `interpretOrchestrator.test.ts`: Updated for typed `StoryContextChangeOperation` and informational-only `relates_to`
  - `refineOrchestrator.test.ts`: Updated `getRefinableElements` assertions for `operationType`/`summary` shape
  - `packageToPatches.test.ts`: Updated storyContext tests for structured operation format
  - `outputParser.test.ts`: Fixed fixture to use new storyContext format
  - `config.test.ts`: Updated `DEFAULT_STORY_CONTEXT` tests (now a structured object, not markdown)
  - `contextSerializer.test.ts`: Fixed obsolete logline test and updated section headers

---

## Key Metrics

| Metric | Start of Jan | End of Jan |
|---|---|---|
| Node types | 10+ (Character, Location, Scene, Beat, Conflict, Theme, Motif, ...) | 8 focused (Character, Location, Object, Beat, StoryBeat, Scene, Idea, CharacterArc) |
| AI providers | 0 | 2 (Anthropic, OpenAI) |
| Generation modes | 0 | 4 (Explore, Expand, Focus, Refine) |
| Test count (core) | ~200 | 361 |
| Test count (api) | ~20 | 43 |
| Total tests | ~220 | 404 (all passing) |
| Prompt token usage | baseline | -48% (prompt optimization) |

## Architecture Summary

```
System Prompt (cached):
  - Story identity (name)
  - Constitution (logline, premise, genre, setting, tone, pillars, rules, bans)

User Prompt (dynamic, per-request):
  - Current story state (nodes by type, edges)
  - Task-specific content (entry point, gaps, ideas, guidelines)
  - Budget constraints
  - Output format specification

StoryContext (structured):
  constitution: { logline, premise, genre, setting, thematicPillars[], hardRules[], toneEssence, banned[], version }
  operational: { softGuidelines[{ id, tags[], text }], workingNotes? }

Package Pipeline:
  Generate/Interpret → NarrativePackage → Review → Accept → Patch → Apply
                                        → Refine → Variations
                                        → Save → Stash
                                        → Reject
```
