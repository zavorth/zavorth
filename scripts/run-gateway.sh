#!/bin/bash

# Startup epoch
STARTUP_EPOCH=$(date +%s)
export STARTUP_EPOCH

# Temporary file to watch
DRAIN_FILE="/tmp/.drain_request.json"

# Print startup info
echo "[Wrapper] Starting gateway server with STARTUP_EPOCH=${STARTUP_EPOCH}..."

# Boot the gateway process
npx next start src/ai-gateway &
GATEWAY_PID=$!

# Poller loop as a secondary safeguard
poll_drain() {
  while true; do
    sleep 5
    if [ -f "$DRAIN_FILE" ]; then
      if command -v jq >/dev/null 2>&1; then
        TARGET_EPOCH=$(jq -r '.epoch' "$DRAIN_FILE")
      else
        # Fallback using grep and cut if jq is not present
        TARGET_EPOCH=$(grep -o '"epoch":[0-9]*' "$DRAIN_FILE" | cut -d: -f2)
      fi

      if [ "$TARGET_EPOCH" = "$STARTUP_EPOCH" ]; then
        echo "[Wrapper] Drain requested for our epoch (${STARTUP_EPOCH}). Invoking trigger..."
        node "$(dirname "$0")/drain-trigger.js" "$STARTUP_EPOCH"
        rm -f "$DRAIN_FILE"
        wait $GATEWAY_PID
        exit 0
      fi
    fi
  done
}

# Run the poller in the background
poll_drain &

# Wait for the gateway process to complete
wait $GATEWAY_PID
