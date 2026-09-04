# Research — *A Federated TinyML Framework for Decentralized Edge Intelligence on ESP32 Devices*

## Positioning

JARVIS is not just a demo: it is the **empirical testbed** for the paper. The distributed
system is the instrumentation. Every number in the results section comes out of the
research database automatically — no manual note-taking.

## Paper outline

1. **Abstract** — a lightweight communication algorithm for federated learning on
   resource-constrained microcontrollers, orchestrated by an autonomous agent.
2. **Introduction** — the problem: data lives at the edge (sensors, cameras, wearables);
   centralizing it is costly and privacy-hostile. TinyML + federated learning solves it.
3. **Related work** — TinyML deployment (TensorFlow Lite Micro), federated learning
   (FedAvg, McMahan et al.), edge orchestration.
4. **System design**
   - The ESP32 fleet as client nodes; local training on-device (e.g. MNIST/gesture model).
   - The Core as the aggregation server running **FederatedAveraging**.
   - A minimal wire protocol (JSON over WebSocket) designed for constrained devices.
   - The agent orchestrator (JARVIS) as the human-AI interface to the whole pipeline.
5. **Methodology**
   - Metrics: per-round **accuracy**, **loss**, **latency**, **model size**, **samples**.
   - Experimental matrix: number of nodes (1/2/3/4), non-IID data splits, rounds.
   - Everything auto-collected by the telemetry sampler (5s cadence) and per-round commits.
6. **Results** — convergence curves, accuracy vs rounds, latency overhead vs model size,
   communication cost analysis.
7. **Conclusion** — a novel, low-footprint aggregation protocol that keeps models tiny and
   data on-device, with implications for privacy and connectivity.

## Data pipeline

| Artifact | Where | How to extract |
|----------|-------|----------------|
| Interactions (prompts/replies) | `interactions` table | `GET :8080/research/export` |
| Tool calls (actions taken) | `tool_calls` table | `GET :8080/research/export` |
| Federated rounds (accuracy/loss/latency/model size) | `federation_rounds` table | `GET :8080/research/export` |
| Time-series telemetry (CPU, nodes, accuracy over time) | `telemetry` table | `GET :8080/research/export` |
| Audit log | `data/jarvis/core.log.jsonl` | plain JSONL |

The Core exposes `GET /research/export` which returns a versioned JSON bundle with
everything above — ready to be turned into the paper's tables and figures.

## Reproducibility

- Environment: Windows / Node 20+ / Python 3 / ESP32 (ESP32-S3 recommended) / Arduino IDE.
- The demo responder exercises the full tool + federation pipeline without a DeepSeek key,
  so the *system behavior* is reproducible; a key is only needed for generative replies.
- Version everything: Core `1.1.0`, client `1.1.0` (see `/health`).
