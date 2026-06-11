# ARCHITECTURE

## System Overview

### Ableton MCP Controller
A two-part system that wraps `ahujasid/ableton-mcp` into a native macOS app **and** an Ableton Live Extension for sending MCP commands directly from inside Live.

### Core Components
```
┌─────────────────────────────────────────────────────────────────┐
│  macOS                                                            │
│                                                                 │
│  AbletonQ.app  ──────────────────────────────────────────►   │
│  (menu-bar app)       installs Remote Script                    │
│       │               starts MCP server on :9877                │
│       ▼                                                         │
│  Python MCP Server (ableton-mcp)    TCP :9877                   │
│       │                                 ▲                       │
│       │    JSON-over-TCP               │                        │
│       ▼                                 │                        │
│  Ableton Live                           │                        │
│    └─ AbletonQ_Remote_Script ───────────┘                       │
│    └─ Ableton Extension (this SDK ext)                        │
│         └─ Modal dialog with input + chat                     │
└─────────────────────────────────────────────────────────────────┘
```

## High-Level Architecture

### macOS App Layer
```
AbletonQ.app
  ↓
Menu bar (LSUIElement)
  ↓
Installs Remote Script → ~/Music/Ableton/User Library/Remote Scripts/
  ↓
Starts MCP server (ableton-mcp) on TCP :9877
  ↓
Shows macOS notifications (PID, connection status)
```

### Extension Layer
```
Ableton Extension
  ↓
panel.html (modal UI)
  ↓
extension.ts (socket relay)
  ↓
TCP Socket :9877
  ↓
Remote Script
  ↓
Ableton Live
```

### Remote Script Layer
```
AbletonQ_Remote_Script/
  ↓
Live API connection (Python)
  ↓
JSON-over-TCP server
```

## Message Flow

### User Input Flow
```
User types command in panel
  ↓
panel.html calls closeAndSend({ action:"send", payload:"..." })
  ↓
extension.ts receives result, opens socket, sends JSON to :9877
  ↓
Remote Script responds
  ↓
extension.ts stores reply in messages[]
  ↓
Next openPanel() call re-hydrates chat log from messages[]
```

### Native App Flow
```
MainWindow → ChatScreen → CommandQueue (worker thread)
  ↓
TCP Socket → Remote Script → Ableton Live
  ↓
Response → result_ready signal → BubbleWidget
```

## Native App Architecture

### Component Hierarchy
```
AbletonQApp (QApplication)
  ├─ QSystemTrayIcon
  ├─ MainWindow (QMainWindow)
  │  ├─ ChatScreen
  │  │  ├─ BubbleWidgets (message display)
  │  │  ├─ QueueBar (pending commands)
  │  │  ├─ CommandPalette
  │  │  └─ Input bar
  │  └─ SettingsScreen
  │     ├─ Model tab
  │     ├─ Server tab
  │     └─ App tab
  ├─ CommandQueue (threaded FIFO)
  │  ├─ item_queued → QueueBar
  │  ├─ item_started → spinner
  │  ├─ item_finished → remove chip
  │  └─ result_ready → BubbleWidget
  └─ ServerManager
     └─ MCP server subprocess
```

### Threading Model
- **Main thread**: UI updates via Qt signals/slots
- **Worker thread**: CommandQueue processes commands serially
- **Poller timer**: StatusPoller checks server reachability every 2s

### Chain Execution Flow
```
Input: "get_tracks >> set_tempo 140 >> start_playback"
  ↓
Split by >> into array of steps
  ↓
Execute step 1 → get result
  ↓
Inject result as _chain_context into step 2 params
  ↓
Execute step 2 → get result
  ↓
Inject result into step 3
  ↓
Execute step 3
```

## Extension Architecture

### UI Components
```
header
  ├─ Title (AbletonQ)
  ├─ Status pill (connected/disconnected)
  └─ Connect button

#chatWrap
  └─ #chat (scrollable message bubbles)

#inputZone
  ├─ #palette (command search, opens on /)
  ├─ #cmdInput (text input)
  ├─ #sendBtn
  └─ #toggleBtn (show/hide chat)
```

### Connection States
- **Disconnected**: Red dot, "Disconnected" label
- **Connecting**: Amber dot, "Connecting…" label
- **Connected**: Green dot, "Connected" label

### Message Types
- `user` - User input
- `assistant` - MCP response
- `system` - Status messages
- `event` - Push events from Remote Script

## MCP Protocol

### Request Format
```ts
interface MCPRequest {
  id: string
  type: string
  params?: Record<string, unknown>
}
```

### Response Format
```ts
interface MCPResponse {
  id?: string
  status: "ok" | "error"
  result?: unknown
  message?: string
  event?: string
  data?: unknown
}
```

### Event Types
- `track_change` - Track selection changed
- `clip_change` - Clip content updated
- `playback` - Transport state changed

## Configuration

### Config File
`~/Library/Application Support/AbletonQ/config.json`

```json
{
  "host": "127.0.0.1",
  "port": 9877,
  "log_level": "INFO",
  "provider": "anthropic",
  "model": "claude-sonnet-4-5",
  "api_key": "",
  "base_url": "",
  "show_thinking": true,
  "launch_at_login": true,
  "auto_start_server": true,
  "show_on_launch": false
}
```

### Providers
- `anthropic` - Claude models (claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5)
- `gemini` - Gemini models (gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash)
- `openai` - GPT models (gpt-4o, gpt-4o-mini, gpt-4-turbo)
- `ollama` - Local models (llama3.1, mistral, codellama, phi3)
- `custom` - Custom endpoint

## Infrastructure

### File Paths
```
Remote Script: ~/Music/Ableton/User Library/Remote Scripts/AbletonQ_Remote_Script/
Logs: ~/Library/Application Support/AbletonQ/server.log
Config: ~/Library/Application Support/AbletonQ/config.json
LaunchAgent: ~/Library/LaunchAgents/com.abletonq.server.plist
```

### Environment Variables (for server)
```env
ABLETONQ_HOST=127.0.0.1
ABLETONQ_PORT=9877
ABLETONQ_LOG_LEVEL=INFO
```

### Dependencies
- Node.js ≥ 18 (for extension build)
- uv (recommended for MCP server)
- Ableton Live 11+
- Extensions SDK tgz