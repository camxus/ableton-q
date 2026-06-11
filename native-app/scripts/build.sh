#!/usr/bin/env bash
# native-app/scripts/build.sh  —  v0.2.0
# One-command build: deps → remote script → PyInstaller → dist/AbletonQ.app
#
# Usage:
#   bash scripts/build.sh              # standard build
#   bash scripts/build.sh --sign       # + ad-hoc codesign
#   bash scripts/build.sh --dmg        # + DMG  (needs: brew install create-dmg)
#   bash scripts/build.sh --sign --dmg # both

set -euo pipefail
cd "$(dirname "$0")/.."

B=$'\e[34m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'
log()  { echo "${B}▸${N} $*"; }
ok()   { echo "${G}✓${N} $*"; }
warn() { echo "${Y}!${N} $*"; }
die()  { echo "${R}✗${N} $*"; exit 1; }

PYTHON=${PYTHON:-python3}

# ── 0. Python version check ───────────────────────────────────────────────────
$PYTHON -c "import sys; sys.exit(0 if sys.version_info>=(3,11) else 1)" \
  || die "Python 3.11+ required  (found: $($PYTHON --version))"
ok "Python: $($PYTHON --version)"

# ── 1. Install / upgrade Python deps ─────────────────────────────────────────
log "Installing Python dependencies…"
$PYTHON -m pip install --quiet --upgrade \
  "pyinstaller>=6.0" \
  "PySide6>=6.7"     \
  "ableton-mcp"
ok "Python deps ready"

# ── 2. Use Local Remote Script (if present) ───────────────────────────────────
RS_DIR="resources/AbletonQ_Remote_Script"
if [ ! -d "$RS_DIR" ]; then
  die "Remote Script not found at $RS_DIR. Please place the AbletonQ_Remote_Script directory at:\n  $RS_DIR"
else
  ok "Remote Script found at $RS_DIR"
fi

# ── 3. Clean ──────────────────────────────────────────────────────────────────
log "Cleaning previous build artefacts…"
rm -rf build dist
ok "Clean"

# ── 4. PyInstaller ───────────────────────────────────────────────────────────
log "Running PyInstaller (this takes ~60–90 s)…"
$PYTHON -m PyInstaller AbletonQ.spec --noconfirm --clean
ok "PyInstaller done"

APP="dist/AbletonQ.app"
[ -d "$APP" ] || die "Expected $APP not produced"

# ── 5. Verify bundle ─────────────────────────────────────────────────────────
log "Verifying bundle…"
[ -f "$APP/Contents/MacOS/AbletonQ" ]        || die "Main binary missing"
[ -f "$APP/Contents/MacOS/abletonq-server" ] || die "Server binary missing"
[ -f "$APP/Contents/Info.plist" ]            || die "Info.plist missing"
ok "Bundle: $(du -sh "$APP" | cut -f1)"

# ── 6. Ad-hoc code sign (removes 'unidentified developer' prompt) ─────────────
if [[ " $* " == *" --sign "* || " $* " == *"--sign"* ]]; then
  log "Code signing (ad-hoc, no Apple Developer account needed)…"
  codesign --deep --force --sign - \
    "$APP/Contents/MacOS/abletonq-server" \
    "$APP/Contents/MacOS/AbletonQ"        \
    "$APP"
  ok "Signed (ad-hoc)"
fi

# ── 7. DMG ───────────────────────────────────────────────────────────────────
if [[ " $* " == *" --dmg "* || " $* " == *"--dmg"* ]]; then
  if command -v create-dmg &>/dev/null; then
    log "Creating DMG…"
    create-dmg \
      --volname  "AbletonQ"         \
      --window-size 540 360          \
      --icon-size 96                 \
      --icon     "AbletonQ.app" 160 180 \
      --app-drop-link 380 180        \
      "dist/AbletonQ.dmg"            \
      "$APP"
    ok "DMG: dist/AbletonQ.dmg  ($(du -sh dist/AbletonQ.dmg | cut -f1))"
  else
    warn "create-dmg not found — skipping DMG  (brew install create-dmg)"
  fi
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "${G}══════════════════════════════════════════${N}"
echo "${G}  AbletonQ v0.2.0 built successfully      ${N}"
echo "${G}  → dist/AbletonQ.app                     ${N}"
echo "${G}══════════════════════════════════════════${N}"
echo ""
echo "Install:  cp -r dist/AbletonQ.app /Applications/"
echo "Run:      open /Applications/AbletonQ.app"
