import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { newId } from '../utils/id';
import { nowIso } from '../utils/time';
import type { MemoryEntry, MemorySearchResult, MemoryStats } from '../shared/types';

const EMBED_DIM = 128;

/**
 * MemoryStore — JARVIS's long-term memory.
 *
 * Two layers:
 *  1. Structured entries persisted to `memory.json` (facts, preferences,
 *     interaction summaries, self-improvement suggestions).
 *  2. Local semantic recall: each entry gets a lightweight bag-of-words
 *     hashing embedding; cosine similarity returns relevant memories for a
 *     query, so JARVIS "remembers" across sessions and clients. This is a
 *     dependency-free vector memory; it can be swapped for ChromaDB without
 *     changing the interface.
 */
export class MemoryStore {
    private entries: MemoryEntry[] = [];
    private readonly file: string;
    private saveTimer: NodeJS.Timeout | null = null;

    constructor(dataDir: string) {
        this.file = join(dataDir, 'memory.json');
    }

    init(): void {
        mkdirSync(join(this.file, '..'), { recursive: true });
        if (existsSync(this.file)) {
            try {
                const parsed = JSON.parse(readFileSync(this.file, 'utf-8')) as MemoryEntry[];
                this.entries = Array.isArray(parsed) ? parsed : [];
            } catch {
                this.entries = [];
            }
        }
    }

    add(kind: MemoryEntry['kind'], content: string, tags: string[] = []): MemoryEntry {
        const entry: MemoryEntry = {
            id: newId('mem'),
            kind,
            content: content.trim(),
            tags,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            vector: embed(content)
        };
        this.entries.unshift(entry);
        // Bound memory size (keep the most relevant 2000 entries).
        if (this.entries.length > 2000) this.entries = this.entries.slice(0, 2000);
        this.schedulePersist();
        return entry;
    }

    get(id: string): MemoryEntry | undefined {
        return this.entries.find((e) => e.id === id);
    }

    all(kind?: MemoryEntry['kind'], limit = 100): MemoryEntry[] {
        const list = kind ? this.entries.filter((e) => e.kind === kind) : this.entries;
        return list.slice(0, limit);
    }

    search(query: string, limit = 5): MemorySearchResult[] {
        const q = embed(query);
        return this.entries
            .map((entry) => ({ entry, score: cosine(q, entry.vector ?? []) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    stats(): MemoryStats {
        const count = (kind: MemoryEntry['kind']): number => this.entries.filter((e) => e.kind === kind).length;
        return {
            total: this.entries.length,
            facts: count('fact'),
            preferences: count('preference'),
            interactions: count('interaction'),
            suggestions: count('suggestion')
        };
    }

    private schedulePersist(): void {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.persistNow();
        }, 400);
    }

    persistNow(): void {
        const data = this.entries.map(({ vector: _vector, ...rest }) => rest);
        writeFileSync(this.file, JSON.stringify(data, null, 2));
    }

    dispose(): void {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.persistNow();
    }
}

// ------------------------------------------------------------ local embedding
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1);
}

function hash(str: string): number {
    let h = 5381;
    for (let i = 0; i < str.length; i += 1) {
        h = (h * 33) ^ str.charCodeAt(i);
    }
    return h >>> 0;
}

/** Deterministic bag-of-words hashing embedding, L2-normalized. */
function embed(text: string): number[] {
    const vector = new Array<number>(EMBED_DIM).fill(0);
    const freq = new Map<string, number>();
    for (const token of tokenize(text)) freq.set(token, (freq.get(token) ?? 0) + 1);
    for (const [token, count] of freq) {
        const idx = hash(token) % EMBED_DIM;
        vector[idx] += 1 + Math.log(count);
    }
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / norm);
}

function cosine(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i += 1) dot += a[i] * (b[i] ?? 0);
    return dot;
}
