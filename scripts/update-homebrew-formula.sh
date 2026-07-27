#!/bin/bash
# update-homebrew-formula.sh — Update Homebrew formula with real SHA256 checksums.
#
# Usage:
#   ./scripts/update-homebrew-formula.sh <version>
#
# This script:
#   1. Downloads release tarballs from GitHub
#   2. Calculates SHA256 for each platform
#   3. Updates the Homebrew formula with real checksums
#
# Prerequisites: gh CLI authenticated, curl, shasum

set -euo pipefail

VERSION="${1:...Usage: $0 <version>}"
REPO="zavorth/zavorth"
FORMULA="packaging/homebrew/zavorth.rb"
PLATFORMS=("darwin-x64" "darwin-arm64" "linux-x64" "linux-arm64")

echo "Updating Homebrew formula for v${VERSION}..."

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

declare -A CHECKSUMS

for platform in "${PLATFORMS[@]}"; do
  ARCHIVE="zavorth-${platform}.tar.gz"
  URL="https://github.com/${REPO}/releases/download/v${VERSION}/${ARCHIVE}"

  echo -n "  Downloading ${ARCHIVE}... "
  if ! curl -sL -o "${TEMP_DIR}/${ARCHIVE}" "$URL"; then
    echo "FAILED (release may not exist yet)"
    continue
  fi

  CHECKSUM=$(shasum -a 256 "${TEMP_DIR}/${ARCHIVE}" | cut -d' ' -f1)
  CHECKSUMS[$platform]="$CHECKSUM"
  echo "$CHECKSUM"
done

if [ ${#CHECKSUMS[@]} -eq 0 ]; then
  echo "ERROR: No checksums computed. Aborting."
  exit 1
fi

echo ""
echo "Updating formula..."

# Read current formula
FORMULA_PATH="$(dirname "$0")/../${FORMULA}"
if [ ! -f "$FORMULA_PATH" ]; then
  FORMULA_PATH="${FORMULA}"
fi

if [ ! -f "$FORMULA_PATH" ]; then
  echo "ERROR: Formula not found at ${FORMULA_PATH}"
  exit 1
fi

# Update version
sed -i.bak "s/version \".*\"/version \"${VERSION}\"/" "$FORMULA_PATH"

# Update SHA256s
for platform in "${PLATFORMS[@]}"; do
  CHECKSUM="${CHECKSUMS[$platform]:-MISSING}"
  # Convert platform name to variable name (darwin-x64 -> DARWIN_X64)
  VAR_NAME=$(echo "$platform" | tr '[:lower:]-' '[:upper:]_')
  sed -i.bak "s/PLACEHOLDER_SHA256_${VAR_NAME}/${CHECKSUM}/" "$FORMULA_PATH"
done

rm -f "${FORMULA_PATH}.bak"

echo ""
echo "Formula updated:"
grep -E '(version|sha256)' "$FORMULA_PATH" | head -10
echo ""
echo "Next steps:"
echo "  1. Review the changes: git diff ${FORMULA}"
echo "  2. Commit: git add ${FORMULA} && git commit -m 'chore: update homebrew formula for v${VERSION}'"
echo "  3. Push: git push"
echo "  4. Test: brew install --build-from-source ${FORMULA}"
