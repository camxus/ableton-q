# ableton-mcp-controller

A two-part project that wraps [ahujasid/ableton-mcp](https://github.com/ahujasid/ableton-mcp) into a native macOS app **and** an Ableton Live Extension that lets you send MCP commands directly from inside Live.

```
┌─────────────────────────────────────────────────────────────────┐
│  macOS                                                          │
│                                                                 │
│  AbletonMCP.app  ──────────────────────────────────────────►   │
│  (menu-bar app)       installs Remote Script                    │
│       │               starts MCP server on :9877                │
│       ▼                                                         │
│  Python MCP Server (ableton-mcp)    TCP :9877                   │
│       │                                 ▲                       │
│       │    JSON-over-TCP               │                        │
│       ▼                                 │                        │
│  Ableton Live                           │                        │
│    └─ AbletonMCP_Remote_Script ─────────┘                       │
│    └─ Ableton Extension (this SDK ext)                          │
│         └─ Modal dialog with input + chat                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project structure

```
ableton-mcp-controller/
│
├── ableton-extension/          # Ableton Live Extension (SDK)
│   ├── src/
│   │   ├── extension.ts        # Entry point – registers command + socket relay
│   │   └── panel.html          # In-Live modal UI (input field + chat log)
│   ├── manifest.json
│   ├── package.json
│   ├── build.ts                # esbuild script
│   └── tsconfig.json
│
├── macos-app/
│   └── AbletonMCPApp.app/
│       └── Contents/
│           ├── Info.plist
│           ├── MacOS/
│           │   └── AbletonMCP          # Shell launcher (executable)
│           └── Resources/
│               └── AbletonMCP_Remote_Script/   # fetched by scripts/fetch-remote-script.sh
│                   └── __init__.py
│
├── scripts/
│   ├── fetch-remote-script.sh  # Pull Remote Script from GitHub into Resources
│   └── package-app.sh          # Zip (+ optional DMG) the .app for distribution
│
└── README.md
```

---

## Architecture

### `macos-app/` – The `.app` bundle

A **menu-bar (LSUIElement) shell-script app**. When double-clicked it:

1. Installs / updates the `AbletonMCP_Remote_Script` into  
   `~/Music/Ableton/User Library/Remote Scripts/`
2. Starts the Python MCP server (`uvx ableton-mcp` or `python3 -m MCP_Server.server`)  
   on **TCP port 9877**
3. Shows a macOS notification with the PID and log path

The `.app` stays running in the background so the server process remains alive.  
Quit it to stop the server.

### `ableton-extension/` – The Live Extension

Built with the **Ableton Extensions SDK (1.0.0-beta.0)**.

| File | Role |
|---|---|
| `src/extension.ts` | Activates the extension, registers the `abletonMcp.openPanel` command, manages the TCP socket connection to port 9877, maintains message history |
| `src/panel.html` | Full Ableton dark-theme modal UI: connection toggle, quick-command strip (Session Info, Tracks, Tempo, Play, Stop, Undo), free-form JSON input, scrollable chat log |

**Message flow:**

```
User types command in panel
  → panel calls closeAndSend({ action:"send", payload:"..." })
  → extension.ts receives result, opens socket, sends JSON to :9877
  → Remote Script responds
  → extension.ts stores reply in messages[]
  → Next openPanel() call re-hydrates the chat log from messages[]
```

> The SDK's modal dialog lifecycle means each panel open/close is a round-trip.  
> The extension serialises full message history into the HTML's `data-initial-state`  
> attribute on every open, so the chat always shows the complete session history.

---

## Setup

### Prerequisites

| Tool | Install |
|---|---|
| Node.js ≥ 18 | https://nodejs.org |
| uv (recommended) | `brew install uv` |
| Ableton Live 11+ | — |
| Extensions SDK tgz | from the zip you already have |

### 1 — Build the extension

```bash
cd ableton-extension
npm install
npm run build          # dev (with source maps)
npm run build:prod     # production (minified)
```

The output is `dist/extension.js`. Load it in Live via  
**Preferences → Extensions → Load Extension** and point to the `ableton-extension/` folder.

### 2 — Build the macOS app

```bash
# (from repo root)
bash scripts/fetch-remote-script.sh   # download Remote Script into .app/Resources
bash scripts/package-app.sh           # produces dist/AbletonMCP.app.zip
```

Unzip and move `AbletonMCPApp.app` to `/Applications`.

### 3 — First run

1. Double-click **AbletonMCP.app** — it installs the Remote Script and starts the server.
2. Open Ableton Live.
3. Go to **Preferences → MIDI** and set a Control Surface to **AbletonMCP**.
4. Right-click any Clip Slot → **Open MCP Controller**.
5. Click **Connect** in the panel → start sending commands.

---

## Quick-command reference

The panel's quick-strip sends these JSON payloads:

| Button | Payload |
|---|---|
| Session Info | `{"type":"get_session_info"}` |
| Tracks | `{"type":"get_tracks"}` |
| Tempo | `{"type":"get_tempo"}` |
| ▶ Play | `{"type":"start_playback"}` |
| ■ Stop | `{"type":"stop_playback"}` |
| Undo | `{"type":"undo"}` |

You can also type any raw JSON in the input field, e.g.:

```json
{"type":"set_tempo","params":{"tempo":128}}
{"type":"create_midi_track","params":{"index":-1}}
{"type":"create_clip","params":{"track_index":0,"clip_index":0,"length":4}}
```

---

## Logs

| Path | Contents |
|---|---|
| `~/Library/Application Support/AbletonMCP/server.log` | MCP Python server stdout/stderr |
| Live's log file | Extension console output (`console.log`) |

---

## License

MIT — built on top of [ahujasid/ableton-mcp](https://github.com/ahujasid/ableton-mcp) (MIT).
