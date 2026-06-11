# AbletonQ.spec  —  v0.2.0
# Run with:  pyinstaller AbletonQ.spec
#
# Produces dist/AbletonQ.app — fully self-contained, zero user dependencies.
#
# Bundle layout:
#   AbletonQ.app/Contents/
#     MacOS/
#       AbletonQ            ← PySide6 GUI  (frozen CPython)
#       abletonq-server     ← ableton-mcp server (frozen CPython, separate binary)
#     Resources/
#       AbletonQ_Remote_Script/   ← auto-installed into Ableton on first launch
#     Info.plist            ← LSUIElement=true, no Dock icon

import subprocess, sys
from pathlib import Path

# ── locate ableton-mcp server entry point ────────────────────────────────────
def _find_server() -> str:
    try:
        pkg_dir = subprocess.check_output(
            [sys.executable, "-c",
             "import MCP_Server, os; print(os.path.dirname(MCP_Server.__file__))"],
            text=True,
        ).strip()
        for name in ("__main__.py", "server.py"):
            p = Path(pkg_dir) / name
            if p.exists():
                return str(p)
    except Exception:
        pass
    raise FileNotFoundError("ableton-mcp not installed — run: pip install ableton-mcp")

SERVER_SCRIPT     = _find_server()
REMOTE_SCRIPT_DIR = Path("resources") / "AbletonQ_Remote_Script"

# ── server binary ─────────────────────────────────────────────────────────────
server_a = Analysis(
    [SERVER_SCRIPT],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=["MCP_Server"],
    hookspath=[],
    excludes=["tkinter","matplotlib","numpy","scipy","PySide6","PyQt6","wx"],
    noarchive=False,
)
server_pyz = PYZ(server_a.pure, server_a.zipped_data)
server_exe = EXE(
    server_pyz,
    server_a.scripts,
    server_a.binaries,
    server_a.zipfiles,
    server_a.datas,
    name="abletonq-server",
    debug=False,
    strip=False,
    upx=False,       # UPX trips Gatekeeper
    console=True,    # server writes to stdout/log
    onefile=True,
)

# ── main GUI binary ───────────────────────────────────────────────────────────
main_a = Analysis(
    ["src/main.py"],
    pathex=[],
    binaries=[],
    datas=(
        [(str(REMOTE_SCRIPT_DIR), "AbletonQ_Remote_Script")]
        if REMOTE_SCRIPT_DIR.exists() else []
    ),
    hiddenimports=[
        "PySide6.QtCore",
        "PySide6.QtGui",
        "PySide6.QtWidgets",
        "PySide6.QtNetwork",
    ],
    hookspath=[],
    excludes=["tkinter","matplotlib","numpy","scipy"],
    noarchive=False,
)
main_pyz = PYZ(main_a.pure, main_a.zipped_data)
main_exe = EXE(
    main_pyz,
    main_a.scripts,
    [],
    exclude_binaries=True,
    name="AbletonQ",
    debug=False,
    strip=False,
    upx=False,
    console=False,   # GUI — no terminal window on launch
)

# ── collect everything ────────────────────────────────────────────────────────
coll = COLLECT(
    main_exe,
    main_a.binaries,
    main_a.zipfiles,
    main_a.datas,
    [server_exe],    # server binary ends up in MacOS/ alongside AbletonQ
    strip=False,
    upx=False,
    name="AbletonQ",
)

# ── .app bundle ───────────────────────────────────────────────────────────────
app = BUNDLE(
    coll,
    name="AbletonQ.app",
    # Uncomment once you have an icns file:
    # icon="resources/AppIcon.icns",
    bundle_identifier="com.abletonq.app",
    info_plist={
        "CFBundleName":              "AbletonQ",
        "CFBundleDisplayName":       "AbletonQ",
        "CFBundleShortVersionString": "0.2.0",
        "CFBundleVersion":           "2",
        "CFBundleExecutable":        "AbletonQ",
        "LSUIElement":               True,   # menu-bar only — no Dock icon
        "NSHighResolutionCapable":   True,
        "NSHumanReadableCopyright":  "MIT — ahujasid/ableton-mcp",
        "NSAppTransportSecurity": {
            "NSAllowsLocalNetworking": True,
        },
    },
)
