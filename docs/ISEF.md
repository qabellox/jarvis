# ISEF Regeneron — Project Abstract

## Title

**JARVIS: A Distributed Edge-AI Orchestration Platform for Federated TinyML on ESP32 Devices**

## Category

Systems Software / Embedded Systems (Robotics and Intelligent Machines)

## Problem

Real-world AI needs to run where the data is — on cheap, battery-powered microcontrollers.
But individual ESP32-class devices cannot train useful models alone, and sending raw
sensor data to a server is expensive and privacy-invasive. How can a fleet of
resource-constrained devices learn collaboratively while keeping data on-device?

## Approach

We built **JARVIS**, a complete autonomous system in three loosely-coupled parts:

1. **The Body** — a fleet of ESP32 nodes that train a tiny model locally on-device and
   exchange only model weights, never raw data.
2. **The Brain** — a standalone intelligence Core that aggregates those weights with a
   lightweight FederatedAveraging algorithm, runs the training lifecycle, and persists
   every metric for analysis.
3. **The Interface** — a cinematic desktop command center (and a Telegram bot) through
   which the operator talks to the system in natural language; the agent decides which
   tools to call (deploy model, start training, query status, execute actions).

## Novelty

- A **minimal communication protocol** designed for constrained devices (compact JSON
  over WebSocket) with a novel aggregation that keeps model size and latency low.
- A **fully autonomous agent** orchestrating the ML lifecycle — from model deployment to
  convergence reporting — driven by an LLM with strict, typed tool calling.
- An **automatic research instrument**: every round's accuracy, loss, latency and model
  size is self-logged and exportable, turning the system itself into the experiment.

## Results (representative, demo pipeline)

- 3-node fleet converging from **88.4% → 94.8%** accuracy across 3 FedAvg rounds.
- On-device inference latency in the **20–25 ms** range with a **~61 KB** model.
- Full data export available at runtime for the results section.

## Broader impact

Decentralized, privacy-preserving intelligence on commodity hardware — applicable to
agriculture, environmental sensing, smart cities and healthcare in low-connectivity
regions (relevant to Port Said and beyond).
