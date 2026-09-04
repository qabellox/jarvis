import WebSocket from 'ws';
import type { ClientMessage, ServerMessage } from './protocol';

export type CoreConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface PendingRequest {
    resolve: (data: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
}

/**
 * Minimal WebSocket client for the JARVIS Core (shared by the Telegram bot).
 */
export class CoreClient {
    private ws: WebSocket | null = null;
    private readonly pending = new Map<string, PendingRequest>();
    private readonly eventListeners = new Map<string, Set<(payload: unknown) => void>>();
    private readonly statusListeners = new Set<(status: CoreConnectionStatus) => void>();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private manuallyClosed = false;
    private status: CoreConnectionStatus = 'disconnected';

    constructor(
        private readonly url: string,
        private readonly version: string,
        private readonly reconnectDelayMs = 4000
    ) { }

    connect(): void {
        this.manuallyClosed = false;
        this.setStatus('connecting');
        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.on('open', () => {
            this.send({
                type: 'hello',
                clientType: 'telegram',
                clientId: `telegram_${Date.now().toString(36)}`,
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
        ws.on('error', () => {
            /* handled by close */
        });
    }

    getStatus(): CoreConnectionStatus {
        return this.status;
    }

    onStatusChange(listener: (status: CoreConnectionStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    onEvent(channel: string, listener: (payload: unknown) => void): () => void {
        let set = this.eventListeners.get(channel);
        if (!set) {
            set = new Set();
            this.eventListeners.set(channel, set);
        }
        set.add(listener);
        return () => set.delete(listener);
    }

    request<T>(method: string, params?: unknown, timeoutMs = 20000): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== 1 /* OPEN */) {
                reject(new Error('JARVIS Core is not connected'));
                return;
            }
            const requestId = `tg_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e5)}`;
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
        } catch {
            return;
        }
        switch (msg.type) {
            case 'welcome':
                this.setStatus('connected');
                break;
            case 'response':
                this.resolveResponse(msg);
                break;
            case 'event':
                if (msg.channel) this.emit(msg.channel, msg.payload);
                break;
            case 'message':
                this.emit('__route__', msg.payload);
                break;
            case 'ping':
                this.send({ type: 'pong' });
                break;
        }
    }

    private resolveResponse(msg: ServerMessage): void {
        const pending = msg.requestId ? this.pending.get(msg.requestId) : undefined;
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(msg.requestId!);
        if (msg.ok) pending.resolve(msg.data);
        else pending.reject(new Error(msg.error?.message ?? 'Core request failed'));
    }

    private emit(channel: string, payload: unknown): void {
        this.eventListeners.get(channel)?.forEach((fn) => {
            try {
                fn(payload);
            } catch {
                /* never break on a subscriber */
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
            pending.reject(new Error('JARVIS Core disconnected'));
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
