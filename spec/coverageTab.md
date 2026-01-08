# Coverage / Gap System Specification

**Version:** 2.0.0
**Date:** 2026-01-06
**Status:** Implemented (Unified into Workspace)

## Overview

The Coverage system provides visual progress indicators showing story completeness across multiple categories. It has been **unified into the Workspace tab** as the **Story Map** navigation panel.

**Key Characteristics:**
- Integrated into the Story Map left navigation
- Progress indicators per category (not just tiers)
- Gap severity badges on categories with issues
- Gaps filtered by selected category in FoundationsPanel

**UI Location:**
- Story Map (left nav in Workspace tab) shows progress bars per category
- Gaps are displayed below the node list when a category is selected
- The unified `/gaps` API endpoint powers both features

---

## 1) Tier Definitions

The coverage pyramid consists of five tiers, ordered from most fundamental (top) to most granular (bottom):

| Tier | Label | What's Counted | Coverage Formula |
|------|-------|----------------|------------------|
| `premise` | Premise | Premise nodes | Has Premise? 1/1 or 0/1 |
| `foundations` | Foundations | Setting, GenreTone, Conflict, Theme, Motif, Character | Count of present types / 6 |
| `structure` | Structure | Distinct Beat types | Unique beat_types / 15 |
| `plotPoints` | Plot Points | Active PlotPoints with SATISFIED_BY edges | Linked PPs / total active PPs |
| `scenes` | Scenes | Scenes with Character + Location | Complete scenes / total scenes |

### 1.1 Tier Computation Details

**Premise Tier:**
- `covered`: 1 if any Premise node exists, 0 otherwise
- `total`: 1
- `percent`: 0% or 100%

**Foundations Tier:**
- Tracks presence of 6 node types: Setting, GenreTone, Conflict, Theme, Motif, Character
- `covered`: Count of types that have at least one node
- `total`: 6
- `percent`: (covered / 6) * 100

**Structure Tier:**
- Based on Save the Cat 15-beat structure
- `covered`: Count of distinct `beat_type` values present
- `total`: 15
- `percent`: (covered / 15) * 100

**Plot Points Tier:**
- Active = proposed or approved (excludes deprecated)
- A plot point is "covered" if it has a SATISFIED_BY edge from a Scene
- `covered`: Active PPs with SATISFIED_BY edges
- `total`: All active PPs
- `percent`: (covered / total) * 100, or 0% if no active PPs

**Scenes Tier:**
- A scene is "complete" if it has both HAS_CHARACTER and LOCATED_AT edges
- `covered`: Scenes with both character and location
- `total`: All scenes
- `percent`: (covered / total) * 100, or 0% if no scenes

---

## 2) Gap Model

A Gap represents a coverage issue that needs attention. Gaps are derived from two sources:
1. **Rule Engine**: Converted from RuleViolation objects via adapter
2. **Derived**: Computed directly from graph analysis (e.g., missing beats)

### 2.1 Gap Types

```typescript
type GapType = 'structural' | 'completeness' | 'creative';
```

| Type | Description |
|------|-------------|
| `structural` | Issues with story structure or ordering |
| `completeness` | Missing required elements |
| `creative` | Orphaned creative elements (themes, motifs) |

### 2.2 Gap Severity

```typescript
type GapSeverity = 'blocker' | 'warn' | 'info';
```

| Severity | Description | Visual |
|----------|-------------|--------|
| `blocker` | Must fix before proceeding | Red border |
| `warn` | Should fix, but not blocking | Orange border |
| `info` | Informational, optional to fix | Blue border |

### 2.3 Gap Interface

```typescript
interface Gap {
  id: string;
  type: GapType;
  tier: GapTier;
  severity: GapSeverity;
  title: string;
  message: string;
  nodeRefs: {
    nodeIds?: string[];
    edgeIds?: string[];
  };
  source: 'rule-engine' | 'derived' | 'user';
  status: 'open' | 'resolved';
}
```

---

## 3) Rule to Tier Mapping

Lint rule violations are mapped to coverage tiers:

### Premise Tier
| Rule ID | Label |
|---------|-------|
| `STORY_HAS_PREMISE` | Missing Premise |

### Foundations Tier
| Rule ID | Label |
|---------|-------|
| `THEME_NOT_ORPHANED` | Orphaned Theme |
| `MOTIF_NOT_ORPHANED` | Orphaned Motif |
| `LOCATION_HAS_SETTING` | Location Without Setting |

### Structure Tier
| Rule ID | Label |
|---------|-------|
| `STC_BEAT_ORDERING` | Beat Order Issue |
| `SCENE_ACT_BOUNDARY` | Scene Act Mismatch |

### Plot Points Tier
| Rule ID | Label |
|---------|-------|
| `PP_HAS_INTENT` | PlotPoint Missing Intent |
| `PP_HAS_CRITERIA` | PlotPoint Missing Criteria |
| `PP_EVENT_REALIZATION` | Unrealized PlotPoint |
| `PP_DAG_NO_CYCLES` | PlotPoint Cycle Detected |
| `PP_ORDER_UNIQUE` | Duplicate PlotPoint Order |
| `PP_ACT_ALIGNMENT` | PlotPoint Act Mismatch |

### Scenes Tier
| Rule ID | Label |
|---------|-------|
| `SCENE_ORDER_UNIQUE` | Duplicate Scene Order |
| `SCENE_HAS_CHARACTER` | Scene Without Character |
| `SCENE_HAS_LOCATION` | Scene Without Location |
| `SCENE_HAS_PLOTPOINT` | Unlinked Scene |
| `EDGE_ORDER_UNIQUE` | Duplicate Edge Order |

---

## 4) API Endpoint

### GET /stories/:id/coverage

Returns coverage metrics and gaps for a story.

**Response:**
```typescript
interface CoverageResponse {
  success: true;
  data: {
    summary: TierSummary[];
    gaps: Gap[];
  };
}

interface TierSummary {
  tier: GapTier;
  label: string;
  covered: number;
  total: number;
  percent: number;
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "summary": [
      { "tier": "premise", "label": "Premise", "covered": 0, "total": 1, "percent": 0 },
      { "tier": "foundations", "label": "Foundations", "covered": 3, "total": 6, "percent": 50 },
      { "tier": "structure", "label": "Structure", "covered": 15, "total": 15, "percent": 100 },
      { "tier": "plotPoints", "label": "Plot Points", "covered": 0, "total": 2, "percent": 0 },
      { "tier": "scenes", "label": "Scenes", "covered": 0, "total": 3, "percent": 0 }
    ],
    "gaps": [
      {
        "id": "gap_rule_001",
        "type": "completeness",
        "tier": "premise",
        "severity": "blocker",
        "title": "Missing Premise",
        "message": "Story has no Premise node defined",
        "nodeRefs": {},
        "source": "rule-engine",
        "status": "open"
      }
    ]
  }
}
```

---

## 5) UI Components

### 5.1 StoryMap (New - Unified)

Left navigation panel in Workspace showing all categories:

**Foundations Section:**
- Premise, Genre/Tone, Setting, Characters, Conflicts, Themes/Motifs

**Outline Section:**
- Structure Board (beat view), Plot Points, Scenes

Each category row displays:
- Label
- Progress bar (color based on completion %)
- Count (covered/total)
- Severity badge (!, ?, i) if gaps exist

### 5.2 FoundationsPanel

Three-column layout for category content:
- **Left**: Node list + filtered GapList below
- **Center**: Node detail panel with edit/delete
- **Right**: Input panel for extraction

### 5.3 GapList (Integrated)

Displayed below node list in FoundationsPanel:
- Filtered to selected category
- Grouped by severity: BLOCKERS, WARNINGS, INFO
- Collapsible via toggle button

### 5.4 Legacy Components (Deprecated)

The following components are still available but deprecated:
- **CoverageView**: Standalone coverage tab (replaced by Workspace)
- **PyramidPanel**: Visual pyramid (replaced by StoryMap)

---

## 6) File Structure

```
packages/core/src/coverage/
├── types.ts       # Gap, TierSummary, CoverageResponse types
├── adapter.ts     # RuleViolation → Gap conversion
├── compute.ts     # Main computeCoverage() function
└── index.ts       # Module exports

packages/api/src/handlers/
├── gaps.ts        # GET /stories/:id/gaps (unified endpoint)
└── coverage.ts    # GET /stories/:id/coverage (legacy)

packages/ui/src/components/workspace/
├── WorkspaceView.tsx      # Main workspace container
├── StoryMap.tsx           # Left nav with progress indicators
├── StoryMap.module.css
├── FoundationsPanel.tsx   # List+editor+gaps layout
└── FoundationsPanel.module.css

packages/ui/src/components/coverage/  (legacy)
├── CoverageView.tsx
├── PyramidPanel.tsx
├── GapList.tsx
└── GapItem.tsx
```

---

## 7) Usage

1. Navigate to the **Workspace** tab in the UI
2. View the **Story Map** on the left to see category progress
3. Click a category to see its nodes and filtered gaps
4. Gaps appear below the node list with severity indicators
5. Progress updates automatically when you make changes

---

## 8) Future Enhancements (V2+)

- **Gap Actions**: Quick-fix buttons for common issues
- **Autofix**: Automated resolution for simple gaps
- **History**: Track coverage progress over time
- **Export**: Generate coverage reports
- **Custom Rules**: User-defined coverage rules
