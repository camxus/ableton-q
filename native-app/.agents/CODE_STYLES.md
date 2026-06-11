# CODE_STYLES

## Naming Conventions

### kebab-case
Use for:
- Folders and files in the extension project
- Route-like identifiers
- CSS classes and IDs

Examples:
```txt
/src/panel.html
/src/extension.ts
/macos-app/AbletonMCPApp.app/
```

### camelCase
Use for:
- JavaScript/TypeScript variables and functions
- React/Vue component props (if used)
- JSON payload keys

Examples:
```ts
// In extension.ts
const MCP_HOST = "127.0.0.1";
let socket: net.Socket | null = null;
function buildPanelHtml() {}
function openPanel(toastOnLoad?: ToastOnLoad) {}
```

### PascalCase
Use for:
- JavaScript/TypeScript classes and interfaces
- TypeScript type names
- Python class names

Examples:
```ts
// In extension.ts
interface MCPRequest { ... }
class AbletonSocket { ... }

// In native-app/main.py
class CommandQueue(QObject): ...
class ChatMsg: ...
class QueueItem: ...
class ToggleSwitch(QWidget): ...
```

### snake_case
Use for:
- Python variables, functions, and methods
- Database columns (if applicable)
- Configuration keys

Examples:
```python
# In native-app/main.py
def load_config() -> dict:
def save_config(cfg: dict) -> None:
def _build_server_tab(self) -> QWidget:
CONFIG_DEFAULTS: dict = {
    "host": "127.0.0.1", 
    "port": 9877,
    "log_level": "INFO",
}
```

### UPPER_CASE
Use for:
- Constants
- Environment variables
- Enum values

Examples:
```ts
// In extension.ts
const MCP_HOST = "127.0.0.1";
const MCP_PORT = 9877;

const WIN_W = 420;
const WIN_H_COLLAPSED = 96;
const WIN_H_EXPANDED = 378;
```

```python
# In native-app/main.py
PROVIDERS = ["anthropic", "gemini", "openai", "ollama", "custom"]
CONFIG_DEFAULTS = { ... }
BUNDLE_RESOURCES = _bundle_dir()
SUPPORT_DIR = Path.home() / "Library" / "Application Support" / "AbletonQ"
```

## Extension Conventions

### extension.ts Structure
```
imports
├─ SDK imports
├─ Node.js imports (net, child_process)
└─ Local imports (panel.html)

Types & Interfaces
├─ MCPRequest/Response
├─ ChatMessage
├─ PanelEnvelope
└─ ToastOnLoad

Constants
├─ Connection settings (MCP_HOST, MCP_PORT)
├─ Window dimensions
└─ MCP_COMMANDS array

Classes
├─ AbletonSocket (TCP handling with reconnect)
└─ (Helper classes if needed)

Functions
├─ launchMcpApp() (fallback launcher)
├─ buildPanelHtml() (UI construction)
└─ activate() (extension entry point)

Event Handlers
├─ Socket callbacks (onStatusChange, onError, onEvent)
└─ UI actions (openPanel, sendCmd)
```

### panel.html Conventions
- CSS variables in :root for theming
- BEM-like naming for UI components (.msg, .msg.user, etc.)
- camelCase for JavaScript variables/functions
- Event handler attributes (onclick="toggleConnect()")

## Native App Conventions (main.py)

### File Structure
```
#!/usr/bin/env python3
"""
Module docstring with architecture overview
"""

# Imports
├─ Standard library
├─ Third-party (PySide6)
└─ Local helpers (none in this file)

# Constants & Paths
├─ Path helper functions
├─ Resource paths (BUNDLE_RESOURCES, SUPPORT_DIR)
└─ Special paths (LOG_FILE, CONFIG_FILE, etc.)

# Configuration
├─ PROVIDERS, PROVIDER_MODELS, PROVIDER_COLORS
└─ CONFIG_DEFAULTS

# Stylesheets
└─ DARK_QSS (Qt Style Sheets)

# Data Models
├─ Enums (MsgRole)
├─ Dataclasses (ChatMsg, QueueItem)
└─ Regular classes (CommandQueue, ToggleSwitch, etc.)

# UI Components
├─ Custom widgets (ToggleSwitch, SpinnerLabel, QueueBar, BubbleWidget)
├─ CommandPalette
├─ ChatScreen
├─ SettingsScreen (with tabs)
├─ SidebarBtn
└─ MainWindow

# Supporting Classes
├─ ServerManager (subprocess handling)
├─ StatusPoller (TCP/polling)
└─ Tray icon helpers (_make_icon functions)

# Application Class
└─ AbletonQApp (QApplication subclass)

# Main Execution
└─ main() function with if __name__ == "__main__": guard
```

### Qt Signal/Slot Naming
- Signals: verb_noun or noun_verb (item_queued, item_started, result_ready)
- Slots: on_noun_verb or verb_noun (on_item_queued, on_item_started)
- Properties: noun_adjective or verb_noun (isChecked, setChecked)

### Threading Conventions
- Worker threads for blocking operations (CommandQueue._run)
- QTimer.singleShot for thread-safe UI updates
- Locks for shared resources (threading.Lock)
- Daemon threads for background workers

### Error Handling
- Try/catch blocks around subprocess and socket operations
- Specific exception handling (JSONDecodeError, ProcessLookupError, TimeoutExpired)
- Graceful degradation with fallback mechanisms

## Commenting Standards

### File Headers
```python
"""
Module description in present tense.
Explains what the file does and its role in the system.
"""
```

### Section Headers
```python
# ─── SECTION NAME ────────────────────────────────────────────────
```

### Function Docstrings
```python
def function_name(param: type) -> return_type:
    """
    Brief description of what the function does.
    
    Args:
        param: Description of parameter
        
    Returns:
        Description of return value
        
    Raises:
        ExceptionType: When this exception might occur
    """
```

### Inline Comments
- Use sparingly for non-obvious logic
- Fix annotations: `# Fix #: description`
- Temporary notes: `# TODO: implement feature`
- Warnings: `# WARNING: potential issue`

## Import Organization

### Python
```python
# Standard library
import json
import os
import plistlib
import queue
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path

# Third-party
from PySide6.QtCore import (
    Property, QAbstractAnimation, QEasingCurve, QObject, QPoint,
    QPropertyAnimation, QSize, Qt, QTimer, Signal, Slot,
)
from PySide6.QtGui import (
    QAction, QColor, QFont, QIcon, QPainter, QPixmap,
)
from PySide6.QtWidgets import (
    QApplication, QComboBox, QFrame, QGraphicsOpacityEffect,
    QHBoxLayout, QLabel, QLineEdit, QMainWindow, QMenu, QPushButton,
    QScrollArea, QSizePolicy, QSpinBox, QStackedWidget, QSystemTrayIcon,
    QVBoxLayout, QWidget,
)
```

### TypeScript/JavaScript
```ts
// Node.js built-ins
import net from "node:net";
import { execFile } from "node:child_process";

// Local imports
import panelHtml from "./panel.html";

// SDK imports
import { initialize, type ActivationContext } from "@ableton-extensions/sdk";
```

## Formatting Standards

### Python
- Max line length: 88 characters (Black default)
- 4 spaces per indent (no tabs)
- Trailing commas in multi-line imports and function calls
- Blank lines between logical sections

### TypeScript/JavaScript
- Max line length: 100 characters
- 2 spaces per indent
- Semicolons required
- Template literals for string interpolation

### HTML/CSS
- 2 spaces per indent
- Lowercase for tag names and attributes
- Quotes around attribute values
- CSS variables in :root for theming