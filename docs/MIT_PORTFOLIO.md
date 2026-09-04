# MIT Maker Portfolio — JARVIS

## The story

JARVIS is a complete, working artifact that demonstrates the arc of an engineering
journey: a cinematic user interface, a distributed backend, machine learning, and
real-world hardware — all integrated into one autonomous system.

> "I didn't build a chat bot. I built the command center for an AI that can act on the
> physical world — and I made it beautiful enough that people want to see it work."

## What to film (video chapters)

1. **The reveal** — launch the desktop app; the neural swarm comes alive. (30s)
2. **Voice in, voice out** — speak a command, watch JARVIS stream a reply and speak back. (45s)
3. **The fleet** — show the ESP32 nodes connecting to the Core, live status, accuracy. (45s)
4. **Training a model** — ask JARVIS to start federated training; watch rounds commit and
   accuracy climb in real time. (60s)
5. **Real-world action** — `execute_python` running a script, a node action firing. (30s)
6. **From your phone** — the Telegram bot answering the same questions. (30s)
7. **The research** — the export endpoint producing the paper's data. (30s)

## Photos / stills

- The app: neural swarm (thinking mode), the command center, the fleet dashboard,
  the memory explorer, the tool log.
- The hardware: ESP32 board(s), wiring, and the boards reporting to the gateway.
- The Core: terminal showing the agent's tool calls and federation logs.

## Developer journal

Keep a dated log in `developer-journal/` — one file per session covering: what you
built, decisions and why, bugs and fixes, metrics captured, and next steps. This becomes
both your process documentation for MIT and your appendix for the research paper.

## Skills on display

- **Systems engineering** — process isolation, typed IPC, WebSocket protocol, DI composition root.
- **Full-stack** — Next.js, React, TypeScript, Tailwind, Electron.
- **Graphics** — Three.js particle systems, Framer Motion, glass-morphism design.
- **ML** — federated learning, model deployment to edge devices.
- **Autonomy** — LLM agentic loops with tool calling, schedulers, self-improvement.
- **Research** — automatic instrumentation and data export.
