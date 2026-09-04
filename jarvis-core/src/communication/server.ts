import type { LoggerLike } from '../logger';
import { ClientManager } from './ClientManager';
import { CoreWebSocketServer } from './WebSocketServer';
import { CoreHttpServer } from './HttpServer';
import type { CoreApi } from './api';

/**
 * Communication layer composition: WebSocket (real-time) + REST (simple HTTP),
 * both backed by the same CoreApi and ClientManager.
 */
export class CoreServer {
    private readonly ws: CoreWebSocketServer;
    private readonly http: CoreHttpServer;

    constructor(
        private readonly api: CoreApi,
        private readonly logger: LoggerLike,
        readonly clients: ClientManager,
        host: string,
        wsPort: number,
        httpPort: number
    ) {
        this.ws = new CoreWebSocketServer(host, wsPort, api, logger, this.clients);
        this.http = new CoreHttpServer(host, httpPort, api, logger);
    }

    async start(): Promise<void> {
        await this.ws.start();
        await this.http.start();
    }

    stop(): void {
        this.ws.stop();
        this.http.stop();
    }
}
