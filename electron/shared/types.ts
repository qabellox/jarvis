/**
 * ===========================================================================
 * JARVIS - Shared Domain Contracts
 * ---------------------------------------------------------------------------
 * Single source of truth for every type that crosses the process boundary
 * (renderer <-> preload <-> main). Keeping these in one module prevents
 * drift between the UI and the orchestration core.
 * ===========================================================================
 */

// ---------------------------------------------------------------------------
// ESP32 fleet ("the Body")
// ---------------------------------------------------------------------------

export type NodeStatus = 'online' | 'offline' | 'training' | 'error';

export interface NodeMetrics {
    /** Accuracy in percent (0..100), latest federated round. */
    accuracy: number;
    loss: number;
    /** Round-trip inference latency in milliseconds. */
    latencyMs: number;
    /** Deployed model size in bytes. */
    modelSizeBytes: number;
    /** Latest completed federated round for this node. */
    round: number;
    /** Local samples used in the last round. */
    samples: number;
}

export interface Esp32Node {
    id: string;
    name: string;
    status: NodeStatus;
    ip: string;
    connectedAt: string;
    lastSeenAt: string;
    firmwareVersion: string;
    modelVersion: string | null;
    /** RSSI in dBm, if reported. */
    signal?: number;
    /** Battery percentage, if reported. */
    battery?: number;
    metrics: NodeMetrics | null;
}

export interface FederationRound {
    round: number;
    algorithm: string;
    accuracy: number;
    loss: number;
    avgLatencyMs: number;
    modelSizeBytes: number;
    participants: number;
    timestamp: string;
}

export interface FederationStatus {
    active: boolean;
    algorithm: string;
    round: number;
    targetRound: number;
    participants: number;
    totalNodes: number;
    accuracy: number;
    loss: number;
    startedAt: string | null;
    history: FederationRound[];
}

// ---------------------------------------------------------------------------
// Commands sent to the fleet
// ---------------------------------------------------------------------------

export type Esp32Command =
    | { type: 'ping' }
    | { type: 'deploy_model'; model?: string }
    | { type: 'start_training'; algorithm: string; rounds: number }
    | { type: 'stop_training' }
    | { type: 'execute_action'; action: string; params?: Record<string, unknown> };

export interface CommandResult {
    ok: boolean;
    message: string;
    nodeId?: string;
    data?: unknown;
    at: string;
}

// ---------------------------------------------------------------------------
// Agent ("the Brain")
// ---------------------------------------------------------------------------

export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMessage {
    role: AgentRole;
    content: string;
    name?: string;
    toolCallId?: string;
}

export type AgentEventType =
    | 'token'      // streaming LLM token
    | 'status'     // lifecycle status change
    | 'tool_call'  // the agent decided to invoke a tool
    | 'tool_result'// a tool finished
    | 'done'       // turn finished
    | 'error';     // turn failed

export interface AgentEvent {
    type: AgentEventType;
    sessionId: string;
    data: unknown;
    at: string;
}

export type AgentStatus = 'idle' | 'listening' | 'thinking' | 'working' | 'speaking';

// ---------------------------------------------------------------------------
// Tools the agent can invoke
// ---------------------------------------------------------------------------

export interface ToolParameterSchema {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    enum?: string[];
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, ToolParameterSchema>;
}

export interface ToolCallRecord {
    id: string;
    sessionId?: string;
    name: string;
    args: unknown;
    ok: boolean;
    summary: string;
    durationMs: number;
    at: string;
}

export interface SpeakResult {
    dataUrl: string | null;
    voice: string;
    durationMs: number;
}

// ---------------------------------------------------------------------------
// Telemetry & logs
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    ts: string;
    level: LogLevel;
    source: string;
    message: string;
    meta?: Record<string, unknown>;
}

export interface SystemStatus {
    version: string;
    platform: string;
    uptimeSeconds: number;
    nodeCount: number;
    activeSessions: number;
    federationActive: boolean;
    wsPort: number;
    cpuUsage: number;
    memoryMb: { total: number; free: number };
}

// ---------------------------------------------------------------------------
// Research database records (exported for the paper)
// ---------------------------------------------------------------------------

export interface ResearchExport {
    exportedAt: string;
    version: string;
    interactions: unknown[];
    toolCalls: unknown[];
    federationRounds: FederationRound[];
    telemetry: unknown[];
}
// ---------------------------------------------------------------------------
// Memory (hosted by the Core)
// ---------------------------------------------------------------------------

export interface MemoryEntry {
    id: string;
    kind: 'fact' | 'preference' | 'interaction' | 'suggestion';
    content: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    vector?: number[];
}

export interface MemorySearchResult {
    entry: MemoryEntry;
    score: number;
}

export interface MemoryStats {
    total: number;
    facts: number;
    preferences: number;
    interactions: number;
    suggestions: number;
}