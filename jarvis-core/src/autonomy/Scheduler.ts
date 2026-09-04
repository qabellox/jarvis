import cron, { type ScheduledTask } from 'node-cron';
import type { LoggerLike } from '../logger';

/**
 * Scheduler — wraps node-cron and runs the autonomy jobs (proactive checks,
 * self-reflection). Invalid expressions are logged, never fatal.
 */
export class Scheduler {
    private readonly tasks: ScheduledTask[] = [];

    constructor(private readonly logger: LoggerLike) { }

    schedule(expression: string, name: string, task: () => Promise<void>): void {
        if (!cron.validate(expression)) {
            this.logger.warn('scheduler', `Invalid cron expression for "${name}": ${expression}`);
            return;
        }
        const handle = cron.schedule(
            expression,
            () => {
                void task().catch((error) => this.logger.error('scheduler', `${name} failed: ${String(error)}`));
            },
            { timezone: 'UTC' }
        );
        this.tasks.push(handle);
        this.logger.info('scheduler', `Scheduled "${name}" with "${expression}"`);
    }

    stop(): void {
        for (const task of this.tasks) task.stop();
        this.tasks.length = 0;
    }
}
