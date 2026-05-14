#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${ZAVORTH_INSTALL_SMOKE_IMAGE:-node:22-bookworm-slim}"
PLATFORM="${ZAVORTH_INSTALL_SMOKE_PLATFORM:-linux/amd64}"
SKIP_PACK="${ZAVORTH_INSTALL_SMOKE_SKIP_PACK:-0}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT

step() {
  printf '[zavorth-install-smoke-docker] %s\n' "$1"
}

fail() {
  printf '[zavorth-install-smoke-docker] %s\n' "$1" >&2
  exit "${2:-1}"
}

command -v docker >/dev/null 2>&1 || fail "docker was not found. Run this from a Docker-capable host or WSL2 environment." 2
docker info >/dev/null 2>&1 || fail "docker is installed, but the daemon is not reachable. Start Docker Desktop or the WSL2 Docker service, then run this smoke again." 2

if [[ ! -f "$ROOT_DIR/scripts/install-zavorth.sh" ]]; then
  fail "scripts/install-zavorth.sh was not found." 2
fi

if [[ "$SKIP_PACK" != "1" ]]; then
  step "Packing local Zavorth package"
  npm pack --json --pack-destination "$TMP_DIR" >"$TMP_DIR/pack.json"
  TARBALL="$(node -e '
const fs = require("node:fs");
const parsed = JSON.parse(fs.readFileSync(process.argv[1], "utf8") || "[]");
const last = Array.isArray(parsed) ? parsed.at(-1) : null;
if (!last || typeof last.filename !== "string") process.exit(1);
process.stdout.write(last.filename);
' "$TMP_DIR/pack.json")"
  [[ -n "$TARBALL" && -f "$TMP_DIR/$TARBALL" ]] || fail "npm pack did not produce a tarball." 3
fi

step "Running Linux installer dry-run smoke in Docker"
docker run --rm -t \
  --platform "$PLATFORM" \
  -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  -e npm_config_fund=false \
  -e npm_config_audit=false \
  -v "$ROOT_DIR:/work:ro" \
  "$IMAGE" \
  bash -lc "cd /work && bash scripts/install-zavorth.sh --dry-run"

if [[ "$SKIP_PACK" == "1" ]]; then
  step "Skipping tarball install smoke because ZAVORTH_INSTALL_SMOKE_SKIP_PACK=1"
  exit 0
fi

step "Running local tarball install smoke in Docker"
docker run --rm -t \
  --platform "$PLATFORM" \
  -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  -e npm_config_fund=false \
  -e npm_config_audit=false \
  -v "$TMP_DIR:/pkg:ro" \
  "$IMAGE" \
  bash -lc "npm install -g /pkg/$TARBALL --omit=optional && zavorth --help >/tmp/zavorth-help.txt && zavorth help doctor >/tmp/zavorth-doctor-help.txt && test -s /tmp/zavorth-help.txt && test -s /tmp/zavorth-doctor-help.txt"

step "Passed. Docker/WSL2 install smoke completed without starting persistent runtime."
