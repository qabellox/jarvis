import { Channels } from '../shared/protocol';
import { newId } from '../utils/id';
import { nowIso } from '../utils/time';
import type { AlertMessage } from '../shared/types';
import type { LoggerLike } from '../logger';
import type { CoreApi } from '../communication/api';

/**
 * ProactiveMonitor — the hourly "stay alive" loop.
 * Checks the ESP32 fleet, federation state and pending work, then pushes an
 * alert to every client and a report to Telegram. This is JARVIS acting on
 * its own initiative rather than waiting for commands.
 */
export class ProactiveMonitor {
    constructor(
        private readonly api: CoreApi,
        private readonly logger: LoggerLike
    ) { }

    async run(): Promise<void> {
        try {
            const nodes = this.api.registry.all();
            const offline = nodes.filter((n) => n.status === 'offline');
            const fed = this.api.federation.getStatus();
            const memoryStats = this.api.memory.stats();

            const lines: string[] = [];
            lines.push(`[JARVIS PROACTIVE REPORT ${nowIso()}]`);
            lines.push(`Fleet: ${nodes.length} registered, ${offline.length} offline, ${this.api.registry.connectedCount()} reachable`);
            lines.push(`Federation: ${fed.active ? `round ${fed.round}/${fed.targetRound}, accuracy ${fed.accuracy}%` : 'idle'}`);
            lines.push(`Memory: ${memoryStats.total} entries (${memoryStats.suggestions} pending suggestions)`);
            if (offline.length > 0) {
                lines.push(`ACTION: ${offline.map((n) => n.name).join(', ')} need attention`);
            }
            const report = lines.join('\n');

            const alert: AlertMessage = {
                id: newId('alert'),
                severity: offline.length > 0 ? 'warn' : 'info',
                title: 'Proactive fleet check complete',
                body: report,
                at: nowIso()
            };
            this.api.clients.broadcast(Channels.Alert, alert);
            this.api.clients.sendTo('telegram', { kind: 'report', text: report });
            this.logger.info('monitor', `Proactive check complete (${offline.length} offline)`);
        } catch (error) {
            this.logger.error('monitor', `Proactive check failed: ${String(error)}`);
        }
    }
}
