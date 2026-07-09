#!/bin/bash
# build-release.sh — Build release archives for Homebrew formula.
#
# Usage:
#   ./packaging/homebrew/build-release.sh [version]
#
# This builds for the CURRENT platform only.
# Cross-platform builds are handled by GitHub Actions (release.yml).
#
# For a full release:
#   1. Push a tag: git tag v2.0.0 && git push origin v2.0.0
#   2. GitHub Actions builds all platforms automatically
#   3. Run: ./scripts/update-homebrew-formula.sh 2.0.0

set -euo pipefail

VERSION="${1:-$(node -p "require('./package.json').version")}"
BUILD_DIR="dist-release"

echo "Building Zavorth v${VERSION} for $(uname -s)-$(uname -m)..."

# Ensure build exists
if [ ! -d dist ]; then
  echo "Running npm build first..."
  npm run build --silent
fi

# Compile standalone binary
node scripts/zavorth-compile.mjs

# Package
mkdir -p "$BUILD_DIR"
cd dist-standalone

ARCHIVE="../${BUILD_DIR}/zavorth-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m).tar.gz"

if [ -d native ]; then
  tar -czf "$ARCHIVE" zavorth* native/
else
  tar -czf "$ARCHIVE" zavorth*
fi

cd ..

CHECKSUM=$(shasum -a 256 "$ARCHIVE" | cut -d' ' -f1)

echo ""
echo "Build complete:"
echo "  Archive: $ARCHIVE"
echo "  Size:    $(du -h "$ARCHIVE" | cut -f1)"
echo "  SHA256:  $CHECKSUM"
echo ""
echo "To create a full release with all platforms:"
echo "  1. git tag v${VERSION}"
echo "  2. git push origin v${VERSION}"
echo "  3. Wait for GitHub Actions to build all platforms"
echo "  4. ./scripts/update-homebrew-formula.sh ${VERSION}"
