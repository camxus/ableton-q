# MODELS

## Core Concepts

### MCPRequest
JSON message sent from client to MCP server.

```ts
interface MCPRequest {
  id: string
  type: string
  params?: Record<string, unknown>
}
```

### MCPResponse
JSON response from MCP server.

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

### ChatMessage
Message in the chat UI.

```ts
interface ChatMessage {
  role: "user" | "assistant" | "system" | "event"
  text: string
  ts: number
}
```

### MsgRole
Enumeration of message roles.

```ts
enum MsgRole {
  USER = "user"
  ASSISTANT = "assistant"
  SYSTEM = "system"
  EVENT = "event"
  THINKING = "thinking"
  CHAIN_HDR = "chain_header"
}
```

### ChatMsg
Dataclass for chat messages (Python).

```python
@dataclass
class ChatMsg:
    role: MsgRole
    text: str
    ts: datetime = field(default_factory=datetime.now)
```

## TypeScript Models

### PanelEnvelope
Message passed between panel and extension.

```ts
interface PanelEnvelope {
  action: "send" | "connect" | "disconnect" | "noop"
  payload?: string
  chatVisible?: boolean
}
```

### ToastOnLoad
Toast notification configuration.

```ts
interface ToastOnLoad {
  text: string
  type: "success" | "error" | "info" | "warning"
}
```

### Command Definition
MCP command with metadata.

```ts
interface MCPCommand {
  type: string
  label: string
  params: Array<{
    name: string
    type: string
    ex: unknown
  }>
}

const MCP_COMMANDS: MCPCommand[] = [
  { type: "get_session_info", label: "Get Session Info", params: [] },
  { type: "get_tracks", label: "Get Tracks", params: [] },
  { type: "get_tempo", label: "Get Tempo", params: [] },
  { type: "set_tempo", label: "Set Tempo", params: [{ name: "tempo", type: "number", ex: 120 }] },
  { type: "start_playback", label: "Start Playback", params: [] },
  { type: "stop_playback", label: "Stop Playback", params: [] },
  { type: "undo", label: "Undo", params: [] },
  { type: "redo", label: "Redo", params: [] },
  { type: "create_midi_track", label: "Create MIDI Track", params: [{ name: "index", type: "number", ex: -1 }] },
  { type: "create_audio_track", label: "Create Audio Track", params: [{ name: "index", type: "number", ex: -1 }] },
  { type: "delete_track", label: "Delete Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "set_track_name", label: "Set Track Name", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "name", type: "string", ex: "Bass" }] },
  { type: "set_track_volume", label: "Set Track Volume", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "volume", type: "number", ex: 0.85 }] },
  { type: "set_track_pan", label: "Set Track Pan", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "pan", type: "number", ex: 0.0 }] },
  { type: "mute_track", label: "Mute Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "unmute_track", label: "Unmute Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "solo_track", label: "Solo Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "arm_track", label: "Arm Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "create_clip", label: "Create Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }, { name: "length", type: "number", ex: 4 }] },
  { type: "delete_clip", label: "Delete Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "fire_clip", label: "Fire Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "stop_clip", label: "Stop Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "get_clip_notes", label: "Get Clip Notes", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "add_notes_to_clip", label: "Add Notes to Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }, { name: "notes", type: "array", ex: [] }] },
  { type: "set_clip_name", label: "Set Clip Name", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }, { name: "name", type: "string", ex: "Intro" }] },
  { type: "load_instrument", label: "Load Instrument", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "uri", type: "string", ex: "" }] },
  { type: "get_device_params", label: "Get Device Params", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "device_index", type: "number", ex: 0 }] },
  { type: "set_device_param", label: "Set Device Param", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "device_index", type: "number", ex: 0 }, { name: "param_index", type: "number", ex: 0 }, { name: "value", type: "number", ex: 0.5 }] },
]
```

## Python Models

### QueueItem
Command queue entry for chain execution.

```python
@dataclass
class QueueItem:
    id: str
    text: str
    chain: list[str] = field(default_factory=list)  # all steps if chained
    step: int = 0                                 # current step index
```

### Config
Configuration options for the app.

```python
CONFIG_DEFAULTS: dict = {
    "host": "127.0.0.1",
    "port": 9877,
    "log_level": "INFO",
    "provider": "anthropic",
    "model": "claude-sonnet-4-5",
    "api_key": "",
    "base_url": "",
    "show_thinking": True,
    "launch_at_login": True,
    "auto_start_server": True,
    "show_on_launch": False,
}
```

## State Models

### Connection State
```ts
interface ConnectionState {
  connected: boolean
  connecting: boolean
  status: "Connected" | "Disconnected" | "Connecting…"
}
```

### Chat State
```ts
interface ChatState {
  messages: ChatMessage[]
  chatVisible: boolean
  inputDisabled: boolean
}
```

### Palette State
```ts
interface PaletteState {
  open: boolean
  results: MCPCommand[]
  activeIndex: number
  searchQuery: string
}
```

### Queue State
```ts
interface QueueState {
  items: QueueItem[]
  activeId: string | null
}
```