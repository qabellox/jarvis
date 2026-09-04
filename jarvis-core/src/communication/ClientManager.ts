import type { ClientType, ServerMessage } from '../shared/protocol';
import { nowIso } from '../utils/time';

export interface ConnectedClient {
    id: string;
    type: ClientType;
    version: string;
    connectedAt: string;
    send: (message: ServerMessage) => void;
}

/**
 * ClientManager — tracks every connected client (Electron, Telegram, web, CLI)
 * and owns the two delivery primitives:
 *  - broadcast(channel, payload): push a domain event to ALL clients.
 *  - sendTo(type, payload): route a message to a specific client type
 *    (used by send_telegram_message and the proactive monitor).
 */
export class ClientManager {
    private readonly clients = new Map<string, ConnectedClient>();
    private readonly connectListeners = new Set<(client: ConnectedClient) => void>();
    private readonly disconnectListeners = new Set<(id: string) => void>();

    register(client: ConnectedClient): void {
        this.clients.set(client.id, client);
        this.connectListeners.forEach((fn) => fn(client));
    }

    unregister(id: string): void {
        if (this.clients.delete(id)) {
            this.disconnectListeners.forEach((fn) => fn(id));
        }
    }

    get(id: string): ConnectedClient | undefined {
        return this.clients.get(id);
    }

    all(): ConnectedClient[] {
        return [...this.clients.values()];
    }

    countByType(): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const client of this.clients.values()) {
            counts[client.type] = (counts[client.type] ?? 0) + 1;
        }
        return counts;
    }

    broadcast(channel: string, payload: unknown): void {
        const message: ServerMessage = { type: 'event', channel, payload };
        for (const client of this.clients.values()) {
            try {
                client.send(message);
            } catch {
                /* drop dead sockets; the heartbeat prunes them */
            }
        }
    }

    /** Route a message to the first client of the given type. Returns false if none. */
    sendTo(type: ClientType, payload: unknown): boolean {
        const client = [...this.clients.values()].find((c) => c.type === type);
        if (!client) return false;
        try {
            client.send({ type: 'message', to: type, payload });
            return true;
        } catch {
            return false;
        }
    }

    onConnect(listener: (client: ConnectedClient) => void): () => void {
        this.connectListeners.add(listener);
        return () => this.connectListeners.delete(listener);
    }

    onDisconnect(listener: (id: string) => void): () => void {
        this.disconnectListeners.add(listener);
        return () => this.disconnectListeners.delete(listener);
    }
}

export function newClientId(type: ClientType): string {
    return `${type}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function clientConnectedAt(): string {
    return nowIso();
}
