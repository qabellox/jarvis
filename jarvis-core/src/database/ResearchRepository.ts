import type { AgentMessage, FederationRound, LogEntry, ToolCallRecord } from '../shared/types';

export interface SessionRecord {
    id: string;
    startedAt: string;
    endedAt: string | null;
    messageCount: number;
    toolCalls: number;
}

export interface InteractionRecord {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    createdAt: string;
}

export interface TelemetryRecord {
    ts: string;
    kind: string;
    value: number;
    meta: string | null;
}

export interface DatabaseStats {
    interactions: number;
    toolCalls: number;
    federationRounds: number;
    telemetry: number;
    voiceEvents: number;
    nodes: number;
}

export interface ResearchRepository {
    init(): Promise<void>;
    createSession(session: SessionRecord): Promise<void>;
    endSession(sessionId: string): Promise<void>;
    saveInteraction(sessionId: string, message: AgentMessage): Promise<void>;
    getRecentInteractions(limit?: number): Promise<InteractionRecord[]>;
    clearInteractions(): Promise<void>;
    recordToolCall(call: ToolCallRecord): Promise<void>; getRecentToolCalls(limit?: number): Promise<ToolCallRecord[]>; recordFederationRound(round: FederationRound): Promise<void>;
    getRounds(): Promise<FederationRound[]>;
    recordTelemetry(record: TelemetryRecord): Promise<void>;
    recordLog(entry: LogEntry): Promise<void>;
    recordVoiceEvent(kind: string, text: string | null, durationMs: number): Promise<void>;
    getStats(): Promise<DatabaseStats>;
    exportResearch(): Promise<unknown>;
    dispose(): void;
}
