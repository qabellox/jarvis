/** Client copy of the JARVIS Core wire protocol (canonical: jarvis-core/src/shared/protocol.ts). */
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
    MemoryGet: 'memory.get',
    MemorySearch: 'memory.search',
    MemoryStats: 'memory.stats',
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

export interface ClientMessage {
    type: 'hello' | 'request' | 'pong';
    clientType?: 'telegram';
    clientId?: string;
    version?: string;
    token?: string;
    requestId?: string;
    method?: string;
    params?: unknown;
}

export interface ServerMessage {
    type: 'welcome' | 'response' | 'event' | 'message' | 'ping';
    serverTime?: string;
    capabilities?: string[];
    requestId?: string;
    ok?: boolean;
    data?: unknown;
    error?: { code: string; message: string };
    channel?: string;
    payload?: unknown;
    to?: string;
}
