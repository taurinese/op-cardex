#!/bin/bash
# Fetches fresh card data from the official One Piece TCG site via vegapull (Docker).
# Then processes it into public/data/ via build-data.mjs.
#
# Usage:
#   ./scripts/update-data.sh              # fetch + build (no images)
#   ./scripts/update-data.sh --with-images

set -e
cd "$(dirname "$0")/.."

IMAGE="op-cardex-vegapull"
CACHE_DIR="$(pwd)/.vegapull-cache"

echo "Building vegapull Docker image (only recompiles if Dockerfile changed)..."
docker build -f Dockerfile.vegapull -t "$IMAGE" .

mkdir -p "$CACHE_DIR"

echo ""
echo "Fetching card data..."
docker run --rm -v "$CACHE_DIR:/output" "$IMAGE"

echo ""
echo "Processing data..."
if [ "$1" = "--with-images" ]; then
  node scripts/build-data.mjs
else
  node scripts/build-data.mjs --no-images
fi
