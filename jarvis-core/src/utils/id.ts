import { randomUUID } from 'node:crypto';

/** v4 UUID with optional prefix. */
export function newId(prefix = ''): string {
    const id = randomUUID();
    return prefix ? `${prefix}_${id}` : id;
}

/** Short human-friendly id, e.g. "ESP32-3F2A". */
export function shortId(prefix: string, length = 4): string {
    const body = randomUUID().replace(/-/g, '').slice(0, length).toUpperCase();
    return `${prefix}-${body}`;
}
