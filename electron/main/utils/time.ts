/** ISO-8601 timestamp helpers (single source of truth for clock reads). */

export function nowIso(): string {
    return new Date().toISOString();
}

export function epochMs(): number {
    return Date.now();
}

export function durationMs(start: number): number {
    return Date.now() - start;
}

export function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
