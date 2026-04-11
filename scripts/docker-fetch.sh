#!/bin/bash
# Runs inside the vega Docker container.
# Fetches packs + cards for EN, FR, JP into /output.
set -e

OUTPUT_DIR=/output

for lang in english french japanese; do
  echo ""
  echo "=== $lang ==="

  vega pull --language "$lang" --output "$OUTPUT_DIR/$lang" packs

  pack_ids=$(jq -r '.[].id' "$OUTPUT_DIR/$lang/json/packs.json")
  total=$(echo "$pack_ids" | wc -l)
  i=0

  for pack_id in $pack_ids; do
    i=$((i + 1))
    echo "  [$i/$total] $pack_id"
    vega pull --language "$lang" --output "$OUTPUT_DIR/$lang" cards "$pack_id" 2>/dev/null \
      || echo "    ⚠ skipped"
  done
done

echo ""
echo "Done."
