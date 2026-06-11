# TESTING

## Testing Philosophy

### Extension (TypeScript)
- Unit tests for pure functions and parsing logic
- Integration tests for socket communication (mocked)
- UI behavior tests via DOM simulation

### Native App (Python)
- Unit tests for data models and parsing functions
- Thread-safety tests for CommandQueue
- Mock socket tests for MCP communication

---

## Test Commands

### Extension Tests
```bash
cd ableton-extension
npm run typecheck    # TypeScript strict mode
npm run build       # Verify build succeeds
```

### Native App Tests
```bash
cd native-app
python -m py_compile src/main.py     # Syntax check
pytest tests/ -v                     # Run unit tests
python -c "import src.main"          # Import check
```

---

## Test Structure

```
ableton-extension/
├── src/
│   ├── extension.ts
│   └── panel.html
├── tests/
│   └── unit/
│       ├── chain-parser.test.ts
│       └── socket-protocol.test.ts
└── package.json

native-app/
├── src/
│   └── main.py
├── tests/
│   ├── unit/
│   │   ├── test_models.py
│   │   ├── test_queue.py
│   │   └── test_chain.py
│   └── integration/
│       └── test_mcp_socket.py
└── requirements.txt
```

---

## Critical Test Areas

### 1. Chain Parsing (Both Projects)
- Single command: `get_tempo`
- Chain with spaces: `get_tracks >> set_tempo 140 >> start_playback`
- Empty steps are skipped
- Whitespace trimming

### 2. CommandQueue Thread Safety (Native App)
- Concurrent submit() calls
- Cancel while executing
- History capping (200 items max)
- Bubble count capping (500 max)

### 3. Socket Protocol (Both Projects)
- Request format: `{id, type, params}`
- Response format: `{status, result?, message?}`
- Event format: `{event, data?}` (no id)
- Timeout handling (10s default)
- Exponential backoff reconnect (1s → 2s → 4s → ... → 30s)

### 4. Context Injection (Chain Steps)
- `_chain_context` injection into params
- Non-JSON commands → wrapped as `{"type": "get_session_info", "raw_input": text}`

---

## Mock MCP Server

For tests, use a simple TCP server that echoes expected responses:

```python
# native-app/tests/mock_mcp_server.py
import json
import socket

MOCK_RESPONSES = {
    "get_tempo": {"status": "ok", "result": 120.0},
    "get_session_info": {"status": "ok", "result": {"tempo": 120.0, "signature": [4, 4]}},
    "get_tracks": {"status": "ok", "result": [{"name": "Audio 1", "type": "audio"}]},
}
```

---

## Test Checklist

- [ ] Chain parser: `get_tracks >> set_tempo 140` splits correctly
- [ ] Chain parser: empty steps skipped
- [ ] Chain parser: whitespace trimmed from each step
- [ ] CommandQueue: submit() returns unique ID
- [ ] CommandQueue: cancel() removes queued items
- [ ] CommandQueue: cancel() during execution shows cancellation message
- [ ] CommandQueue: bubble limit (500) enforced
- [ ] CommandQueue: history limit (200) enforced
- [ ] Socket: request timeout after 10s
- [ ] Socket: auto-reconnect on connection loss
- [ ] Socket: push events handled without id
- [ ] Socket: multiple JSON responses on single socket read
- [ ] UI: command palette opens on `/`
- [ ] UI: command palette keyboard nav (↑/↓/Enter/Escape)
- [ ] UI: chat history navigation (↑/↓)
- [ ] UI: toast notifications auto-dismiss after 3.2s
- [ ] UI: connection state reflected in dot color
- [ ] Config: defaults applied when config file missing
- [ ] Config: settings saved/loaded correctly
- [ ] Config: provider change persisted immediately (native app)

---

## Known Issues to Test

### Extension
1. **History persistence**: Extension keeps messages in memory but doesn't persist to disk
2. **Chain validation**: No validation of JSON syntax before sending

### Native App
1. **Lambda capture in loops**: Signals use `lambda i=item` pattern correctly (lines 253, 256, 279, 335)
2. **Socket read loop**: May not handle multiple responses correctly (line 311-326)
3. **Error for empty response**: Returns "No valid response received" error correctly

---

## Running Tests

```bash
# Install test deps
pip install pytest pytest-qt

# Run all tests
pytest native-app/tests/ -v --tb=short

# Run specific test
pytest native-app/tests/unit/test_queue.py -v
```

---

## Test Frameworks

| Language | Framework | Purpose |
|----------|-----------|---------|
| TypeScript | Node built-in | Type checking via `tsc --noEmit` |
| Python | pytest | Unit/integration tests |
| Python | pytest-qt | Qt widget tests |

---

## CI Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
steps:
  - name: Install deps
    run: |
      cd ableton-extension && npm ci
      cd ../native-app && pip install -r requirements.txt pytest pytest-qt

  - name: Type check extension
    run: npx tsc --noEmit

  - name: Run Python tests
    run: pytest native-app/tests/ -v
```