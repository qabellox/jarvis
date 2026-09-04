import { Channels } from '../shared/protocol';
import { nowIso } from '../utils/time';
import type { LoggerLike } from '../logger';
import type { CoreApi } from '../communication/api';

/**
 * SelfImprovement — the learning loop. Runs on a schedule and exercises the
 * `self_reflect` tool to turn raw telemetry into concrete optimization
 * suggestions, then surfaces them to clients and memory.
 */
export class SelfImprovement {
    constructor(
        private readonly api: CoreApi,
        private readonly logger: LoggerLike
    ) { }

    async reflect(): Promise<void> {
        try {
            const sessionId = `reflection_${Date.now().toString(36)}`;
            const result = await this.api.tools.execute(
                'self_reflect',
                {},
                { sessionId, emit: () => undefined }
            );

            const suggestions = Array.isArray(result.data) ? result.data : [];
            this.api.clients.broadcast(Channels.Alert, {
                id: `reflect_${Date.now().toString(36)}`,
                severity: 'info',
                title: 'Self-reflection complete',
                body: `${result.summary}. ${suggestions.map((s: { title?: string }) => s.title ?? '').join(' | ')}`,
                at: nowIso()
            });
            this.logger.info('self-improvement', result.summary);
        } catch (error) {
            this.logger.error('self-improvement', `Reflection failed: ${String(error)}`);
        }
    }
}
