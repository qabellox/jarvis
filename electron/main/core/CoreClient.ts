import WebSocket from 'ws';
import type { ClientMessage, CoreChannel, ServerMessage } from '../../shared/protocol';
import { newId } from '../utils/id';
import { toJarvisError } from '../utils/errors';
import type { LoggerLike } from '../services/logger';

export type CoreConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface PendingRequest {
    resolve: (data: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
}

/**
 * CoreClient — the Electron app's only link to the JARVIS Core.
 *
 * The desktop client is now a thin shell: all intelligence, tools, ESP32
 * gateway, memory and research data live in the Core. This class manages the
 * WebSocket connection (with auto-reconnect), typed request/response, and
 * real-time event subscriptions that keep the UI alive.
 */
export class CoreClient {
    private ws: WebSocket | null = null;
    private readonly pending = new Map<string, PendingRequest>();
    private readonly eventListeners = new Map<string, Set<(payload: unknown) => void>>();
    private readonly statusListeners = new Set<(status: CoreConnectionStatus) => void>();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private manuallyClosed = false;
    private status: CoreConnectionStatus = 'disconnected';
    private readonly clientId: string;

    constructor(
        private readonly url: string,
        private readonly version: string,
        private readonly logger: LoggerLike,
        private readonly reconnectDelayMs = 3000
    ) {
        this.clientId = `electron_${Date.now().toString(36)}`;
    }

    connect(): void {
        this.manuallyClosed = false;
        this.setStatus('connecting');
        this.logger.info('core-client', `Connecting to JARVIS Core at ${this.url}`);

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.on('open', () => {
            this.send({
                type: 'hello',
                clientType: 'electron',
                clientId: this.clientId,
                version: this.version,
                token: process.env.JARVIS_ACCESS_TOKEN
            });
        });
        ws.on('message', (raw) => this.onMessage(raw));
        ws.on('close', () => {
            this.setStatus('disconnected');
            this.rejectAll();
            this.scheduleReconnect();
        });
        ws.on('error', (error) => {
            this.logger.warn('core-client', `WebSocket error: ${String(error)}`);
        });
    }

    getStatus(): CoreConnectionStatus {
        return this.status;
    }

    onStatusChange(listener: (status: CoreConnectionStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    onEvent(channel: CoreChannel, listener: (payload: unknown) => void): () => void {
        let set = this.eventListeners.get(channel);
        if (!set) {
            set = new Set();
            this.eventListeners.set(channel, set);
        }
        set.add(listener);
        return () => set.delete(listener);
    }

    async request<T>(method: string, params?: unknown, timeoutMs = 15000): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== 1 /* OPEN */) {
                reject(new Error('JARVIS Core is not connected'));
                return;
            }
            const requestId = newId('req');
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error(`Core request timed out: ${method}`));
            }, timeoutMs);
            this.pending.set(requestId, {
                resolve: (data) => resolve(data as T),
                reject,
                timer
            });
            this.send({ type: 'request', requestId, method, params });
        });
    }

    dispose(): void {
        this.manuallyClosed = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.ws?.close();
        this.ws = null;
    }

    private onMessage(raw: WebSocket.RawData): void {
        let msg: ServerMessage;
        try {
            msg = JSON.parse(raw.toString()) as ServerMessage;
        } catch (error) {
            this.logger.debug('core-client', 'Ignoring non-JSON message');
            void error;
            return;
        }

        switch (msg.type) {
            case 'welcome':
                this.setStatus('connected');
                this.logger.info('core-client', `Connected to Core v${this.version} | capabilities: ${msg.capabilities.join(', ')}`);
                break;
            case 'response':
                this.resolveResponse(msg);
                break;
            case 'event':
                this.emit(msg.channel, msg.payload);
                break;
            case 'message':
                // Routed (telegram-directed) messages are handled by the bot, not the desktop client.
                break;
            case 'ping':
                this.send({ type: 'pong' });
                break;
        }
    }

    private resolveResponse(msg: Extract<ServerMessage, { type: 'response' }>): void {
        const pending = this.pending.get(msg.requestId);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(msg.requestId);
        if (msg.ok) {
            pending.resolve(msg.data);
        } else {
            pending.reject(new Error(msg.error?.message ?? 'Core request failed'));
        }
    }

    private emit(channel: string, payload: unknown): void {
        this.eventListeners.get(channel)?.forEach((fn) => {
            try {
                fn(payload);
            } catch {
                /* subscriber errors must not break the client */
            }
        });
    }

    private send(message: ClientMessage): void {
        if (this.ws && this.ws.readyState === 1 /* OPEN */) {
            this.ws.send(JSON.stringify(message));
        }
    }

    private setStatus(status: CoreConnectionStatus): void {
        if (this.status === status) return;
        this.status = status;
        this.statusListeners.forEach((fn) => fn(status));
    }

    private rejectAll(): void {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(toJarvisError(new Error('JARVIS Core disconnected'), 'CORE_DISCONNECTED'));
        }
        this.pending.clear();
    }

    private scheduleReconnect(): void {
        if (this.manuallyClosed || this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelayMs);
    }
}
