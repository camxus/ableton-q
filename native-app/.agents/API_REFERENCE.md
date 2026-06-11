# API_REFERENCE

## MCP Commands

All commands are sent as JSON over TCP to port 9877.

### Session Commands

#### get_session_info
Get current Live session information.

```json
{ "type": "get_session_info" }
```

**Response:**
```json
{
  "status": "ok",
  "result": {
    "tempo": 120.0,
    "signature": [4, 4],
    "loop": false,
    "metronome": true,
    "overdub": false,
    "count_in": 0
  }
}
```

#### get_tempo
Get current tempo.

```json
{ "type": "get_tempo" }
```

**Response:**
```json
{ "status": "ok", "result": 120.0 }
```

#### set_tempo
Set tempo to specific value.

```json
{ "type": "set_tempo", "params": { "tempo": 140 } }
```

#### start_playback
Start Live playback.

```json
{ "type": "start_playback" }
```

#### stop_playback
Stop Live playback.

```json
{ "type": "stop_playback" }
```

#### undo / redo
Undo or redo last action.

```json
{ "type": "undo" }
{ "type": "redo" }
```

### Track Commands

#### get_tracks
List all tracks.

```json
{ "type": "get_tracks" }
```

**Response:**
```json
{
  "status": "ok",
  "result": [
    { "name": "Audio 1", "type": "audio", "mute": false, "solo": false, "volume": 0.8 },
    { "name": "MIDI 1", "type": "midi", "mute": false, "solo": false, "volume": 0.7 }
  ]
}
```

#### create_midi_track / create_audio_track
Create track at position.

```json
{ "type": "create_midi_track", "params": { "index": -1 } }  // -1 = last
{ "type": "create_audio_track", "params": { "index": -1 } }
```

#### delete_track
Delete track by index.

```json
{ "type": "delete_track", "params": { "track_index": 0 } }
```

#### set_track_name
Rename track.

```json
{ "type": "set_track_name", "params": { "track_index": 0, "name": "Bass" } }
```

#### set_track_volume / set_track_pan
Set track volume or pan.

```json
{ "type": "set_track_volume", "params": { "track_index": 0, "volume": 0.85 } }
{ "type": "set_track_pan", "params": { "track_index": 0, "pan": 0.0 } }
```

#### mute_track / unmute_track / solo_track / arm_track
Track state controls.

```json
{ "type": "mute_track", "params": { "track_index": 0 } }
{ "type": "unmute_track", "params": { "track_index": 0 } }
{ "type": "solo_track", "params": { "track_index": 0 } }
{ "type": "arm_track", "params": { "track_index": 0 } }
```

### Clip Commands

#### create_clip
Create clip at position.

```json
{ "type": "create_clip", "params": { "track_index": 0, "clip_index": 0, "length": 4 } }
```

#### delete_clip
Delete clip.

```json
{ "type": "delete_clip", "params": { "track_index": 0, "clip_index": 0 } }
```

#### fire_clip / stop_clip
Trigger clip playback.

```json
{ "type": "fire_clip", "params": { "track_index": 0, "clip_index": 0 } }
{ "type": "stop_clip", "params": { "track_index": 0, "clip_index": 0 } }
```

#### get_clip_notes
Get notes in clip.

```json
{ "type": "get_clip_notes", "params": { "track_index": 0, "clip_index": 0 } }
```

#### add_notes_to_clip
Add notes to clip.

```json
{ "type": "add_notes_to_clip", "params": { "track_index": 0, "clip_index": 0, "notes": [...] } }
```

#### set_clip_name
Rename clip.

```json
{ "type": "set_clip_name", "params": { "track_index": 0, "clip_index": 0, "name": "Intro" } }
```

### Device Commands

#### load_instrument
Load instrument by URI.

```json
{ "type": "load_instrument", "params": { "track_index": 0, "uri": "path/to/instrument" } }
```

#### get_device_params
Get device parameters.

```json
{ "type": "get_device_params", "params": { "track_index": 0, "device_index": 0 } }
```

#### set_device_param
Set device parameter.

```json
{ "type": "set_device_param", "params": { "track_index": 0, "device_index": 0, "param_index": 0, "value": 0.5 } }
```

## Extension API

### showModalDialog
Shows the panel UI.

```ts
const raw: string = await ctx.ui.showModalDialog(
  `data:text/html,${encodeURIComponent(html)}`,
  width: 420,
  height: chatVisible ? 378 : 96  // WIN_H_EXPANDED : WIN_H_COLLAPSED
)
```

### registerCommand
Registers the panel command in Live.

```ts
ctx.commands.registerCommand("abletonQ.openPanel", () => openPanel())
```

### registerContextMenuAction
Adds context menu entry.

```ts
ctx.ui.registerContextMenuAction("ClipSlot", "Open AbletonQ", "abletonQ.openPanel")
```

## Panel Bridge API

### closeAndSend
Sends payload back to extension.

```js
function closeAndSend(payload) {
  postToHost({ method: 'close_and_send', params: [JSON.stringify(payload)] })
}
```

### Message Handler
```js
function postToHost(msg) {
  if (window.webkit?.messageHandlers?.live)
    window.webkit.messageHandlers.live.postMessage(msg)
  else if (window.chrome?.webview)
    window.chrome.webview.postMessage(msg)
}
```

## Socket Protocol

### AbletonSocket Class

#### connect()
Initiates TCP connection to MCP server.

```ts
sock.connect()  // Connect to 127.0.0.1:9877
```

#### send(req: MCPRequest)
Sends request and returns Promise<MCPResponse>.

```ts
const req = { id: "req-1", type: "get_tracks" }
const response = await sock.send(req)
```

#### Callbacks
```ts
sock.onStatusChange = (connected: boolean) => void
sock.onError = (msg: string) => void
sock.onEvent = (event: string, data: unknown) => void
```

### Connection States
- **Disconnected**: Red status indicator
- **Connecting**: Amber indicator, button disabled
- **Connected**: Green indicator, input enabled

### Auto-Reconnect
Exponential backoff: 1s → 2s → 4s → ... → 30s max retry delay

## MCP_COMMANDS Array
Reference of all available commands with metadata.

| Type | Label | Params |
|------|-------|--------|
| get_session_info | Get Session Info | - |
| get_tracks | Get Tracks | - |
| get_tempo | Get Tempo | - |
| set_tempo | Set Tempo | tempo (number) |
| start_playback | Start Playback | - |
| stop_playback | Stop Playback | - |
| undo | Undo | - |
| redo | Redo | - |
| create_midi_track | Create MIDI Track | index (number) |
| create_audio_track | Create Audio Track | index (number) |
| create_return_track | Create Return Track | - |
| delete_track | Delete Track | track_index (number) |
| set_track_name | Set Track Name | track_index, name |
| set_track_volume | Set Track Volume | track_index, volume |
| set_track_pan | Set Track Pan | track_index, pan |
| mute_track | Mute Track | track_index |
| unmute_track | Unmute Track | track_index |
| solo_track | Solo Track | track_index |
| arm_track | Arm Track | track_index |
| create_clip | Create Clip | track_index, clip_index, length |
| delete_clip | Delete Clip | track_index, clip_index |
| fire_clip | Fire Clip | track_index, clip_index |
| stop_clip | Stop Clip | track_index, clip_index |
| get_clip_notes | Get Clip Notes | track_index, clip_index |
| add_notes_to_clip | Add Notes to Clip | track_index, clip_index, notes[] |
| set_clip_name | Set Clip Name | track_index, clip_index, name |
| load_instrument | Load Instrument | track_index, uri |
| get_device_params | Get Device Params | track_index, device_index |
| set_device_param | Set Device Param | track_index, device_index, param_index, value |