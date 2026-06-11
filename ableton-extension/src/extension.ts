import { initialize, type ActivationContext } from "@ableton-extensions/sdk";
import net from "node:net";
import { execFile } from "node:child_process";

import panelHtml from "./panel.html";

const MCP_HOST = "127.0.0.1";
const MCP_PORT = 9877;

const WIN_W           = 420;
const WIN_H_COLLAPSED = 96;
const WIN_H_EXPANDED  = 378;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MCPRequest {
  id: string;
  type: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  id?: string;
  status: "ok" | "error";
  result?: unknown;
  message?: string;
  // push events carry no id — they are unsolicited server→client frames
  event?: string;
  data?: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "event";
  text: string;
  ts: number;
}

interface PanelEnvelope {
  action: "send" | "connect" | "disconnect" | "noop";
  payload?: string;
  chatVisible?: boolean;
}

type ToastType = "success" | "error" | "info" | "warning";
interface ToastOnLoad { text: string; type: ToastType; }

// ─── All known MCP commands (for command palette) ─────────────────────────────

export const MCP_COMMANDS = [
  { type: "get_session_info",    label: "Get Session Info",      params: [] },
  { type: "get_tracks",          label: "Get Tracks",            params: [] },
  { type: "get_tempo",           label: "Get Tempo",             params: [] },
  { type: "set_tempo",           label: "Set Tempo",             params: [{ name: "tempo", type: "number", ex: 120 }] },
  { type: "start_playback",      label: "Start Playback",        params: [] },
  { type: "stop_playback",       label: "Stop Playback",         params: [] },
  { type: "undo",                label: "Undo",                  params: [] },
  { type: "redo",                label: "Redo",                  params: [] },
  { type: "create_midi_track",   label: "Create MIDI Track",     params: [{ name: "index", type: "number", ex: -1 }] },
  { type: "create_audio_track",  label: "Create Audio Track",    params: [{ name: "index", type: "number", ex: -1 }] },
  { type: "create_return_track", label: "Create Return Track",   params: [] },
  { type: "delete_track",        label: "Delete Track",          params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "set_track_name",      label: "Set Track Name",        params: [{ name: "track_index", type: "number", ex: 0 }, { name: "name", type: "string", ex: "Bass" }] },
  { type: "set_track_volume",    label: "Set Track Volume",      params: [{ name: "track_index", type: "number", ex: 0 }, { name: "volume", type: "number", ex: 0.85 }] },
  { type: "set_track_pan",       label: "Set Track Pan",         params: [{ name: "track_index", type: "number", ex: 0 }, { name: "pan", type: "number", ex: 0.0 }] },
  { type: "mute_track",          label: "Mute Track",            params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "unmute_track",        label: "Unmute Track",          params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "solo_track",          label: "Solo Track",            params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "arm_track",           label: "Arm Track",             params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "create_clip",         label: "Create Clip",           params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }, { name: "length", type: "number", ex: 4 }] },
  { type: "delete_clip",         label: "Delete Clip",           params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "fire_clip",           label: "Fire Clip",             params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "stop_clip",           label: "Stop Clip",             params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "get_clip_notes",      label: "Get Clip Notes",        params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "add_notes_to_clip",   label: "Add Notes to Clip",     params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }, { name: "notes", type: "array", ex: [] }] },
  { type: "set_clip_name",       label: "Set Clip Name",         params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }, { name: "name", type: "string", ex: "Intro" }] },
  { type: "load_instrument",     label: "Load Instrument",       params: [{ name: "track_index", type: "number", ex: 0 }, { name: "uri", type: "string", ex: "" }] },
  { type: "get_device_params",   label: "Get Device Params",     params: [{ name: "track_index", type: "number", ex: 0 }, { name: "device_index", type: "number", ex: 0 }] },
  { type: "set_device_param",    label: "Set Device Param",      params: [{ name: "track_index", type: "number", ex: 0 }, { name: "device_index", type: "number", ex: 0 }, { name: "param_index", type: "number", ex: 0 }, { name: "value", type: "number", ex: 0.5 }] },
] as const;

// ─── Socket with push-event support ──────────────────────────────────────────

class AbletonSocket {
  private socket: net.Socket | null = null;
  private buffer = "";
  private pending = new Map<string, {
    resolve: (v: MCPResponse) => void;
    reject:  (e: Error) => void;
  }>();

  onStatusChange?: (connected: boolean) => void;
  onError?:        (msg: string) => void;
  onEvent?:        (event: string, data: unknown) => void;   // ← push events

  // ── Auto-reconnect state ──────────────────────────────────────────────────
  private _wantConnected   = false;
  private _retryTimer:     ReturnType<typeof setTimeout> | null = null;
  private _retryDelay      = 1000;   // ms, doubles on each failure
  private _maxRetryDelay   = 30_000;

  connect() {
    this._wantConnected = true;
    this._retryDelay = 1000;
    this._tryConnect();
  }

  private _tryConnect() {
    if (this.socket || !this._wantConnected) return;

    const sock = new net.Socket();
    sock.setEncoding("utf8");

    sock.on("connect", () => {
      this.socket = sock;
      this._retryDelay = 1000;  // reset backoff on success
      this.onStatusChange?.(true);
    });

    sock.on("data", (chunk: string) => {
      this.buffer += chunk;
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg: MCPResponse = JSON.parse(line);
          if (msg.id) {
            // response to a request we sent
            const p = this.pending.get(msg.id);
            if (p) { this.pending.delete(msg.id); p.resolve(msg); }
          } else if (msg.event) {
            // unsolicited push event from the Remote Script
            this.onEvent?.(msg.event, msg.data);
          }
        } catch { /* skip malformed */ }
      }
    });

    sock.on("close", () => {
      this.socket = null;
      for (const p of this.pending.values()) p.reject(new Error("Socket closed"));
      this.pending.clear();
      this.onStatusChange?.(false);

      if (this._wantConnected) {
        // schedule auto-reconnect with exponential backoff
        this._retryTimer = setTimeout(() => {
          this._retryDelay = Math.min(this._retryDelay * 2, this._maxRetryDelay);
          this._tryConnect();
        }, this._retryDelay);
      }
    });

    sock.on("error", (err) => {
      this.onError?.(err.message);
      // error fires before close, so close handler will schedule retry
    });

    sock.connect(MCP_PORT, MCP_HOST);
  }

  disconnect() {
    this._wantConnected = false;
    if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null; }
    this.socket?.destroy();
    this.socket = null;
  }

  isConnected() {
    return this.socket !== null && !this.socket.destroyed;
  }

  send(req: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error("Not connected"));
        return;
      }
      this.pending.set(req.id, { resolve, reject });
      this.socket.write(JSON.stringify(req) + "\n");
      setTimeout(() => {
        if (this.pending.has(req.id)) {
          this.pending.delete(req.id);
          reject(new Error("Request timed out"));
        }
      }, 10_000);
    });
  }
}

// ─── Launch AbletonQ.app (or Terminal fallback) ─────────────────────────────

function launchMcpApp() {
  const possiblePaths = [
    "/Applications/AbletonQ.app",
    `${process.env.HOME}/Applications/AbletonQ.app`
  ];

  let tried = 0;
  function tryOpen(path: string) {
    execFile("open", [path], (err) => {
      if (!err) {
        return; // success
      }
      tried++;
      if (tried === possiblePaths.length) {
        // All paths failed, fall back to uvx
        const script = `tell application "Terminal"
          activate
          do script "uvx ableton-q"
        end tell`;
        execFile("osascript", ["-e", script], (err2) => {
          if (err2) console.error("[abletonq] launch fallback failed:", err2.message);
        });
      } else {
        tryOpen(possiblePaths[tried]);
      }
    });
  }

  if (possiblePaths.length > 0) {
    tryOpen(possiblePaths[0]);
  } else {
    // Fallback immediately
    const script = `tell application "Terminal"
      activate
      do script "uvx ableton-q"
    end tell`;
    execFile("osascript", ["-e", script], (err2) => {
      if (err2) console.error("[abletonq] launch fallback failed:", err2.message);
    });
  }
}

// ─── Build panel HTML ─────────────────────────────────────────────────────────

function buildPanelHtml(
  messages:    ChatMessage[],
  connected:   boolean,
  chatVisible: boolean,
  commands:    typeof MCP_COMMANDS,
  toastOnLoad?: ToastOnLoad,
): string {
  const state = encodeURIComponent(JSON.stringify({
    messages, connected, chatVisible,
    commands: commands.map(c => ({
      type:   c.type,
      label:  c.label,
      params: c.params,
    })),
  }));
  let html = panelHtml.replace(
    /data-initial-state="[^"]*"/,
    `data-initial-state="${state}"`
  );
  if (toastOnLoad) {
    const inj = `<script>window.__toastOnLoad=${JSON.stringify(toastOnLoad)};<\/script>`;
    html = html.replace("</head>", inj + "\n</head>");
  }
  return html;
}

// ─── Extension entry ──────────────────────────────────────────────────────────

export function activate(activation: ActivationContext) {
  const ctx  = initialize(activation, "1.0.0");
  const sock = new AbletonSocket();
  const messages: ChatMessage[] = [];
  let reqCounter  = 0;
  let dialogOpen  = false;
  let chatVisible = false;

  function nextId()  { return `req-${++reqCounter}`; }
  function pushMsg(m: ChatMessage) { messages.push(m); }

  // ── Open / reopen panel ────────────────────────────────────────────────────
  async function openPanel(toastOnLoad?: ToastOnLoad) {
    if (dialogOpen) return;
    dialogOpen = true;

    const html = buildPanelHtml(
      messages, sock.isConnected(), chatVisible, MCP_COMMANDS, toastOnLoad
    );
    const h = chatVisible ? WIN_H_EXPANDED : WIN_H_COLLAPSED;

    let raw: string;
    try {
      raw = await ctx.ui.showModalDialog(
        `data:text/html,${encodeURIComponent(html)}`,
        WIN_W, h,
      );
    } catch {
      dialogOpen = false;
      return;
    }
    dialogOpen = false;

    let env: PanelEnvelope;
    try { env = JSON.parse(raw); } catch { return; }

    if (typeof env.chatVisible === "boolean") chatVisible = env.chatVisible;

    // ── Handle action ──────────────────────────────────────────────────────
    if (env.action === "connect") {
      if (!sock.isConnected()) {
        launchMcpApp();
        setTimeout(() => sock.connect(), 1500);
      }

    } else if (env.action === "disconnect") {
      sock.disconnect();

    } else if (env.action === "send" && env.payload?.trim()) {
      const userText = env.payload.trim();
      pushMsg({ role: "user", text: userText, ts: Date.now() });

      let req: MCPRequest;
      try {
        const p = JSON.parse(userText) as { type?: string; params?: Record<string, unknown> };
        req = { id: nextId(), type: p.type ?? "raw", params: p.params };
      } catch {
        req = { id: nextId(), type: "get_session_info" };
      }

      let toastAfter: ToastOnLoad;
      try {
        const resp = await sock.send(req);
        const text = resp.status === "ok"
          ? JSON.stringify(resp.result, null, 2)
          : `Error: ${resp.message}`;
        pushMsg({ role: "assistant", text, ts: Date.now() });
        toastAfter = resp.status === "ok"
          ? { text: "OK", type: "success" }
          : { text: resp.message ?? "Error", type: "error" };
      } catch (err) {
        const msg = (err as Error).message;
        pushMsg({ role: "assistant", text: `Failed: ${msg}`, ts: Date.now() });
        toastAfter = { text: msg, type: "error" };
      }
      openPanel(toastAfter);

    } else if (env.action === "noop") {
      // panel closed without action (e.g. palette dismissed) — just reopen
      openPanel();
    }
  }

  // ── Socket callbacks ───────────────────────────────────────────────────────
  sock.onStatusChange = (connected) => {
    const toast: ToastOnLoad = connected
      ? { text: `Connected :${MCP_PORT}`, type: "success" }
      : { text: "Disconnected — retrying…", type: "warning" };
    pushMsg({
      role: "system",
      text: connected
        ? `Connected to Ableton on ${MCP_HOST}:${MCP_PORT}`
        : "Disconnected — auto-reconnecting…",
      ts: Date.now(),
    });
    if (!dialogOpen) openPanel(toast);
  };

  sock.onError = (msg) => {
    console.error("[abletonq] socket error:", msg);
  };

  // ── Push events from Remote Script ────────────────────────────────────────
  sock.onEvent = (event, data) => {
    const text = `⚡ ${event}${data ? "\n" + JSON.stringify(data, null, 2) : ""}`;
    pushMsg({ role: "event", text, ts: Date.now() });
    // if panel is closed, reopen it to surface the event
    if (!dialogOpen) openPanel({ text: event, type: "info" });
  };

  // ── Register command + context-menu ───────────────────────────────────────
  ctx.commands.registerCommand("abletonQ.openPanel", () => openPanel());
  ctx.ui.registerContextMenuAction("ClipSlot", "Open AbletonQ", "abletonQ.openPanel");

  console.log("[abletonq] activated");
}
