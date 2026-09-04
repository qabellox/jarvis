import { Channels, Methods } from '../shared/protocol';
import type { Esp32Command, SystemStatus, ToolCallRecord } from '../shared/types';
import { ProtocolError, toJarvisError } from '../utils/errors';
import type { LoggerLike } from '../logger';
import type { CoreConfig } from '../config';
import type { ResearchRepository } from '../database/ResearchRepository';
import type { MemoryStore } from '../memory/MemoryStore';
import type { NodeRegistry } from '../esp32/NodeRegistry';
import type { FederationManager } from '../federation/FederationManager';
import type { Esp32Gateway } from '../esp32/Esp32Gateway';
import type { ToolRegistry } from '../agent/ToolRegistry';
import type { AgentRuntime } from '../agent/AgentRuntime';
import type { ClientManager } from './ClientManager';

/**
 * CoreApi — the single façade every transport (WebSocket, REST) talks to.
 * This keeps both transports thin and identical: one dispatch, two doorways.
 */
export interface CoreApi {
    config: CoreConfig;
    logger: LoggerLike;
    repository: ResearchRepository;
    memory: MemoryStore;
    registry: NodeRegistry;
    federation: FederationManager;
    gateway: Esp32Gateway;
    tools: ToolRegistry;
    agent: AgentRuntime;
    clients: ClientManager;
    startedAt: number;
    systemStatus: () => SystemStatus;
    toolLog: (limit: number) => Promise<ToolCallRecord[]>;
}

export interface DispatchResult {
    ok: boolean;
    data?: unknown;
    error?: { code: string; message: string };
}

/**
 * The one true RPC dispatcher. Both the WebSocket server and the REST API
 * funnel every method call through here, guaranteeing identical behavior.
 */
export async function dispatch(method: string, params: unknown, api: CoreApi): Promise<DispatchResult> {
    try {
        const data = await handle(method, params, api);
        return { ok: true, data };
    } catch (error) {
        const jarvisError = toJarvisError(error);
        api.logger.warn('api', `Dispatch ${method} failed: ${jarvisError.message}`, { code: jarvisError.code });
        return { ok: false, error: { code: jarvisError.code, message: jarvisError.message } };
    }
}

async function handle(method: string, params: unknown, api: CoreApi): Promise<unknown> {
    const p = (params ?? {}) as Record<string, unknown>;

    switch (method) {
        case Methods.AgentRun: {
            const prompt = String(p.prompt ?? '').trim();
            if (!prompt) throw new ProtocolError('agent.run requires a prompt');
            const sessionId = api.agent.createSession((event) =>
                api.clients.broadcast(Channels.AgentEvent, event)
            );
            void api.agent
                .run(sessionId, prompt)
                .catch((error) => api.logger.error('api', `Agent run failed: ${String(error)}`));
            return { sessionId };
        }

        case Methods.AgentCancel:
            api.agent.cancel(String(p.sessionId ?? ''));
            return { cancelled: true };

        case Methods.NodeList:
            return api.registry.all();

        case Methods.NodeCommand:
            return api.gateway.sendCommand(String(p.nodeId ?? ''), p.command as Esp32Command);

        case Methods.FederationStatus:
            return api.federation.getStatus();

        case Methods.FederationStart: {
            const rounds = Math.max(1, Math.min(50, Number(p.rounds) || 5));
            api.federation.startTraining(rounds);
            await api.gateway
                .sendCommand('all', { type: 'start_training', algorithm: api.federation.getStatus().algorithm, rounds })
                .catch(() => undefined);
            return api.federation.getStatus();
        }

        case Methods.FederationStop:
            api.federation.stopTraining();
            return api.federation.getStatus();

        case Methods.SystemStatus:
            return api.systemStatus();

        case Methods.Logs:
            return api.logger.recent(Number(p.limit) || 200);

        case Methods.ToolLog:
            return api.toolLog(Number(p.limit) || 50);

        case Methods.MemoryGet:
            return api.memory.all(p.kind as never, Number(p.limit) || 100);

        case Methods.MemorySet:
            return api.memory.add(p.kind as never, String(p.content ?? ''), Array.isArray(p.tags) ? (p.tags as string[]) : []);

        case Methods.MemorySearch:
            return api.memory.search(String(p.query ?? ''), Number(p.limit) || 5);

        case Methods.MemoryStats:
            return api.memory.stats();

        case Methods.ConversationList:
            return api.repository.getRecentInteractions(Number(p.limit) || 100);

        case Methods.ConversationClear:
            await api.repository.clearInteractions();
            return { cleared: true };

        case Methods.ResearchExport:
            return api.repository.exportResearch();

        case Methods.Stats:
            return api.repository.getStats();

        default:
            throw new ProtocolError(`Unknown method: ${method}`);
    }
}
