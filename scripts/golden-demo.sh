#!/bin/bash
# Golden demo: Demonstrates typical Project Apollo CLI workflow
#
# This script runs through a typical workflow to:
# 1. Verify CLI functionality
# 2. Document typical usage patterns
# 3. Serve as a CI smoke test
#
# Usage: ./scripts/golden-demo.sh
#
# Output can be compared against fixtures/golden-demo-output.txt

set -e  # Exit on error

# Use a temp directory for isolation
export APOLLO_HOME="${TMPDIR:-/tmp}/apollo-golden-demo-$$"
mkdir -p "$APOLLO_HOME"

# Cleanup on exit
cleanup() {
  rm -rf "$APOLLO_HOME"
}
trap cleanup EXIT

echo "=== Golden Demo: Project Apollo CLI ==="
echo "Working directory: $APOLLO_HOME"
echo ""

# Step 1: Initialize a story
echo "--- Step 1: Initialize story ---"
npx project-apollo init --name "The Impossible Crime" "A retired detective is drawn back into service when her protege is framed for a murder that seems physically impossible."
echo ""

# Step 2: Check current status
echo "--- Step 2: Story status ---"
npx project-apollo status
echo ""

# Step 3: List open questions
echo "--- Step 3: Open questions ---"
npx project-apollo oqs
echo ""

# Step 4: Generate clusters for an OQ (Catalyst beat)
echo "--- Step 4: Generate cluster for Catalyst beat ---"
npx project-apollo cluster oq_beat_beat_Catalyst --count 3
echo ""

# Step 5: Preview a move
echo "--- Step 5: Preview first move ---"
# Get the first move ID from the cluster command output
FIRST_MOVE=$(npx project-apollo cluster oq_beat_beat_Catalyst --count 1 2>&1 | grep -o 'mv_[a-zA-Z0-9_]*' | head -1)
if [ -n "$FIRST_MOVE" ]; then
  npx project-apollo preview "$FIRST_MOVE"
else
  echo "(No move ID captured, skipping preview)"
fi
echo ""

# Step 6: Accept a move
echo "--- Step 6: Accept move ---"
npx project-apollo cluster oq_beat_beat_Catalyst --count 1 2>&1
MOVE_TO_ACCEPT=$(npx project-apollo cluster oq_beat_beat_Catalyst --count 1 2>&1 | grep -o 'mv_[a-zA-Z0-9_]*' | head -1)
if [ -n "$MOVE_TO_ACCEPT" ]; then
  npx project-apollo accept "$MOVE_TO_ACCEPT" --yes
else
  echo "(No move ID captured, skipping accept)"
fi
echo ""

# Step 7: View version history
echo "--- Step 7: Version history ---"
npx project-apollo log
echo ""

# Step 8: Create a branch
echo "--- Step 8: Create experimental branch ---"
npx project-apollo branch create "experimental" -d "Testing alternate approaches"
echo ""

# Step 9: List branches
echo "--- Step 9: List branches ---"
npx project-apollo branch
echo ""

# Step 10: Add a character
echo "--- Step 10: Add a character ---"
npx project-apollo add character "Sarah Chen" --description "A forensic accountant with a keen eye for detail" --traits "methodical,skeptical,loyal" --yes
echo ""

# Step 11: View diff (current vs parent)
echo "--- Step 11: View diff ---"
npx project-apollo diff
echo ""

# Step 12: Switch back to main
echo "--- Step 12: Switch to main branch ---"
npx project-apollo branch switch main
echo ""

# Step 13: View diff between branches
echo "--- Step 13: Diff between main and experimental ---"
npx project-apollo diff main experimental
echo ""

# Step 14: Final status
echo "--- Step 14: Final status ---"
npx project-apollo status
echo ""

echo "=== Golden Demo Complete ==="
