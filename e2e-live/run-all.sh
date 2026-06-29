#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# E2E Live Production Test Runner
# Runs all phases sequentially and produces a final report
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Zenvix E2E Live Production Tests                           ║"
echo "║  $(date -u +%Y-%m-%dT%H:%M:%SZ)                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Target: ${BASE_URL:-http://localhost:3001/v1}"
echo ""

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0
PHASE_RESULTS=()

run_phase() {
  local script="$1"
  local name="$2"
  
  echo ""
  echo "┌──────────────────────────────────────────────────────────────┐"
  echo "│  $name"
  echo "└──────────────────────────────────────────────────────────────┘"
  
  if bash "$script" 2>&1; then
    echo ""
  else
    echo ""
    echo "  ⚠ Phase had errors but continuing..."
  fi
  
  # Read results file if it exists
  local result_file="$RESULTS_DIR/${name// /_}.json"
  # Replace spaces and dashes
  result_file=$(echo "$result_file" | sed 's/ /_/g')
  
  if [ -f "$result_file" ]; then
    local p=$(python3 -c "import json; print(json.load(open('$result_file'))['pass'])" 2>/dev/null || echo 0)
    local f=$(python3 -c "import json; print(json.load(open('$result_file'))['fail'])" 2>/dev/null || echo 0)
    local s=$(python3 -c "import json; print(json.load(open('$result_file'))['skip'])" 2>/dev/null || echo 0)
    TOTAL_PASS=$((TOTAL_PASS + p))
    TOTAL_FAIL=$((TOTAL_FAIL + f))
    TOTAL_SKIP=$((TOTAL_SKIP + s))
    PHASE_RESULTS+=("$name: ✓$p ✗$f ○$s")
  fi
}

# Run all phases
run_phase "$SCRIPT_DIR/01-onboarding.sh" "Phase 1 - Onboarding"
run_phase "$SCRIPT_DIR/02-organization.sh" "Phase 2 - Organization"
run_phase "$SCRIPT_DIR/03-operations.sh" "Phase 3 - Operations"
run_phase "$SCRIPT_DIR/04-extended.sh" "Phase 4 - Extended"

# ─── Final Summary ────────────────────────────────────────────────────────
echo ""
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    FINAL TEST REPORT                        ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
printf "║  %-10s %s\n" "PASSED:" "$TOTAL_PASS ║"
printf "║  %-10s %s\n" "FAILED:" "$TOTAL_FAIL ║"
printf "║  %-10s %s\n" "SKIPPED:" "$TOTAL_SKIP ║"
printf "║  %-10s %s\n" "TOTAL:" "$((TOTAL_PASS + TOTAL_FAIL + TOTAL_SKIP)) ║"
echo "║                                                            ║"
echo "╠══════════════════════════════════════════════════════════════╣"

for phase_result in "${PHASE_RESULTS[@]}"; do
  printf "║  %-58s║\n" "$phase_result"
done

echo "╚══════════════════════════════════════════════════════════════╝"

# Write final summary
cat > "$RESULTS_DIR/final-summary.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "target": "${BASE_URL:-http://localhost:3001/v1}",
  "total_pass": $TOTAL_PASS,
  "total_fail": $TOTAL_FAIL,
  "total_skip": $TOTAL_SKIP,
  "total_tests": $((TOTAL_PASS + TOTAL_FAIL + TOTAL_SKIP)),
  "success_rate": $(python3 -c "t=$TOTAL_PASS+$TOTAL_FAIL; print(f'{($TOTAL_PASS/t*100):.1f}' if t>0 else '0')" 2>/dev/null || echo "0")
}
EOF

echo ""
echo "Results written to: $RESULTS_DIR/"
echo ""

# Exit with failure if any tests failed
if [ $TOTAL_FAIL -gt 0 ]; then
  exit 1
fi
