#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "${APPLE_CERTIFICATE_BASE64:-}" ]]; then
  echo "$APPLE_CERTIFICATE_BASE64" | base64 --decode > certificate.p12
  export CSC_LINK="$ROOT/certificate.p12"
  export CSC_KEY_PASSWORD="${APPLE_CERTIFICATE_PASSWORD:-}"
fi

npm run release:publish
node scripts/rewrite-r2-update-metadata.mjs
