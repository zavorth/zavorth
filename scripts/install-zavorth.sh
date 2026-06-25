#!/usr/bin/env bash
set -euo pipefail

tag="latest"
dry_run=0

# Premium ANSI colors
CLR_RESET='\033[0m'
CLR_PRIMARY='\033[1;36m'   # Bold Cyan
CLR_ACCENT='\033[1;35m'    # Bold Magenta
CLR_MUTED='\033[0;90m'     # Dark Gray
CLR_SUCCESS='\033[1;32m'   # Bold Green
CLR_WARNING='\033[1;33m'   # Bold Yellow
CLR_ERROR='\033[1;31m'     # Bold Red
CLR_INFO='\033[1;34m'      # Bold Blue

usage() {
  cat <<USAGE
${CLR_PRIMARY}Zavorth Installer${CLR_RESET}

Usage:
  bash scripts/install-zavorth.sh [--dry-run] [--tag latest]

Options:
  --dry-run     Show checks and commands without installing anything.
  --tag <tag>   npm dist-tag or version to install. Default: latest.
  -h, --help    Show this help.
USAGE
}

step() {
  printf " ${CLR_PRIMARY}⠋${CLR_RESET} %s\n" "$1"
}

ok() {
  printf " ${CLR_SUCCESS}✓${CLR_RESET} %s\n" "$1"
}

fail() {
  printf "\n ${CLR_ERROR}✗ ERROR:${CLR_RESET} %s\n\n" "$1" >&2
  exit "${2:-1}"
}

# Unicode loading spinner
run_with_spinner() {
  local message="$1"
  shift
  local pid
  # Execute command in background
  "$@" >/dev/null 2>&1 &
  pid=$!
  
  local spinchars=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  local delay=0.08
  while kill -0 "$pid" 2>/dev/null; do
    for char in "${spinchars[@]}"; do
      printf "\r ${CLR_PRIMARY}%s${CLR_RESET} %s..." "$char" "$message"
      sleep $delay
    done
  done
  wait "$pid"
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    printf "\r ${CLR_ERROR}✗${CLR_RESET} %s (Failed)\n" "$message"
    return $exit_code
  else
    printf "\r ${CLR_SUCCESS}✓${CLR_RESET} %s\n" "$message"
    return 0
  fi
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
  fail "Invalid tag/version. Use a simple value such as latest or 1.1.0." 2
fi

clear 2>/dev/null || true
echo -e "${CLR_PRIMARY} ✨  Z A V O R T H  |  I N S T A L L E R${CLR_RESET}"
echo -e "${CLR_MUTED}  Local-first intelligence. Governed execution. Clear evidence.${CLR_RESET}"
echo -e "${CLR_MUTED} ─────────────────────────────────────────────────────────────${CLR_RESET}"
echo ""

# Check dependencies
command -v node >/dev/null 2>&1 || fail "Node.js was not found. Install Node.js 18 or newer, then run this installer again." 2
command -v npm >/dev/null 2>&1 || fail "npm was not found. Install npm with Node.js, then run this installer again." 2

node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
if [[ ! "$node_major" =~ ^[0-9]+$ ]]; then
  fail "Could not read the Node.js version." 2
fi
if [[ "$node_major" -lt 18 ]]; then
  fail "Node.js $(node --version) was found. Zavorth requires Node.js 18 or newer." 2
fi

node_version=$(node --version)
npm_version=$(npm --version)
ok "Node.js runtime detected: ${CLR_MUTED}${node_version}${CLR_RESET}"
ok "npm package manager detected: ${CLR_MUTED}v${npm_version}${CLR_RESET}"

package_spec="zavorth@$tag"
echo -e " ${CLR_MUTED}Target Package:${CLR_RESET} ${CLR_PRIMARY}${package_spec}${CLR_RESET}"
echo ""

if [[ "$dry_run" -eq 1 ]]; then
  step "Running in dry-run mode..."
  ok "Would run: npm install -g $package_spec"
  ok "Would run: zavorth --help"
  ok "Would run: zavorth help doctor"
  echo ""
  ok "Dry-run complete. No files or system paths were changed."
  exit 0
fi

# Run installation with spinner
run_with_spinner "Downloading and installing $package_spec globally" npm install -g "$package_spec" || fail "npm install failed. Fix permissions or check network connection." 3

# Verify path
command -v zavorth >/dev/null 2>&1 || fail "Installation finished, but 'zavorth' command is not on PATH. Restart the terminal or check npm global bin." 4

# Run safe post-install checks
run_with_spinner "Verifying CLI executable integrity" zavorth --help || fail "Safe CLI verification failed. Run: zavorth doctor" 5
run_with_spinner "Verifying system diagnostics readiness" zavorth help doctor || fail "Safe diagnostics check failed. Run: zavorth doctor" 5

echo ""
echo -e " ${CLR_SUCCESS}🎉 Success! Zavorth has been successfully installed.${CLR_RESET}"
echo -e " ${CLR_MUTED}─────────────────────────────────────────────────────────────${CLR_RESET}"
echo -e " ${CLR_PRIMARY}Next steps to get started:${CLR_RESET}"
echo -e "  1. Run ${CLR_ACCENT}zavorth setup${CLR_RESET} to connect your first AI model."
echo -e "  2. Run ${CLR_ACCENT}zavorth start${CLR_RESET} to launch the background runtime daemon."
echo -e "  3. Run ${CLR_ACCENT}zavorth open${CLR_RESET} to open the visual dashboard in your browser."
echo -e " ${CLR_MUTED}─────────────────────────────────────────────────────────────${CLR_RESET}"
echo ""
