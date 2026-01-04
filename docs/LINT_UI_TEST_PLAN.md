# Rule Engine MVP - UI Test Plan

Manual frontend tests to validate the lint/rule engine from the browser.

## Prerequisites

1. Start the dev server: `npm run dev` (runs both API and UI)
2. Open the app in browser (typically http://localhost:5173)
3. Have a story selected with some beats and scenes

---

## Test 1: LintPanel Appears in Edit Mode

**Steps:**
1. Go to the **Explore** tab
2. Select "Scene" from the type filter
3. Click on any scene in the list
4. Click the **Edit** button on the node detail panel
5. Change any field (e.g., modify the heading text)

**Expected:**
- [ ] A "Lint" panel appears below the patch preview
- [ ] Shows error/warning badges or "All clear"
- [ ] Shows "checked Xs ago" timestamp

---

## Test 2: Auto-Lint on Edit

**Steps:**
1. Enter edit mode on a scene (as above)
2. Type in a text field
3. Stop typing and wait ~1 second

**Expected:**
- [ ] Spinner appears briefly in the Lint panel header
- [ ] Timestamp updates to "checked 0s ago"
- [ ] Lint runs automatically after you stop typing

---

## Test 3: View Soft Rule Warnings

**Steps:**
1. Find or create a scene that has no characters assigned
2. Edit that scene and make any small change
3. Look at the LintPanel

**Expected:**
- [ ] Orange warning badge shows (e.g., "1 warning")
- [ ] Warning item shows: "Scene X has no characters assigned"
- [ ] Warning has orange styling with "^" icon
- [ ] No "Apply Fix" button (soft rules have no auto-fix)

---

## Test 4: Create Hard Rule Violation (Duplicate Order)

**Steps:**
1. Find a beat that has multiple scenes
2. Edit one scene and manually set its `order_index` to match another scene's order
3. Commit the change
4. Edit any scene in that beat again

**Expected:**
- [ ] Red error badge appears (e.g., "1 error")
- [ ] Error message: "Beat X has N scenes with order_index Y"
- [ ] Error has red styling with "!" icon
- [ ] Blue "Re-index N scenes..." fix button appears

---

## Test 5: Apply Single Fix

**Steps:**
1. Create a hard rule violation (see Test 4)
2. Click the **"Re-index scenes..."** button on the violation

**Expected:**
- [ ] Button shows "Applying..." briefly
- [ ] Error disappears from the list
- [ ] Error count decreases
- [ ] "All clear" or remaining violations shown

---

## Test 6: Run Full Lint Button

**Steps:**
1. While in edit mode with LintPanel visible
2. Click the **"Run Full Lint"** button

**Expected:**
- [ ] Button shows "Linting..." during operation
- [ ] All violations in the entire story are checked
- [ ] Timestamp updates
- [ ] May show more violations than touched-scope lint

---

## Test 7: Apply All Fixes

**Steps:**
1. Create multiple hard rule violations
2. In the LintPanel, click **"Apply All Fixes (N)"**

**Expected:**
- [ ] All fixable violations are resolved at once
- [ ] Error count goes to 0 (for hard rules with fixes)
- [ ] Warnings may remain (no auto-fix)

---

## Test 8: Pre-Commit Blocking (Hard Errors)

**Steps:**
1. Create a hard rule violation (duplicate scene order)
2. Edit any node and make a change
3. Click **"Commit Changes"**

**Expected:**
- [ ] A modal appears titled "Commit Blocked"
- [ ] Red message: "There are N errors that must be fixed"
- [ ] The violation is shown with a fix button
- [ ] **No "Proceed" button** - commit is blocked
- [ ] Cancel button closes the modal without committing

---

## Test 9: Fix from Pre-Commit Modal

**Steps:**
1. Trigger the pre-commit modal (see Test 8)
2. Click **"Apply All Fixes"** in the modal

**Expected:**
- [ ] Fixes are applied
- [ ] Modal updates - errors disappear
- [ ] If only warnings remain, "Proceed with Warnings" button appears
- [ ] Can now proceed with commit

---

## Test 10: Pre-Commit with Warnings Only

**Steps:**
1. Ensure there are no hard rule violations (only soft warnings)
2. Edit a node and click **"Commit Changes"**

**Expected:**
- [ ] Modal appears titled "Review Before Commit"
- [ ] Warnings are listed
- [ ] **"Proceed with Warnings"** button is available
- [ ] Clicking it commits the changes successfully

---

## Test 11: Clean Commit (No Violations)

**Steps:**
1. Ensure the story has no lint violations
2. Edit a node, make a valid change
3. Click **"Commit Changes"**

**Expected:**
- [ ] No modal appears
- [ ] Commit proceeds immediately
- [ ] Node is updated successfully

---

## Test 12: Cancel Edit Clears Lint State

**Steps:**
1. Enter edit mode, trigger some violations
2. Click **"Cancel"** to exit edit mode
3. Enter edit mode again on a different node

**Expected:**
- [ ] Previous violations are cleared
- [ ] Fresh lint runs for the new node
- [ ] No stale violation data shown

---

## Test 13: Location Warning

**Steps:**
1. Find a scene with no location assigned (no LOCATED_AT edge)
2. Edit that scene

**Expected:**
- [ ] Warning: "Scene X has no location assigned"
- [ ] Does not block commit

---

## Test 14: Theme Orphan Warning

**Steps:**
1. Go to Explore > select "Theme" type
2. Find a theme that isn't connected to any scenes
3. Edit that theme

**Expected:**
- [ ] Warning: "Theme X is not expressed in any scene or beat"

---

## Test 15: Motif Orphan Warning

**Steps:**
1. Go to Explore > select "Motif" type
2. Find a motif that isn't connected to any scenes
3. Edit that motif

**Expected:**
- [ ] Warning: "Motif X does not appear in any scene"

---

## Test Results

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| 1. LintPanel Appears | | | |
| 2. Auto-Lint on Edit | | | |
| 3. Soft Rule Warnings | | | |
| 4. Hard Rule Violation | | | |
| 5. Apply Single Fix | | | |
| 6. Run Full Lint | | | |
| 7. Apply All Fixes | | | |
| 8. Pre-Commit Blocking | | | |
| 9. Fix from Modal | | | |
| 10. Warnings Only | | | |
| 11. Clean Commit | | | |
| 12. Cancel Clears State | | | |
| 13. Location Warning | | | |
| 14. Theme Orphan | | | |
| 15. Motif Orphan | | | |

**Tester:** _______________
**Date:** _______________
