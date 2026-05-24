#!/usr/bin/env bash
set -euo pipefail

channel="${ZAVORTH_CHANNEL:-stable}"
tag="${ZAVORTH_NPM_TAG:-}"
dry_run=0
install_completions=0

usage() {
  cat <<'USAGE'
Zavorth installer

Usage:
  curl -fsSL <installer-url> | bash
  ZAVORTH_CHANNEL=beta curl -fsSL <installer-url> | bash
  bash scripts/install.sh [--dry-run] [--channel stable]

Options:
  --dry-run     Show checks and commands without installing anything.
  --channel     Release channel: stable, beta, nightly or dev. Default: stable.
  --tag <tag>   npm dist-tag or version to install. Default: latest.
  --completions Print the shell completion install command after install.
  -h, --help    Show this help.

This installer is intentionally conservative: until Zavorth publishes signed
standalone binaries, it installs the official npm package and verifies the CLI.
USAGE
}

step() {
  printf '\033[0;33m[Zavorth]\033[0m %s\n' "$1"
}

ok() {
  printf '\033[0;32m[Zavorth] OK\033[0m %s\n' "$1"
}

fail() {
  printf '\033[0;31m[Zavorth] ERROR\033[0m %s\n' "$1" >&2
  exit "${2:-1}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run=1
      shift
      ;;
    --tag)
      [[ $# -ge 2 ]] || fail "Missing value for --tag." 2
      tag="$2"
      shift 2
      ;;
    --channel)
      [[ $# -ge 2 ]] || fail "Missing value for --channel." 2
      channel="$2"
      shift 2
      ;;
    --completions)
      install_completions=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1" 2
      ;;
  esac
done

case "$channel" in
  stable) default_tag="latest" ;;
  beta) default_tag="beta" ;;
  nightly) default_tag="nightly" ;;
  dev) default_tag="dev" ;;
  *) fail "Invalid channel. Expected stable, beta, nightly or dev." 2 ;;
esac

tag="${tag:-$default_tag}"

if [[ ! "$tag" =~ ^[A-Za-z0-9._-]+$ ]]; then
  fail "Invalid tag/version. Use a simple value such as latest or 1.1.0." 2
fi

cat <<'BANNER'
  Z A V O R T H   I N S T A L L E R
  Local-first intelligence. Governed execution. Clear evidence.
BANNER
echo ""

command -v node >/dev/null 2>&1 || fail "Node.js was not found. Install Node.js 18 or newer, then run this installer again." 2
command -v npm >/dev/null 2>&1 || fail "npm was not found. Install npm with Node.js, then run this installer again." 2

node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
if [[ ! "$node_major" =~ ^[0-9]+$ ]]; then
  fail "Could not read the Node.js version." 2
fi
if [[ "$node_major" -lt 18 ]]; then
  fail "Node.js $(node --version) was found. Zavorth requires Node.js 18 or newer." 2
fi

package_spec="zavorth@$tag"
step "Mode: $([[ "$dry_run" -eq 1 ]] && printf dry-run || printf install)"
step "Channel: $channel"
step "Package: $package_spec"
step "Node: $(node --version)"
step "npm: $(npm --version)"

if [[ "$dry_run" -eq 1 ]]; then
  step "Would run: npm install -g $package_spec"
  step "Would run: zavorth --help"
  step "Would run: zavorth help doctor"
  if [[ "$install_completions" -eq 1 ]]; then
    step "Would suggest: zavorth completions <shell> --install"
  fi
  ok "Dry-run complete. No install, runtime start, PATH edit, or secret write happened."
  exit 0
fi

step "Installing $package_spec globally..."
npm install -g "$package_spec" || fail "npm install failed. Run npm doctor, fix npm permissions, or retry with --dry-run." 3

command -v zavorth >/dev/null 2>&1 || fail "Install finished, but zavorth is not on PATH. Restart the terminal or check npm global bin." 4

step "Running safe post-install check: zavorth --help"
zavorth --help >/dev/null || fail "Zavorth installed, but the help check failed. Next: run zavorth doctor." 5

step "Running safe post-install check: zavorth help doctor"
zavorth help doctor >/dev/null || fail "Zavorth installed, but the doctor help check failed. Next: run zavorth doctor." 5

ok "Ready. Next: zavorth setup"
if [[ "$install_completions" -eq 1 ]]; then
  step "Completions are opt-in. Run one of:"
  step "  zavorth completions bash --install"
  step "  zavorth completions zsh --install"
  step "  zavorth completions fish --install"
fi
