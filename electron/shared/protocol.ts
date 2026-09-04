/**
 * ===========================================================================
 * JARVIS Electron client - Core Wire Protocol (client copy)
 * ---------------------------------------------------------------------------
 * The canonical protocol lives in jarvis-core/src/shared/protocol.ts; this is
 * the Electron client's mirror of the method names and event channels.
 * ===========================================================================
 */
export const Methods = {
    AgentRun: 'agent.run',
    AgentCancel: 'agent.cancel',
    NodeList: 'esp32.listNodes',
    NodeCommand: 'esp32.sendCommand',
    FederationStatus: 'federation.status',
    FederationStart: 'federation.startTraining',
    FederationStop: 'federation.stopTraining',
    SystemStatus: 'system.status',
    Logs: 'system.logs',
    ToolLog: 'system.toolLog',
    MemoryGet: 'memory.get',
    MemorySet: 'memory.set',
    MemorySearch: 'memory.search',
    MemoryStats: 'memory.stats',
    ConversationList: 'conversation.list',
    ConversationClear: 'conversation.clear',
    ResearchExport: 'research.export',
    Stats: 'system.stats'
} as const;

export const Channels = {
    AgentEvent: 'agent:event',
    NodeUpdate: 'esp32:node',
    FederationUpdate: 'federation:status',
    Log: 'system:log',
    Alert: 'system:alert'
} as const;

export type CoreChannel = (typeof Channels)[keyof typeof Channels];
export type CoreMethod = (typeof Methods)[keyof typeof Methods];

export interface HelloMessage {
    type: 'hello';
    clientType: 'electron' | 'telegram' | 'web' | 'cli';
    clientId: string;
    version: string;
    token?: string;
}

export interface RequestMessage {
    type: 'request';
    requestId: string;
    method: string;
    params?: unknown;
}

export interface PongMessage {
    type: 'pong';
}

export type ClientMessage = HelloMessage | RequestMessage | PongMessage;

export interface WelcomeMessage {
    type: 'welcome';
    serverTime: string;
    capabilities: string[];
}

export interface ResponseMessage {
    type: 'response';
    requestId: string;
    ok: boolean;
    data?: unknown;
    error?: { code: string; message: string };
}

export interface EventMessage {
    type: 'event';
    channel: string;
    payload: unknown;
}

export interface RouteMessage {
    type: 'message';
    to: 'telegram' | 'electron' | 'web' | 'cli';
    payload: unknown;
}

export interface PingMessage {
    type: 'ping';
}

export type ServerMessage = WelcomeMessage | ResponseMessage | EventMessage | RouteMessage | PingMessage;
