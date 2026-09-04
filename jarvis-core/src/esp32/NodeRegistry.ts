import type { Esp32Node, NodeMetrics, NodeStatus } from '../shared/types';
import { nowIso } from '../utils/time';
import type { LoggerLike } from '../logger';

export type NodeListener = (node: Esp32Node) => void;

/** In-memory registry of known ESP32 nodes. Owns the current node truth. */
export class NodeRegistry {
    private readonly nodes = new Map<string, Esp32Node>();
    private readonly listeners = new Set<NodeListener>();

    constructor(private readonly logger: LoggerLike) { }

    subscribe(listener: NodeListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    all(): Esp32Node[] {
        return [...this.nodes.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    get(id: string): Esp32Node | undefined {
        return this.nodes.get(id);
    }

    connectedCount(): number {
        let n = 0;
        for (const node of this.nodes.values()) {
            if (node.status === 'online' || node.status === 'training') n += 1;
        }
        return n;
    }

    upsert(
        id: string,
        partial: Partial<Esp32Node> & { name?: string; ip?: string; firmwareVersion?: string }
    ): Esp32Node {
        const existing = this.nodes.get(id);
        const node: Esp32Node = {
            id,
            name: partial.name ?? existing?.name ?? id,
            status: 'online',
            ip: partial.ip ?? existing?.ip ?? 'unknown',
            connectedAt: existing?.connectedAt ?? nowIso(),
            lastSeenAt: nowIso(),
            firmwareVersion: partial.firmwareVersion ?? existing?.firmwareVersion ?? '0.0.0',
            modelVersion: partial.modelVersion ?? existing?.modelVersion ?? null,
            signal: partial.signal ?? existing?.signal,
            battery: partial.battery ?? existing?.battery,
            metrics: partial.metrics ?? existing?.metrics ?? null
        };
        this.nodes.set(id, node);
        this.emit(node);
        return node;
    }

    updateMetrics(id: string, metrics: NodeMetrics): void {
        const node = this.nodes.get(id);
        if (!node) return;
        node.metrics = metrics;
        node.lastSeenAt = nowIso();
        this.emit(node);
    }

    setStatus(id: string, status: NodeStatus): void {
        const node = this.nodes.get(id);
        if (!node || node.status === status) return;
        node.status = status;
        this.emit(node);
        this.logger.info('node-registry', `Node ${node.name} (${id}) is now ${status}`);
    }

    markStale(timeoutMs: number): number {
        const cutoff = Date.now() - timeoutMs;
        let marked = 0;
        for (const node of this.nodes.values()) {
            if ((node.status === 'online' || node.status === 'training') && new Date(node.lastSeenAt).getTime() < cutoff) {
                node.status = 'offline';
                this.emit(node);
                marked += 1;
                this.logger.warn('node-registry', `Node ${node.name} (${node.id}) timed out`);
            }
        }
        return marked;
    }

    private emit(node: Esp32Node): void {
        this.listeners.forEach((fn) => fn(node));
    }
}
