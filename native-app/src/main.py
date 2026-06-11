"""
AbletonQ  v0.2.0
────────────────
Native macOS menu-bar + main window app.
PySide6 + PyInstaller — zero runtime dependencies for the end user.

New in 0.2:
  • Command queue  — commands pile up while one is processing; each queued
    item shows a (×) cancel button; the active item shows a spinner
  • Process chain  — chain multiple commands with >> separator; they execute
    sequentially, each using the previous response as context
  • Full packaging — AbletonQ.spec produces a self-contained .app

Architecture overview:
  AbletonQApp          QApplication subclass, owns tray + main window
  MainWindow           QMainWindow: titlebar + sidebar + QStackedWidget
    ChatScreen         scroll area of BubbleWidgets + QueueBar + input
      QueueBar         shows pending items with cancel (×) buttons
      CommandQueue     QObject — serialises command execution, signals results
    SettingsScreen     3-tab settings (Model / Server / App)
  ServerManager        subprocess wrapper for abletonq-server binary
  StatusPoller         2-second TCP + pgrep timer
"""

from __future__ import annotations

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

# ─── Paths ────────────────────────────────────────────────────────────────────

def _bundle_dir() -> Path:
    # PyInstaller sets sys._MEIPASS in one-file mode; the .app Resources folder
    # is two levels up from the MacOS/ executable in one-dir / BUNDLE mode.
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            return Path(meipass)
        return Path(sys.executable).parent.parent / "Resources"
    return Path(__file__).parent.parent / "resources"

BUNDLE_RESOURCES  = _bundle_dir()
SUPPORT_DIR       = Path.home() / "Library" / "Application Support" / "AbletonQ"
LOG_FILE          = SUPPORT_DIR / "server.log"
CONFIG_FILE       = SUPPORT_DIR / "config.json"
LAUNCHAGENT_DIR   = Path.home() / "Library" / "LaunchAgents"
LAUNCHAGENT_PLIST = LAUNCHAGENT_DIR / "com.abletonq.server.plist"
REMOTE_SCRIPT_SRC = BUNDLE_RESOURCES / "AbletonQ_Remote_Script"
REMOTE_SCRIPT_DST = (
    Path.home() / "Music" / "Ableton" / "User Library"
    / "Remote Scripts" / "AbletonQ_Remote_Script"
)

# ─── Config ───────────────────────────────────────────────────────────────────

PROVIDERS = ["anthropic", "gemini", "openai", "ollama", "custom"]
PROVIDER_MODELS: dict[str, list[str]] = {
    "anthropic": ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
    "gemini":    ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
    "openai":    ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    "ollama":    ["llama3.1", "mistral", "codellama", "phi3"],
    "custom":    [],
}
PROVIDER_COLORS: dict[str, str] = {
    "anthropic": "#7ab4e8",
    "gemini":    "#4ca87a",
    "openai":    "#7ab87a",
    "ollama":    "#c4906a",
    "custom":    "#9a7ad0",
}
CONFIG_DEFAULTS: dict = {
    "host": "127.0.0.1", "port": 9877, "log_level": "INFO",
    "provider": "anthropic", "model": "claude-sonnet-4-5",
    "api_key": "", "base_url": "",
    "show_thinking": True,
    "launch_at_login": True, "auto_start_server": True, "show_on_launch": False,
}

def load_config() -> dict:
    try:
        return {**CONFIG_DEFAULTS, **json.loads(CONFIG_FILE.read_text(encoding="utf-8"))}
    except Exception:
        return dict(CONFIG_DEFAULTS)

def save_config(cfg: dict) -> None:
    SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")

# ─── Stylesheet ───────────────────────────────────────────────────────────────

DARK_QSS = """
QWidget { background:#1a1a1a; color:#c8c8c8;
  font-family:-apple-system,"SF Pro Text","Helvetica Neue",sans-serif; font-size:12px; }
QMainWindow { background:#1a1a1a; }
QScrollArea { border:none; background:transparent; }
QScrollBar:vertical { background:transparent; width:4px; margin:0; }
QScrollBar::handle:vertical { background:#2e2e2e; border-radius:2px; min-height:20px; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height:0; }
QLineEdit, QSpinBox, QComboBox {
  background:#141414; border:1px solid #2a2a2a; border-radius:5px;
  padding:4px 8px; color:#c8c8c8; min-height:24px; }
QLineEdit:focus, QSpinBox:focus, QComboBox:focus { border-color:#3a3a3a; }
QComboBox::drop-down { border:none; width:20px; }
QComboBox QAbstractItemView { background:#242424; border:1px solid #333;
  selection-background-color:#2d2a1e; color:#c8c8c8; }
QPushButton { background:#242424; border:1px solid #2e2e2e; border-radius:5px;
  padding:5px 14px; color:#aaa; }
QPushButton:hover  { background:#2a2a2a; color:#ccc; }
QPushButton:pressed { background:#202020; }
QPushButton#sendBtn { background:#f5a623; color:#1a1a1a; border:none;
  border-radius:14px; padding:5px 18px; font-weight:600; }
QPushButton#sendBtn:hover  { background:#f0a020; }
QPushButton#accentBtn { background:#f5a62318; color:#f5a623; border:1px solid #f5a62340; }
QPushButton#accentBtn:hover { background:#f5a62328; }
QPushButton#cancelBtn { background:transparent; border:none; color:#555;
  font-size:13px; padding:0 3px; min-width:18px; max-width:18px; }
QPushButton#cancelBtn:hover { color:#d84f4f; }
QFrame#separator { background:#222; max-height:1px; }
QFrame#card { background:#1e1e1e; border:1px solid #2a2a2a; border-radius:8px; }
QLabel#sectionLabel { font-size:10px; letter-spacing:.08em; color:#555; }
"""

# ─── Chat message model ───────────────────────────────────────────────────────

class MsgRole(str, Enum):
    USER      = "user"
    ASSISTANT = "assistant"
    SYSTEM    = "system"
    EVENT     = "event"
    THINKING  = "thinking"
    CHAIN_HDR = "chain_header"   # shows "── Step N / M ──"

@dataclass
class ChatMsg:
    role: MsgRole
    text: str
    ts:   datetime = field(default_factory=datetime.now)

# ─── Command queue item ───────────────────────────────────────────────────────

@dataclass
class QueueItem:
    id:    str
    text:  str
    chain: list[str] = field(default_factory=list)  # all steps if chained
    step:  int = 0                                   # current step index

# ─── CommandQueue — serialised execution engine ───────────────────────────────

class CommandQueue(QObject):
    """
    Thread-safe FIFO queue. One command executes at a time.
    If a new command arrives while one is running it is appended;
    the UI shows it with a (×) cancel button.

    Chain syntax: separate steps with >>
      e.g.  get_tracks >> set_tempo 140 >> start_playback

    Signals:
      item_queued(QueueItem)          — new item appended (show in queue bar)
      item_started(str)               — item_id now processing (show spinner)
      item_finished(str)              — item_id done (remove from queue bar)
      item_cancelled(str)             — item_id cancelled
      result_ready(ChatMsg)           — emit response / error bubble
    """
    item_queued   = Signal(object)   # QueueItem
    item_started  = Signal(str)      # id
    item_finished = Signal(str)      # id
    item_cancelled = Signal(str)     # id
    result_ready  = Signal(object)   # ChatMsg

    def __init__(self, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self._q: deque[QueueItem] = deque()
        self._active: QueueItem | None = None
        self._lock = threading.Lock()
        self._cancel_ids: set[str] = set()
        self._worker = threading.Thread(target=self._run, daemon=True)
        self._worker.start()
        self._wake = threading.Event()

    # ── public API ────────────────────────────────────────────────────────────

    def submit(self, text: str) -> str:
        """Parse text (chain or single), create a QueueItem, enqueue it."""
        steps = [s.strip() for s in text.split(">>") if s.strip()]
        item = QueueItem(id=uuid.uuid4().hex[:8], text=text, chain=steps, step=0)
        with self._lock:
            self._q.append(item)
        self.item_queued.emit(item)
        self._wake.set()
        return item.id

    def cancel(self, item_id: str) -> None:
        with self._lock:
            self._cancel_ids.add(item_id)
            # remove from pending queue immediately if not yet started
            new_q = deque(i for i in self._q if i.id != item_id)
            removed = len(self._q) != len(new_q)
            self._q = new_q
        if removed:
            self.item_cancelled.emit(item_id)

    def queue_snapshot(self) -> list[QueueItem]:
        with self._lock:
            return list(self._q)

    def active_id(self) -> str | None:
        with self._lock:
            return self._active.id if self._active else None

    # ── worker loop ───────────────────────────────────────────────────────────

    def _run(self) -> None:
        while True:
            self._wake.wait()
            self._wake.clear()
            while True:
                with self._lock:
                    if not self._q:
                        break
                    item = self._q.popleft()
                self._active = item
                QTimer.singleShot(0, lambda i=item: self.item_started.emit(i.id))
                self._execute_item(item)
                self._active = None
                QTimer.singleShot(0, lambda i=item: self.item_finished.emit(i.id))

    def _execute_item(self, item: QueueItem) -> None:
        """
        Execute all chain steps sequentially.
        Each step gets the previous step's result injected as context.
        """
        cfg = load_config()
        prev_result: str | None = None
        total = len(item.chain)

        for step_idx, step_text in enumerate(item.chain):
            # Check for cancellation under lock
            with self._lock:
                if item.id in self._cancel_ids:
                    QTimer.singleShot(0, lambda: self.result_ready.emit(
                        ChatMsg(MsgRole.SYSTEM, f"[chain cancelled at step {step_idx+1}]")
                    ))
                    return

            # emit chain header for multi-step chains
            if total > 1:
                header = f"── Step {step_idx + 1} / {total}  ·  {step_text}"
                QTimer.singleShot(0, lambda h=header: self.result_ready.emit(
                    ChatMsg(MsgRole.CHAIN_HDR, h)
                ))

            result = self._send_one(step_text, prev_result, cfg)
            prev_result = result

    def _send_one(self, text: str, context: str | None, cfg: dict) -> str:
        """Send one command to the MCP socket, return stringified result."""
        # parse as JSON or wrap as get_session_info
        try:
            req = json.loads(text)
        except json.JSONDecodeError:
            req = {"type": "get_session_info", "raw_input": text}

        req["id"] = uuid.uuid4().hex[:8]

        # inject previous chain result as context if present
        if context is not None:
            req.setdefault("params", {})
            req["params"]["_chain_context"] = context

        try:
            with socket.create_connection((cfg["host"], cfg["port"]), timeout=10) as s:
                s.sendall((json.dumps(req) + "\n").encode())
                data = b""
                while True:
                    chunk = s.recv(65536)
                    if not chunk:
                        break
                    data += chunk
                    # Process all complete lines we have so far
                    while b"\n" in data:
                        line, data = data.split(b"\n", 1)
                        if line:  # Only process non-empty lines
                            try:
                                resp = json.loads(line.decode())
                                # Use the last valid response we get
                                result_text = json.dumps(resp.get("result", resp), indent=2)
                            except json.JSONDecodeError:
                                # Invalid JSON, skip this line
                                pass
                # If we have leftover data that's not a complete line, it's incomplete
                # but we'll ignore it since the socket is closing
                if data:
                    # Log incomplete data for debugging (optional)
                    pass
                    
            # If we never got a valid response, return an error
            if 'result_text' not in locals():
                err = "Error: No valid response received from server"
                QTimer.singleShot(0, lambda e=err: self.result_ready.emit(
                    ChatMsg(MsgRole.ASSISTANT, e)
                ))
                return err
                
            QTimer.singleShot(0, lambda t=result_text: self.result_ready.emit(
                ChatMsg(MsgRole.ASSISTANT, t)
            ))
            return result_text
        except Exception as exc:
            err = f"Error: {exc}"
            QTimer.singleShot(0, lambda e=err: self.result_ready.emit(
                ChatMsg(MsgRole.ASSISTANT, e)
            ))
            return err

# ─── Toggle switch ────────────────────────────────────────────────────────────

class ToggleSwitch(QWidget):
    toggled = Signal(bool)

    def __init__(self, checked: bool = False, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setFixedSize(36, 20)
        self._checked = checked
        self._thumb   = 18.0 if checked else 3.0
        self._anim = QPropertyAnimation(self, b"_thumb_x", self)
        self._anim.setDuration(150)
        self._anim.setEasingCurve(QEasingCurve.Type.OutCubic)

    def isChecked(self) -> bool:
        return self._checked

    def setChecked(self, val: bool) -> None:
        if val == self._checked:
            return
        self._checked = val
        self._anim.stop()
        self._anim.setStartValue(self._thumb)
        self._anim.setEndValue(18.0 if val else 3.0)
        self._anim.start()

    def _get_thumb(self) -> float: return self._thumb
    def _set_thumb(self, v: float) -> None: self._thumb = v; self.update()
    _thumb_x = Property(float, _get_thumb, _set_thumb)

    def mousePressEvent(self, _):
        self._checked = not self._checked
        self._anim.stop()
        self._anim.setStartValue(self._thumb)
        self._anim.setEndValue(18.0 if self._checked else 3.0)
        self._anim.start()
        self.toggled.emit(self._checked)

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor("#f5a623" if self._checked else "#2e2e2e"))
        p.drawRoundedRect(0, 0, 36, 20, 10, 10)
        p.setBrush(QColor("#ffffff"))
        p.drawEllipse(int(self._thumb), 3, 14, 14)

# ─── Spinner widget ───────────────────────────────────────────────────────────

class SpinnerLabel(QLabel):
    """Tiny animated ◐ spinner for active queue item."""
    FRAMES = ["◐", "◓", "◑", "◒"]

    def __init__(self, parent=None):
        super().__init__(self.FRAMES[0], parent)
        self.setStyleSheet("color:#f5a623;font-size:12px;")
        self._frame = 0
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.start(120)

    def _tick(self):
        self._frame = (self._frame + 1) % len(self.FRAMES)
        self.setText(self.FRAMES[self._frame])

    def stop(self):
        self._timer.stop()

# ─── Queue bar widget ─────────────────────────────────────────────────────────

class QueueBar(QWidget):
    """
    Sits above the input bar; shows pending/active queue items.
    Each chip has the command label + (×) cancel button.
    Active item gets a spinner instead of ×.
    Hides itself when empty.
    """
    cancel_requested = Signal(str)  # item_id

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("background:#1e1e1e;border-top:1px solid #111;")
        self._outer = QHBoxLayout(self)
        self._outer.setContentsMargins(10, 6, 10, 6)
        self._outer.setSpacing(6)

        prefix = QLabel("Queue:")
        prefix.setStyleSheet("color:#555;font-size:10px;")
        self._outer.addWidget(prefix)

        self._chips_area = QWidget()
        self._chips_lay  = QHBoxLayout(self._chips_area)
        self._chips_lay.setContentsMargins(0, 0, 0, 0)
        self._chips_lay.setSpacing(5)
        self._chips_lay.addStretch()
        self._outer.addWidget(self._chips_area, 1)

        self._chips: dict[str, QWidget] = {}   # id → chip widget
        self._spinners: dict[str, SpinnerLabel] = {}
        self.hide()

    # ── public slots ─────────────────────────────────────────────────────────

    @Slot(object)
    def on_item_queued(self, item: QueueItem):
        self._add_chip(item.id, item.text, active=False)
        self.show()

    @Slot(str)
    def on_item_started(self, item_id: str):
        chip = self._chips.get(item_id)
        if not chip:
            return
        # swap the × button for a spinner
        lay = chip.layout()
        # remove last widget (the × btn)
        old = lay.takeAt(lay.count() - 1)
        if old and old.widget():
            old.widget().deleteLater()
        spinner = SpinnerLabel(chip)
        self._spinners[item_id] = spinner
        lay.addWidget(spinner)
        # highlight chip
        chip.setStyleSheet(
            "background:#2d2a1e;border:1px solid #f5a62360;border-radius:12px;"
        )

    @Slot(str)
    def on_item_finished(self, item_id: str):
        self._remove_chip(item_id)

    @Slot(str)
    def on_item_cancelled(self, item_id: str):
        self._remove_chip(item_id)

    # ── internal ─────────────────────────────────────────────────────────────

    def _add_chip(self, item_id: str, text: str, active: bool):
        chip = QWidget()
        chip.setStyleSheet(
            "background:#252525;border:1px solid #333;border-radius:12px;"
        )
        lay = QHBoxLayout(chip)
        lay.setContentsMargins(8, 3, 4, 3)
        lay.setSpacing(4)

        # truncate long commands
        display = text if len(text) <= 28 else text[:26] + "…"
        lbl = QLabel(display)
        lbl.setStyleSheet("color:#aaa;font-size:10px;font-family:ui-monospace,monospace;")
        lay.addWidget(lbl)

        if active:
            spinner = SpinnerLabel(chip)
            self._spinners[item_id] = spinner
            lay.addWidget(spinner)
        else:
            cancel = QPushButton("×")
            cancel.setObjectName("cancelBtn")
            cancel.setFixedSize(18, 18)
            cancel.clicked.connect(lambda _, i=item_id: self.cancel_requested.emit(i))
            lay.addWidget(cancel)

        # animate chip in
        eff = QGraphicsOpacityEffect(chip)
        eff.setOpacity(0.0)
        chip.setGraphicsEffect(eff)
        anim = QPropertyAnimation(eff, b"opacity", chip)
        anim.setDuration(180)
        anim.setStartValue(0.0)
        anim.setEndValue(1.0)
        anim.start(QAbstractAnimation.DeletionPolicy.DeleteWhenStopped)

        # insert before the stretch
        idx = self._chips_lay.count() - 1
        self._chips_lay.insertWidget(idx, chip)
        self._chips[item_id] = chip

    def _remove_chip(self, item_id: str):
        spinner = self._spinners.pop(item_id, None)
        if spinner:
            spinner.stop()

        chip = self._chips.pop(item_id, None)
        if not chip:
            return

        # animate out then delete
        eff = QGraphicsOpacityEffect(chip)
        chip.setGraphicsEffect(eff)
        anim = QPropertyAnimation(eff, b"opacity", chip)
        anim.setDuration(160)
        anim.setStartValue(1.0)
        anim.setEndValue(0.0)
        anim.finished.connect(chip.deleteLater)
        anim.start(QAbstractAnimation.DeletionPolicy.DeleteWhenStopped)

        # hide bar when no more chips
        if not self._chips:
            QTimer.singleShot(200, lambda: self.hide() if not self._chips else None)

# ─── Bubble widget ────────────────────────────────────────────────────────────

BUBBLE_CSS: dict[MsgRole, tuple[str, str]] = {
    MsgRole.USER:      ("background:#2d2d2d;border:1px solid #3a3a3a;border-radius:10px;",
                        "color:#f5a623;"),
    MsgRole.ASSISTANT: ("background:#252525;border:1px solid #2e2e2e;border-radius:10px;",
                        "color:#c8c8c8;font-family:ui-monospace,monospace;font-size:11px;"),
    MsgRole.EVENT:     ("background:#1c2535;border:1px solid #2a3a50;border-radius:10px;",
                        "color:#6fa8d0;font-family:ui-monospace,monospace;font-size:11px;"),
    MsgRole.THINKING:  ("background:#1e1e2a;border:1px solid #2a2a40;border-radius:10px;",
                        "color:#7070a0;font-size:11px;font-style:italic;"),
    MsgRole.SYSTEM:    ("", "color:#555;font-size:10px;font-style:italic;"),
    MsgRole.CHAIN_HDR: ("", "color:#666;font-size:10px;letter-spacing:.04em;"),
}

class BubbleWidget(QWidget):
    def __init__(self, msg: ChatMsg, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._msg = msg
        self._build()
        # fade-in
        eff = QGraphicsOpacityEffect(self)
        eff.setOpacity(0.0)
        self.setGraphicsEffect(eff)
        anim = QPropertyAnimation(eff, b"opacity", self)
        anim.setDuration(240)
        anim.setEasingCurve(QEasingCurve.Type.OutCubic)
        anim.setStartValue(0.0)
        anim.setEndValue(1.0)
        QTimer.singleShot(30, lambda: (anim.start(), None))
        self._fade_anim = anim   # keep ref

    def _build(self):
        role = self._msg.role
        track, text_css = BUBBLE_CSS.get(role, ("", "color:#c8c8c8;"))
        outer = QHBoxLayout(self)
        outer.setContentsMargins(10, 3, 10, 3)
        if role == MsgRole.USER:
            outer.addStretch()

        lbl = QLabel(self._msg.text)
        lbl.setWordWrap(True)
        lbl.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        lbl.setStyleSheet(f"padding:8px 12px;{track}{text_css}")
        lbl.setMaximumWidth(500)

        inner = QVBoxLayout()
        inner.setSpacing(2)
        inner.addWidget(lbl)

        if role not in (MsgRole.SYSTEM, MsgRole.CHAIN_HDR):
            ts = QLabel(self._msg.ts.strftime("%H:%M:%S"))
            ts.setStyleSheet("color:#444;font-size:9px;padding:0 4px;")
            inner.addWidget(ts)

        outer.addLayout(inner)
        if role not in (MsgRole.USER,):
            outer.addStretch()

    def set_visible_animated(self, visible: bool):
        # Fix #4: create a fresh animation each call (DeleteWhenStopped cleans it up).
        # Never reuse self._fade_anim here — each call would add another finished connection.
        eff = self.graphicsEffect()
        if not eff:
            eff = QGraphicsOpacityEffect(self)
            self.setGraphicsEffect(eff)
        if visible:
            self.show()
        anim = QPropertyAnimation(eff, b"opacity")   # no parent → manual lifetime
        anim.setDuration(220)
        anim.setStartValue(float(not visible))
        anim.setEndValue(float(visible))
        anim.setEasingCurve(QEasingCurve.Type.OutCubic)
        if not visible:
            anim.finished.connect(self.hide)
        anim.start(QAbstractAnimation.DeletionPolicy.DeleteWhenStopped)

# ─── MCP command list (for palette) ──────────────────────────────────────────
MCP_COMMANDS: list[tuple[str, str, dict]] = [
    ("get_session_info",   "Get Session Info",    {}),
    ("get_tracks",         "Get Tracks",          {}),
    ("get_tempo",          "Get Tempo",           {}),
    ("set_tempo",          "Set Tempo",           {"tempo": 128}),
    ("start_playback",     "Start Playback",      {}),
    ("stop_playback",      "Stop Playback",       {}),
    ("undo",               "Undo",                {}),
    ("redo",               "Redo",                {}),
    ("create_midi_track",  "Create MIDI Track",   {"index": -1}),
    ("create_audio_track", "Create Audio Track",  {"index": -1}),
    ("create_return_track","Create Return Track",  {}),
    ("delete_track",       "Delete Track",        {"track_index": 0}),
    ("set_track_name",     "Set Track Name",      {"track_index": 0, "name": ""}),
    ("set_track_volume",   "Set Track Volume",    {"track_index": 0, "volume": 0.85}),
    ("set_track_pan",      "Set Track Pan",       {"track_index": 0, "pan": 0.0}),
    ("mute_track",         "Mute Track",          {"track_index": 0}),
    ("unmute_track",       "Unmute Track",        {"track_index": 0}),
    ("solo_track",         "Solo Track",          {"track_index": 0}),
    ("arm_track",          "Arm Track",           {"track_index": 0}),
    ("create_clip",        "Create Clip",         {"track_index": 0, "clip_index": 0, "length": 4}),
    ("delete_clip",        "Delete Clip",         {"track_index": 0, "clip_index": 0}),
    ("fire_clip",          "Fire Clip",           {"track_index": 0, "clip_index": 0}),
    ("stop_clip",          "Stop Clip",           {"track_index": 0, "clip_index": 0}),
    ("get_clip_notes",     "Get Clip Notes",      {"track_index": 0, "clip_index": 0}),
    ("add_notes_to_clip",  "Add Notes to Clip",   {"track_index": 0, "clip_index": 0, "notes": []}),
    ("set_clip_name",      "Set Clip Name",       {"track_index": 0, "clip_index": 0, "name": ""}),
    ("load_instrument",    "Load Instrument",     {"track_index": 0, "uri": ""}),
    ("get_device_params",  "Get Device Params",   {"track_index": 0, "device_index": 0}),
    ("set_device_param",   "Set Device Param",    {"track_index": 0, "device_index": 0,
                                                   "param_index": 0, "value": 0.5}),
]

# ─── Command palette ──────────────────────────────────────────────────────────

class CommandPalette(QWidget):
    command_selected = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet(
            "background:#1e1e1e;border:1px solid #333;border-radius:8px;"
        )
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        self._search = QLineEdit()
        self._search.setPlaceholderText("Search commands… (>> to chain)")
        self._search.setStyleSheet(
            "background:#141414;border:none;"
            "border-bottom:1px solid #2a2a2a;"
            "border-radius:8px 8px 0 0;padding:7px 10px;color:#ccc;"
        )
        self._search.textChanged.connect(self._filter)
        # Fix #6: handle Up/Down/Enter/Escape in the search field
        self._search.installEventFilter(self)
        lay.addWidget(self._search)

        self._list_w   = QWidget()
        self._list_lay = QVBoxLayout(self._list_w)
        self._list_lay.setContentsMargins(4, 4, 4, 4)
        self._list_lay.setSpacing(1)
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.Shape.NoFrame)
        self._scroll.setWidget(self._list_w)
        self._scroll.setFixedHeight(175)
        lay.addWidget(self._scroll)

        self._results = list(MCP_COMMANDS)
        self._active  = 0
        self._render()

    def reset(self):
        self._search.clear()
        self._results = list(MCP_COMMANDS)
        self._active  = 0
        self._render()

    def focus_search(self):
        self._search.setFocus()

    def eventFilter(self, obj, ev):
        from PySide6.QtCore import QEvent
        if obj is self._search and ev.type() == QEvent.Type.KeyPress:
            key = ev.key()
            if key in (Qt.Key.Key_Down, Qt.Key.Key_Up):
                delta = 1 if key == Qt.Key.Key_Down else -1
                self._active = max(0, min(len(self._results) - 1, self._active + delta))
                self._render()
                return True
            if key in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
                self._select(self._active)
                return True
            if key == Qt.Key.Key_Escape:
                self.hide()
                return True
        return super().eventFilter(obj, ev)

    def _filter(self, q: str):
        q = q.lower()
        self._results = ([c for c in MCP_COMMANDS
                          if q in c[0].lower() or q in c[1].lower()]
                         if q else list(MCP_COMMANDS))
        self._active = 0
        self._render()

    def _select(self, idx: int):
        if not self._results or idx >= len(self._results):
            return
        cmd_type, _label, params = self._results[idx]
        obj: dict = {"type": cmd_type}
        if params:
            obj["params"] = params
        self.command_selected.emit(json.dumps(obj))

    def _render(self):
        while self._list_lay.count():
            item = self._list_lay.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        for i, (cmd_type, label, params) in enumerate(self._results):
            btn = QPushButton()
            btn.setFlat(True)
            # Fix #7: removed dead param_str variable; show param names as dim suffix
            suffix = f"  ({', '.join(params.keys())})" if params else ""
            btn.setText(f"  {label}{suffix}")
            is_active = i == self._active
            btn.setStyleSheet(
                f"text-align:left;padding:5px 8px;border-radius:4px;"
                f"{'background:#2d2a1e;color:#f5a623;' if is_active else 'color:#aaa;'}"
            )
            btn.clicked.connect(lambda _, idx=i: self._select(idx))
            self._list_lay.addWidget(btn)
        self._list_lay.addStretch()
        # Scroll active item into view
        if self._results:
            item = self._list_lay.itemAt(self._active)
            if item and item.widget():
                self._scroll.ensureWidgetVisible(item.widget())

# ─── Chat screen ──────────────────────────────────────────────────────────────

class ChatScreen(QWidget):
    # Maximum number of chat bubbles to keep in memory to prevent unbounded growth
    MAX_BUBBLES = 500
    
    def __init__(self, cmd_queue: CommandQueue, parent=None):
        super().__init__(parent)
        self._cmd_queue    = cmd_queue
        self._history:     list[str] = []
        self._hist_idx     = -1
        self._draft        = ""
        self._show_thinking = True
        self._bubbles:     list[tuple[BubbleWidget, ChatMsg]] = []
        self._build()
        self._wire()

    def _build(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # ── header ────────────────────────────────────────────────────────────
        hdr = QWidget()
        hdr.setFixedHeight(44)
        hdr.setStyleSheet("background:#1e1e1e;border-bottom:1px solid #111;")
        hl = QHBoxLayout(hdr)
        hl.setContentsMargins(12, 0, 12, 0)

        # Fix #16: initialize from saved config so label matches reality on startup
        _cfg_model = load_config().get("model", "claude-sonnet-4-5")
        self._model_btn = QPushButton(f"{_cfg_model}  ▾")
        self._model_btn.setStyleSheet(
            "background:#242424;border:1px solid #333;border-radius:14px;"
            "padding:3px 12px;color:#aaa;font-size:11px;"
        )
        hl.addWidget(self._model_btn)

        self._conn_lbl = QLabel("● :9877")
        self._conn_lbl.setStyleSheet("color:#4cc97a;font-size:10px;")
        hl.addWidget(self._conn_lbl)
        hl.addStretch()

        think_lbl = QLabel("thinking")
        think_lbl.setStyleSheet("color:#555;font-size:10px;")
        self._think_toggle = ToggleSwitch(checked=True)
        self._think_toggle.toggled.connect(self._on_thinking_toggled)
        hl.addWidget(think_lbl)
        hl.addWidget(self._think_toggle)
        root.addWidget(hdr)

        # ── chat scroll ───────────────────────────────────────────────────────
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.Shape.NoFrame)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)

        self._container = QWidget()
        self._chat_lay  = QVBoxLayout(self._container)
        self._chat_lay.setContentsMargins(0, 8, 0, 8)
        self._chat_lay.setSpacing(4)
        self._chat_lay.addStretch()
        self._scroll.setWidget(self._container)
        root.addWidget(self._scroll, 1)

        # ── queue bar (hidden when empty) ─────────────────────────────────────
        self._queue_bar = QueueBar()
        self._queue_bar.cancel_requested.connect(self._cmd_queue.cancel)
        root.addWidget(self._queue_bar)

        # ── chain hint ────────────────────────────────────────────────────────
        hint = QLabel("Tip: use >> to chain commands  ·  / for palette  ·  ↑↓ for history")
        hint.setStyleSheet(
            "color:#333;font-size:9px;padding:3px 12px;"
            "background:#1a1a1a;border-top:1px solid #111;"
        )
        root.addWidget(hint)

        # ── palette overlay ───────────────────────────────────────────────────
        self._palette = CommandPalette(self)
        self._palette.hide()
        self._palette.command_selected.connect(self._on_palette_cmd)

        # ── input bar ─────────────────────────────────────────────────────────
        input_bar = QWidget()
        input_bar.setFixedHeight(52)
        input_bar.setStyleSheet("background:#1e1e1e;border-top:1px solid #111;")
        ib = QHBoxLayout(input_bar)
        ib.setContentsMargins(10, 10, 10, 10)
        ib.setSpacing(8)

        self._pal_btn = QPushButton("⌘")
        self._pal_btn.setFixedSize(32, 32)
        self._pal_btn.setToolTip("Command palette (/)")
        self._pal_btn.setStyleSheet(
            "background:#242424;border:1px solid #2e2e2e;"
            "border-radius:6px;color:#555;font-size:14px;"
        )
        self._pal_btn.clicked.connect(self._toggle_palette)
        ib.addWidget(self._pal_btn)

        self._input = QLineEdit()
        self._input.setPlaceholderText("Command… or step1 >> step2 >> step3")
        self._input.setFixedHeight(32)
        self._input.returnPressed.connect(self._send)
        self._input.textChanged.connect(self._on_input_changed)
        self._input.installEventFilter(self)
        ib.addWidget(self._input, 1)

        send_btn = QPushButton("Send")
        send_btn.setObjectName("sendBtn")
        send_btn.setFixedHeight(32)
        send_btn.clicked.connect(self._send)
        ib.addWidget(send_btn)

        root.addWidget(input_bar)

    def _wire(self):
        self._cmd_queue.item_queued.connect(self._queue_bar.on_item_queued)
        self._cmd_queue.item_started.connect(self._queue_bar.on_item_started)
        self._cmd_queue.item_finished.connect(self._queue_bar.on_item_finished)
        self._cmd_queue.item_cancelled.connect(self._queue_bar.on_item_cancelled)
        self._cmd_queue.result_ready.connect(self.add_message)

    # ── event filter for ↑↓ history ───────────────────────────────────────────
    def eventFilter(self, obj, ev):
        from PySide6.QtCore import QEvent
        if obj is self._input and ev.type() == QEvent.Type.KeyPress:
            k = ev.key()
            if k == Qt.Key.Key_Up:   self._hist_up();   return True
            if k == Qt.Key.Key_Down: self._hist_down(); return True
            if k == Qt.Key.Key_Escape and not self._palette.isHidden():
                self._palette.hide(); return True
        return super().eventFilter(obj, ev)

    def _hist_up(self):
        if not self._history: return
        if self._hist_idx == -1:
            self._draft    = self._input.text()
            self._hist_idx = len(self._history) - 1
        else:
            self._hist_idx = max(0, self._hist_idx - 1)
        self._input.setText(self._history[self._hist_idx])

    def _hist_down(self):
        if self._hist_idx == -1: return
        self._hist_idx += 1
        if self._hist_idx >= len(self._history):
            self._hist_idx = -1
            self._input.setText(self._draft)
        else:
            self._input.setText(self._history[self._hist_idx])

    def _on_input_changed(self, text: str):
        if text == "/" and self._palette.isHidden():
            self._input.setText("")
            self._show_palette()
        self._hist_idx = -1

    def _toggle_palette(self):
        if self._palette.isHidden(): self._show_palette()
        else: self._palette.hide()

    def _show_palette(self):
        self._palette.reset()
        PAL_H = 218
        y_input = self._input.mapTo(self, QPoint(0, 0)).y()
        # Fix #5: clamp so palette never goes above y=4 even in small windows
        y = max(4, y_input - PAL_H)
        self._palette.setGeometry(10, y, self.width() - 20, PAL_H)
        self._palette.show()
        self._palette.focus_search()

    def _on_palette_cmd(self, json_str: str):
        self._palette.hide()
        self._input.setText(json_str)
        self._input.setFocus()

    def _send(self):
        text = self._input.text().strip()
        if not text: return
        self._input.clear()
        self._hist_idx = -1
        if text not in self._history:
            self._history.append(text)
            # Fix #8: cap history to avoid unbounded growth
            if len(self._history) > 200:
                self._history = self._history[-200:]

        # show user bubble for each chain step (or single command)
        steps = [s.strip() for s in text.split(">>") if s.strip()]
        if len(steps) > 1:
            label = f"Chain ({len(steps)} steps): " + "  >>  ".join(
                (s[:20] + "…" if len(s) > 20 else s) for s in steps
            )
        else:
            label = text
        self.add_message(ChatMsg(MsgRole.USER, label))

        self._cmd_queue.submit(text)

    def add_message(self, msg: ChatMsg):
        bw = BubbleWidget(msg, self._container)
        if msg.role == MsgRole.THINKING and not self._show_thinking:
            bw.hide()
        self._bubbles.append((bw, msg))
        self._chat_lay.addWidget(bw)
        
        # Limit the number of bubbles to prevent unbounded memory growth
        if len(self._bubbles) > self.MAX_BUBBLES:
            # Remove the oldest bubbles
            old_bubbles = self._bubbles[:-self.MAX_BUBBLES]
            self._bubbles = self._bubbles[-self.MAX_BUBBLES:]
            for old_bw, _ in old_bubbles:
                old_bw.setParent(None)  # Remove from layout
                old_bw.deleteLater()    # Schedule for deletion
        
        QTimer.singleShot(60, self._scroll_bottom)

    def _scroll_bottom(self):
        sb = self._scroll.verticalScrollBar()
        sb.setValue(sb.maximum())

    def _on_thinking_toggled(self, on: bool):
        self._show_thinking = on
        for bw, msg in self._bubbles:
            if msg.role == MsgRole.THINKING:
                bw.set_visible_animated(on)

    def set_connection_status(self, reachable: bool, port: int):
        if reachable:
            self._conn_lbl.setText(f"● :{port}")
            self._conn_lbl.setStyleSheet("color:#4cc97a;font-size:10px;")
        else:
            self._conn_lbl.setText(f"○ :{port}")
            self._conn_lbl.setStyleSheet("color:#d84f4f;font-size:10px;")

    def update_model_label(self, model: str):
        self._model_btn.setText(f"{model}  ▾")

# ─── Provider card ────────────────────────────────────────────────────────────

class ProviderCard(QWidget):
    clicked = Signal(str)

    def __init__(self, name: str, color: str, parent=None):
        super().__init__(parent)
        self._name  = name
        self._color = color
        self.setFixedSize(100, 68)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(8, 8, 8, 8)
        icon = QLabel(name[0].upper())
        icon.setFixedSize(26, 26)
        icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon.setStyleSheet(
            f"background:{color}18;color:{color};"
            "border-radius:6px;font-weight:600;font-size:13px;"
        )
        self._name_lbl = QLabel(name.capitalize())
        self._name_lbl.setStyleSheet("font-size:11px;font-weight:500;color:#888;")
        lay.addWidget(icon)
        lay.addWidget(self._name_lbl)
        self.set_active(False)

    def set_active(self, v: bool):
        border = f"border:1px solid {self._color};" if v else "border:1px solid #2e2e2e;"
        self._name_lbl.setStyleSheet(
            f"font-size:11px;font-weight:500;"
            f"{'color:' + self._color + ';' if v else 'color:#888;'}"
        )
        self.setStyleSheet(f"background:#1e1e1e;border-radius:8px;{border}")

    def mousePressEvent(self, _):
        self.clicked.emit(self._name)

# ─── Settings screen ──────────────────────────────────────────────────────────

class SettingsScreen(QWidget):
    settings_changed = Signal(dict)
    server_toggle_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._cfg = load_config()
        self._build()

    def _build(self):
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # nav
        nav = QWidget()
        nav.setFixedWidth(130)
        nav.setStyleSheet("background:#1a1a1a;border-right:1px solid #111;")
        nav_lay = QVBoxLayout(nav)
        nav_lay.setContentsMargins(0, 12, 0, 0)
        nav_lay.setSpacing(2)

        self._nav_btns: list[QPushButton] = []
        self._stack = QStackedWidget()

        for i, label in enumerate(["Model", "Server", "App"]):
            btn = QPushButton(label)
            btn.setFlat(True)
            btn.setStyleSheet(
                "text-align:left;padding:7px 16px;"
                "border-left:2px solid transparent;color:#666;border-radius:0;"
            )
            btn.clicked.connect(lambda _, idx=i: self._switch(idx))
            self._nav_btns.append(btn)
            nav_lay.addWidget(btn)
        nav_lay.addStretch()
        root.addWidget(nav)

        self._stack.addWidget(self._build_model_tab())
        self._stack.addWidget(self._build_server_tab())
        self._stack.addWidget(self._build_app_tab())

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setWidget(self._stack)
        root.addWidget(scroll, 1)
        self._switch(0)

    def _switch(self, idx: int):
        for i, btn in enumerate(self._nav_btns):
            a = i == idx
            btn.setStyleSheet(
                f"text-align:left;padding:7px 16px;border-radius:0;"
                f"{'border-left:2px solid #f5a623;color:#f5a623;background:#1e1e18;'
                   if a else 'border-left:2px solid transparent;color:#666;'}"
            )
        self._stack.setCurrentIndex(idx)

    def _row(self, label: str, widget: QWidget) -> QWidget:
        w   = QWidget()
        lay = QHBoxLayout(w)
        lay.setContentsMargins(0, 0, 0, 0)
        lbl = QLabel(label)
        lbl.setFixedWidth(120)
        lbl.setStyleSheet("color:#777;")
        lay.addWidget(lbl)
        lay.addWidget(widget, 1)
        return w

    def _section(self, title: str) -> QLabel:
        lbl = QLabel(title.upper())
        lbl.setObjectName("sectionLabel")
        lbl.setStyleSheet(
            "font-size:10px;letter-spacing:.08em;color:#555;margin-top:8px;"
        )
        return lbl

    # ── Model tab ─────────────────────────────────────────────────────────────
    def _build_model_tab(self) -> QWidget:
        page = QWidget()
        lay  = QVBoxLayout(page)
        lay.setContentsMargins(20, 16, 20, 20)
        lay.setSpacing(10)
        lay.addWidget(self._section("AI Provider"))

        grid_w  = QWidget()
        grid_lay = QHBoxLayout(grid_w)
        grid_lay.setContentsMargins(0, 0, 0, 0)
        grid_lay.setSpacing(8)
        self._pcards: dict[str, ProviderCard] = {}
        for p in PROVIDERS:
            c = ProviderCard(p, PROVIDER_COLORS[p])
            c.clicked.connect(self._on_provider)
            self._pcards[p] = c
            grid_lay.addWidget(c)
        grid_lay.addStretch()
        lay.addWidget(grid_w)

        lay.addWidget(self._section("Model"))
        self._model_combo = QComboBox()
        lay.addWidget(self._row("Model", self._model_combo))

        self._api_key_edit = QLineEdit()
        self._api_key_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self._api_key_edit.setPlaceholderText("sk-…")
        lay.addWidget(self._row("API key", self._api_key_edit))

        self._base_url_edit = QLineEdit()
        self._base_url_edit.setPlaceholderText("http://localhost:11434")
        self._base_url_row = self._row("Base URL", self._base_url_edit)
        lay.addWidget(self._base_url_row)

        lay.addWidget(self._section("Inference"))
        self._thinking_toggle = ToggleSwitch(self._cfg.get("show_thinking", True))
        tr = QWidget()
        tl = QHBoxLayout(tr)
        tl.setContentsMargins(0, 0, 0, 0)
        tl.addWidget(self._thinking_toggle)
        tl_lbl = QLabel("Show thinking / reasoning tokens")
        tl_lbl.setStyleSheet("color:#777;")
        tl.addWidget(tl_lbl)
        tl.addStretch()
        lay.addWidget(tr)

        save = QPushButton("Save model settings")
        save.setObjectName("accentBtn")
        save.clicked.connect(self._save_model)
        lay.addWidget(save)
        lay.addStretch()

        self._load_provider(self._cfg.get("provider", "anthropic"))
        self._api_key_edit.setText(self._cfg.get("api_key", ""))
        self._base_url_edit.setText(self._cfg.get("base_url", ""))
        return page

    def _on_provider(self, name: str):
        self._load_provider(name)
        # Fix #10: persist provider change immediately so it survives without explicit Save
        self._cfg["provider"] = name
        save_config(self._cfg)

    def _load_provider(self, name: str):
        for p, c in self._pcards.items():
            c.set_active(p == name)
        models = PROVIDER_MODELS.get(name, [])
        self._model_combo.clear()
        self._model_combo.addItems(models)
        saved = self._cfg.get("model", "")
        if saved in models:
            self._model_combo.setCurrentText(saved)
        needs_url = name in ("ollama", "custom")
        self._base_url_row.setVisible(needs_url)
        if name == "ollama":
            self._base_url_edit.setPlaceholderText("http://localhost:11434")
        self._cfg["provider"] = name

    def _save_model(self):
        self._cfg["model"]         = self._model_combo.currentText()
        self._cfg["api_key"]       = self._api_key_edit.text().strip()
        self._cfg["base_url"]      = self._base_url_edit.text().strip()
        self._cfg["show_thinking"] = self._thinking_toggle.isChecked()
        save_config(self._cfg)
        self.settings_changed.emit(self._cfg)

    # ── Server tab ────────────────────────────────────────────────────────────
    def _build_server_tab(self) -> QWidget:
        page = QWidget()
        lay  = QVBoxLayout(page)
        lay.setContentsMargins(20, 16, 20, 20)
        lay.setSpacing(10)
        lay.addWidget(self._section("MCP Server"))

        card = QFrame()
        card.setObjectName("card")
        cl = QHBoxLayout(card)
        self._srv_dot = QLabel("●")
        self._srv_dot.setStyleSheet("color:#4cc97a;font-size:16px;")
        cl.addWidget(self._srv_dot)
        info = QVBoxLayout()
        self._srv_title = QLabel("Server running")
        self._srv_title.setStyleSheet("font-size:12px;color:#c0c0c0;")
        self._srv_sub   = QLabel("127.0.0.1:9877")
        self._srv_sub.setStyleSheet("font-size:10px;color:#555;font-family:ui-monospace,monospace;")
        info.addWidget(self._srv_title)
        info.addWidget(self._srv_sub)
        cl.addLayout(info, 1)
        self.srv_btn = QPushButton("Stop")
        self.srv_btn.setObjectName("accentBtn")
        self.srv_btn.setFixedWidth(60)
        self.srv_btn.clicked.connect(self.server_toggle_requested)
        cl.addWidget(self.srv_btn)
        lay.addWidget(card)

        self._host_edit = QLineEdit(self._cfg.get("host", "127.0.0.1"))
        lay.addWidget(self._row("Host", self._host_edit))

        self._port_spin = QSpinBox()
        self._port_spin.setRange(1024, 65535)
        self._port_spin.setValue(self._cfg.get("port", 9877))
        lay.addWidget(self._row("Port", self._port_spin))

        self._log_combo = QComboBox()
        self._log_combo.addItems(["INFO", "DEBUG", "WARNING", "ERROR"])
        self._log_combo.setCurrentText(self._cfg.get("log_level", "INFO"))
        lay.addWidget(self._row("Log level", self._log_combo))

        lay.addWidget(self._section("Remote Script"))
        rs = QFrame(); rs.setObjectName("card")
        rl = QHBoxLayout(rs)
        ri = QLabel("✓"); ri.setStyleSheet("color:#4cc97a;font-size:14px;")
        rv = QVBoxLayout()
        rv.addWidget(QLabel("Installed"))
        rp = QLabel(str(REMOTE_SCRIPT_DST))
        rp.setStyleSheet("color:#555;font-size:9px;font-family:ui-monospace,monospace;")
        rv.addWidget(rp)
        rl.addWidget(ri); rl.addLayout(rv, 1)
        lay.addWidget(rs)

        save = QPushButton("Save server settings")
        save.setObjectName("accentBtn")
        save.clicked.connect(self._save_server)
        lay.addWidget(save)
        lay.addStretch()
        return page

    def _save_server(self):
        # Get current config to compare
        old_cfg = load_config()
        old_host = old_cfg.get("host", "127.0.0.1")
        old_port = old_cfg.get("port", 9877)
        
        # Update config with new values
        self._cfg.update({
            "host":      self._host_edit.text().strip(),
            "port":      self._port_spin.value(),
            "log_level": self._log_combo.currentText(),
        })
        save_config(self._cfg)
        self.settings_changed.emit(self._cfg)
        
        # If server is running and host or port changed, restart it
        new_host = self._cfg["host"]
        new_port = self._cfg["port"]
        if (old_host != new_host or old_port != new_port) and self._win._server.is_running():
            # Server is running and host/port changed - restart it
            self._win._server.restart()

    def update_server_status(self, running: bool, pid: int | None = None):
        cfg = load_config()
        if running:
            self._srv_dot.setStyleSheet("color:#4cc97a;font-size:16px;")
            self._srv_title.setText("Server running")
            self._srv_sub.setText(
                f"{cfg['host']}:{cfg['port']}" + (f"  PID {pid}" if pid else "")
            )
            self.srv_btn.setText("Stop")
        else:
            self._srv_dot.setStyleSheet("color:#d84f4f;font-size:16px;")
            self._srv_title.setText("Server stopped")
            self._srv_sub.setText("click Start to restart")
            self.srv_btn.setText("Start")

    # ── App tab ───────────────────────────────────────────────────────────────
    def _build_app_tab(self) -> QWidget:
        page = QWidget()
        lay  = QVBoxLayout(page)
        lay.setContentsMargins(20, 16, 20, 20)
        lay.setSpacing(10)
        lay.addWidget(self._section("Startup"))

        self._login_toggle      = ToggleSwitch(self._cfg.get("launch_at_login", True))
        self._autostart_toggle  = ToggleSwitch(self._cfg.get("auto_start_server", True))
        self._showlaunch_toggle = ToggleSwitch(self._cfg.get("show_on_launch", False))

        lay.addWidget(self._row("Launch at login",       self._login_toggle))
        lay.addWidget(self._row("Auto-start server",     self._autostart_toggle))
        lay.addWidget(self._row("Show window on launch", self._showlaunch_toggle))

        lay.addWidget(self._section("Window"))
        theme_combo = QComboBox()
        theme_combo.addItems(["Dark", "Light", "System"])
        lay.addWidget(self._row("Theme", theme_combo))

        lay.addWidget(self._section("Data"))
        btn_row = QWidget()
        bl = QHBoxLayout(btn_row)
        bl.setContentsMargins(0, 0, 0, 0)
        bl.addWidget(QPushButton("Clear chat history"))
        bl.addWidget(QPushButton("Reset settings"))
        bl.addStretch()
        lay.addWidget(btn_row)

        save = QPushButton("Save app settings")
        save.setObjectName("accentBtn")
        save.clicked.connect(self._save_app)
        lay.addWidget(save)
        lay.addStretch()
        return page

    def _save_app(self):
        self._cfg.update({
            "launch_at_login":   self._login_toggle.isChecked(),
            "auto_start_server": self._autostart_toggle.isChecked(),
            "show_on_launch":    self._showlaunch_toggle.isChecked(),
        })
        save_config(self._cfg)
        if self._cfg["launch_at_login"]:
            enable_autolaunch()
        else:
            disable_autolaunch()
        self.settings_changed.emit(self._cfg)

# ─── Sidebar button ───────────────────────────────────────────────────────────

class SidebarBtn(QPushButton):
    def __init__(self, icon_char: str, tooltip: str, parent=None):
        super().__init__(icon_char, parent)
        self.setToolTip(tooltip)
        self.setFixedSize(48, 44)
        self.setFlat(True)
        self.set_active(False)

    def set_active(self, v: bool):
        self.setStyleSheet(
            f"font-size:18px;border-radius:8px;margin:2px;"
            f"{'color:#f5a623;background:#2a2a2a;' if v else 'color:#555;background:transparent;'}"
        )

# ─── Main window ─────────────────────────────────────────────────────────────

class MainWindow(QMainWindow):
    server_toggle_requested = Signal()

    def __init__(self, cmd_queue: CommandQueue, parent=None):
        super().__init__(parent)
        self._cmd_queue = cmd_queue
        self.setWindowTitle("AbletonQ")
        self.setMinimumSize(760, 540)
        self.resize(860, 600)
        self.setStyleSheet(DARK_QSS)
        self._cur_screen = 0
        self._build()

    def _build(self):
        root = QWidget()
        self.setCentralWidget(root)
        outer = QVBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        # title bar
        tb = QWidget()
        tb.setFixedHeight(38)
        tb.setStyleSheet("background:#242424;border-bottom:1px solid #111;")
        tl = QHBoxLayout(tb)
        tl.setContentsMargins(12, 0, 14, 0)
        title = QLabel("AbletonQ")
        title.setStyleSheet("color:#777;font-size:13px;font-weight:500;")
        self._tl_status = QLabel("● connected")
        self._tl_status.setStyleSheet("color:#4cc97a;font-size:10px;")
        tl.addWidget(title)
        tl.addStretch()
        tl.addWidget(self._tl_status)
        outer.addWidget(tb)

        body = QWidget()
        bl   = QHBoxLayout(body)
        bl.setContentsMargins(0, 0, 0, 0)
        bl.setSpacing(0)
        outer.addWidget(body, 1)

        # sidebar
        sidebar = QWidget()
        sidebar.setFixedWidth(52)
        sidebar.setStyleSheet("background:#1e1e1e;border-right:1px solid #111;")
        sb = QVBoxLayout(sidebar)
        sb.setContentsMargins(0, 8, 0, 8)
        sb.setSpacing(2)

        self._btn_chat     = SidebarBtn("💬", "Chat")
        self._btn_settings = SidebarBtn("⚙",  "Settings")
        self._btn_server   = SidebarBtn("◉",  "Toggle server")
        self._btn_server.setStyleSheet(
            "font-size:16px;border-radius:8px;margin:2px;color:#4cc97a;background:transparent;"
        )
        self._btn_chat.clicked.connect(lambda: self._show_screen(0))
        self._btn_settings.clicked.connect(lambda: self._show_screen(1))
        self._btn_server.clicked.connect(self.server_toggle_requested)
        sb.addWidget(self._btn_chat)
        sb.addWidget(self._btn_settings)
        sb.addStretch()
        sb.addWidget(self._btn_server)
        bl.addWidget(sidebar)

        # screens
        self._stack           = QStackedWidget()
        self.chat_screen      = ChatScreen(self._cmd_queue)
        self.settings_screen  = SettingsScreen()
        self.settings_screen.server_toggle_requested.connect(self.server_toggle_requested)
        self.settings_screen.settings_changed.connect(self._on_settings_changed)

        self._stack.addWidget(self.chat_screen)
        self._stack.addWidget(self.settings_screen)
        bl.addWidget(self._stack, 1)

        self._btn_chat.set_active(True)
        self.chat_screen.add_message(
            ChatMsg(MsgRole.SYSTEM, "AbletonQ ready. Use >> to chain commands.")
        )

    def _show_screen(self, idx: int):
        if idx == self._cur_screen: return
        self._cur_screen = idx
        self._btn_chat.set_active(idx == 0)
        self._btn_settings.set_active(idx == 1)

        old = self._stack.currentWidget()
        eff = QGraphicsOpacityEffect(old)
        old.setGraphicsEffect(eff)
        a1  = QPropertyAnimation(eff, b"opacity", self)
        a1.setDuration(130)
        a1.setStartValue(1.0); a1.setEndValue(0.0)
        a1.setEasingCurve(QEasingCurve.Type.InCubic)

        def _swap():
            old.setGraphicsEffect(None)
            self._stack.setCurrentIndex(idx)
            nw  = self._stack.currentWidget()
            ef2 = QGraphicsOpacityEffect(nw)
            nw.setGraphicsEffect(ef2)
            ef2.setOpacity(0.0)
            a2  = QPropertyAnimation(ef2, b"opacity", self)
            a2.setDuration(170)
            a2.setStartValue(0.0); a2.setEndValue(1.0)
            a2.setEasingCurve(QEasingCurve.Type.OutCubic)
            a2.finished.connect(lambda: nw.setGraphicsEffect(None))
            a2.start(QAbstractAnimation.DeletionPolicy.DeleteWhenStopped)

        a1.finished.connect(_swap)
        a1.start(QAbstractAnimation.DeletionPolicy.DeleteWhenStopped)

    def _on_settings_changed(self, cfg: dict):
        self.chat_screen.update_model_label(cfg.get("model", ""))

    def update_server_status(
        self, running: bool, reachable: bool, ableton: bool, pid: int | None = None
    ):
        if reachable:
            self._tl_status.setText("● connected")
            self._tl_status.setStyleSheet("color:#4cc97a;font-size:10px;")
        else:
            self._tl_status.setText("○ disconnected")
            self._tl_status.setStyleSheet("color:#d84f4f;font-size:10px;")
        self._btn_server.setStyleSheet(
            f"font-size:16px;border-radius:8px;margin:2px;"
            f"{'color:#4cc97a;' if running else 'color:#555;'}background:transparent;"
        )
        cfg = load_config()
        self.chat_screen.set_connection_status(reachable, cfg["port"])
        self.settings_screen.update_server_status(running, pid)

    def push_event(self, msg: ChatMsg):
        self.chat_screen.add_message(msg)

    def show_and_raise(self):
        self.show(); self.raise_(); self.activateWindow()

# ─── Auto-launch ─────────────────────────────────────────────────────────────

def _app_exe() -> str:
    return str(Path(sys.executable).resolve())

def autolaunch_enabled() -> bool:
    if sys.platform != "darwin":
        return False
    return LAUNCHAGENT_PLIST.exists()

def enable_autolaunch() -> None:
    # Fix #14: LaunchAgent is a macOS-only mechanism
    if sys.platform != "darwin":
        return
    LAUNCHAGENT_DIR.mkdir(parents=True, exist_ok=True)
    plist = {
        "Label":              "com.abletonq.server",
        "ProgramArguments":   [_app_exe(), "--headless"],
        "RunAtLoad":          True,
        "KeepAlive":          False,
        "StandardOutPath":    str(LOG_FILE),
        "StandardErrorPath":  str(LOG_FILE),
    }
    with open(LAUNCHAGENT_PLIST, "wb") as f:
        plistlib.dump(plist, f)
    subprocess.run(["launchctl", "load", str(LAUNCHAGENT_PLIST)], check=False)

def disable_autolaunch() -> None:
    if sys.platform != "darwin":
        return
    subprocess.run(["launchctl", "unload", str(LAUNCHAGENT_PLIST)], check=False)
    LAUNCHAGENT_PLIST.unlink(missing_ok=True)

# ─── Server manager ───────────────────────────────────────────────────────────

class ServerManager(QObject):
    status_changed = Signal(str)
    log_line       = Signal(str)   # emits lines for UI log viewer only (NOT written to file here)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._proc:  subprocess.Popen | None = None
        self._lock   = threading.Lock()   # guards _proc across GUI + tail thread

    @staticmethod
    def _server_exe() -> Path:
        c = Path(sys.executable).parent / "abletonq-server"
        if c.exists(): return c
        uv = shutil.which("uv")
        if uv: return Path(uv)
        py = shutil.which("python3") or shutil.which("python")
        if py: return Path(py)
        raise FileNotFoundError("No server binary found")

    def _build_cmd(self) -> list[str]:
        exe = self._server_exe()
        if exe.name == "abletonq-server": return [str(exe)]
        if exe.name == "uv": return [str(exe), "run", "ableton-mcp"]
        return [str(exe), "-m", "MCP_Server.server"]

    def install_remote_script(self) -> str:
        if not REMOTE_SCRIPT_SRC.exists():
            return "Remote Script not found in bundle"
        REMOTE_SCRIPT_DST.parent.mkdir(parents=True, exist_ok=True)
        if REMOTE_SCRIPT_DST.exists():
            shutil.rmtree(REMOTE_SCRIPT_DST)
        shutil.copytree(REMOTE_SCRIPT_SRC, REMOTE_SCRIPT_DST)
        return f"Remote Script installed → {REMOTE_SCRIPT_DST}"

    def start(self):
        with self._lock:
            if self._proc is not None and self._proc.poll() is None:
                return  # already running
        SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
        cfg = load_config()
        env = {
            **os.environ,
            "ABLETONQ_HOST":      cfg["host"],
            "ABLETONQ_PORT":      str(cfg["port"]),
            "ABLETONQ_LOG_LEVEL": cfg["log_level"],
        }
        try:
            proc = subprocess.Popen(
                self._build_cmd(),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
                text=True,
                bufsize=1,
                # Fix #2: put child in its own session so SIGTERM only hits it
                start_new_session=True,
            )
        except Exception as exc:
            self.status_changed.emit("error")
            self.log_line.emit(f"[AbletonQ] Failed to start: {exc}")
            return
        with self._lock:
            self._proc = proc
        self.status_changed.emit("running")
        self.log_line.emit(f"[AbletonQ] Server started (PID {proc.pid})")
        threading.Thread(target=self._tail, args=(proc,), daemon=True).start()

    def _tail(self, proc: subprocess.Popen):
        # Fix #17: write to log file here ONLY. log_line signal is for UI display only.
        # AbletonQApp._on_log_line no longer calls _log(), eliminating double-write.
        SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as lf:
            for line in proc.stdout:
                lf.write(line)
                lf.flush()
                # Signal is thread-safe in Qt; GUI thread receives it via queued connection
                self.log_line.emit(line.rstrip())
        code = proc.wait()
        entry = f"[AbletonQ] Server exited (code {code})\n"
        with open(LOG_FILE, "a", encoding="utf-8") as lf:
            lf.write(entry)
        self.log_line.emit(entry.rstrip())
        # Fix #3: mutate _proc under lock, then signal on GUI thread via singleShot
        with self._lock:
            if self._proc is proc:   # guard against a concurrent restart
                self._proc = None
        QTimer.singleShot(0, lambda: self.status_changed.emit("stopped"))

    def stop(self):
        with self._lock:
            proc = self._proc
            self._proc = None
        if proc is None:
            return
        # Fix #1: SIGTERM then wait (up to 5 s), fallback SIGKILL
        try:
            os.kill(proc.pid, signal.SIGTERM)   # targets the session leader only
        except ProcessLookupError:
            pass
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        self.status_changed.emit("stopped")

    def restart(self):
        self.stop()
        QTimer.singleShot(800, self.start)

    def is_running(self) -> bool:
        with self._lock:
            return self._proc is not None and self._proc.poll() is None

    def pid(self) -> int | None:
        with self._lock:
            return self._proc.pid if self._proc and self._proc.poll() is None else None

# ─── Status poller ────────────────────────────────────────────────────────────

class StatusPoller(QObject):
    server_reachable = Signal(bool)
    ableton_running  = Signal(bool)

    def __init__(self, parent=None):
        super().__init__(parent)
        t = QTimer(self)
        t.timeout.connect(self._poll)
        t.start(2000)
        self._poll()

    @Slot()
    def _poll(self):
        cfg = load_config()
        try:
            with socket.create_connection((cfg["host"], cfg["port"]), timeout=0.5):
                self.server_reachable.emit(True)
        except OSError:
            self.server_reachable.emit(False)

        # Fix #12: portable Ableton detection — works on macOS and Windows
        ableton_found = False
        if sys.platform == "darwin":
            # macOS: Ableton Live process is named "Live"
            try:
                out = subprocess.check_output(
                    ["pgrep", "-x", "Live"], text=True, stderr=subprocess.DEVNULL
                )
                ableton_found = bool(out.strip())
            except (subprocess.CalledProcessError, FileNotFoundError):
                ableton_found = False
        elif sys.platform == "win32":
            try:
                out = subprocess.check_output(
                    ["tasklist", "/FI", "IMAGENAME eq Ableton Live*.exe", "/NH"],
                    text=True, stderr=subprocess.DEVNULL,
                )
                ableton_found = "Ableton Live" in out
            except (subprocess.CalledProcessError, FileNotFoundError):
                ableton_found = False
        self.ableton_running.emit(ableton_found)

# ─── Tray icon ────────────────────────────────────────────────────────────────

def _make_icon(server_ok: bool, ableton_ok: bool) -> QIcon:
    size = 22
    px   = QPixmap(size, size)
    px.fill(QColor(0, 0, 0, 0))
    p = QPainter(px)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    p.setPen(QColor(255, 255, 255, 200))
    f = p.font(); f.setPixelSize(16); f.setBold(True)
    p.setFont(f)
    p.drawText(0, 0, size - 2, size, 0, "Q")
    dot = (QColor(80, 200, 100) if (server_ok and ableton_ok)
           else QColor(240, 160, 40) if server_ok
           else QColor(210, 70, 70))
    p.setPen(Qt.PenStyle.NoPen); p.setBrush(dot)
    p.drawEllipse(size - 6, size - 6, 5, 5)
    p.end()
    return QIcon(px)


def _make_icon_starting() -> QIcon:
    """Amber dot — server process running, TCP not yet open."""
    size = 22
    px   = QPixmap(size, size)
    px.fill(QColor(0, 0, 0, 0))
    p = QPainter(px)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    p.setPen(QColor(255, 255, 255, 200))
    f = p.font(); f.setPixelSize(16); f.setBold(True)
    p.setFont(f)
    p.drawText(0, 0, size - 2, size, 0, "Q")
    p.setPen(Qt.PenStyle.NoPen)
    p.setBrush(QColor(240, 160, 40))
    p.drawEllipse(size - 6, size - 6, 5, 5)
    p.end()
    return QIcon(px)

# ─── Application ─────────────────────────────────────────────────────────────

class AbletonQApp(QApplication):
    def __init__(self, argv: list[str]) -> None:
        super().__init__(argv)
        self.setQuitOnLastWindowClosed(False)

        self._server    = ServerManager(self)
        self._poller    = StatusPoller(self)
        self._cmd_queue = CommandQueue(self)

        self._srv_reachable = False
        self._abl_running   = False
        self._srv_running   = False

        self._win = MainWindow(self._cmd_queue)
        self._win.server_toggle_requested.connect(self._toggle_server)

        self._tray = QSystemTrayIcon(self)
        self._tray.setIcon(_make_icon(False, False))
        self._tray.setToolTip("AbletonQ")
        self._tray.activated.connect(self._on_tray_activated)
        self._build_tray_menu()
        self._tray.show()

        self._server.status_changed.connect(self._on_server_status)
        self._server.log_line.connect(self._on_log_line)
        self._poller.server_reachable.connect(self._on_reachable)
        self._poller.ableton_running.connect(self._on_ableton)

        msg = self._server.install_remote_script()
        self._log(msg)

        cfg = load_config()
        if cfg.get("auto_start_server", True):
            self._server.start()
        if cfg.get("show_on_launch", False):
            self._win.show()

    def _build_tray_menu(self):
        menu = QMenu()

        self._act_srv = QAction("● Server: starting…")
        self._act_srv.setEnabled(False)
        menu.addAction(self._act_srv)

        self._act_abl = QAction("● Ableton: checking…")
        self._act_abl.setEnabled(False)
        menu.addAction(self._act_abl)

        menu.addSeparator()

        act_show = QAction("Show Q")
        act_show.triggered.connect(self._show_window)
        f = act_show.font(); f.setBold(True); act_show.setFont(f)
        menu.addAction(act_show)

        menu.addSeparator()

        self._act_toggle = QAction("Stop Server")
        self._act_toggle.triggered.connect(self._toggle_server)
        menu.addAction(self._act_toggle)

        act_restart = QAction("Restart Server")
        act_restart.triggered.connect(self._server.restart)
        menu.addAction(act_restart)

        menu.addSeparator()

        self._act_autolaunch = QAction("Launch at Login")
        self._act_autolaunch.setCheckable(True)
        self._act_autolaunch.setChecked(autolaunch_enabled())
        self._act_autolaunch.toggled.connect(
            lambda v: enable_autolaunch() if v else disable_autolaunch()
        )
        menu.addAction(self._act_autolaunch)

        menu.addSeparator()

        act_log = QAction("Show Log…")
        act_log.triggered.connect(self._show_log)
        menu.addAction(act_log)

        act_cfg = QAction("Settings…")
        act_cfg.triggered.connect(self._show_settings)
        menu.addAction(act_cfg)

        menu.addSeparator()

        act_quit = QAction("Quit AbletonQ")
        act_quit.triggered.connect(self._quit)
        menu.addAction(act_quit)

        self._tray.setContextMenu(menu)

    @Slot()
    def _show_window(self):
        self._win.show_and_raise()

    @Slot()
    def _show_settings(self):
        self._win.show_and_raise()
        self._win._show_screen(1)

    @Slot()
    def _show_log(self):
        SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
        if sys.platform == "darwin":
            subprocess.run(["open", "-a", "Console", str(LOG_FILE)], check=False)
        elif sys.platform == "win32":
            os.startfile(str(LOG_FILE))
        else:
            subprocess.run(["xdg-open", str(LOG_FILE)], check=False)

    @Slot(str)
    def _on_server_status(self, status: str):
        self._srv_running = status == "running"
        self._act_toggle.setText("Stop Server" if self._srv_running else "Start Server")
        cfg = load_config()
        self._act_srv.setText(
            f"● Server: {status}  ({cfg['host']}:{cfg['port']})"
        )
        self._win.update_server_status(
            self._srv_running, self._srv_reachable, self._abl_running, self._server.pid()
        )
        self._update_icon()

    @Slot(str)
    def _on_log_line(self, line: str):
        # Fix #17: _tail() already writes to LOG_FILE directly.
        # This slot is UI-only — do NOT call self._log(line) here.
        pass  # future: forward to an in-app log viewer widget

    @Slot(bool)
    def _on_reachable(self, ok: bool):
        self._srv_reachable = ok
        cfg = load_config()
        self._act_srv.setText(
            f"● Server: {'reachable' if ok else 'unreachable'}  ({cfg['host']}:{cfg['port']})"
        )
        self._win.update_server_status(
            self._srv_running, ok, self._abl_running, self._server.pid()
        )
        self._update_icon()

    @Slot(bool)
    def _on_ableton(self, ok: bool):
        self._abl_running = ok
        self._act_abl.setText(f"● Ableton: {'running' if ok else 'not detected'}")
        self._update_icon()

    def _update_icon(self):
        # Fix #15: show amber while server process is running but not yet reachable
        # (e.g. still starting up). Only green when both process + TCP check pass.
        if self._srv_running and self._srv_reachable and self._abl_running:
            self._tray.setIcon(_make_icon(True, True))
        elif self._srv_running and self._srv_reachable:
            self._tray.setIcon(_make_icon(True, False))
        elif self._srv_running:
            # Process running but TCP not yet open — show amber dot
            self._tray.setIcon(_make_icon_starting())
        else:
            self._tray.setIcon(_make_icon(False, False))

    @Slot()
    def _toggle_server(self):
        if self._server.is_running(): self._server.stop()
        else: self._server.start()

    @Slot(QSystemTrayIcon.ActivationReason)
    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.Trigger:
            self._show_window()

    @Slot()
    def _quit(self):
        self._server.stop()
        self.quit()

    def _log(self, msg: str):
        SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a") as f:
            f.write(msg + "\n")

# ─── Entry point ─────────────────────────────────────────────────────────────

def main() -> None:
    if "--headless" in sys.argv:
        mgr = ServerManager()
        SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a") as f:
            f.write(mgr.install_remote_script() + "\n")
        mgr.start()
        try:
            while mgr.is_running():
                time.sleep(1)
        except KeyboardInterrupt:
            mgr.stop()
        return

    app = AbletonQApp(sys.argv)
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
