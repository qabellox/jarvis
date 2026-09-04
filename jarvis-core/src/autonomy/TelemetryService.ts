import type { LoggerLike } from '../logger';
import type { ResearchRepository } from '../database/ResearchRepository';
import type { NodeRegistry } from '../esp32/NodeRegistry';
import type { FederationManager } from '../federation/FederationManager';
import type { SystemStatus } from '../shared/types';
import { nowIso } from '../utils/time';

const SAMPLE_INTERVAL_MS = 5_000;

/**
 * TelemetryService — samples system + fleet metrics on a fixed cadence into
 * the research database. This time-series is the empirical backbone of the
 * ISEF paper (latency, accuracy, convergence over rounds).
 */
export class TelemetryService {
    private timer: NodeJS.Timeout | null = null;

    constructor(
        private readonly logger: LoggerLike,
        private readonly repository: ResearchRepository,
        private readonly registry: NodeRegistry,
        private readonly federation: FederationManager,
        private readonly getSystemStatus: () => SystemStatus
    ) { }

    start(): void {
        this.timer = setInterval(() => void this.sample(), SAMPLE_INTERVAL_MS);
        this.timer.unref?.();
        void this.sample();
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    private async sample(): Promise<void> {
        try {
            const status = this.getSystemStatus();
            const ts = nowIso();
            await this.repository.recordTelemetry({ ts, kind: 'system.cpu', value: status.cpuUsage, meta: null });
            await this.repository.recordTelemetry({ ts, kind: 'system.mem_free_mb', value: status.memoryMb.free, meta: null });
            await this.repository.recordTelemetry({ ts, kind: 'nodes.online', value: status.nodeCount, meta: null });
            await this.repository.recordTelemetry({ ts, kind: 'federation.round', value: this.federation.getStatus().round, meta: null });
            await this.repository.recordTelemetry({ ts, kind: 'federation.accuracy', value: this.federation.getStatus().accuracy, meta: null });

            for (const node of this.registry.all()) {
                if (!node.metrics) continue;
                await this.repository.recordTelemetry({
                    ts,
                    kind: `node.${node.id}.accuracy`,
                    value: node.metrics.accuracy,
                    meta: node.name
                });
                await this.repository.recordTelemetry({
                    ts,
                    kind: `node.${node.id}.latency_ms`,
                    value: node.metrics.latencyMs,
                    meta: node.name
                });
            }
        } catch (error) {
            this.logger.warn('telemetry', `Telemetry sample failed: ${String(error)}`);
        }
    }
}
