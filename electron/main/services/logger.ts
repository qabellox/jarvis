import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { LogEntry, LogLevel } from '../../shared/types';
import { nowIso } from '../utils/time';

export interface LoggerLike {
    debug(source: string, message: string, meta?: Record<string, unknown>): void;
    info(source: string, message: string, meta?: Record<string, unknown>): void;
    warn(source: string, message: string, meta?: Record<string, unknown>): void;
    error(source: string, message: string, meta?: Record<string, unknown>): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Structured, leveled logger.
 *  - In-memory ring buffer (queried by the renderer for the Status Panel)
 *  - Subscriber push (forwarded to the UI in real time)
 *  - Optional rotating JSONL file (research-grade audit trail)
 */
export class Logger implements LoggerLike {
    private readonly buffer: LogEntry[] = [];
    private readonly listeners = new Set<(entry: LogEntry) => void>();
    private readonly file: string | null;

    constructor(
        private readonly minLevel: LogLevel = 'info',
        dataDir?: string
    ) {
        this.file = dataDir ? join(dataDir, 'jarvis.log.jsonl') : null;
        if (this.file) {
            try {
                mkdirSync(dataDir!, { recursive: true });
            } catch {
                this.file = null;
            }
        }
    }

    private write(level: LogLevel, source: string, message: string, meta?: Record<string, unknown>): void {
        if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
        const entry: LogEntry = { ts: nowIso(), level, source, message, meta };
        this.buffer.push(entry);
        if (this.buffer.length > 2000) this.buffer.shift();
        this.listeners.forEach((fn) => fn(entry));
        this.appendToFile(entry);
    }

    private appendToFile(entry: LogEntry): void {
        if (!this.file) return;
        try {
            appendFileSync(this.file, JSON.stringify(entry) + '\n');
        } catch {
            /* never let logging break the system */
        }
    }

    debug(source: string, message: string, meta?: Record<string, unknown>): void {
        this.write('debug', source, message, meta);
    }
    info(source: string, message: string, meta?: Record<string, unknown>): void {
        this.write('info', source, message, meta);
    }
    warn(source: string, message: string, meta?: Record<string, unknown>): void {
        this.write('warn', source, message, meta);
    }
    error(source: string, message: string, meta?: Record<string, unknown>): void {
        this.write('error', source, message, meta);
    }

    subscribe(listener: (entry: LogEntry) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    recent(limit = 200): LogEntry[] {
        return this.buffer.slice(-limit);
    }
}
