# AbletonQ — Native App

A self-contained macOS menu-bar app built with **PySide6** and packaged with
**PyInstaller**. The resulting `AbletonQ.app` has zero runtime dependencies —
no Python, no uv, nothing to install.

## What's inside the bundle

```
AbletonQ.app/
└── Contents/
    ├── Info.plist                  macOS metadata, LSUIElement=true (no Dock icon)
    ├── MacOS/
    │   ├── AbletonQ                PySide6 tray app (frozen Python)
    │   └── abletonq-server         ableton-mcp server (frozen Python, separate binary)
    └── Resources/
        └── AbletonQ_Remote_Script/ installed into Ableton on first launch
            └── __init__.py
```

Both binaries are standalone frozen executables — they carry their own CPython
interpreter. The user needs nothing installed.

## Build

```bash
cd native-app

# one command — installs deps, fetches Remote Script, runs PyInstaller
bash scripts/build.sh

# with ad-hoc code signing (removes Gatekeeper "unidentified developer" prompt)
bash scripts/build.sh --sign

# with DMG (requires: brew install create-dmg)
bash scripts/build.sh --sign --dmg
```

Output: `dist/AbletonQ.app`

Install: `cp -r dist/AbletonQ.app /Applications/`

## Features

| Feature | Detail |
|---|---|
| **Zero dependencies** | Entire CPython + PySide6 + ableton-mcp frozen inside |
| **Menu-bar only** | `LSUIElement=true` — no Dock icon |
| **Server control** | Start / Stop / Restart from menu |
| **Live status** | TCP probe every 2 s — dot turns green when server is reachable |
| **Ableton detection** | `pgrep Live` every 2 s — dot turns amber if server up but Live not running |
| **Remote Script** | Auto-installed to `~/Music/Ableton/User Library/Remote Scripts/` on launch |
| **Config editor** | Host, port, log level — Settings… in menu |
| **Auto-launch** | Settings checkbox writes/removes a LaunchAgent plist |
| **Log viewer** | Shows live server stdout in a dark-themed window |
| **Headless mode** | `AbletonQ --headless` for LaunchAgent (server only, no UI) |

## Icon states

| Dot colour | Meaning |
|---|---|
| 🟢 Green | Server reachable **and** Ableton Live is running |
| 🟡 Amber | Server reachable, Ableton not detected |
| 🔴 Red | Server not reachable |

## Development (without building)

```bash
pip install PySide6 ableton-mcp
python src/main.py
```

## Distributing to non-technical users

1. `bash scripts/build.sh --sign --dmg`
2. Send `dist/AbletonQ.dmg`
3. User double-clicks DMG, drags to Applications, done

No Python, no Terminal, no package managers.
