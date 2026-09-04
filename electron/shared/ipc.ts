/**
 * ===========================================================================
 * JARVIS - IPC Contract
 * ---------------------------------------------------------------------------
 * Every message that crosses the Electron process boundary is declared here:
 *  - `IPC`   : invoke/handle request-response channels (renderer -> main)
 *  - `Events`: webContents.push channels, main -> renderer real-time pushes
 *  - `JarvisBridge`: the exact shape exposed on `window.jarvis` by preload.
 *
 * The renderer NEVER touches ipcRenderer directly; it only talks to this
 * whitelisted surface. This is the secure-bridge pattern.
 * ===========================================================================
 */
import type {
    AgentEvent,
    CommandResult,
    Esp32Command,
    Esp32Node,
    FederationStatus,
    LogEntry,
    SpeakResult,
    SystemStatus
} from './types';

export const IPC = {
    Agent: {
        Run: 'agent:run',
        Cancel: 'agent:cancel'
    },
    Voice: {
        Speak: 'voice:speak',
        Stop: 'voice:stop'
    },
    Esp32: {
        ListNodes: 'esp32:list-nodes',
        SendCommand: 'esp32:send-command'
    },
    Federation: {
        GetStatus: 'federation:get-status'
    },
    Memory: {
        Get: 'memory:get',
        Search: 'memory:search',
        Stats: 'memory:stats'
    },
    Conversation: {
        List: 'conversation:list',
        Clear: 'conversation:clear'
    },
    System: {
        GetStatus: 'system:get-status',
        GetLogs: 'system:get-logs',
        ToolLog: 'system:tool-log'
    }
} as const;

/** Main -> renderer real-time push channels. */
export const Events = {
    AgentEvent: 'events:agent',
    NodeUpdate: 'events:node',
    FederationUpdate: 'events:federation',
    Log: 'events:log',
    Alert: 'events:alert',
    Connection: 'events:connection'
} as const;

export type EventChannel = (typeof Events)[keyof typeof Events];

/** The secure, typed surface exposed on `window.jarvis`. */
export interface JarvisBridge {
    platform: string;
    agent: {
        run(prompt: string): Promise<string>;
        cancel(sessionId: string): Promise<void>;
    };
    voice: {
        speak(text: string): Promise<SpeakResult>;
        stop(): Promise<void>;
    };
    esp32: {
        listNodes(): Promise<Esp32Node[]>;
        sendCommand(nodeId: string, command: Esp32Command): Promise<CommandResult>;
    };
    federation: {
        getStatus(): Promise<FederationStatus>;
    };
    memory: {
        list(kind?: string, limit?: number): Promise<import('./types').MemoryEntry[]>;
        search(query: string, limit?: number): Promise<import('./types').MemorySearchResult[]>;
        stats(): Promise<import('./types').MemoryStats>;
    };
    conversation: {
        list(limit?: number): Promise<ConversationMessage[]>;
        clear(): Promise<void>;
    };
    system: {
        getStatus(): Promise<SystemStatus>;
        getLogs(limit?: number): Promise<LogEntry[]>;
        getToolLog(limit?: number): Promise<import('./types').ToolCallRecord[]>;
    };
    /** Subscribe to a main-process push channel. Returns an unsubscribe fn. */
    on(channel: EventChannel, callback: (payload: unknown) => void): () => void;
}

/** Payloads pushed per event channel. */
export interface AgentEventPayload extends AgentEvent { }

/** A single persisted message in a conversation (chronological). */
export interface ConversationMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
}

export interface NodeUpdatePayload {
    kind: 'connected' | 'disconnected' | 'metrics' | 'status';
    node: Esp32Node;
}

export interface FederationUpdatePayload {
    status: FederationStatus;
}

export interface ConnectionPayload {
    connected: boolean;
    serverTime?: string;
}
