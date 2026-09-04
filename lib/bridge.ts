'use client';

import type { ConversationMessage, EventChannel, JarvisBridge } from '@shared/ipc';
import { createRemoteBridge } from './remoteBridge';
import type {
    AgentEvent,
    CommandResult,
    Esp32Command,
    Esp32Node,
    FederationStatus,
    LogEntry,
    MemoryEntry,
    MemorySearchResult,
    MemoryStats,
    NodeMetrics,
    SpeakResult,
    SystemStatus,
    ToolCallRecord
} from '@shared/types';

declare global {
    interface Window {
        jarvis?: JarvisBridge;
    }
}

/**
 * Bridge resolution.
 *
 * Inside Electron this returns the real preload bridge (`window.jarvis`).
 * In a plain browser (or before preload mounts) it returns a live simulation
 * so the full UI — neural swarm, agent console, fleet, federation, memory —
 * is fully demonstrable with zero hardware and zero API keys.
 */
export function getBridge(): JarvisBridge {
    if (typeof window !== 'undefined' && window.jarvis) return window.jarvis;
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('core')) {
        return remoteBridge;
    }
    return demoBridge;
}

// ---------------------------------------------------------------------------
// Demo simulation
// ---------------------------------------------------------------------------

type Listener = (payload: unknown) => void;

class DemoBus {
    private readonly listeners = new Map<string, Set<Listener>>();
    on(channel: EventChannel, fn: Listener): () => void {
        let set = this.listeners.get(channel);
        if (!set) {
            set = new Set();
            this.listeners.set(channel, set);
        }
        set.add(fn);
        return () => set.delete(fn);
    }
    emit(channel: EventChannel, payload: unknown): void {
        this.listeners.get(channel)?.forEach((fn) => fn(payload));
    }
}

const iso = (offsetSec: number): string => new Date(Date.now() - offsetSec * 1000).toISOString();

// ---------------------------------------------------------------------------
// Demo conversation persistence (localStorage so refresh keeps the chat)
// ---------------------------------------------------------------------------

const DEMO_CONV_KEY = 'jarvis-demo-conversation';

function loadDemoConv(): ConversationMessage[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(DEMO_CONV_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as ConversationMessage[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function appendDemoConv(role: ConversationMessage['role'], content: string): void {
    if (typeof window === 'undefined') return;
    const all = loadDemoConv();
    all.push({
        id: `conv_${Date.now().toString(36)}_${all.length}`,
        sessionId: 'demo',
        role,
        content,
        createdAt: new Date().toISOString()
    });
    try {
        window.localStorage.setItem(DEMO_CONV_KEY, JSON.stringify(all.slice(-200)));
    } catch {
        /* storage full / blocked */
    }
}

function demoNodes(): Esp32Node[] {
    const mk = (
        id: string,
        name: string,
        ip: string,
        status: Esp32Node['status'],
        metrics: NodeMetrics,
        extra: Partial<Esp32Node> = {}
    ): Esp32Node => ({
        id,
        name,
        status,
        ip,
        connectedAt: iso(86400),
        lastSeenAt: iso(2),
        firmwareVersion: '0.4.2',
        modelVersion: 'tiny-mnist-v3',
        signal: -52,
        battery: 88,
        metrics,
        ...extra
    });
    return [
        mk('esp32-001', 'ESP32-1', '192.168.1.21', 'training', {
            accuracy: 94.8,
            loss: 0.082,
            latencyMs: 23.4,
            modelSizeBytes: 61200,
            round: 3,
            samples: 1200
        }),
        mk('esp32-002', 'ESP32-2', '192.168.1.22', 'online', {
            accuracy: 93.6,
            loss: 0.091,
            latencyMs: 25.1,
            modelSizeBytes: 61200,
            round: 3,
            samples: 980
        }),
        mk('esp32-003', 'ESP32-3', '192.168.1.23', 'training', {
            accuracy: 95.1,
            loss: 0.074,
            latencyMs: 21.9,
            modelSizeBytes: 61200,
            round: 3,
            samples: 1410
        })
    ];
}

function demoFederation(): FederationStatus {
    const round = (n: number, accuracy: number, loss: number): FederationStatus['history'][number] => ({
        round: n,
        algorithm: 'FedAvg',
        accuracy,
        loss,
        avgLatencyMs: 22 + n * 0.7,
        modelSizeBytes: 61200,
        participants: 3,
        timestamp: iso(3600 * (6 - n))
    });
    return {
        active: true,
        algorithm: 'FedAvg',
        round: 3,
        targetRound: 5,
        participants: 3,
        totalNodes: 3,
        accuracy: 94.8,
        loss: 0.078,
        startedAt: iso(3600 * 5),
        history: [round(1, 88.4, 0.142), round(2, 91.7, 0.105), round(3, 94.8, 0.078)]
    };
}

const demoLogs: LogEntry[] = [
    { ts: iso(90), level: 'info', source: 'registry', message: 'JARVIS v1.0.0 online' },
    { ts: iso(70), level: 'info', source: 'esp32-gateway', message: 'WebSocket gateway listening on 0.0.0.0:8765' },
    { ts: iso(50), level: 'info', source: 'esp32-gateway', message: 'Node registered: ESP32-1 (esp32-001) fw 0.4.2' },
    { ts: iso(40), level: 'info', source: 'esp32-gateway', message: 'Node registered: ESP32-2 (esp32-002) fw 0.4.2' },
    { ts: iso(30), level: 'info', source: 'esp32-gateway', message: 'Node registered: ESP32-3 (esp32-003) fw 0.4.2' },
    { ts: iso(20), level: 'info', source: 'federation', message: 'Training started: FedAvg, 5 rounds' },
    { ts: iso(10), level: 'info', source: 'federation', message: 'Round 3 committed | accuracy 94.8% | latency 23.4ms | 3 participants' }
];

function demoMemory(): MemoryEntry[] {
    const mk = (kind: MemoryEntry['kind'], content: string, tags: string[], minutesAgo: number): MemoryEntry => ({
        id: `mem_demo_${minutesAgo}`,
        kind,
        content,
        tags,
        createdAt: iso(minutesAgo * 60),
        updatedAt: iso(minutesAgo * 60)
    });
    return [
        mk('fact', 'Fleet runs tiny-mnist-v3 (61.2 KB) on FedAvg', ['model', 'federation'], 300),
        mk('preference', 'Operator prefers concise status reports over Telegram', ['telegram'], 260),
        mk('interaction', 'Start federated training :: Training underway across the fleet', ['conversation'], 120),
        mk('suggestion', 'Convergence is healthy: accuracy improved 88.4% -> 94.8%', ['reflection'], 90),
        mk('fact', 'ESP32-3 reports lowest inference latency (21.9 ms)', ['esp32'], 40)
    ];
}

function demoToolLog(): ToolCallRecord[] {
    const mk = (name: string, ok: boolean, summary: string, minutesAgo: number): ToolCallRecord => ({
        id: `tc_demo_${minutesAgo}`,
        name,
        args: {},
        ok,
        summary,
        durationMs: 120 + (minutesAgo % 5) * 30,
        at: iso(minutesAgo * 60)
    });
    return [
        mk('query_federated_learning_status', true, 'Round 3 | FedAvg | accuracy 94.8% | 3 participants', 12),
        mk('control_esp32', true, 'deploy_model -> all: OK', 34),
        mk('initiate_training', true, 'Federated training initiated: FedAvg, 5 rounds', 58),
        mk('get_system_status', true, 'Uptime 5400s | 3 nodes | training active', 90)
    ];
}

class DemoBridge implements JarvisBridge {
    readonly platform = 'demo';
    private readonly bus = new DemoBus();
    private nodes: Esp32Node[] = demoNodes();
    private federationData: FederationStatus = demoFederation();
    private memoryEntries: MemoryEntry[] = demoMemory();
    private toolLog: ToolCallRecord[] = demoToolLog();

    agent = {
        run: (prompt: string): Promise<string> => {
            const sessionId = `demo_${Date.now().toString(36)}`;
            void this.simulateAgent(sessionId, prompt);
            return Promise.resolve(sessionId);
        },
        cancel: (): Promise<void> => Promise.resolve()
    };

    voice = {
        speak: (): Promise<SpeakResult> => Promise.resolve({ dataUrl: null, voice: 'demo', durationMs: 0 }),
        stop: (): Promise<void> => Promise.resolve()
    };

    esp32 = {
        listNodes: (): Promise<Esp32Node[]> => Promise.resolve(this.nodes),
        sendCommand: (nodeId: string, command: Esp32Command): Promise<CommandResult> =>
            new Promise((resolve) => {
                setTimeout(() => {
                    const result: CommandResult = {
                        ok: true,
                        nodeId,
                        message: `Simulated ${command.type} accepted`,
                        at: iso(0)
                    };
                    if (command.type === 'deploy_model') {
                        this.nodes = this.nodes.map((n) => ({
                            ...n,
                            modelVersion: command.model ?? n.modelVersion,
                            status: 'online'
                        }));
                        this.bus.emit('events:node', { kind: 'status', node: this.nodes[0] });
                    }
                    if (command.type === 'start_training') {
                        this.federationData = { ...this.federationData, active: true, targetRound: command.rounds ?? 5, startedAt: iso(0) };
                        this.bus.emit('events:federation', { status: this.federationData });
                    }
                    if (command.type === 'stop_training') {
                        this.federationData = { ...this.federationData, active: false, startedAt: null };
                        this.bus.emit('events:federation', { status: this.federationData });
                    }
                    resolve(result);
                }, 260);
            })
    };

    federation = {
        getStatus: (): Promise<FederationStatus> => Promise.resolve(this.federationData)
    };

    memory = {
        list: (kind?: string, limit = 100): Promise<MemoryEntry[]> => {
            const list = kind ? this.memoryEntries.filter((e) => e.kind === kind) : this.memoryEntries;
            return Promise.resolve(list.slice(0, limit));
        },
        search: (query: string, limit = 5): Promise<MemorySearchResult[]> => {
            const q = query.toLowerCase();
            const scored = this.memoryEntries
                .map((entry) => ({ entry, score: entry.content.toLowerCase().includes(q) ? 0.9 : 0.1 }))
                .sort((a, b) => b.score - a.score);
            return Promise.resolve(scored.slice(0, limit));
        },
        stats: (): Promise<MemoryStats> => {
            const count = (k: MemoryEntry['kind']): number => this.memoryEntries.filter((e) => e.kind === k).length;
            return Promise.resolve({
                total: this.memoryEntries.length,
                facts: count('fact'),
                preferences: count('preference'),
                interactions: count('interaction'),
                suggestions: count('suggestion')
            });
        }
    };

    conversation = {
        list: (limit = 100): Promise<ConversationMessage[]> =>
            Promise.resolve(loadDemoConv().slice(-limit)),
        clear: (): Promise<void> => {
            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.removeItem(DEMO_CONV_KEY);
                } catch {
                    /* noop */
                }
            }
            return Promise.resolve();
        }
    };

    system = {
        getStatus: (): Promise<SystemStatus> =>
            Promise.resolve({
                version: '1.0.0',
                platform: 'demo-web',
                uptimeSeconds: 5400,
                nodeCount: this.nodes.filter((n) => n.status !== 'offline').length,
                activeSessions: 1,
                federationActive: this.federationData.active,
                wsPort: 8765,
                cpuUsage: 24,
                memoryMb: { total: 16384, free: 9216 }
            }),
        getLogs: (limit = 200): Promise<LogEntry[]> => Promise.resolve(demoLogs.slice(-limit)),
        getToolLog: (limit = 50): Promise<ToolCallRecord[]> => Promise.resolve(this.toolLog.slice(0, limit))
    };

    on(channel: EventChannel, callback: (payload: unknown) => void): () => void {
        return this.bus.on(channel, callback);
    }

    private emitAgent(event: Omit<AgentEvent, 'at'> & { at?: string }): void {
        this.bus.emit('events:agent', { ...event, at: event.at ?? iso(0) });
    }

    private async simulateAgent(sessionId: string, prompt: string): Promise<void> {
        const emit = (type: AgentEvent['type'], data: unknown): void =>
            this.emitAgent({ type, sessionId, data, at: iso(0) });

        emit('status', 'thinking');
        appendDemoConv('user', prompt);
        const opener = 'Understood. Engaging the neural swarm. ';
        for (const chunk of opener.match(/.{1,5}/gs) ?? []) {
            await sleep(60);
            emit('token', chunk);
        }

        const toolName = /train|learn|federat/i.test(prompt)
            ? 'initiate_training'
            : /deploy|model/i.test(prompt)
                ? 'control_esp32'
                : 'query_federated_learning_status';

        const toolId = `tc_${Date.now().toString(36)}`;
        emit('tool_call', {
            id: toolId,
            name: toolName,
            args:
                toolName === 'initiate_training'
                    ? { algorithm: 'FedAvg', rounds: 5 }
                    : toolName === 'control_esp32'
                        ? { target_node: 'all', command: 'deploy_model', model: 'tiny-mnist-v3' }
                        : {}
        });

        await sleep(500);
        let summary = `Round ${this.federationData.round} | ${this.federationData.algorithm} | accuracy ${this.federationData.accuracy}% | ${this.federationData.participants} participants`;
        if (toolName === 'initiate_training') {
            this.federationData = { ...this.federationData, active: true, targetRound: 5, startedAt: iso(0) };
            this.bus.emit('events:federation', { status: this.federationData });
            summary = `Federated training initiated: ${this.federationData.algorithm}, 5 rounds across the fleet`;
        }
        if (toolName === 'control_esp32') {
            summary = 'Model deployed to all reachable nodes';
        }
        emit('tool_result', { id: toolId, name: toolName, ok: true, summary });

        // Record into the Tool Log + memory so the new panels stay live.
        this.toolLog = [
            { id: toolId, name: toolName, args: {}, ok: true, summary, durationMs: 260, at: iso(0) },
            ...this.toolLog
        ].slice(0, 50);
        const memoryEntry: MemoryEntry = {
            id: `mem_${Date.now().toString(36)}`,
            kind: 'interaction',
            content: `${prompt} :: ${summary}`,
            tags: ['conversation'],
            createdAt: iso(0),
            updatedAt: iso(0)
        };
        this.memoryEntries = [memoryEntry, ...this.memoryEntries].slice(0, 100);

        const reply = `Done. ${summary}. The swarm remains stable and I am standing by for your next directive.`;
        for (const word of reply.split(' ')) {
            await sleep(40);
            emit('token', word + ' ');
        }
        appendDemoConv('assistant', reply);
        emit('status', 'idle');
        emit('done', { aborted: false });
    }
}

const demoBridge = new DemoBridge();
/** Lazily created remote bridge (only when a `?core=` URL is used). */
const remoteBridge = createRemoteBridge();


function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
