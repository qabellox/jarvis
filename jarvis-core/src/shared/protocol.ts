/**
 * ===========================================================================
 * JARVIS Core - Wire Protocol (canonical)
 * ---------------------------------------------------------------------------
 * Every message exchanged between the Core and its clients (Electron,
 * Telegram, web, CLI) is defined here. Clients keep a small local copy of
 * this file; the Core is the source of truth.
 * ===========================================================================
 */

// ---------------------------------------------------------------- client->core
export type ClientType = 'electron' | 'telegram' | 'web' | 'cli';

export interface HelloMessage {
    type: 'hello';
    clientType: ClientType;
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

// ---------------------------------------------------------------- core->client
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

/** Core->specific-client routed message (e.g. proactive report to Telegram). */
export interface RouteMessage {
    type: 'message';
    to: ClientType;
    payload: unknown;
}

export interface PingMessage {
    type: 'ping';
}

export type ServerMessage = WelcomeMessage | ResponseMessage | EventMessage | RouteMessage | PingMessage;

// ------------------------------------------------------------------ RPC methods
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

export type MethodName = (typeof Methods)[keyof typeof Methods];

// -------------------------------------------------------------------- channels
export const Channels = {
    AgentEvent: 'agent:event',
    NodeUpdate: 'esp32:node',
    FederationUpdate: 'federation:status',
    Log: 'system:log',
    Alert: 'system:alert'
} as const;

export type CoreChannel = (typeof Channels)[keyof typeof Channels];
