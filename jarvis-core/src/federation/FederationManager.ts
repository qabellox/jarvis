import type { FederationRound, FederationStatus, NodeMetrics } from '../shared/types';
import { nowIso } from '../utils/time';
import type { LoggerLike } from '../logger';
import type { ResearchRepository } from '../database/ResearchRepository';

export type FederationListener = (status: FederationStatus) => void;

/**
 * Federated Learning coordinator — a minimal FederatedAveraging state machine
 * over the ESP32 fleet. Nodes train locally; this service collects, aggregates
 * and commits global rounds to the research database.
 */
export class FederationManager {
    private status: FederationStatus;
    private readonly roundResults = new Map<string, NodeMetrics>();
    private readonly listeners = new Set<FederationListener>();

    constructor(
        private readonly algorithm: string,
        private readonly logger: LoggerLike,
        private readonly repository: ResearchRepository
    ) {
        this.status = {
            active: false,
            algorithm,
            round: 0,
            targetRound: 0,
            participants: 0,
            totalNodes: 0,
            accuracy: 0,
            loss: 0,
            startedAt: null,
            history: []
        };
    }

    async init(): Promise<void> {
        const history = await this.repository.getRounds();
        this.status.history = history;
        if (history.length > 0) {
            const last = history[history.length - 1];
            this.status.round = last.round;
            this.status.accuracy = last.accuracy;
            this.status.loss = last.loss;
        }
        this.emit();
    }

    getStatus(): FederationStatus {
        return this.status;
    }

    subscribe(listener: FederationListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    setExpectedParticipants(count: number): void {
        this.status.totalNodes = count;
        this.emit();
    }

    startTraining(rounds = 5): void {
        this.status = {
            ...this.status,
            active: true,
            round: 0,
            targetRound: rounds,
            participants: 0,
            accuracy: 0,
            loss: 0,
            startedAt: nowIso()
        };
        this.roundResults.clear();
        this.logger.info('federation', `Training started: ${this.algorithm}, ${rounds} rounds`);
        this.emit();
    }

    stopTraining(): void {
        this.status = { ...this.status, active: false, targetRound: 0, startedAt: null };
        this.roundResults.clear();
        this.logger.info('federation', 'Training stopped');
        this.emit();
    }

    onNodeRoundResult(nodeId: string, metrics: NodeMetrics): void {
        if (!this.status.active) return;
        this.roundResults.set(nodeId, metrics);
        this.logger.debug('federation', `Round result from ${nodeId}`, { metrics });
        if (this.roundResults.size >= Math.max(1, this.status.totalNodes)) {
            this.commitRound();
        }
    }

    private commitRound(): void {
        const list = [...this.roundResults.values()];
        const mean = (fn: (m: NodeMetrics) => number): number =>
            list.reduce((sum, m) => sum + fn(m), 0) / list.length;

        const round: FederationRound = {
            round: this.status.round + 1,
            algorithm: this.status.algorithm,
            accuracy: Number(mean((m) => m.accuracy).toFixed(2)),
            loss: Number(mean((m) => m.loss).toFixed(4)),
            avgLatencyMs: Number(mean((m) => m.latencyMs).toFixed(1)),
            modelSizeBytes: Math.max(...list.map((m) => m.modelSizeBytes)),
            participants: list.length,
            timestamp: nowIso()
        };

        this.status.history = [...this.status.history, round].slice(-100);
        this.status.round = round.round;
        this.status.participants = list.length;
        this.status.accuracy = round.accuracy;
        this.status.loss = round.loss;
        if (this.status.round >= this.status.targetRound) {
            this.status.active = false;
            this.status.startedAt = null;
        }
        this.roundResults.clear();

        void this.repository.recordFederationRound(round);
        this.logger.info(
            'federation',
            `Round ${round.round} committed | accuracy ${round.accuracy}% | latency ${round.avgLatencyMs}ms | ${round.participants} participants`
        );
        this.emit();
    }

    private emit(): void {
        this.listeners.forEach((fn) => fn(this.status));
    }
}
