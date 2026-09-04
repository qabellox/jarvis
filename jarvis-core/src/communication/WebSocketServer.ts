import { WebSocketServer, type WebSocket } from 'ws';
import type { RawData } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/protocol';
import { toJarvisError } from '../utils/errors';
import { newId } from '../utils/id';
import { nowIso } from '../utils/time';
import type { LoggerLike } from '../logger';
import { ClientManager, newClientId, clientConnectedAt } from './ClientManager';
import { dispatch, type CoreApi } from './api';

const HEARTBEAT_INTERVAL_MS = 30_000;

type AliveSocket = WebSocket & { isAlive?: boolean; jarvisClientId?: string };

/**
 * WebSocket server — the primary real-time door into the Core.
 * Clients (Electron, Telegram, web) connect, say hello, send typed requests,
 * and receive streamed events. Heartbeats prune dead sockets.
 */
export class CoreWebSocketServer {
    private wss: WebSocketServer | null = null;
    private readonly sockets = new Set<AliveSocket>();
    private heartbeat: NodeJS.Timeout | null = null;

    constructor(
        private readonly host: string,
        private readonly port: number,
        private readonly api: CoreApi,
        private readonly logger: LoggerLike,
        private readonly clients: ClientManager
    ) { }

    start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                this.wss = new WebSocketServer({ host: this.host, port: this.port });
                this.wss.on('listening', () => {
                    this.logger.info('core-ws', `Core WebSocket server on ${this.host}:${this.port}`);
                    this.heartbeat = setInterval(() => this.pingAll(), HEARTBEAT_INTERVAL_MS);
                    this.heartbeat.unref?.();
                    resolve();
                });
                this.wss.on('error', (error) => {
                    this.logger.error('core-ws', `WebSocket error: ${String(error)}`);
                    reject(error);
                });
                this.wss.on('connection', (ws) => this.onConnection(ws as AliveSocket));
            } catch (error) {
                reject(toJarvisError(error, 'WS_START'));
            }
        });
    }

    stop(): void {
        if (this.heartbeat) clearInterval(this.heartbeat);
        for (const socket of this.sockets) socket.terminate();
        this.sockets.clear();
        this.wss?.close();
        this.wss = null;
    }

    private onConnection(ws: AliveSocket): void {
        ws.isAlive = true;
        this.sockets.add(ws);

        ws.on('pong', () => {
            ws.isAlive = true;
        });
        ws.on('message', (raw) => void this.handleMessage(ws, raw));
        ws.on('close', () => {
            this.sockets.delete(ws);
            if (ws.jarvisClientId) {
                this.clients.unregister(ws.jarvisClientId);
                this.logger.info('core-ws', `Client disconnected: ${ws.jarvisClientId}`);
            }
        });
        ws.on('error', () => {
            this.sockets.delete(ws);
            if (ws.jarvisClientId) this.clients.unregister(ws.jarvisClientId);
        });
    }

    private async handleMessage(ws: AliveSocket, raw: RawData): Promise<void> {
        let msg: ClientMessage;
        try {
            msg = JSON.parse(raw.toString()) as ClientMessage;
        } catch {
            ws.send(JSON.stringify({ type: 'error', message: 'invalid json' }));
            return;
        }

        switch (msg.type) {
            case 'hello':
                this.bindClient(ws, msg);
                break;
            case 'request':
                await this.handleRequest(ws, msg);
                break;
            case 'pong':
                ws.isAlive = true;
                break;
            default:
                this.logger.debug('core-ws', `Unhandled client message: ${(msg as { type?: string }).type}`);
        }
    }

    private bindClient(ws: AliveSocket, hello: Extract<ClientMessage, { type: 'hello' }>): void {
        const accessToken = this.api.config.accessToken;
        if (accessToken && hello.token !== accessToken) {
            this.logger.warn('core-ws', `Rejected client: missing/invalid access token`);
            ws.send(JSON.stringify({ type: 'error', message: 'unauthorized' }));
            ws.close(4001, 'unauthorized');
            return;
        }
        const clientId = hello.clientId || newClientId(hello.clientType);
        ws.jarvisClientId = clientId;

        this.clients.register({
            id: clientId,
            type: hello.clientType,
            version: hello.version,
            connectedAt: clientConnectedAt(),
            send: (message: ServerMessage): void => {
                if (ws.readyState === 1 /* OPEN */) ws.send(JSON.stringify(message));
            }
        });

        ws.send(
            JSON.stringify({
                type: 'welcome',
                serverTime: nowIso(),
                capabilities: this.api.tools.names()
            } satisfies ServerMessage)
        );

        this.logger.info('core-ws', `${hello.clientType} client connected: ${clientId} (v${hello.version})`);
    }

    private async handleRequest(ws: AliveSocket, request: Extract<ClientMessage, { type: 'request' }>): Promise<void> {
        const requestId = request.requestId || newId('req');
        const result = await dispatch(request.method, request.params, this.api);
        const message: ServerMessage = {
            type: 'response',
            requestId,
            ok: result.ok,
            data: result.data,
            error: result.error
        };
        if (ws.readyState === 1 /* OPEN */) ws.send(JSON.stringify(message));
    }

    private pingAll(): void {
        for (const socket of this.sockets) {
            if (!socket.isAlive) {
                socket.terminate();
                this.sockets.delete(socket);
                continue;
            }
            socket.isAlive = false;
            socket.ping();
        }
    }
}
