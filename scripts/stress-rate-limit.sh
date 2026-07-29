#!/bin/bash
# ── Staging Rate Limit Stress Test ──────────────────────────────
#
# Usage:  bash stress-test.sh [endpoint] [device-id] [requests] [concurrency]
#
# Requires: curl, jq (optional for pretty output)
#
# Deploys the current api to staging, then runs ab (Apache Bench)
# against the rate-limited endpoint to verify enforcement.
#
# Defaults:
#   endpoint    = https://api.staging.sonora.app/payments/create
#   device-id   = stress-test-device-001
#   requests    = 100
#   concurrency = 10
#
# Example:
#   bash stress-test.sh
#   bash stress-test.sh https://api.staging.sonora.app/experiences/ 30 5 20
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

ENDPOINT="${1:-https://api.staging.sonora.app/payments/create}"
DEVICE_ID="${2:-stress-test-device-001}"
REQUESTS="${3:-100}"
CONCURRENCY="${4:-10}"

echo "═══ Staging Rate Limit Stress Test ═══════════════════════════"
echo "  Endpoint:     $ENDPOINT"
echo "  Device ID:    $DEVICE_ID"
echo "  Requests:     $REQUESTS"
echo "  Concurrency:  $CONCURRENCY"
echo "═══════════════════════════════════════════════════════════════"

# ── Deploy current api to staging ──
echo ""
echo ">>> Deploying api to staging..."
cd "$(dirname "$0")/.."  # project root
apps/api/node_modules/.bin/wrangler deploy --env staging 2>&1 | tail -3
echo ""

# ── Dry run (single request to verify) ──
echo ">>> Dry run (1 request)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Device-Id: $DEVICE_ID" \
  "$ENDPOINT")
echo "  HTTP $HTTP_CODE"
echo ""

# ── Stress with ab ──
echo ">>> Stress test ($REQUESTS requests, $CONCURRENCY concurrent)..."
ab -n "$REQUESTS" -c "$CONCURRENCY" \
  -H "X-Device-Id: $DEVICE_ID" \
  -H "Accept: application/json" \
  "$ENDPOINT" 2>&1 | tail -20

echo ""
echo "═══ Done ═══════════════════════════════════════════════════════"
echo ""
echo "Interpretation:"
echo "  Non-2xx responses = rate limited (429)"
echo "  If ALL 100 requests return 200, the rate limiter"
echo "    may be in a new window or the limit is >100."
echo "  If some return 429, rate limiting is working."
echo ""
echo "To test with different device IDs:"
echo "  seq 1 50 | parallel -j10 curl -s -o /dev/null -w '%{http_code}\n' \\"
echo "    -H 'X-Device-Id: device-{}' $ENDPOINT | sort | uniq -c"
