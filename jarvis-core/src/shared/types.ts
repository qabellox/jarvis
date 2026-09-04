/**
 * ===========================================================================
 * JARVIS Core - Domain Types (canonical)
 * ===========================================================================
 */

// ---------------------------------------------------------------- ESP32 fleet
export type NodeStatus = 'online' | 'offline' | 'training' | 'error';

export interface NodeMetrics {
    accuracy: number;
    loss: number;
    latencyMs: number;
    modelSizeBytes: number;
    round: number;
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
    signal?: number;
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

// ------------------------------------------------------------------ commands
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

// ---------------------------------------------------------------------- agent
export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMessage {
    role: AgentRole;
    content: string;
    name?: string;
    toolCallId?: string;
}

export type AgentEventType =
    | 'token'
    | 'status'
    | 'tool_call'
    | 'tool_result'
    | 'done'
    | 'error';

export interface AgentEvent {
    type: AgentEventType;
    sessionId: string;
    data: unknown;
    at: string;
}

export interface ToolParameterSchema {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    enum?: string[];
    required?: boolean;
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

// ---------------------------------------------------------------- telemetry
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
    httpPort: number;
    cpuUsage: number;
    memoryMb: { total: number; free: number };
    connectedClients: Record<string, number>;
}

export interface AlertMessage {
    id: string;
    severity: 'info' | 'warn' | 'critical';
    title: string;
    body: string;
    at: string;
}

// --------------------------------------------------------------------- memory
export interface MemoryEntry {
    id: string;
    kind: 'fact' | 'preference' | 'interaction' | 'suggestion';
    content: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    /** Normalized vector for semantic recall (embedded locally). */
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

// ------------------------------------------------------------ python executor
export interface PythonExecResult {
    ok: boolean;
    scriptPath: string;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durationMs: number;
}

// ------------------------------------------------------------ self-reflection
export interface ReflectionSuggestion {
    id: string;
    title: string;
    detail: string;
    metric: string;
    at: string;
}
