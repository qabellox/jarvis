# JARVIS — Enterprise Architecture

## Design principles

1. **One brain, many faces.** All intelligence, tools and state live in the Core.
   The desktop client and the Telegram bot are interchangeable front-ends.
2. **Loose coupling via contracts.** The wire protocol (`src/shared/protocol.ts`) is the
   only interface between processes. No process reaches into another's internals.
3. **Storage seams.** The research repository and memory store are behind interfaces, so
   the SQLite/WASM engine can be swapped for `better-sqlite3` or ChromaDB without
   touching callers.
4. **Everything is a research artifact.** Every interaction, tool call, federated round
   and telemetry sample is persisted and exportable.
5. **Graceful degradation.** No DeepSeek key → live demo responder. Core down → clients
   show "Core Offline" and auto-reconnect. TTS failure → Web Speech fallback.

## The Core (`jarvis-core/`)

```
src/
├── index.ts                 # composition root (wires everything, graceful shutdown)
├── config.ts                # validated env config, module-relative paths
├── logger.ts                # leveled structured logger + ring buffer + JSONL
├── shared/                  # protocol + domain types (source of truth)
├── agent/
│   ├── AgentRuntime.ts      # the agentic loop: prompt → tools → answer (bounded)
│   ├── DeepSeekClient.ts    # SSE streaming client (fetch, no SDK)
│   ├── ToolRegistry.ts      # strict typed tool contract
│   └── DemoResponder.ts     # no-key fallback that still runs real tools
├── tools/                   # one file per tool, loaded in index.ts
├── esp32/                   # NodeRegistry + WebSocket gateway for boards
├── federation/              # FedAvg coordinator
├── memory/                  # MemoryStore + local vector recall
├── database/                # ResearchRepository interface + SQLite/WASM impl
├── communication/
│   ├── api.ts               # single RPC dispatcher (used by WS and REST)
│   ├── WebSocketServer.ts   # real-time channel to all clients
│   ├── HttpServer.ts        # REST: health, nodes, export, memory...
│   └── ClientManager.ts     # broadcast + route-to-type primitives
└── autonomy/
    ├── Scheduler.ts         # node-cron jobs
    ├── ProactiveMonitor.ts  # hourly fleet/report loop
    ├── SelfImprovement.ts   # reflection → suggestions
    └── TelemetryService.ts  # 5s sampling into the research DB
```

### The agentic loop

```
user prompt ──► recall relevant memory ──► DeepSeek (stream, tools declared)
        ──► if tool_calls: execute via ToolRegistry ──► feed result back
        ──► repeat (max 6 iterations) ──► stream final answer
        ──► persist session, interactions, tool calls; update memory
```

### Communication protocol

- **Request/response** over WebSocket (`{type:'request', requestId, method, params}` →
  `{type:'response', requestId, ok, data|error}`) — one `dispatch()` powers both WS and REST.
- **Events** broadcast to all clients: `agent:event`, `esp32:node`,
  `federation:status`, `system:log`, `system:alert`.
- **Routing** sends Core-initiated messages (proactive reports, the
  `send_telegram_message` tool) to a specific client type.

## The Desktop client (`electron/` + Next.js renderer)

```
electron/
├── main/
│   ├── index.ts             # boots config, CoreClient, IPC, window
│   ├── core/CoreClient.ts   # WS client: auto-reconnect, request/response, events
│   ├── ipc/register.ts      # proxies renderer channels to the Core
│   ├── services/            # logger, client config, VoiceService (Edge TTS)
│   └── window.ts            # secure BrowserWindow (contextIsolation, no nodeIntegration)
├── preload/index.ts         # whitelisted window.jarvis bridge
└── shared/                  # types + IPC contract + protocol mirror
```

The renderer (`app/`, `components/`, `lib/`) is pure React + Three.js + Framer Motion.
`lib/bridge.ts` returns the real preload bridge inside Electron, or a live simulation in
a plain browser — the full UI is demonstrable with zero backend.

## The Telegram bot (`telegram-bot/`)

- `src/bot.ts` — telegraf bot: user messages become `agent.run` requests; streamed
  replies are relayed back; proactive reports and tool messages are delivered.
- `src/coreClient.ts` — the same WS client pattern as the desktop app.

## Security

- Renderer is sandboxed: `contextIsolation: true`, `nodeIntegration: false`, only a
  whitelisted bridge crosses the boundary.
- `execute_python` is confined to the allowed scripts directory.
- Telegram access can be restricted to allowed chat ids.
- Secrets live only in `.env` files (gitignored); the Core is the only process that
  holds the DeepSeek key.
