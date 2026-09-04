import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Esp32Command } from '../shared/types';
import { Methods } from '../shared/protocol';
import { toJarvisError } from '../utils/errors';
import { nowIso } from '../utils/time';
import type { LoggerLike } from '../logger';
import { dispatch, type CoreApi } from './api';

/**
 * Lightweight REST API (Node http, no framework). Useful for health checks,
 * simple integrations and the research export. Streaming agent events still
 * flow over WebSocket, so this stays small and focused.
 */
export class CoreHttpServer {
    private server: ReturnType<typeof createServer> | null = null;

    constructor(
        private readonly host: string,
        private readonly port: number,
        private readonly api: CoreApi,
        private readonly logger: LoggerLike
    ) { }

    start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.server = createServer((req, res) => void this.handle(req, res));
            this.server.on('error', (error) => {
                this.logger.error('core-http', `HTTP server error: ${String(error)}`);
                reject(error);
            });
            this.server.listen(this.port, this.host, () => {
                this.logger.info('core-http', `Core REST API on http://${this.host}:${this.port}`);
                resolve();
            });
        });
    }

    stop(): void {
        this.server?.close();
        this.server = null;
    }

    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        this.setCors(res);
        try {
            const accessToken = this.api.config.accessToken;
            if (accessToken && req.headers['x-jarvis-token'] !== accessToken) {
                return this.json(res, 401, { ok: false, error: 'unauthorized' });
            }
            const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
            const segments = pathname.split('/').filter(Boolean);
            const method = req.method ?? 'GET';

            if (method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            // /health
            if (pathname === '/health') {
                return this.json(res, 200, {
                    status: 'ok',
                    version: this.api.config.version,
                    uptimeSeconds: Math.floor((Date.now() - this.api.startedAt) / 1000),
                    clients: this.api.clients.countByType(),
                    time: nowIso()
                });
            }

            // /tools
            if (pathname === '/tools') {
                return this.json(res, 200, this.api.tools.definitions());
            }

            // /nodes
            if (pathname === '/nodes' && method === 'GET') {
                return this.json(res, 200, this.api.registry.all());
            }

            // /nodes/command
            if (pathname === '/nodes/command' && method === 'POST') {
                const body = await this.readJson<{ nodeId: string; command: Esp32Command }>(req);
                const result = await dispatch(Methods.NodeCommand, body, this.api);
                return this.json(res, result.ok ? 200 : 400, result);
            }

            // /federation
            if (pathname === '/federation') {
                const status = this.api.federation.getStatus();
                return this.json(res, 200, status);
            }

            // /agent/run
            if (pathname === '/agent/run' && method === 'POST') {
                const body = await this.readJson<{ prompt: string }>(req);
                const result = await dispatch(Methods.AgentRun, body, this.api);
                return this.json(res, result.ok ? 202 : 400, result);
            }

            // /agent/cancel
            if (pathname === '/agent/cancel' && method === 'POST') {
                const body = await this.readJson<{ sessionId: string }>(req);
                const result = await dispatch(Methods.AgentCancel, body, this.api);
                return this.json(res, 200, result);
            }

            // /memory
            if (pathname === '/memory' && method === 'GET') {
                const query = req.url?.split('?')[1] ?? '';
                const params = new URLSearchParams(query);
                if (params.has('q')) {
                    const result = await dispatch(Methods.MemorySearch, { query: params.get('q'), limit: Number(params.get('limit') || 5) }, this.api);
                    return this.json(res, 200, result);
                }
                const result = await dispatch(Methods.MemoryGet, { kind: params.get('kind') ?? undefined, limit: Number(params.get('limit') || 100) }, this.api);
                return this.json(res, 200, result);
            }

            // /memory/stats
            if (pathname === '/memory/stats') {
                const result = await dispatch(Methods.MemoryStats, {}, this.api);
                return this.json(res, 200, result);
            }

            // /logs
            if (pathname === '/logs') {
                const limit = Number(req.url?.split('?')[1]?.split('=')[1] || 200);
                return this.json(res, 200, this.api.logger.recent(limit));
            }

            // /tools/log
            if (pathname === '/tools/log') {
                const limit = Number(req.url?.split('?')[1]?.split('=')[1] || 50);
                const calls = await this.api.toolLog(limit);
                return this.json(res, 200, calls);
            }

            // /research/export
            if (pathname === '/research/export') {
                const result = await dispatch(Methods.ResearchExport, {}, this.api);
                return this.json(res, 200, result);
            }

            // /stats
            if (pathname === '/stats') {
                const result = await dispatch(Methods.Stats, {}, this.api);
                return this.json(res, 200, result);
            }

            return this.json(res, 404, { ok: false, error: 'Not found' });
        } catch (error) {
            const jarvisError = toJarvisError(error);
            return this.json(res, 500, { ok: false, error: { code: jarvisError.code, message: jarvisError.message } });
        }
    }

    private setCors(res: ServerResponse): void {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    private json(res: ServerResponse, status: number, payload: unknown): void {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
    }

    private readJson<T>(req: IncomingMessage): Promise<T> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
                try {
                    const raw = Buffer.concat(chunks).toString('utf8') || '{}';
                    resolve(JSON.parse(raw) as T);
                } catch (error) {
                    reject(toJarvisError(error, 'BAD_JSON'));
                }
            });
            req.on('error', reject);
        });
    }
}
