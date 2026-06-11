#!/usr/bin/env bash
# scripts/fetch-remote-script.sh
# Copies the AbletonQ_Remote_Script from the local resources directory
# into the .app bundle's Resources folder so the launcher can install it.
# No network access required.

set -euo pipefail

SCRIPT_NAME="AbletonQ_Remote_Script"
DEST="macos-app/AbletonQApp.app/Contents/Resources/$SCRIPT_NAME"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_RS="$SCRIPT_DIR/../native-app/resources/$SCRIPT_NAME"

if [ ! -d "$LOCAL_RS" ]; then
  echo "ERROR: Local $SCRIPT_NAME not found at $LOCAL_RS" >&2
  echo "  Place the AbletonQ_Remote_Script directory at:" >&2
  echo "    $LOCAL_RS" >&2
  exit 1
fi

echo "Copying $SCRIPT_NAME from local resources → $DEST"

mkdir -p "$DEST"
cp -r "$LOCAL_RS/." "$DEST/"

echo "✓ Remote Script copied to $DEST"
echo "  Files: $(find "$DEST" -type f | wc -l | tr -d ' ')"
