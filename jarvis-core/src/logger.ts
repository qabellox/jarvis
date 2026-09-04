import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LogEntry, LogLevel } from './shared/types';
import { nowIso } from './utils/time';

export interface LoggerLike {
    debug(source: string, message: string, meta?: Record<string, unknown>): void;
    info(source: string, message: string, meta?: Record<string, unknown>): void;
    warn(source: string, message: string, meta?: Record<string, unknown>): void;
    error(source: string, message: string, meta?: Record<string, unknown>): void;
    recent(limit?: number): LogEntry[];
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Structured, leveled logger with an in-memory ring buffer (queried by
 * clients), subscriber push (forwarded over the wire) and an optional JSONL
 * audit file.
 */
export class Logger implements LoggerLike {
    private readonly buffer: LogEntry[] = [];
    private readonly listeners = new Set<(entry: LogEntry) => void>();
    private readonly file: string | null;
    private readonly minLevel: LogLevel;

    constructor(minLevel: LogLevel = 'info', dataDir?: string) {
        this.minLevel = minLevel;
        this.file = dataDir ? join(dataDir, 'core.log.jsonl') : null;
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
        if (this.buffer.length > 4000) this.buffer.shift();
        this.listeners.forEach((fn) => fn(entry));
        if (this.file) {
            try {
                appendFileSync(this.file, JSON.stringify(entry) + '\n');
            } catch {
                /* logging must never break the system */
            }
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

    recent(limit = 400): LogEntry[] {
        return this.buffer.slice(-limit);
    }
}
