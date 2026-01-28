#!/usr/bin/env bash
#
# Test All LLM Generation APIs against the neon-noir-test story
#
# Starts the API server, calls every LLM-based endpoint,
# and logs system prompts, user prompts, requests, and responses to a file.
#
# The Anthropic client already logs system/user prompts and LLM responses
# to stdout, so we capture the server's stdout alongside the HTTP request/response.
#
# Usage:
#   ./scripts/test-all-prompts.sh
#
# Prerequisites:
#   - ANTHROPIC_API_KEY set in .env or environment
#   - packages built (npm run build from root)
#   - neon-noir-test story exists in ~/.apollo/stories/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$ROOT_DIR/prompt-test-output.log"
SERVER_LOG="$ROOT_DIR/.server-output.log"
PORT=3099
BASE_URL="http://localhost:$PORT"
STORY_ID="neon-noir-test"

# Known node IDs from the graph
STORYBEAT_1="pp_extracted_1767576713934"
STORYBEAT_2="pp_extracted_1767585226496"
CHARACTER_1="char_protagonist"
SCENE_1="scene_extracted_1767490321406"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    echo -e "${YELLOW}Stopping server (PID: $SERVER_PID)...${NC}"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Append to log file (no color codes)
log_raw() {
  echo "$1" >> "$LOG_FILE"
}

log_section() {
  local sep=$(printf '=%.0s' {1..80})
  echo "" >> "$LOG_FILE"
  echo "$sep" >> "$LOG_FILE"
  echo "  $1" >> "$LOG_FILE"
  echo "$sep" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
}

# Call an API endpoint and log request + response
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"
  local description="${4:-$method $endpoint}"

  log_raw ""
  log_raw "--- $description ---"
  log_raw ""
  log_raw "REQUEST: $method $BASE_URL$endpoint"

  if [ -n "$data" ]; then
    log_raw ""
    log_raw "REQUEST BODY:"
    echo "$data" | python3 -m json.tool 2>/dev/null >> "$LOG_FILE" || echo "$data" >> "$LOG_FILE"
  fi

  local response
  local http_code
  local tmpfile=$(mktemp)

  if [ -n "$data" ]; then
    http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint" 2>&1)
  else
    http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" -X "$method" \
      "$BASE_URL$endpoint" 2>&1)
  fi

  local body=$(cat "$tmpfile")
  rm -f "$tmpfile"

  log_raw ""
  log_raw "RESPONSE STATUS: $http_code"
  log_raw ""
  log_raw "RESPONSE BODY:"
  echo "$body" | python3 -m json.tool 2>/dev/null >> "$LOG_FILE" || echo "$body" >> "$LOG_FILE"

  echo "$body"
}

# ==============================================================================
echo -e "${CYAN}Apollo Prompt Test Script${NC}"
echo -e "${CYAN}Using story: $STORY_ID${NC}"
echo ""

# Clear log files
> "$LOG_FILE"
> "$SERVER_LOG"

log_raw "Apollo LLM Prompt Test Log"
log_raw "Story: $STORY_ID"
log_raw "Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# 1. Build
echo -e "${YELLOW}Building project...${NC}"
cd "$ROOT_DIR"
npm run build 2>&1 | tail -3

# 2. Start server
echo -e "${YELLOW}Starting server on port $PORT...${NC}"
PORT=$PORT node packages/api/dist/index.js > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

echo -n "Waiting for server"
for i in $(seq 1 30); do
  if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo -e " ${GREEN}ready!${NC}"
    break
  fi
  echo -n "."
  sleep 0.5
done

if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
  echo -e " ${RED}FAILED${NC}"
  cat "$SERVER_LOG"
  exit 1
fi

# Verify story exists
STATUS=$(curl -s "$BASE_URL/stories/$STORY_ID/status")
STORY_NAME=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('name','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
echo -e "${GREEN}Story loaded: $STORY_NAME${NC}"
echo ""

# Mark where LLM tests begin in server log
echo "======== LLM TESTS BEGIN ========" >> "$SERVER_LOG"

# ==============================================================================
# LLM ENDPOINT TESTS
# ==============================================================================

run_test() {
  local num="$1"
  local total="$2"
  local label="$3"
  echo -e "${YELLOW}[$num/$total] $label${NC}"
}

TOTAL=8

# --------------------------------------------------------------------------
# Test 1: Unified propose (naked/exploratory)
# --------------------------------------------------------------------------
run_test 1 $TOTAL "POST /propose (naked, exploratory)"
log_section "TEST 1: POST /stories/:id/propose (naked, exploratory)"

api_call POST "/stories/$STORY_ID/propose" \
  '{
    "intent": "explore",
    "scope": { "entryPoint": "naked" },
    "mode": "exploratory",
    "constraints": { "creativity": 0.7 },
    "options": { "packageCount": 1, "maxNodesPerPackage": 3 }
  }' \
  "Unified propose - naked exploratory" > /dev/null

echo -e "  ${GREEN}Done${NC}"
sleep 2

# --------------------------------------------------------------------------
# Test 2: Propose story beats
# --------------------------------------------------------------------------
run_test 2 $TOTAL "POST /propose/story-beats"
log_section "TEST 2: POST /stories/:id/propose/story-beats"

api_call POST "/stories/$STORY_ID/propose/story-beats" \
  '{
    "packageCount": 1,
    "maxStoryBeatsPerPackage": 2,
    "direction": "Focus on rising tension in Act 2",
    "creativity": 0.5,
    "expansionScope": "flexible"
  }' \
  "Propose story beats" > /dev/null

echo -e "  ${GREEN}Done${NC}"
sleep 2

# --------------------------------------------------------------------------
# Test 3: Propose characters
# --------------------------------------------------------------------------
run_test 3 $TOTAL "POST /propose/characters"
log_section "TEST 3: POST /stories/:id/propose/characters"

api_call POST "/stories/$STORY_ID/propose/characters" \
  '{
    "focus": "cast_ensemble",
    "includeArcs": true,
    "maxCharactersPerPackage": 2,
    "expansionScope": "flexible",
    "direction": "Create a compelling antagonist",
    "packageCount": 1,
    "creativity": 0.6
  }' \
  "Propose characters" > /dev/null

echo -e "  ${GREEN}Done${NC}"
sleep 2

# --------------------------------------------------------------------------
# Test 4: Propose scenes (from existing story beats)
# --------------------------------------------------------------------------
run_test 4 $TOTAL "POST /propose/scenes"
log_section "TEST 4: POST /stories/:id/propose/scenes"

api_call POST "/stories/$STORY_ID/propose/scenes" \
  "{
    \"storyBeatIds\": [\"$STORYBEAT_1\", \"$STORYBEAT_2\"],
    \"scenesPerBeat\": 1,
    \"maxScenesPerPackage\": 2,
    \"expansionScope\": \"flexible\",
    \"direction\": \"Create visually striking scenes\",
    \"packageCount\": 1,
    \"creativity\": 0.5
  }" \
  "Propose scenes for story beats" > /dev/null

echo -e "  ${GREEN}Done${NC}"
sleep 2

# --------------------------------------------------------------------------
# Test 5: Propose expand (story-context)
# --------------------------------------------------------------------------
run_test 5 $TOTAL "POST /propose/expand (story-context)"
log_section "TEST 5: POST /stories/:id/propose/expand (story-context)"

api_call POST "/stories/$STORY_ID/propose/expand" \
  '{
    "target": { "type": "story-context" },
    "depth": "deep",
    "maxNodesPerPackage": 3,
    "expansionScope": "flexible",
    "direction": "Expand on themes and world-building",
    "packageCount": 1,
    "creativity": 0.6
  }' \
  "Propose expand - story context" > /dev/null

echo -e "  ${GREEN}Done${NC}"
sleep 2

# --------------------------------------------------------------------------
# Test 6: Propose expand (node - character)
# --------------------------------------------------------------------------
run_test 6 $TOTAL "POST /propose/expand (character node)"
log_section "TEST 6: POST /stories/:id/propose/expand (character node)"

api_call POST "/stories/$STORY_ID/propose/expand" \
  "{
    \"target\": { \"type\": \"node\", \"nodeId\": \"$CHARACTER_1\" },
    \"depth\": \"deep\",
    \"maxNodesPerPackage\": 3,
    \"expansionScope\": \"flexible\",
    \"direction\": \"Develop backstory and relationships\",
    \"packageCount\": 1,
    \"creativity\": 0.5
  }" \
  "Propose expand - character node ($CHARACTER_1)" > /dev/null

echo -e "  ${GREEN}Done${NC}"
sleep 2

# --------------------------------------------------------------------------
# Test 7: Propose refine (uses active proposal from previous test)
# --------------------------------------------------------------------------
run_test 7 $TOTAL "POST /propose/refine"
log_section "TEST 7: POST /stories/:id/propose/refine"

ACTIVE=$(curl -s "$BASE_URL/stories/$STORY_ID/propose/active")
PKG_ID=$(echo "$ACTIVE" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data'); print(d['packages'][0]['id'] if d and d.get('packages') else '')" 2>/dev/null || echo "")

if [ -n "$PKG_ID" ]; then
  api_call POST "/stories/$STORY_ID/propose/refine" \
    "{
      \"packageId\": \"$PKG_ID\",
      \"guidance\": \"Make the elements more morally ambiguous. Add more tension and stakes.\",
      \"creativity\": 0.6
    }" \
    "Propose refine (package: $PKG_ID)" > /dev/null
else
  log_raw "SKIPPED: No active proposal found for refinement"
  echo -e "  ${RED}Skipped (no active proposal)${NC}"
fi

echo -e "  ${GREEN}Done${NC}"
sleep 2

# --------------------------------------------------------------------------
# Test 8: Unified propose with user text (interpret mode)
# --------------------------------------------------------------------------
run_test 8 $TOTAL "POST /propose (user text input)"
log_section "TEST 8: POST /stories/:id/propose (user text input - interpret mode)"

api_call POST "/stories/$STORY_ID/propose" \
  '{
    "intent": "add",
    "scope": { "entryPoint": "naked" },
    "input": { "text": "I want to add a scene where the protagonist confronts his old boss in a dimly lit warehouse, and we learn that the robberies are connected to a bigger conspiracy involving corrupt police." },
    "mode": "targeted",
    "options": { "packageCount": 1 }
  }' \
  "Unified propose - user text input (interpret+generate)" > /dev/null

echo -e "  ${GREEN}Done${NC}"

# ==============================================================================
# Append server logs (contains all system prompts, user prompts, LLM responses)
# ==============================================================================

log_section "RAW SERVER LOGS (System Prompts, User Prompts, LLM Responses)"
log_raw "Look for [Anthropic] markers:"
log_raw "  [Anthropic] System prompt: ...  -> the system prompt sent to the LLM"
log_raw "  [Anthropic] User prompt: ...    -> the user prompt sent to the LLM"
log_raw "  [Anthropic] Content: ...        -> the raw LLM response"
log_raw ""

cat "$SERVER_LOG" >> "$LOG_FILE"

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo -e "${GREEN}All $TOTAL tests complete!${NC}"
echo ""
echo -e "Log file:      ${CYAN}$LOG_FILE${NC}"
echo -e "Server output: ${CYAN}$SERVER_LOG${NC}"
echo ""
echo "The log file contains for each endpoint:"
echo "  - HTTP request body"
echo "  - HTTP response body"
echo "  - System prompt sent to the LLM"
echo "  - User prompt sent to the LLM"
echo "  - Raw LLM response content"
