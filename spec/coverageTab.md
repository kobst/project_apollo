# Coverage Tab Specification

**Version:** 1.0.0
**Date:** 2026-01-05
**Status:** Implemented

## Overview

The Coverage Tab provides a visual progress indicator showing story completeness across five hierarchical tiers. It serves as an informational dashboard that aggregates rule violations and derived checks into a unified "Gap" model.

**Key Characteristics:**
- Purely informational (no fix actions in V1)
- Unifies lint rule violations with derived coverage checks
- Visual pyramid representation of story completeness
- Expandable gap details for investigation

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

### 5.1 CoverageView

Main container component with:
- Header showing story name and Refresh button
- Two-column layout: PyramidPanel (left) + GapList (right)
- State management for coverage data and tier filtering

### 5.2 PyramidPanel

Visual pyramid showing five tiers:
- Each tier displays: label, covered/total, progress bar
- Progress bar color based on percentage:
  - Green: >= 80%
  - Orange: >= 50%
  - Red: < 50%
- Click tier to filter gaps (toggle selection)
- Selected tier highlighted with accent color

### 5.3 GapList

List of gaps grouped by severity:
- Sections: BLOCKERS, WARNINGS, INFO
- Empty state: "No gaps found - great work!"
- Respects tier filter from PyramidPanel

### 5.4 GapItem

Expandable gap row:
- Collapsed: title, type badge, tier badge
- Expanded: message, related node IDs, source
- Severity indicated by left border color

---

## 6) File Structure

```
packages/core/src/coverage/
├── types.ts       # Gap, TierSummary, CoverageResponse types
├── adapter.ts     # RuleViolation → Gap conversion
├── compute.ts     # Main computeCoverage() function
└── index.ts       # Module exports

packages/api/src/handlers/
└── coverage.ts    # GET /stories/:id/coverage handler

packages/ui/src/components/coverage/
├── CoverageView.tsx
├── CoverageView.module.css
├── PyramidPanel.tsx
├── PyramidPanel.module.css
├── GapList.tsx
├── GapList.module.css
├── GapItem.tsx
└── GapItem.module.css
```

---

## 7) Usage

1. Navigate to the Coverage tab in the UI
2. View the pyramid to see overall story completeness
3. Click a tier to filter gaps to that tier
4. Expand gaps to see details and related nodes
5. Use the Refresh button to re-fetch coverage after making changes

---

## 8) Future Enhancements (V2+)

- **Gap Actions**: Quick-fix buttons for common issues
- **Autofix**: Automated resolution for simple gaps
- **History**: Track coverage progress over time
- **Export**: Generate coverage reports
- **Custom Rules**: User-defined coverage rules
