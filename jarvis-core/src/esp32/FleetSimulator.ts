import type { LoggerLike } from '../logger';
import type { NodeRegistry } from './NodeRegistry';
import type { FederationManager } from '../federation/FederationManager';

const SIM_NODES = [
    { id: 'esp32-001', name: 'ESP32-1', ip: '192.168.1.21', accuracy: 88.6, loss: 0.141, latency: 23.4 },
    { id: 'esp32-002', name: 'ESP32-2', ip: '192.168.1.22', accuracy: 91.9, loss: 0.102, latency: 25.1 },
    { id: 'esp32-003', name: 'ESP32-3', ip: '192.168.1.23', accuracy: 95.1, loss: 0.074, latency: 21.9 }
];

export interface FleetSimulatorOptions {
    fleet: boolean;
    autoTrain: boolean;
}

/**
 * FleetSimulator — keeps the platform alive and demonstrable without hardware.
 *
 * When no real ESP32 boards are connected, the simulator:
 *  - registers a 3-node fleet with live metrics and logs,
 *  - steps aside the moment real hardware connects,
 *  - and (optionally) runs continuous federated training rounds so the
 *    dashboard shows real convergence in real time.
 *
 * Disable with JARVIS_DEMO_FLEET=0 / JARVIS_DEMO_AUTO_TRAIN=0.
 */
export class FleetSimulator {
    private timer: NodeJS.Timeout | null = null;
    private autoTrainTimer: NodeJS.Timeout | null = null;
    private prevActive = false;
    private idleSince = 0;

    constructor(
        private readonly registry: NodeRegistry,
        private readonly federation: FederationManager,
        private readonly logger: LoggerLike,
        private readonly options: FleetSimulatorOptions
    ) { }

    start(): void {
        if (!this.options.fleet) return;
        this.bootstrap();
        this.timer = setInterval(() => this.tick(), 4000);
        this.timer.unref?.();
        if (this.options.autoTrain) {
            this.autoTrainTimer = setTimeout(() => {
                if (!this.realHardwarePresent()) {
                    this.federation.startTraining(5);
                    this.logger.info('fleet-simulator', 'Demo training run started (no ESP32 hardware detected)');
                }
            }, 6000);
            this.autoTrainTimer.unref?.();
        }
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        if (this.autoTrainTimer) clearTimeout(this.autoTrainTimer);
        this.timer = null;
        this.autoTrainTimer = null;
    }

    /** True when a real (non-simulated) node is online — the simulator steps aside. */
    private realHardwarePresent(): boolean {
        return this.registry
            .all()
            .some((n) => !SIM_NODES.some((s) => s.id === n.id) && (n.status === 'online' || n.status === 'training'));
    }

    private bootstrap(): void {
        this.logger.info('esp32-gateway', 'WebSocket gateway listening on 0.0.0.0:8765');
        for (const sim of SIM_NODES) {
            const node = this.registry.upsert(sim.id, { name: sim.name, ip: sim.ip, firmwareVersion: '0.4.2' });
            node.modelVersion = 'tiny-mnist-v3';
            node.signal = -52;
            node.battery = 88;
            this.registry.updateMetrics(sim.id, {
                accuracy: sim.accuracy,
                loss: sim.loss,
                latencyMs: sim.latency,
                modelSizeBytes: 61200,
                round: 0,
                samples: 1200
            });
            this.logger.info('esp32-gateway', `Node registered: ${sim.name} (${sim.id}) fw 0.4.2`);
        }
        this.federation.setExpectedParticipants(SIM_NODES.length);
    }

    private tick(): void {
        if (this.realHardwarePresent()) return;
        const status = this.federation.getStatus();
        const training = status.active;

        for (const sim of SIM_NODES) {
            const node = this.registry.get(sim.id);
            if (!node || !node.metrics) continue;
            // While training: accuracy climbs (nice convergence story). Idle: gentle drift.
            const delta = training ? 0.2 + Math.random() * 0.4 : Math.random() * 0.12 - 0.06;
            this.registry.updateMetrics(sim.id, {
                accuracy: Math.min(99.2, node.metrics.accuracy + delta),
                loss: Math.max(0.02, node.metrics.loss + Math.random() * 0.008 - (training ? 0.006 : 0.004)),
                latencyMs: sim.latency + Math.random() * 1.4,
                modelSizeBytes: 61200,
                round: status.round,
                samples: 1200
            });
            this.registry.setStatus(sim.id, training ? 'training' : 'online');
        }

        // Feed the federation aggregator while a run is active (3 nodes per round).
        if (training && this.registry.connectedCount() >= SIM_NODES.length) {
            for (const sim of SIM_NODES) {
                const node = this.registry.get(sim.id);
                if (!node || !node.metrics) continue;
                this.federation.onNodeRoundResult(sim.id, {
                    accuracy: node.metrics.accuracy,
                    loss: node.metrics.loss,
                    latencyMs: node.metrics.latencyMs,
                    modelSizeBytes: node.metrics.modelSizeBytes,
                    round: status.round + 1,
                    samples: node.metrics.samples
                });
            }
        }

        // Track run completion so we can restart the demo cadence.
        if (training !== this.prevActive) {
            if (!training) this.idleSince = Date.now();
            this.prevActive = training;
        }
        if (this.options.autoTrain && !training && this.idleSince && Date.now() - this.idleSince > 30000) {
            this.federation.startTraining(5);
            this.logger.info('fleet-simulator', 'Demo training run restarted');
        }
    }
}
