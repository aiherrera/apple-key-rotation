#!/usr/bin/env bash
# Rebuild build/icon.icns from build/icon-1024.png (macOS: sips + iconutil).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/build/icon-1024.png}"
OUT="$ROOT/build/AppIcon.iconset"
ICNS="$ROOT/build/icon.icns"

if [[ ! -f "$SRC" ]]; then
  echo "Missing: $SRC" >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"

sips -z 16 16     "$SRC" --out "$OUT/icon_16x16.png"       >/dev/null
sips -z 32 32     "$SRC" --out "$OUT/icon_16x16@2x.png"     >/dev/null
sips -z 32 32     "$SRC" --out "$OUT/icon_32x32.png"       >/dev/null
sips -z 64 64     "$SRC" --out "$OUT/icon_32x32@2x.png"    >/dev/null
sips -z 128 128   "$SRC" --out "$OUT/icon_128x128.png"     >/dev/null
sips -z 256 256   "$SRC" --out "$OUT/icon_128x128@2x.png"  >/dev/null
sips -z 256 256   "$SRC" --out "$OUT/icon_256x256.png"     >/dev/null
sips -z 512 512   "$SRC" --out "$OUT/icon_256x256@2x.png"  >/dev/null
sips -z 512 512   "$SRC" --out "$OUT/icon_512x512.png"     >/dev/null
sips -z 1024 1024 "$SRC" --out "$OUT/icon_512x512@2x.png"  >/dev/null

iconutil -c icns "$OUT" -o "$ICNS"
rm -rf "$OUT"
echo "Wrote $ICNS"
