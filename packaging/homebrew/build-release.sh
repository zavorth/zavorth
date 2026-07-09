#!/bin/bash
# Build release archives for Homebrew formula
# Usage: ./build-release.sh <version>
set -e

VERSION=${1:-"1.1.0"}
BUILD_DIR="dist-release"
PLATFORMS=("darwin-x64" "darwin-arm64" "linux-x64" "linux-arm64")

mkdir -p "$BUILD_DIR"

for platform in "${PLATFORMS[@]}"; do
  echo "Building for $platform..."
  ARCHIVE="$BUILD_DIR/zavorth-$platform.tar.gz"

  if [ "$platform" = "darwin-x64" ] || [ "$platform" = "linux-x64" ]; then
    NODE_ARCH="x64"
  else
    NODE_ARCH="arm64"
  fi

  # Build Node SEA binary
  npx tsx scripts/zavorth-compile.mjs --arch "$NODE_ARCH" --output "$BUILD_DIR/zavorth-$platform"

  # Create tarball
  cd "$BUILD_DIR"
  tar -czf "zavorth-$platform.tar.gz" "zavorth-$platform"
  rm -f "zavorth-$platform"
  cd ..

  # Calculate checksum
  CHECKSUM=$(shasum -a 256 "$ARCHIVE" | cut -d' ' -f1)
  echo "  $platform: sha256 $CHECKSUM"
done

echo ""
echo "Release archives built in $BUILD_DIR/"
echo "Update the Homebrew formula with the checksums above."
