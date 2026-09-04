'use client';

import type { ConversationMessage, EventChannel, JarvisBridge } from '@shared/ipc';
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
    SpeakResult,
    SystemStatus,
    ToolCallRecord
} from '@shared/types';
import { Channels, Methods } from '@shared/protocol';

/**
 * RemoteBridge — a browser `JarvisBridge` that talks to a JARVIS Core over
 * WebSocket instead of Electron IPC. This is what makes the app globally
 * accessible: deploy this UI to Vercel, expose your local Core through a
 * tunnel (ngrok / Tailscale / Cloudflare Tunnel), then open the UI with
 *
 *     https://<your-app>.vercel.app/?core=wss://<tunnel-host>&token=<JARVIS_ACCESS_TOKEN>
 *
 * Every capability the desktop app has (agent, ESP32 fleet, federation,
 * memory, file tools) is available remotely. Requests and events use the same
 * wire protocol the Core already speaks.
 */

interface PendingRequest {
    resolve: (data: unknown) => void;
    reject: (error: Error) => void;
    timer: number;
}

type Listener = (payload: unknown) => void;

const QUERY = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const coreUrl = QUERY?.get('core') ?? '';
const accessToken = QUERY?.get('token') ?? '';

const CHANNEL_MAP: Record<string, EventChannel> = {
    [Channels.AgentEvent]: 'events:agent',
    [Channels.NodeUpdate]: 'events:node',
    [Channels.FederationUpdate]: 'events:federation',
    [Channels.Log]: 'events:log',
    [Channels.Alert]: 'events:alert'
};

export class RemoteBridge implements JarvisBridge {
    readonly platform = 'remote';
    private ws: WebSocket | null = null;
    private readonly pending = new Map<string, PendingRequest>();
    private readonly listeners = new Map<string, Set<Listener>>();
    private requestSeq = 0;
    private connected = false;
    private reconnectTimer: number | null = null;
    private manuallyClosed = false;
    private reconnectAttempts = 0;
    private ready: Promise<void> | null = null;
    private readyResolve: (() => void) | null = null;
    private readyReject: ((error: Error) => void) | null = null;

    get url(): string {
        return coreUrl;
    }

    get hasToken(): boolean {
        return accessToken.length > 0;
    }

    connect(): void {
        if (!coreUrl) return;
        this.manuallyClosed = false;
        this.ready = new Promise<void>((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
        try {
            const ws = new WebSocket(coreUrl);
            this.ws = ws;
            ws.onopen = () => {
                this.reconnectAttempts = 0;
                ws.send(
                    JSON.stringify({
                        type: 'hello',
                        clientType: 'web',
                        clientId: `web_${Date.now().toString(36)}`,
                        version: '1.0.0',
                        token: accessToken
                    })
                );
            };
            ws.onmessage = (event) => this.onMessage(event.data as string);
            ws.onclose = () => {
                this.setConnected(false);
                this.rejectAll(new Error('connection closed'));
                this.readyReject?.(new Error('connection closed'));
                this.scheduleReconnect();
            };
            ws.onerror = () => {
                /* handled by close */
            };
        } catch (error) {
            this.setConnected(false);
            this.readyReject?.(error as Error);
            this.emit('events:alert', {
                level: 'error',
                source: 'remote',
                message: `Failed to open connection: ${String(error)}`
            });
        }
    }

    disconnect(): void {
        this.manuallyClosed = true;
        this.ws?.close();
        this.ws = null;
    }

    // ------------------------------------------------------------ JarvisBridge
    agent = {
        run: (prompt: string): Promise<string> =>
            this.request<string>(Methods.AgentRun, { prompt }).then((data) =>
                (data as { sessionId?: string } | null)?.sessionId ?? ''
            ),
        cancel: (sessionId: string): Promise<void> =>
            this.request(Methods.AgentCancel, { sessionId }).then(() => undefined)
    };

    voice = {
        speak: (): Promise<SpeakResult> => Promise.resolve({ dataUrl: null, voice: 'remote', durationMs: 0 }),
        stop: (): Promise<void> => Promise.resolve()
    };

    esp32 = {
        listNodes: (): Promise<Esp32Node[]> => this.request<Esp32Node[]>(Methods.NodeList),
        sendCommand: (nodeId: string, command: Esp32Command): Promise<CommandResult> =>
            this.request<CommandResult>(Methods.NodeCommand, { nodeId, command })
    };

    federation = {
        getStatus: (): Promise<FederationStatus> => this.request<FederationStatus>(Methods.FederationStatus)
    };

    memory = {
        list: (kind?: string, limit = 100): Promise<MemoryEntry[]> =>
            this.request<MemoryEntry[]>(Methods.MemoryGet, { kind, limit }),
        search: (query: string, limit = 5): Promise<MemorySearchResult[]> =>
            this.request<MemorySearchResult[]>(Methods.MemorySearch, { query, limit }),
        stats: (): Promise<MemoryStats> => this.request<MemoryStats>(Methods.MemoryStats)
    };

    conversation = {
        list: (limit = 100): Promise<ConversationMessage[]> =>
            this.request<ConversationMessage[]>(Methods.ConversationList, { limit }),
        clear: (): Promise<void> =>
            this.request(Methods.ConversationClear).then(() => undefined)
    };

    system = {
        getStatus: (): Promise<SystemStatus> => this.request<SystemStatus>(Methods.SystemStatus),
        getLogs: (limit = 200): Promise<LogEntry[]> => this.request<LogEntry[]>(Methods.Logs, { limit }),
        getToolLog: (limit = 50): Promise<ToolCallRecord[]> => this.request<ToolCallRecord[]>(Methods.ToolLog, { limit })
    };

    on(channel: EventChannel, callback: (payload: unknown) => void): () => void {
        let set = this.listeners.get(channel);
        if (!set) {
            set = new Set();
            this.listeners.set(channel, set);
        }
        set.add(callback);
        return () => set.delete(callback);
    }

    // ------------------------------------------------------------------ internals
    private async request<T>(method: string, params?: unknown): Promise<T> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // The tunneled handshake can take a moment; wait for it before sending.
            if (!this.ready) throw new Error('Not connected to JARVIS Core');
            await Promise.race([
                this.ready,
                new Promise<never>((_, reject) => {
                    window.setTimeout(() => reject(new Error('Connection timed out')), 30000);
                })
            ]);
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                throw new Error('Not connected to JARVIS Core');
            }
        }
        const requestId = `web_${(++this.requestSeq).toString(36)}`;
        return new Promise<T>((resolve, reject) => {
            const timer = window.setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error(`Request ${method} timed out`));
            }, 30000);
            this.pending.set(requestId, { resolve: resolve as (data: unknown) => void, reject, timer });
            this.ws?.send(JSON.stringify({ type: 'request', requestId, method, params }));
        });
    }

    private onMessage(raw: string): void {
        let msg: unknown;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }
        const m = msg as Record<string, unknown>;
        switch (m.type) {
            case 'welcome': {
                this.readyResolve?.();
                this.readyResolve = null;
                this.setConnected(true);
                this.emit('events:connection', {
                    connected: true,
                    serverTime: m.serverTime as string | undefined
                });
                break;
            }
            case 'response': {
                const id = m.requestId as string;
                const p = this.pending.get(id);
                if (!p) return;
                this.pending.delete(id);
                window.clearTimeout(p.timer);
                if (m.ok) p.resolve(m.data);
                else p.reject(new Error((m.error as { message?: string } | null)?.message ?? 'Request failed'));
                break;
            }
            case 'event': {
                const channel = CHANNEL_MAP[m.channel as string];
                if (channel) this.emit(channel, m.payload);
                break;
            }
            case 'error': {
                this.emit('events:alert', {
                    level: 'error',
                    source: 'remote',
                    message: String(m.message ?? 'Core rejected the connection')
                });
                break;
            }
            default:
                break;
        }
    }

    private setConnected(value: boolean): void {
        if (this.connected === value) return;
        this.connected = value;
        this.emit('events:connection', { connected: value });
    }

    private scheduleReconnect(): void {
        if (this.manuallyClosed) return;
        if (this.reconnectTimer !== null) return;
        const delay = Math.min(15000, 2000 * 2 ** this.reconnectAttempts);
        this.reconnectAttempts += 1;
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    private rejectAll(error: Error): void {
        this.pending.forEach((p) => {
            window.clearTimeout(p.timer);
            p.reject(error);
        });
        this.pending.clear();
    }

    private emit(channel: EventChannel, payload: unknown): void {
        this.listeners.get(channel)?.forEach((fn) => fn(payload));
    }
}

export function createRemoteBridge(): RemoteBridge {
    const bridge = new RemoteBridge();
    if (typeof window !== 'undefined') bridge.connect();
    return bridge;
}

export type { AgentEvent };
