
Planning Tab — UI Specification
Date: 2026-02-01
Status: Proposal
Supersedes: Current inline Planning/Stash section in Workspace tab
Author: Esh (AI Assistant)

1. Overview
1.1 Problem
The current Planning section lives at the bottom of the Workspace scroll, below Elements, Structure, and Context. This creates three issues: the user must scroll past the entire story bible to reach it, they cannot cross-reference planning ideas against structure or elements without losing their place, and the filter-heavy toolbar (three dropdowns, three chips, a collapsible filter pane) is disproportionately complex for the content it manages.
1.2 Solution
Promote Planning to a top-level tab (peer to Stories and Workspace) with its own three-column layout. The left sidebar becomes a planning-native inventory grouped by kind. The center area is the working space for viewing, editing, and refining ideas. The right panel provides both idea generation controls and a compact story bible reference for cross-referencing.
1.3 Design Principles

Spatial grouping replaces filtering. The sidebar organizes ideas by kind, eliminating the need for Kind/Resolution/Status dropdowns and quick chips.
Cross-referencing is always available. A read-only story bible reference in the right panel means you never scroll away from your planning work.
Capture is low-friction. A persistent quick-add form is always accessible without modals or inline forms that push content.
Planning and building are distinct modes. Separating them into tabs reflects different cognitive activities and prevents planning from being buried beneath artifacts.


2. Top-Level Navigation
2.1 Tab Bar
[ Stories ] [ Workspace ] [ Planning ]
Planning is added as a third tab in the existing top-level tab bar. Active state styling matches the existing pattern (filled background for active tab, text-only for inactive).
2.2 Tab Behavior
Clicking the Planning tab loads the Planning view. State is preserved when switching between tabs — if the user was viewing a specific idea, it remains selected when they return to Planning. The Workspace tab no longer renders the inline Planning/Stash section (see §9 for migration details).
2.3 Sidebar Label
In the Workspace tab's left sidebar, "Stash" is renamed to "Planning" and becomes a clickable link that switches to the Planning tab rather than scrolling to a section. It retains a count badge showing the number of active ideas. The icon remains the same (📥) or can be updated to match the Planning tab.

Open question: Should clicking "Planning" in the Workspace sidebar switch tabs, or should the Workspace retain a compact planning summary widget in place of the current full section? (See §9.)


3. Layout — Three-Column Structure
The Planning tab uses a three-column layout consistent with the Workspace pattern but with planning-specific content in each column.
┌─────────────────────────────────────────────────────────────┐
│  [ Stories ] [ Workspace ] [ Planning ]                     │
├──────────┬───────────────────────┬──────────────────────────┤
│          │                       │                          │
│ PLANNING │   CENTER AREA         │   RIGHT PANEL            │
│ INVENTORY│                       │                          │
│          │   Detail / List view  │   Generate / Refine      │
│ (sidebar)│                       │   ──────────────         │
│          │                       │   Story Bible Reference  │
│  200px   │   flex                │   ~350-400px             │
│  fixed   │                       │   collapsible            │
│          │                       │                          │
└──────────┴───────────────────────┴──────────────────────────┘
3.1 Column Specifications
ColumnWidthScrollPurposeLeft sidebar200px fixedIndependentPlanning inventory grouped by kindCenterFlex (fills remaining)IndependentIdea detail, list view, refinement sessionsRight panel~350–400pxIndependentIdea generation controls + story bible reference
All three columns scroll independently. This is a departure from the Workspace where the center and right columns co-scroll — independent scroll is essential here so the user can browse their inventory, read an idea's detail, and reference the structure simultaneously.
The right panel is collapsible via an × button (same pattern as Workspace's AI Generation panel). When collapsed, the center area expands to fill the space.
The left sidebar is collapsible via the same ◄ toggle used in Workspace. When collapsed, it shows only kind icons with count badges.

4. Left Sidebar — Planning Inventory
4.1 Structure
The sidebar displays all ideas grouped by IdeaKind, with each group as a collapsible section. Counts reflect the current (filtered-by-status) set.
PLANNING INVENTORY
─────────────────
▼ Constraints (2)
   No supernatural elements         ●
   Keep story grounded              ●

▼ Open Questions (3)
   Who committed the crime?         ○
   Why does Cain return?            ◐
   Morrison's real motive?          ○

▼ Directions (4)
   ┈ Act 1
     Act 1 ends with comic relief
   ┈ Act 3
     Midpoint is a false victory
   ┈ General
     Dante should feel slimy

▼ Proposals (5)
   Character: Arthur "Artie" Kemp
   Character: Tomás "Tico" Reyes
   Character: Elena Marquez
   ...

▼ Notes (1)
   Dante should feel slimy but...
─────────────────
Status: [ Active ▼ ]
4.2 Group Ordering
Groups are ordered by planning relevance, top to bottom:

Constraints — global guardrails, always visible first
Open Questions — unresolved items needing attention
Directions — targeted guidance for generation
Proposals — concrete suggestions for artifacts
Notes — freeform observations

4.3 Sidebar Item Display
Each item row shows:

Title (truncated to one line with ellipsis)
Resolution indicator (right-aligned):

● filled dot = resolved
◐ half dot = discussed
○ open dot = open
No indicator for archived (archived items hidden by default)


Source icon (small, inline): user icon or AI icon, only if space permits

Clicking an item selects it and loads its detail in the center area. The selected item has a highlighted background (same selection pattern as the Workspace sidebar's active section).
4.4 Directions Sub-Grouping
Directions with a targetAct value are grouped under act sub-headers within the Directions section. Directions without a target appear under a "General" sub-header. This provides act-level navigation without requiring a separate filter.
▼ Directions (4)
   Act 1
     Act 1 ends with comic relief
   Act 3
     Midpoint is a false victory
   General
     Dante should feel slimy
4.5 Status Filter
A single Status select at the bottom of the sidebar filters all groups simultaneously:

Active (default) — shows items with status active
All — shows everything including promoted and dismissed
Promoted — only promoted items
Dismissed — only dismissed items

This is the only filter control. Kind filtering is handled by the spatial grouping. Resolution filtering is visual (the dots). The collapsible filter pane, Kind dropdown, Resolution dropdown, and quick chips from the current implementation are all removed.
4.6 Multi-Select
Holding Cmd (Mac) / Ctrl (Windows) while clicking items enables multi-select. When multiple items are selected, the center area shows a bulk actions bar (see §6.4).

Open question: Is checkbox-on-hover better UX than modifier-key multi-select for discoverability?


5. Center Area — Detail & Working Space
The center area has two modes: List View (default when nothing is selected) and Detail View (when an item is selected from the sidebar).
5.1 List View
Shown when no sidebar item is selected, or when the user clicks a "Show All" / group header in the sidebar. Displays idea cards in a vertical scrolling list.
Card Layout
┌──────────────────────────────────────────────────────┐
│ 🧑 Character: Arthur "Artie" Kemp                    │
│                                                      │
│ proposal · open · AI · Character                     │
│                                                      │
│ A slick Miami defense attorney in his mid-40s who    │
│ represents low-level dealers, dirty cops, and...     │
│                                                      │
│ Target: —    Themes: —    Used: 0 times              │
│                                                      │
│ [ Develop ] [ Refine with AI ] [ Dismiss ]  [ Delete ]│
└──────────────────────────────────────────────────────┘
Cards show:

Title with kind icon
Metadata line: kind badge, resolution badge, source badge, category badge
Description (truncated to 3 lines with "Show more")
Targeting & provenance line: targetAct, targetBeat, themes, usage count
Action buttons: Develop, Refine with AI, Dismiss, Delete

The targeting and provenance line is new compared to the current card layout — it surfaces planning metadata that was previously invisible.
5.2 Detail View
Shown when a sidebar item is clicked. Full editable detail of a single idea.
┌──────────────────────────────────────────────────────┐
│ ← Back to list                                       │
│                                                      │
│ Kind: [ Direction ▼ ]     Resolution: [ Open ▼ ]     │
│                                                      │
│ Title                                                │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Act 1 ends with humanizing comic relief          │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ Description                                          │
│ ┌──────────────────────────────────────────────────┐ │
│ │ The final beat of Act 1 should release tension   │ │
│ │ with a moment of warmth or humor that humanizes  │ │
│ │ Cain before the story escalates...               │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─ Targeting ──────────────────────────────────────┐ │
│ │ Target Act: [ 1 ]                                │ │
│ │ Target Beat: [ Debate ]                          │ │
│ │ Themes: [ tension, humor, character ]            │ │
│ │ Category: [ plot ▼ ]                             │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─ Provenance ─────────────────────────────────────┐ │
│ │ Used 3 times · Informed 2 artifacts              │ │
│ │ Last used: 2 hours ago                           │ │
│ │                                                  │ │
│ │ → PlotPoint: "Cain's quiet moment at the dock"   │ │
│ │ → Scene: "INT. BODY SHOP - EVENING"              │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ Source: AI    Status: Active    Created: 2h ago       │
│                                                      │
│ [ Refine with AI ] [ Generate PlotPoint ] [ Dismiss ] │
│ [ Delete ]                                           │
└──────────────────────────────────────────────────────┘
All fields are inline-editable. Changes auto-save (matching the existing pattern in Context fields). The provenance section is read-only and populated automatically when artifacts reference this idea.
"Generate PlotPoint" button appears on Directions and Proposals. Clicking it switches to the Workspace tab and pre-populates the AI Generation panel's Direction field with this idea's content, with relevant constraints auto-included. (See §8.2.)
5.3 Refinement Session View
Triggered by clicking "Refine with AI" on any idea. The center area transitions to a session layout:
┌──────────────────────────────────────────────────────┐
│ Refining: "Act 1 ends with humanizing comic relief"  │
│                                                      │
│ ┌─ Original ─────────┐  ┌─ Variant 1 ─────────────┐ │
│ │                     │  │ ✦ AI-generated           │ │
│ │ The final beat of   │  │                          │ │
│ │ Act 1 should...     │  │ Close Act 1 with Cain    │ │
│ │                     │  │ fixing a kid's bike at   │ │
│ │                     │  │ the shop — a beat of...  │ │
│ │                     │  │                          │ │
│ │                     │  │ [ Accept ] [ Discard ]   │ │
│ └─────────────────────┘  └──────────────────────────┘ │
│                                                      │
│                          ┌─ Variant 2 ─────────────┐ │
│                          │ ✦ AI-generated           │ │
│                          │                          │ │
│                          │ End Act 1 with Cain and  │ │
│                          │ Rigo sharing a quiet     │ │
│                          │ meal — callback to...    │ │
│                          │                          │ │
│                          │ [ Accept ] [ Discard ]   │ │
│                          └──────────────────────────┘ │
│                                                      │
│              [ Cancel Refinement ]                    │
└──────────────────────────────────────────────────────┘

Accept on a variant: presents choice to Update (replace original) or Create New (keep original, add variant as new idea). This mirrors the package review commit pattern.
Discard removes that variant from the session.
Cancel Refinement returns to the detail view without changes.
The right panel remains visible during refinement, showing the story bible reference for context.

5.4 Bulk Actions
When multiple items are selected via multi-select (§4.6), the center area shows a floating action bar at the top:
┌──────────────────────────────────────────────────────┐
│ 4 items selected  [ Archive ] [ Dismiss ] [ Delete ] │
│                   [ Mark as Reviewed ] [ Cancel ]    │
└──────────────────────────────────────────────────────┘
"Archive resolved questions" is not a permanent button — it becomes available as "Archive" when the selection includes resolved items. Bulk actions are contextual to the selection.

6. Right Panel — Generation & Reference
The right panel has two sections stacked vertically: Idea Generation (top) and Story Bible Reference (bottom). Each section is independently collapsible.
6.1 Idea Generation Section
┌─ IDEA GENERATION ──────────────────────────────┐
│                                                │
│ What to generate:                              │
│ ┌────────────────────────────────────────────┐ │
│ │ ○ Questions about [Act ▼]                  │ │
│ │ ○ Constraints from premise                 │ │
│ │ ○ Directions for unfilled beats            │ │
│ │ ○ Character proposals                      │ │
│ │ ○ General brainstorm                       │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ Focus (optional):                              │
│ ┌────────────────────────────────────────────┐ │
│ │ e.g., "What are the unresolved tensions    │ │
│ │ in Act 2?" or "Suggest constraints for     │ │
│ │ maintaining noir tone"                     │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ [ Generate Ideas ]                             │
│                                                │
│ Generated ideas appear in the sidebar          │
│ inventory as AI-sourced, open items.           │
└────────────────────────────────────────────────┘
Generation modes:

Questions about [Act] — AI analyzes the act's structure and proposes unresolved questions
Constraints from premise — AI reads Constitution/premise and suggests constraints
Directions for unfilled beats — AI identifies beats without plot points and suggests directions
Character proposals — AI suggests characters to fill gaps (e.g., scenes without characters)
General brainstorm — freeform; the Focus field drives the generation

The Act selector appears inline when "Questions about" or a targeted mode is selected. Generated ideas appear immediately in the sidebar inventory, marked with source: 'ai' and resolutionStatus: 'open'.

Open question: Should generated ideas appear in a staging area for review before being added to the inventory, or drop directly into the sidebar? Direct addition is lower friction but may clutter the inventory. A staging approach would add a "Review N generated ideas" step.

6.2 Quick Capture
Below or above the generation section, a persistent quick-capture bar:
┌─ QUICK ADD ────────────────────────────────────┐
│ Title: [                                     ] │
│ Kind:  [ Note ▼ ]                              │
│ [ Add ]                                        │
│                                                │
│ ▶ More fields...                               │
└────────────────────────────────────────────────┘

Defaults to Kind: note (lowest commitment).
"More fields..." expands to show: Description (textarea), Target Act (number), Target Beat (text), Themes (comma-separated text), Category (select).
Submitting adds the idea to the sidebar immediately with source: 'user', resolutionStatus: 'open', status: 'active'.
The form clears after submission for rapid capture.

This replaces the current inline "+ Add Idea" form that pushes content down in the center area.
6.3 Story Bible Reference
A read-only, compact view of the story bible below the generation controls. Organized as collapsible accordion sections:
┌─ STORY BIBLE REFERENCE ────────────────────────┐
│                                                │
│ ▼ Structure                                    │
│   Act 1 - Setup (5 beats, 4 plot points)       │
│     Opening Image ●                            │
│     Theme Stated ●                             │
│     Setup ●                                    │
│     Catalyst ○                                 │
│     Debate ○                                   │
│   Act 2A - Fun & Games (3 beats, 1 plot point) │
│     Break Into Two ○                           │
│     B Story ○                                  │
│     Fun & Games ●                              │
│   Act 3 - Midpoint (2 beats, 1 plot point)     │
│     Midpoint ●                                 │
│     Bad Guys Close In ○                        │
│   Act 4 - All Is Lost (2 beats, 1 plot point)  │
│     All Is Lost ●                              │
│     Dark Night Of Soul ○                       │
│   Act 5 - Finale (3 beats, 0 plot points)      │
│     Break Into Three ○                         │
│     Finale ○                                   │
│     Final Image ○                              │
│                                                │
│ ▶ Characters (6)                               │
│ ▶ Locations (3)                                │
│ ▶ Constraints (active, from Planning)          │
│                                                │
└────────────────────────────────────────────────┘

● = beat has plot point(s) assigned, ○ = unfilled
Characters section shows names only (one-liners)
Locations section shows names only
Constraints section mirrors the Constraints group from the sidebar — this dual visibility reinforces that constraints are always-on guardrails

Context-sensitive highlighting: When viewing an idea with targetAct: 1 in the center detail view, the reference panel auto-scrolls to and highlights Act 1's section. This requires no user action — the reference follows focus.

Open question: Should clicking a beat/character/location in the reference panel do anything? Options: (a) nothing, purely read-only; (b) open it in Workspace in a new tab; (c) show a tooltip with full detail. Leaning toward (a) for simplicity.


7. Data Model Changes
7.1 Schema
No changes to the Idea type schema defined in IDEAS_PLANNING_LAYER_SPEC.md. The existing fields (kind, resolutionStatus, targetAct, targetBeat, themes, provenance, usageCount, etc.) are sufficient.
7.2 New Fields (if not already present)
If the following are not yet implemented, they should be added:
typescript// On the Idea interface
lastUsedAt?: string;        // ISO timestamp, updated when idea is included in generation
provenanceLinks?: Array<{   // Populated when artifacts reference this idea
  artifactId: string;
  artifactType: 'PlotPoint' | 'Scene' | 'Character' | 'Location';
  artifactTitle: string;
  linkedAt: string;         // ISO timestamp
}>;
```

### 7.3 Migration

Existing ideas in the Stash retain all current data. The `kind` field defaults to `'proposal'` for ideas that predate the planning layer. The `resolutionStatus` field defaults to `'open'`.

---

## 8. Interactions & Flows

### 8.1 Quick Capture Flow

1. User types title in Quick Add (right panel), optionally selects Kind
2. User clicks "Add" (or presses Enter)
3. Idea appears in sidebar under the appropriate kind group
4. Form clears for next entry
5. If user wants to add targeting/description, they select the new idea in the sidebar and edit in the center detail view

### 8.2 Direction → Generate PlotPoint Flow

1. User selects a Direction in the sidebar
2. Center area shows the direction's detail view
3. User clicks "Generate PlotPoint"
4. App switches to Workspace tab
5. AI Generation panel's Direction field is pre-populated with the idea's title + description
6. Relevant constraints (all active constraints from Planning) are auto-included in the generation context
7. If the direction has a `targetAct`, the Focus is set to "Specific Act" with that act selected
8. User reviews and clicks "Generate Proposals" as normal
9. When a package is accepted, provenance is recorded: the direction's `usageCount` increments and a `provenanceLink` is added

### 8.3 Refine with AI Flow

1. User selects an idea in the sidebar, clicks "Refine with AI" in center detail view
2. Center area transitions to Refinement Session view (§5.3)
3. AI generates 2–3 variants based on the idea's content + relevant story context
4. User reviews variants:
   - **Accept → Update**: original idea is replaced with variant content
   - **Accept → Create New**: variant becomes a new idea, original unchanged
   - **Discard**: variant removed from session
5. Session ends when all variants are accepted/discarded, or user clicks "Cancel Refinement"
6. Resolution status of the original idea can be updated (e.g., from `open` to `discussed`)

### 8.4 Question → Resolve Flow

1. User adds a question: "Who committed the crime and why?"
2. Over time, user refines it or simply edits the description with an answer
3. User changes resolution status to `resolved` via the detail view dropdown
4. The question remains visible in the sidebar (with `●` indicator) until archived
5. Resolved questions are included in generation context as established facts

### 8.5 Constraint Enforcement

1. User adds a constraint: "No supernatural elements"
2. All active constraints are automatically included in every generation prompt (from Workspace)
3. After generation, a lint step checks package content against constraint keywords
4. Violations are flagged in package review (Workspace side, not Planning tab)

### 8.6 Idea Generation Flow

1. User selects a generation mode in the right panel (e.g., "Questions about Act 2")
2. Optionally adds a focus prompt
3. Clicks "Generate Ideas"
4. AI generates 3–5 ideas of the appropriate kind, targeted to the selected scope
5. Ideas appear in the sidebar immediately, marked as AI-sourced and open
6. User reviews and dismisses/refines as needed

---

## 9. Migration from Inline Planning Section

### 9.1 Workspace Changes

The current Planning/Stash region (`region [ref_333]`) is removed from the Workspace scroll. In its place, a compact summary widget appears in the Workspace sidebar:
```
Planning          →
  3 constraints
  2 open questions
  5 active ideas
Clicking the "→" or the "Planning" label switches to the Planning tab.
9.2 Workspace Sidebar Update
In the Workspace's "STORY BIBLE" sidebar:
BeforeAfterElementsElementsStructureStructureContextContextStash (3)Planning → (link to tab)
The "Stash" label is renamed to "Planning" and becomes a tab-switch link rather than a scroll-to-section link.
9.3 Data Continuity
All existing ideas remain in the store. No data migration is needed — only the rendering location changes from Workspace to Planning tab.

10. Component Inventory
10.1 New Components
ComponentLocationPurposePlanningTabTop-levelRoot component for the Planning tab viewPlanningInventorySidebarLeft columnGrouped sidebar with kind sectionsInventoryGroupSidebarCollapsible section for each kindInventoryItemSidebarSingle idea row with title + resolution dotIdeaDetailViewCenterFull editable detail for selected ideaIdeaListViewCenterCard list when no item is selectedRefinementSessionCenterSide-by-side original + variants viewBulkActionBarCenter (floating)Contextual bulk operationsIdeaGenerationPanelRight panelGeneration mode selector + formQuickCaptureFormRight panelPersistent minimal add formStoryBibleReferenceRight panelRead-only compact bible viewReferenceStructureRight panelCompact act/beat outlineReferenceCharactersRight panelCharacter name listReferenceLocationsRight panelLocation name listReferenceConstraintsRight panelActive constraints mirror
10.2 Reused Components
ComponentReuse fromNotesIdea cardExisting IdeaCardExtended with provenance lineTab barExisting top-level tabsAdd "Planning" entryStatus badgesExisting badge patternSame kind/resolution/source pillsCollapsible sectionExisting accordion patternUsed in sidebar groups and reference panel

11. Open Questions

Generated idea staging. Should AI-generated ideas go directly into the inventory, or through a staging review first? Direct is lower friction; staging prevents clutter.
Reference panel interactivity. Should items in the Story Bible Reference be clickable (opening in Workspace), or purely read-only? Read-only is simpler but limits utility.
Multi-select pattern. Modifier-key multi-select (Cmd/Ctrl+click) vs. checkbox-on-hover. Checkboxes are more discoverable but add visual noise.
Sidebar collapsed state. When the sidebar is collapsed, should it show only kind icons with count badges, or nothing at all? Icons maintain awareness; blank saves space.
Planning summary in Workspace. Should the Workspace retain a compact planning summary widget, or fully remove the Planning section and rely on the sidebar link? A summary maintains cross-tab awareness; full removal is cleaner.
Right panel default state. When the Planning tab first loads, should the right panel default to Generation, Quick Capture, or Story Bible Reference as the topmost visible section?
Keyboard shortcuts. Should there be a shortcut for quick capture (e.g., N for new idea) and tab switching (e.g., Cmd+1/2/3)? This would benefit power users but needs conflict checking.
Constraint lint detail. The spec mentions constraint lint checking after generation. Where exactly do violations surface — in the package review UI in Workspace, as a banner, or as inline annotations? This is a Workspace-side concern but affects how constraint provenance is displayed in Planning.


12. Out of Scope

Changes to the AI Generation panel in Workspace (beyond pre-populating Direction from Planning)
Restructuring the Stories tab
Real-time collaboration on ideas
Idea templates or presets
AI-driven auto-categorization of ideas by kind

