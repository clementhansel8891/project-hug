#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# E2E Test Library - Shared utilities
# ═══════════════════════════════════════════════════════════════════════

BASE_URL="${BASE_URL:-http://localhost:3001/v1}"
RESULTS_DIR="$(dirname "$0")/results"
mkdir -p "$RESULTS_DIR"

# Counters
PASS=0
FAIL=0
SKIP=0
ERRORS=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── HTTP helpers ─────────────────────────────────────────────────────────

api_post() {
  local path="$1"
  local data="$2"
  local token="${3:-}"
  local tenant="${4:-}"
  local company="${5:-}"

  local headers=(-H "Content-Type: application/json")
  [ -n "$token" ] && headers+=(-H "Authorization: Bearer $token")
  [ -n "$tenant" ] && headers+=(-H "x-tenant-id: $tenant")
  [ -n "$company" ] && headers+=(-H "x-company-id: $company")

  curl -s -w "\n%{http_code}" -X POST "${BASE_URL}${path}" \
    "${headers[@]}" \
    -d "$data" 2>/dev/null
}

api_get() {
  local path="$1"
  local token="${2:-}"
  local tenant="${3:-}"
  local company="${4:-}"

  local headers=()
  [ -n "$token" ] && headers+=(-H "Authorization: Bearer $token")
  [ -n "$tenant" ] && headers+=(-H "x-tenant-id: $tenant")
  [ -n "$company" ] && headers+=(-H "x-company-id: $company")

  curl -s -w "\n%{http_code}" -X GET "${BASE_URL}${path}" \
    "${headers[@]}" 2>/dev/null
}

api_put() {
  local path="$1"
  local data="$2"
  local token="${3:-}"
  local tenant="${4:-}"
  local company="${5:-}"

  local headers=(-H "Content-Type: application/json")
  [ -n "$token" ] && headers+=(-H "Authorization: Bearer $token")
  [ -n "$tenant" ] && headers+=(-H "x-tenant-id: $tenant")
  [ -n "$company" ] && headers+=(-H "x-company-id: $company")

  curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}${path}" \
    "${headers[@]}" \
    -d "$data" 2>/dev/null
}

api_patch() {
  local path="$1"
  local data="$2"
  local token="${3:-}"
  local tenant="${4:-}"
  local company="${5:-}"

  local headers=(-H "Content-Type: application/json")
  [ -n "$token" ] && headers+=(-H "Authorization: Bearer $token")
  [ -n "$tenant" ] && headers+=(-H "x-tenant-id: $tenant")
  [ -n "$company" ] && headers+=(-H "x-company-id: $company")

  curl -s -w "\n%{http_code}" -X PATCH "${BASE_URL}${path}" \
    "${headers[@]}" \
    -d "$data" 2>/dev/null
}

api_delete() {
  local path="$1"
  local token="${2:-}"
  local tenant="${3:-}"
  local company="${4:-}"

  local headers=()
  [ -n "$token" ] && headers+=(-H "Authorization: Bearer $token")
  [ -n "$tenant" ] && headers+=(-H "x-tenant-id: $tenant")
  [ -n "$company" ] && headers+=(-H "x-company-id: $company")

  curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}${path}" \
    "${headers[@]}" 2>/dev/null
}

# ─── Response parsing ─────────────────────────────────────────────────────

# Extract HTTP status code (last line of response)
get_status() {
  echo "$1" | tail -1
}

# Extract response body (all lines except last)
get_body() {
  echo "$1" | sed '$d'
}

# Extract JSON field from body
json_field() {
  local body="$1"
  local field="$2"
  echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field',''))" 2>/dev/null
}

# Extract nested field (e.g., "data.id")
json_nested() {
  local body="$1"
  local path="$2"
  echo "$body" | python3 -c "
import sys,json
d=json.load(sys.stdin)
keys='$path'.split('.')
for k in keys:
  if isinstance(d, dict):
    d = d.get(k, '')
  elif isinstance(d, list) and k.isdigit():
    d = d[int(k)] if int(k) < len(d) else ''
  else:
    d = ''
print(d)
" 2>/dev/null
}

# ─── Assertions ───────────────────────────────────────────────────────────

assert_status() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  local body="${4:-}"

  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $test_name (${actual})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name (expected ${expected}, got ${actual})"
    [ -n "$body" ] && echo -e "    ${RED}→ $(echo "$body" | head -c 200)${NC}"
    FAIL=$((FAIL + 1))
    ERRORS+=("$test_name: expected $expected got $actual")
  fi
}

assert_status_one_of() {
  local test_name="$1"
  local actual="$2"
  shift 2
  local expected_list=("$@")

  for exp in "${expected_list[@]}"; do
    if [ "$actual" = "$exp" ]; then
      echo -e "  ${GREEN}✓${NC} $test_name (${actual})"
      PASS=$((PASS + 1))
      return
    fi
  done

  echo -e "  ${RED}✗${NC} $test_name (got ${actual}, expected one of: ${expected_list[*]})"
  FAIL=$((FAIL + 1))
  ERRORS+=("$test_name: got $actual expected one of ${expected_list[*]}")
}

assert_not_empty() {
  local test_name="$1"
  local value="$2"

  if [ -n "$value" ] && [ "$value" != "None" ] && [ "$value" != "" ]; then
    echo -e "  ${GREEN}✓${NC} $test_name (has value)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $test_name (empty or None)"
    FAIL=$((FAIL + 1))
    ERRORS+=("$test_name: value was empty")
  fi
}

skip_test() {
  local test_name="$1"
  local reason="$2"
  echo -e "  ${YELLOW}○${NC} $test_name (SKIPPED: $reason)"
  SKIP=$((SKIP + 1))
}

# ─── Section headers ─────────────────────────────────────────────────────

section() {
  echo ""
  echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

subsection() {
  echo -e "  ${BLUE}── $1${NC}"
}

# ─── Summary ──────────────────────────────────────────────────────────────

print_summary() {
  local phase="$1"
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo -e " ${BLUE}$phase Results${NC}"
  echo "═══════════════════════════════════════════════════════"
  echo -e " ${GREEN}PASS:${NC} $PASS"
  echo -e " ${RED}FAIL:${NC} $FAIL"
  echo -e " ${YELLOW}SKIP:${NC} $SKIP"
  echo " TOTAL: $((PASS + FAIL + SKIP))"
  echo "═══════════════════════════════════════════════════════"

  if [ ${#ERRORS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed tests:${NC}"
    for err in "${ERRORS[@]}"; do
      echo -e "  ${RED}• $err${NC}"
    done
  fi

  # Write results to file
  cat > "$RESULTS_DIR/${phase// /_}.json" << EOF
{
  "phase": "$phase",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "pass": $PASS,
  "fail": $FAIL,
  "skip": $SKIP,
  "total": $((PASS + FAIL + SKIP)),
  "errors": $(python3 -c "import json; print(json.dumps([$(printf '"%s",' "${ERRORS[@]}" | sed 's/,$//'])))" 2>/dev/null || echo "[]")
}
EOF
}
