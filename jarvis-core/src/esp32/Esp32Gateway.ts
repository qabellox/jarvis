import { WebSocketServer, type WebSocket } from 'ws';
import type { RawData } from 'ws';
import type { CommandResult, Esp32Command } from '../shared/types';
import { newId } from '../utils/id';
import { nowIso } from '../utils/time';
import { Esp32Error, toJarvisError } from '../utils/errors';
import type { LoggerLike } from '../logger';
import type { NodeRegistry } from './NodeRegistry';
import type { FederationManager } from '../federation/FederationManager';

const COMMAND_TIMEOUT_MS = 10_000;
const PRUNE_INTERVAL_MS = 15_000;
const WS_OPEN = 1;

interface PendingCommand {
    resolve: (result: CommandResult) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
}

interface NodeSocket {
    ws: WebSocket;
    nodeId: string | null;
}

/**
 * ESP32 Gateway — the real-world interface. ESP32 boards connect here,
 * register, stream metrics, report federated round results, and receive
 * commands. Runs inside the Core so every client shares the same fleet view.
 */
export class Esp32Gateway {
    private wss: WebSocketServer | null = null;
    private readonly sockets = new Map<string, NodeSocket>();
    private readonly pending = new Map<string, PendingCommand>();
    private readonly pruneTimer: NodeJS.Timeout;
    private readonly nodeTimeoutMs: number;

    constructor(
        private readonly host: string,
        private readonly port: number,
        private readonly logger: LoggerLike,
        private readonly registry: NodeRegistry,
        private readonly federation: FederationManager,
        nodeTimeoutMs: number
    ) {
        this.nodeTimeoutMs = nodeTimeoutMs;
        this.pruneTimer = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
        this.pruneTimer.unref?.();
    }

    start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                this.wss = new WebSocketServer({ host: this.host, port: this.port });
                this.wss.on('listening', () => {
                    this.logger.info('esp32-gateway', `ESP32 gateway listening on ${this.host}:${this.port}`);
                    resolve();
                });
                this.wss.on('error', (error) => {
                    this.logger.error('esp32-gateway', `Gateway error: ${String(error)}`);
                    reject(error);
                });
                this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
            } catch (error) {
                reject(toJarvisError(error, 'WS_START'));
            }
        });
    }

    stop(): void {
        clearInterval(this.pruneTimer);
        this.wss?.close();
        this.wss = null;
        for (const [, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(new Esp32Error('Gateway shut down'));
        }
        this.pending.clear();
    }

    private onConnection(ws: WebSocket, req: { socket?: { remoteAddress?: string } }): void {
        const ip = req.socket?.remoteAddress ?? 'unknown';
        const entry: NodeSocket = { ws, nodeId: null };
        this.sockets.set(ip + Math.random(), entry);

        ws.on('message', (raw) => this.handleMessage(ws, raw));
        ws.on('close', () => {
            if (entry.nodeId) this.registry.setStatus(entry.nodeId, 'offline');
            for (const [key, value] of this.sockets) {
                if (value.ws === ws) this.sockets.delete(key);
            }
            this.federation.setExpectedParticipants(this.registry.connectedCount());
        });
        ws.on('error', () => {
            /* handled by close */
        });
        this.logger.info('esp32-gateway', `Inbound connection from ${ip}`);
    }

    private handleMessage(ws: WebSocket, raw: RawData): void {
        let msg: Record<string, unknown>;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            this.logger.warn('esp32-gateway', 'Received non-JSON message');
            return;
        }
        switch (msg.type) {
            case 'hello':
                this.handleHello(ws, msg);
                break;
            case 'metrics':
                this.handleMetrics(msg);
                break;
            case 'round_result':
                this.handleRoundResult(msg);
                break;
            case 'ack':
                this.handleAck(msg);
                break;
            case 'log':
                this.logger.info('esp32-gateway', String(msg.message ?? 'node log'), { level: msg.level });
                break;
            default:
                this.logger.debug('esp32-gateway', `Unhandled message type: ${String(msg.type)}`);
        }
    }

    private handleHello(ws: WebSocket, msg: Record<string, unknown>): void {
        const nodeId = String(msg.nodeId ?? '');
        if (!nodeId) {
            ws.send(JSON.stringify({ type: 'error', message: 'missing nodeId' }));
            return;
        }
        const name = String(msg.name ?? nodeId);
        const firmwareVersion = String(msg.firmwareVersion ?? '0.0.0');

        for (const entry of this.sockets.values()) {
            if (entry.ws === ws) entry.nodeId = nodeId;
        }
        for (const [key, entry] of this.sockets) {
            if (entry.nodeId === nodeId && entry.ws !== ws) {
                entry.ws.close();
                this.sockets.delete(key);
            }
        }

        this.registry.upsert(nodeId, { name, firmwareVersion });
        ws.send(JSON.stringify({ type: 'welcome', serverTime: nowIso() }));
        this.federation.setExpectedParticipants(this.registry.connectedCount());
        this.logger.info('esp32-gateway', `Node registered: ${name} (${nodeId}) fw ${firmwareVersion}`);
    }

    private handleMetrics(msg: Record<string, unknown>): void {
        const nodeId = String(msg.nodeId ?? '');
        if (!nodeId) return;
        this.registry.updateMetrics(nodeId, {
            accuracy: Number(msg.accuracy ?? 0),
            loss: Number(msg.loss ?? 0),
            latencyMs: Number(msg.latencyMs ?? 0),
            modelSizeBytes: Number(msg.modelSizeBytes ?? 0),
            round: Number(msg.round ?? 0),
            samples: Number(msg.samples ?? 0)
        });
        const node = this.registry.get(nodeId);
        if (node) {
            if (typeof msg.signal === 'number') node.signal = msg.signal;
            if (typeof msg.battery === 'number') node.battery = msg.battery;
        }
    }

    private handleRoundResult(msg: Record<string, unknown>): void {
        const nodeId = String(msg.nodeId ?? '');
        if (!nodeId) return;
        this.federation.onNodeRoundResult(nodeId, {
            accuracy: Number(msg.accuracy ?? 0),
            loss: Number(msg.loss ?? 0),
            latencyMs: Number(msg.latencyMs ?? 0),
            modelSizeBytes: Number(msg.modelSizeBytes ?? 0),
            round: Number(msg.round ?? 0),
            samples: Number(msg.samples ?? 0)
        });
    }

    private handleAck(msg: Record<string, unknown>): void {
        const commandId = String(msg.commandId ?? '');
        const pending = this.pending.get(commandId);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(commandId);
        pending.resolve({
            ok: Boolean(msg.ok),
            message: String(msg.message ?? (msg.ok ? 'Acknowledged' : 'Command rejected')),
            data: msg.data,
            at: nowIso()
        });
    }

    async sendCommand(nodeId: string, command: Esp32Command): Promise<CommandResult> {
        if (nodeId === 'all') {
            const results: CommandResult[] = [];
            for (const node of this.registry.all()) {
                if (node.status === 'online' || node.status === 'training') {
                    results.push(await this.sendCommand(node.id, command));
                }
            }
            return {
                ok: results.every((r) => r.ok),
                message: `Broadcast to ${results.length} node(s)`,
                data: results,
                at: nowIso()
            };
        }

        const entry = [...this.sockets.values()].find((s) => s.nodeId === nodeId);
        if (!entry || entry.ws.readyState !== WS_OPEN) {
            throw new Esp32Error(`Node ${nodeId} is not connected`);
        }

        const commandId = newId('cmd');
        const result = await new Promise<CommandResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(commandId);
                reject(new Esp32Error(`Command ${command.type} timed out on node ${nodeId}`));
            }, COMMAND_TIMEOUT_MS);
            this.pending.set(commandId, { resolve, reject, timer });
            entry.ws.send(JSON.stringify({ type: 'command', commandId, payload: command }));
        });
        return { ...result, nodeId };
    }

    broadcast(payload: unknown): void {
        const json = JSON.stringify(payload);
        for (const entry of this.sockets.values()) {
            if (entry.ws.readyState === WS_OPEN) entry.ws.send(json);
        }
    }

    private prune(): void {
        const marked = this.registry.markStale(this.nodeTimeoutMs);
        if (marked > 0) this.federation.setExpectedParticipants(this.registry.connectedCount());
    }
}
