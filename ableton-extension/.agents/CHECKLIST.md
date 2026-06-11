# CHECKLIST

## Phase 1 - Foundation
```md
[ ] Project setup (package.json, tsconfig, .pyproject)
[ ] Extension: Basic panel.html with socket bridge
[ ] Extension: extension.ts with TCP connection logic
[ ] Native app: Basic PySide6 window with menu bar
[ ] Native app: Remote script installation
[ ] Native app: MCP server subprocess management
[ ] Shared: Basic TCP communication test
[ ] Version control: Initial commit with README
```

## Phase 2 - Connection Management
```md
[ ] Extension: Auto-reconnect with exponential backoff
[ ] Extension: Connection status UI (dot + label)
[ ] Extension: Toast notifications for connect/disconnect
[ ] Native app: ServerManager class with start/stop/restart
[ ] Native app: StatusPoller for TCP reachability
[ ] Native app: System tray icon with status indicators
[ ] Extension: Push event handling from Remote Script
[ ] Native app: Log file forwarding to UI (optional)
```

## Phase 3 - MCP Command Execution
```md
[ ] Extension: Send MCP commands via TCP socket
[ ] Extension: Parse and display MCP responses
[ ] Extension: Error handling for timeouts and malformed responses
[ ] Native app: CommandQueue for serialized execution
[ ] Native app: Chain command parsing (>> separator)
[ ] Native app: Context injection between chain steps
[ ] Extension: Command palette (/ to open)
[ ] Extension: Quick-command strip buttons
```

## Phase 4 - Chat & History
```md
[ ] Extension: Message bubble rendering (user/assistant/system/event)
[ ] Extension: Message history persistence in memory
[ ] Extension: Auto-scroll to bottom on new messages
[ ] Extension: Input clearing after send
[ ] Native app: ChatScreen with BubbleWidgets
[ ] Native app: Message styling by role (user, assistant, etc.)
[ ] Native app: Command history (↑/↓ navigation)
[ ] Native app: History capping (200 messages max)
```

## Phase 5 - Settings & Configuration
```md
[ ] Extension: N/A (settings handled by native app)
[ ] Native app: SettingsScreen with 3 tabs (Model/Server/App)
[ ] Native app: Provider selection (anthropic, gemini, etc.)
[ ] Native app: Model selection dropdown
[ ] Native app: API key and base URL inputs
[ ] Native app: Thinking/reasoning token toggle
[ ] Native app: Server configuration (host, port, log level)
[ ] Native app: App settings (launch at login, auto-start, theme)
[ ] Both: Config file load/save with defaults fallback
```

## Phase 6 - Remote Script Integration
```md
[ ] Extension: N/A (handled by native app)
[ ] Native app: Remote script installation verification
[ ] Native app: LaunchAgent creation for auto-start
[ ] Native app: Remote script update mechanism
[ ] Native app: Cross-platform support (macOS/Windows)
[ ] Extension: Test with actual ableton-mcp server
[ ] Extension: Handle various MCP response types
[ ] Extension: Handle push events (track_change, etc.)
```

## Phase 7 - UI Polish & UX
```md
[ ] Extension: Dark theme CSS variables
[ ] Extension: Responsive layout (collapsed/expanded panel)
[ ] Extension: Command palette keyboard navigation (↑/↓/Enter)
[ ] Extension: Input placeholder and focus management
[ ] Native app: Dark QSS styling
[ ] Native app: QueueBar with spinners and cancel buttons
[ ] Native app: Split view (sidebar + stacked widget)
[ ] Native app: ToolTips on all interactive elements
[ ] Both: Accessibility considerations (keyboard navigation)
```

## Phase 8 - Advanced Features
```md
[ ] Extension: N/A (core features complete)
[ ] Native app: Process chain visual indicators
[ ] Native app: Chain header messages ("── Step 2 / 3 ──")
[ ] Native app: Thinking toggle visibility control
[ ] Native app: Server status updates in tray menu
[ ] Native app: Log viewer (optional enhancement)
[ ] Native app: Drag and drop for file attachments (future)
[ ] Both: Performance profiling and optimization
```

## Phase 9 - Production Readiness
```md
[ ] Extension: Production build (npm run build:prod)
[ ] Native app: PyInstaller spec file configuration
[ ] Native app: Zero runtime dependencies goal
[ ] Native app: Code signing preparation (macOS)
[ ] Both: Comprehensive error handling
[ ] Both: Logging and diagnostics
[ ] Both: Unit tests for core logic
[ ] Both: Integration test scenarios
[ ] Both: Documentation and help system
[ ] Both: Release packaging (ZIP/DMG)
```

## Dependency Rules

```
Extension UI must be complete before TCP integration
TCP integration must be complete before command execution
Command execution must be complete before chaining
Chaining must be complete before context injection
Settings depend on config persistence
Native app UI depends on Qt components
Packaging depends on feature completion
```

## Next Step Rules

After each milestone, verify:
- [ ] All new features tested manually
- [ ] Existing functionality still works
- [ ] No TypeScript/JavaScript errors (extension)
- [ ] No Python exceptions or unhandled errors (native app)
- [ ] UI updates correctly reflect state changes
- [ ] Logging captures important events
- [ ] Memory usage is reasonable
- [ ] CPU usage is appropriate for idle/active states

**What should be built next?**
→ Phase 2: Connection Management (auto-reconnect, status UI, toast notifications)
This establishes the reliable communication foundation for all other features.