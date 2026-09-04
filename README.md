# JARVIS — Just A Rather Very Intelligent System

**Edge AI Orchestrator** — a cinematic desktop command center for an autonomous AI agent
controlling a fleet of ESP32 microcontrollers through federated learning. Built as a
distributed system: a standalone intelligence **Core** serves the desktop client and a
Telegram bot over WebSocket/REST, with real-world tools, memory, and autonomy.

Built for ISEF Regeneron, the MIT Maker Portfolio, and the research paper
*A Federated TinyML Framework for Decentralized Edge Intelligence on ESP32 Devices*.

---

## Architecture

```
                        ┌────────────────────────────────────────────┐
                        │              JARVIS CORE                   │
                        │            (jarvis-core/)                  │
   Telegram ───────┐    │                                            │
   (telegram-bot/) │    │  AgentRuntime  ── DeepSeek (the Brain)     │
                   │    │        │                                   │
                   │    │  ToolRegistry  (the Hands)                 │
   Desktop UI ─────┤ WS │   ├ control_esp32      ├ execute_python    │
   (Electron +     │    │   ├ initiate_training  ├ send_telegram_msg │
    Next.js) ──────┴──► │   ├ query_federation   ├ self_reflect      │
                        │        │                                   │
                        │  ESP32 Gateway ── WS :8765 ──► ESP32 fleet │
                        │  FederationManager (FedAvg)               │
                        │  MemoryStore (vector recall)              │
                        │  Research Database (SQLite/WASM)          │
                        │  Autonomy: scheduler · monitor ·          │
                        │            self-improvement               │
                        └────────────────────────────────────────────┘
                                     │  WS :8767 + REST :8080
                                     ▼
                        Electron client · Telegram bot · future web
```

**Loose coupling:** the Brain (LLM), the Senses (voice + UI), and the Body (ESP32 fleet)
are separate services that only talk over the typed wire protocol.

## Repository layout

| Path | Role |
|------|------|
| `jarvis-core/` | The standalone "brain" service. Agent runtime, tools, ESP32 gateway, federated learning, memory, research DB, WebSocket + REST servers, autonomy loops. |
| `electron/` | The desktop client (main + preload). Thin shell that connects to the Core over WebSocket and renders the cinematic UI. |
| `app/`, `components/`, `lib/` | The "New Era" Next.js renderer: Three.js neural swarm, glass-morphism panels, Framer Motion, voice pipeline. |
| `telegram-bot/` | A second client — talk to the same agent from your phone. |
| `docs/` | Architecture, ISEF, MIT and research documentation. |
| `developer-journal/` | Portfolio artifacts (build logs, notes, media). |

## Run it as an application

The fastest way is to treat JARVIS like any other app — no terminals needed:

1. **Build once** (or use the ready-made installer):
   ```bash
   npm install
   npm --prefix jarvis-core install
   npm approve-scripts electron     # allow the Electron binary download
   npm run build
   ```
2. **Open it** — one of:
   - Double-click **`JARVIS.cmd`** at the project root, **or**
   - Build a real installer and install it:
     ```bash
     npm run dist:win
     # → release/JARVIS-Setup-1.0.0.exe  (creates a desktop + Start Menu icon)
     ```

The app **auto-starts the JARVIS Core in the background** when it opens and shuts it down
when you close it — a true one-click experience. (Set `JARVIS_EXTERNAL_CORE=1` in `.env`
if you prefer to run the Core yourself, e.g. on a server.)

## Developer mode

```bash
# 1. Install dependencies (each package installs its own)
npm install                      # desktop client
npm --prefix jarvis-core install # core
npm --prefix telegram-bot install# telegram bot
npm approve-scripts electron     # allow the Electron binary download

# 2. Configure (copy the .env.example files and fill in secrets)
#    jarvis-core/.env   → DEEPSEEK_API_KEY (optional; demo mode without it)
#    telegram-bot/.env  → TELEGRAM_BOT_TOKEN (optional)

# 3. Terminal 1 — start the Core
npm run core:dev

# 4. Terminal 2 — start the desktop client
npm run dev

# 5. Terminal 3 — start the Telegram bot (optional)
npm run bot:dev
```

Or run everything at once with `npm run dev:all` (Core + desktop + bot).

**Demo mode:** with no `DEEPSEEK_API_KEY` the Core's demo responder runs the *real* tool
pipeline (federated training init, fleet queries) with scripted replies, so the entire
distributed system is demonstrable end to end without a key or hardware.

## The Agent's tools

| Tool | What it does |
|------|--------------|
| `control_esp32(node_id, command)` | Ping / deploy model / execute action / start-stop training on a node or the fleet |
| `query_federated_learning_status()` | Live FedAvg round, accuracy, loss, participants |
| `initiate_training(algorithm, rounds)` | Starts federated training across the ESP32 network |
| `get_system_status()` | Core health: uptime, nodes, clients, CPU/memory |
| `query_research_database(query)` | Rounds history, stats, or full research export |
| `execute_python(script_path)` | Run a Python script on this machine (sandboxed to `jarvis-core/scripts/`) |
| `list_files(path)` | List files and folders in the Core workspace (`workspace/`) |
| `read_file(path)` | Read a text file from the workspace (max 200 KB) |
| `write_file(path, content)` | Write a file to the workspace (creates folders) |
| `send_telegram_message(chat_id, text)` | Notify Telegram through the connected bot |
| `self_reflect()` | Review interactions and emit optimization suggestions |

Tools are loaded from `jarvis-core/src/tools/` — add a file, register it in
`tools/index.ts`, and every client instantly sees the new capability.

## Autonomy

- **Scheduler** (`node-cron`): hourly proactive fleet check + nightly self-reflection.
- **Proactive monitor**: checks ESP32 nodes, federation state and pending work, then
  pushes an alert to every client and a report to Telegram.
- **Self-improvement loop**: turns telemetry into concrete suggestions stored in memory.

## Memory

`MemoryStore` keeps facts, preferences, conversation summaries and suggestions in
`data/jarvis/memory.json` with a dependency-free hashing embedding. Semantic recall
(`memory.search`) injects the most relevant memories into every agent turn, so JARVIS
remembers across sessions and across clients.

## Research data

Everything is logged to the SQLite research database (`data/jarvis/research.db`) and the
JSONL audit log. Export the full dataset from the running Core:

```
GET http://127.0.0.1:8080/research/export
```

## Ports

| Port | Purpose |
|------|---------|
| `8765` | ESP32 boards connect to the Core gateway |
| `8767` | Clients (Electron, Telegram, web) connect to the Core |
| `8080` | Core REST API (health, nodes, export) |
| `3000` | Next.js dev server (renderer) |

## Global access (web UI + local hardware control)

### Always-on local agent

The web UI can only control the local machine while a JARVIS Core is running. To keep the Core available after logout, while Windows is locked, and after a reboot, run PowerShell as Administrator once:

```powershell
npm --prefix jarvis-core run build
powershell -ExecutionPolicy Bypass -File .\scripts\install-global-agent.ps1
```

This installs a Windows Scheduled Task that starts the Core at boot independently of Electron. It also starts `cloudflared` when it is installed. Use `scripts\remove-global-agent.ps1` to remove the task.

Sleep and power-off are hardware states. A sleeping machine must either stay awake or support Wake-on-LAN; a powered-off machine cannot execute commands until it boots. For a permanent public address, use a named Cloudflare Tunnel or VPN rather than a quick tunnel, whose URL changes and has no uptime guarantee.

The same cinematic UI you get in the desktop app runs as a static web app. It talks
straight to your local Core over WebSocket, so you get the perks of both: reach JARVIS
from anywhere in the world **and** keep full control of your PC — files, folders and
any machine action the tools can run.

**The plan**

1. **Deploy the UI** to Vercel (static export, no server needed):
   ```bash
   npm run build
   npx vercel --prod
   ```
   The export lands in `dist/renderer` (`vercel.json` already points there).

2. **Expose your local Core** with a tunnel. Any works — example with ngrok:
   ```bash
   # in F:\jarvis\jarvis-core\.env, set a secret token:
   JARVIS_ACCESS_TOKEN=<a-long-random-secret>

   # start the Core, then tunnel the client port:
   npm run core:dev
   ngrok http 8767
   ```
   Copy the `wss://...` forwarding URL ngrok gives you.

3. **Open the web app pointed at your Core:**
   ```
   https://<your-app>.vercel.app/?core=wss://<ngrok-host>&token=<JARVIS_ACCESS_TOKEN>
   ```

That's it. The web UI is the exact same agent console, fleet, memory and tools as the
desktop app — just served from anywhere.

**Security (important)**

- Always set `JARVIS_ACCESS_TOKEN` before exposing the Core to the internet. When set,
  the Core rejects every WebSocket hello and REST call that does not carry the token.
  Your desktop app and Telegram bot pick the token up from the same environment
  variable automatically, so local clients keep working unchanged.
- The WebSocket and REST ports both enforce the token, but you should still treat the
tunnel as a power switch: shut it down when you are not using JARVIS remotely.
- All file, python and command tools are sandboxed to their allowed directories by the
  Core; keep the Core running on your own machine so actions execute there, not in the
  cloud.

## Troubleshooting

- **npm SSL / ECONNRESET errors during install:** retry the install. If a specific
  package keeps failing, write its name to a text file and run the install again —
  npm retries the cached metadata and usually succeeds.
- **Electron won't launch:** run `npm approve-scripts electron` and verify
  `node_modules/electron/dist/electron.exe` exists.
- **"Core Offline" in the UI:** start the Core first (`npm run core:dev`); the client
  auto-reconnects every 3s.
- **EADDRINUSE:** another process holds a port — check `netstat -ano | findstr "<port>"`.

## Documentation

- `docs/ARCHITECTURE.md` — the enterprise design in depth.
- `docs/RESEARCH.md` — the paper outline and data pipeline.
- `docs/ISEF.md` — ISEF Regeneron framing.
- `docs/MIT_PORTFOLIO.md` — MIT Maker Portfolio narrative.
- `docs/ESP32_FIRMWARE.md` — firmware + wiring for the microcontroller side.
