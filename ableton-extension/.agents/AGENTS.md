# AGENTS

## Command Processing Flow

```txt
User Command
 ↓
Command Parsing
 ↓
Validation & Preparation
 ↓
TCP Transmission
 ↓
MCP Server Processing
 ↓
Response Reception
 ↓
Result Handling
 ↓
UI Update
 ↓
History Storage
```

### Command Parsing
- Split chained commands by `>>`
- Trim whitespace from each step
- Convert single commands to single-step chains

### Validation & Preparation
- Validate command exists in MCP_COMMANDS
- Prepare JSON-RPC request with unique ID
- Inject chain context from previous step (if applicable)
- Add raw_input for non-JSON commands

### TCP Transmission
- Send JSON request over socket to :9877
- Wait for response with timeout (10s)
- Handle connection errors and retries

### MCP Server Processing
- Remote Script receives JSON request
- Routes to appropriate Live API handler
- Executes command in Ableton Live
- Returns JSON response

### Response Reception
- Parse JSON response from socket
- Distinguish between success/error status
- Extract result data or error message
- Handle push events (unsolicited notifications)

### Result Handling
- Format result for display (JSON.stringify with indentation)
- Create appropriate ChatMsg (assistant/user/system)
- Emit result_ready signal to UI

### UI Update
- Add message bubble to chat display
- Auto-scroll to bottom
- Update input field state
- Show toast notifications for errors/success

### History Storage
- Append user command to history list
- Maintain history cap (200 entries)
- Preserve draft text for navigation

## Agent Responsibilities (Command Agents)

Each MCP command acts as an "agent" responsible for:

### Interpretation
- Understand user intent from command type
- Map UI actions to MCP protocol
- Handle parameter validation and conversion

### Execution
- Execute via Live API through Remote Script
- Manage state changes in Live session
- Produce observable results or state changes

### Result Reporting
- Return structured data or confirmation
- Provide meaningful error messages
- Emit push events for state changes (when applicable)

### Observability
- Generate appropriate log entries
- Update connection status when relevant
- Contribute to user understanding of Live state

## Specialized Command Agents

### Session Agent
Handles session-level commands:
- `get_session_info`, `get_tempo`, `set_tempo`
- `start_playback`, `stop_playback`
- `undo`, `redo`

**Responsibilities:**
- Transport and tempo control
- Session state queries
- Global session modifications

### Track Agent
Handles track management:
- `get_tracks`, `create_midi_track`, `create_audio_track`
- `delete_track`, `set_track_name`, `set_track_volume`
- `mute_track`, `unmute_track`, `solo_track`, `arm_track`

**Responsibilities:**
- Track creation and deletion
- Track property modification
- Track state control (mute/solo/arm)

### Clip Agent
Handles clip operations:
- `create_clip`, `delete_clip`, `fire_clip`, `stop_clip`
- `get_clip_notes`, `add_notes_to_clip`, `set_clip_name`

**Responsibilities:**
- Clip lifecycle management
- MIDI note editing
- Clip naming and triggering

### Device Agent
Handles device/parameter operations:
- `load_instrument`, `get_device_params`, `set_device_param`

**Responsibilities:**
- Instrument loading
- Device parameter access and modification
- Instrument chain management

### System Agent
Handles system-level operations:
- Connection management
- Configuration updates
- Remote script installation (local resources only)
- Server process control

**Responsibilities:**
- System health and connectivity
- User persistence
- Environment setup and maintenance

## Command Lifecycle Awareness

### Context Awareness
Commands in a chain must understand:
- Previous command's result (as `_chain_context`)
- Current Live state (via implicit queries)
- User intent from full command string

### State Awareness
Each command agent understands:
- Current Live session state
- Selected tracks/clips (when relevant)
- Transport state (playing/stopped/recording)
- Mixer state (volumes, pans, etc.)

### Error Awareness
Commands must handle:
- Connection failures (retry logic)
- Invalid parameters (validation before sending)
- Live API errors (propagate as error responses)
- Timeout scenarios (user feedback)

## Chain Awareness

### Step Execution
In a chain like `get_tracks >> set_tempo 140 >> start_playback`:
1. `get_tracks` executes → returns track list
2. `set_tempo` executes with `_chain_context` = track list
3. `start_playback` executes with `_chain_context` = set_tempo result

### Context Injection
Previous results are injected as:
```json
{
  "type": "set_tempo",
  "params": {
    "tempo": 140,
    "_chain_context": "[previous result JSON]"
  }
}
```

### Failure Handling
- If any step fails, chain stops
- Failed step ID reported to user
- Subsequent steps not executed
- User can retry from failed step

## Event-Driven Behavior

Every significant state change should emit observable events:

### Push Events (from Remote Script)
```json
{
  "event": "track_change",
  "data": { "track_index": 2 }
}
```

### UI Events (from Extension/Native App)
- Connection status changes
- Command start/completion
- Error occurrences
- Toast notifications

### Internal Signals (Native App Qt)
- `item_queued`, `item_started`, `item_finished`
- `result_ready`, `settings_changed`
- `server_reachable`, `abelton_running`

## Response Patterns

### Success Response
```ts
{
  "status": "ok",
  "result": { /* command-specific data */ }
}
```

### Error Response
```ts
{
  "status": "error",
  "message": "Human-readable error description"
}
```

### Event Response (unsolicited)
```ts
{
  "event": "event_name",
  "data": { /* event-specific data */ }
}
```

## Examples

### Simple Command Flow
```
User: "get_tempo"
  ↓
Parse: ["get_tempo"]
  ↓
Validate: Found in MCP_COMMANDS
  ↓
Prepare: { id: "req-1", type: "get_tempo" }
  ↓
Transmit: Send TCP request
  ↓
Process: Remote Script → Live API
  ↓
Respond: { status: "ok", result: 120.0 }
  ↓
Handle: Format as "120.0", create assistant message
  ↓
Update: Add bubble to chat, store in history
```

### Chain Command Flow
```
User: "get_tracks >> set_tempo 140"
  ↓
Parse: ["get_tracks", "set_tempo 140"]
  ↓
Validate: Both commands found
  ↓
Prepare Step 1: { id: "req-1", type: "get_tracks" }
  ↓
Transmit/Process/Respond: Returns track list
  ↓
Prepare Step 2: { 
    id: "req-2", 
    type: "set_tempo", 
    params: { tempo: 140, _chain_context: "[track list]" } 
  }
  ↓
Transmit/Process/Respond: Sets tempo to 140
  ↓
Handle: Format results, create messages for both steps
  ↓
Update: Add both bubbles, store user command in history
```

### Error Flow
```
User: "invalid_command"
  ↓
Parse: ["invalid_command"]
  ↓
Validate: Not found in MCP_COMMANDS
  ↓
Handle: Treat as raw input → { type: "get_session_info" }
  ↓
... continue normal flow ...
```

Or:
```
User: "set_tempo abc"
  ↓
Parse: ["set_tempo abc"]
  ↓
Prepare: { id: "req-1", type: "set_tempo", params: { tempo: "abc" } }
  ↓
Transmit: Send request
  ↓
Process: Remote Script validation fails
  ↓
Respond: { status: "error", message: "Invalid parameter: tempo must be number" }
  ↓
Handle: Show error message in assistant bubble
  ↓
Update: Add error bubble, store in history
```