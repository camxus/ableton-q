#!/usr/bin/env bash
# scripts/package-app.sh
# Packages AbletonQ.app into a distributable zip (and optionally a DMG).
# Run from the repo root.

set -euo pipefail

APP="native-app/dist/AbletonQ.app"
OUT_DIR="dist"

echo "── AbletonQ Packager ──────────────────────────────"

# ── Preflight ─────────────────────────────────────────────────────────────────
if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run from repo root." >&2
  exit 1
fi

# Ensure Remote Script is present in Resources
RS="$APP/Contents/Resources/AbletonQ_Remote_Script"
if [ ! -d "$RS" ]; then
  echo "Remote Script missing — fetching from GitHub…"
  bash scripts/fetch-remote-script.sh
fi

# Make the launcher executable
chmod +x "$APP/Contents/MacOS/AbletonQ"

# ── Zip ───────────────────────────────────────────────────────────────────────
mkdir -p "$OUT_DIR"
ZIP="$OUT_DIR/AbletonQ.app.zip"
echo "Creating $ZIP …"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"
echo "✓ $ZIP ($(du -sh "$ZIP" | cut -f1))"

# ── Optional DMG (requires create-dmg, brew install create-dmg) ───────────────
if command -v create-dmg &>/dev/null; then
  DMG="$OUT_DIR/AbletonQ.dmg"
  echo "Creating $DMG …"
  create-dmg \
    --volname "AbletonQ" \
    --window-size 540 360 \
    --icon-size 96 \
    --app-drop-link 380 180 \
    --icon "AbletonQ.app" 160 180 \
    "$DMG" \
    "$APP"
  echo "✓ $DMG"
else
  echo "(skipping DMG — install create-dmg for DMG packaging)"
fi

echo "── Done ─────────────────────────────────────────────"
