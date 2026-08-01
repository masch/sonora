#!/bin/bash
# ── Staging Rate Limit Stress Test ──────────────────────────────
#
# Usage:
#   bash scripts/stress-rate-limit.sh                      → run ALL endpoints
#   bash scripts/stress-rate-limit.sh all                  → run ALL endpoints
#   bash scripts/stress-rate-limit.sh payments-create      → run one endpoint
#   bash scripts/stress-rate-limit.sh dry-run              → dry-run all (1 req each)
#   bash scripts/stress-rate-limit.sh list                 → list named endpoints
#
# Options (override defaults for every endpoint):
#   -n <count>      Total requests per endpoint  (default: 100)
#   -c <num>        Concurrency level            (default: 10)
#   -d <device-id>  Custom device ID suffix      (default: auto per endpoint)
#   --no-deploy     Skip wrangler deploy
#
# Examples:
#   bash scripts/stress-rate-limit.sh -n 50 -c 5 payments-create
#   bash scripts/stress-rate-limit.sh --no-deploy all
#
# Requires: curl, ab (Apache Bench)
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Named endpoints ─────────────────────────────────────────────
# Format: name|url|expected_limit|device_id_suffix

ENDPOINTS=(
	"payments-create|POST|https://sonora-api-staging.sonora-api.workers.dev/payments/create|10|payments|{\"experienceId\":\"550e8400-e29b-41d4-a716-446655440000\"}"
	"experiences-list|GET|https://sonora-api-staging.sonora-api.workers.dev/experiences|30|experiences|"
	"experiences-access|POST|https://sonora-api-staging.sonora-api.workers.dev/payments/experiences/123/access|20|access|{\"source\":\"sonoraMap\"}"
)

# ── Defaults ────────────────────────────────────────────────────

REQUESTS=100
CONCURRENCY=10
DEVICE_SUFFIX=""
DEPLOY=true

# ── Parse options ───────────────────────────────────────────────

POSITIONAL=()
while [[ $# -gt 0 ]]; do
	case "$1" in
	-n)
		REQUESTS="$2"
		shift 2
		;;
	-c)
		CONCURRENCY="$2"
		shift 2
		;;
	-d)
		DEVICE_SUFFIX="$2"
		shift 2
		;;
	--no-deploy)
		DEPLOY=false
		shift
		;;
	-h | --help)
		head -30 "$0"
		exit 0
		;;
	*)
		POSITIONAL+=("$1")
		shift
		;;
	esac
done

SELECTOR="${POSITIONAL[0]:-all}"

# ── Functions ───────────────────────────────────────────────────

_curl() {
	local method="$1" url="$2" device_id="$3" body="$4"
	if [[ "$method" == "GET" ]]; then
		curl -s -o /dev/null -w "%{http_code}\n" \
			-H "X-Device-Id: $device_id" \
			"$url"
	else
		curl -s -o /dev/null -w "%{http_code}\n" -X "$method" \
			-H "X-Device-Id: $device_id" \
			-H "Content-Type: application/json" \
			-d "$body" \
			"$url"
	fi
}

_ab() {
	local method="$1" url="$2" device_id="$3" body="$4"
	if [[ "$method" == "POST" ]]; then
		local body_file
		body_file=$(mktemp)
		printf '%s' "$body" >"$body_file"
		ab -n "$REQUESTS" -c "$CONCURRENCY" \
			-p "$body_file" -T "application/json" \
			-H "X-Device-Id: $device_id" \
			-H "Accept: application/json" \
			"$url" 2>&1 | tail -15
		rm -f "$body_file"
	else
		ab -n "$REQUESTS" -c "$CONCURRENCY" \
			-H "X-Device-Id: $device_id" \
			-H "Accept: application/json" \
			"$url" 2>&1 | tail -15
	fi
}

run_stress_test() {
	local name="$1" method="$2" url="$3" limit="$4" device_suffix="$5" body="$6"
	local device_id="stress-device-${DEVICE_SUFFIX:-${device_suffix}}"

	echo ""
	echo "═══════════════════════════════════════════════════════════════"
	echo "  Endpoint:  $name"
	echo "  Method:    $method"
	echo "  URL:       $url"
	echo "  Limit:     $limit req/window"
	echo "  Device:    $device_id"
	echo "  Requests:  $REQUESTS"
	echo "  Concurrency: $CONCURRENCY"
	echo "═══════════════════════════════════════════════════════════════"

	# Dry run
	echo ""
	echo ">>> Dry run..."
	HTTP_CODE=$(_curl "$method" "$url" "$device_id" "$body")
	echo "    HTTP $HTTP_CODE"

	# Stress
	echo ""
	echo ">>> Stress test..."
	_ab "$method" "$url" "$device_id" "$body"

	# Quick response code breakdown via parallel curl
	echo ""
	echo ">>> Response code breakdown (${REQUESTS}x parallel curl)..."
	local codes_file
	codes_file=$(mktemp)
	for _ in $(seq 1 "$REQUESTS"); do
		_curl "$method" "$url" "$device_id" "$body" >>"$codes_file" &
	done
	wait
	echo "  Response codes:"
	sort "$codes_file" | uniq -c | awk '{printf "    HTTP %s: %sx\n", $2, $1}'
	rm -f "$codes_file"

	# Fresh device check
	echo ""
	local fresh
	fresh=$(_curl "$method" "$url" "${device_id}-final-check" "$body")
	echo "  Fresh device check: HTTP $fresh (should be 200/404)"
}

dry_run_all() {
	echo "═══ Dry-run: 1 request per endpoint ═══════════════════════════"
	for entry in "${ENDPOINTS[@]}"; do
		IFS='|' read -r name method url _ suffix body <<<"$entry"
		local device_id="stress-device-${DEVICE_SUFFIX:-${suffix}}"
		HTTP_CODE=$(_curl "$method" "$url" "$device_id" "$body")
		echo "  $method $name → HTTP $HTTP_CODE"
	done
}

list_endpoints() {
	echo "═══ Configured endpoints ═══════════════════════════════════════"
	printf "  %-20s %-6s %s\n" "NAME" "METHOD" "URL"
	printf "  %-20s %-6s %s\n" "----" "------" "---"
	for entry in "${ENDPOINTS[@]}"; do
		IFS='|' read -r name method url limit _ <<<"$entry"
		printf "  %-20s %-6s %s (limit: %s)\n" "$name" "$method" "$url" "$limit"
	done
}

# ── Main ────────────────────────────────────────────────────────

case "$SELECTOR" in
list)
	list_endpoints
	exit 0
	;;
dry-run)
	dry_run_all
	exit 0
	;;
esac

# Deploy
if $DEPLOY; then
	echo "═══ Deploying api to staging ═══════════════════════════════════"
	echo ""
	make -C "$(dirname "$0")/.." api-deploy-staging 2>&1 | tail -5
fi

# Run selected endpoint or all
if [[ "$SELECTOR" == "all" ]]; then
	for entry in "${ENDPOINTS[@]}"; do
		IFS='|' read -r name method url limit suffix body <<<"$entry"
		run_stress_test "$name" "$method" "$url" "$limit" "$suffix" "$body"
	done
else
	found=false
	for entry in "${ENDPOINTS[@]}"; do
		IFS='|' read -r name method url limit suffix body <<<"$entry"
		if [[ "$name" == "$SELECTOR" ]]; then
			run_stress_test "$name" "$method" "$url" "$limit" "$suffix" "$body"
			found=true
			break
		fi
	done
	if ! $found; then
		echo "Unknown endpoint: '$SELECTOR'"
		echo ""
		list_endpoints
		echo ""
		echo -n "Use: all | dry-run | list | "
		for e in "${ENDPOINTS[@]}"; do
			IFS='|' read -r n _ _ _ _ <<<"$e"
			echo -n "$n | "
		done
		echo ""
		exit 1
	fi
fi

echo ""
echo "═══ All done ═════════════════════════════════════════════════════"
echo ""
echo "Interpretation:"
echo "  Non-2xx responses = rate limited (429)"
echo "  If ALL requests return 200, rate limiter may be in a new"
echo "    window or the limit exceeds the request count."
echo "  If some return 429, rate limiting is working correctly."
echo ""
echo "To test a single endpoint:"
echo "  bash scripts/stress-rate-limit.sh <name>"
