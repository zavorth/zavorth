#!/usr/bin/env bash
set -euo pipefail

tag="latest"
dry_run=0

usage() {
  cat <<'USAGE'
Zavorth official installer

Usage:
  bash scripts/install-zavorth.sh [--dry-run] [--tag latest]

Options:
  --dry-run     Show checks and commands without installing anything.
  --tag <tag>   npm tag to install. Default: latest.
  -h, --help    Show this help.
USAGE
}

step() {
  printf '[Zavorth] %s\n' "$1"
}

fail() {
  printf '[Zavorth] %s\n' "$1" >&2
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
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1" 2
      ;;
  esac
done

if [[ ! "$tag" =~ ^[A-Za-z0-9._-]+$ ]]; then
  fail "Invalid npm tag. Use a simple tag such as latest." 2
fi

command -v node >/dev/null 2>&1 || fail "node was not found. Install Node.js 18 or newer, then run this installer again." 2
command -v npm >/dev/null 2>&1 || fail "npm was not found. Install npm with Node.js, then run this installer again." 2

package_spec="zavorth@$tag"

step "Official installer"
step "Mode: $([[ "$dry_run" -eq 1 ]] && printf dry-run || printf install)"
step "Package: $package_spec"
node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
if [[ ! "$node_major" =~ ^[0-9]+$ ]]; then
  fail "Could not read the Node.js version." 2
fi
if [[ "$node_major" -lt 18 ]]; then
  fail "Node.js $(node --version) was found. Zavorth requires Node.js 18 or newer." 2
fi
step "Node: $(node --version)"
step "npm: $(npm --version)"

if [[ "$dry_run" -eq 1 ]]; then
  step "Would run: npm install -g $package_spec"
  step "Would run: zavorth --help"
  step "Would run: zavorth help doctor"
  step "Dry-run complete. No global install, runtime start, or secret write happened."
  exit 0
fi

step "Installing $package_spec globally..."
npm install -g "$package_spec" || fail "npm install failed. Next: run npm doctor or try this installer with --dry-run." 3

command -v zavorth >/dev/null 2>&1 || fail "Install finished, but the zavorth command is not on PATH. Restart the terminal or check npm global bin." 4

step "Running safe post-install check: zavorth --help"
zavorth --help || fail "Zavorth installed, but the safe help check failed. Next: run zavorth doctor." 5

step "Running safe post-install check: zavorth help doctor"
zavorth help doctor || fail "Zavorth installed, but the safe doctor help check failed. Next: run zavorth doctor." 5

step "Ready. Next: zavorth setup"
