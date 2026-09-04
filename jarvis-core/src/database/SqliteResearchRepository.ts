import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SqlJsDatabase, SqlJsNamespace } from 'sql.js';
import { newId } from '../utils/id';
import { nowIso } from '../utils/time';
import { toJarvisError } from '../utils/errors';
import type { AgentMessage, FederationRound, LogEntry, ToolCallRecord } from '../shared/types';
import type {
    DatabaseStats,
    InteractionRecord,
    ResearchRepository,
    SessionRecord,
    TelemetryRecord
} from './ResearchRepository';

/**
 * SQLite (WASM) research repository. Zero native modules, works in Node and
 * Electron. Persistence is a debounced write-through export to a .db file.
 */
export class SqliteResearchRepository implements ResearchRepository {
    private db: SqlJsDatabase | null = null;
    private readonly dbFile: string;
    private saveTimer: NodeJS.Timeout | null = null;

    constructor(dataDir: string) {
        this.dbFile = join(dataDir, 'research.db');
    }

    async init(): Promise<void> {
        const initSqlJs = (await import('sql.js')).default;
        mkdirSync(dirname(this.dbFile), { recursive: true });

        let SQL: SqlJsNamespace;
        try {
            SQL = await initSqlJs({
                locateFile: (file) => join(dirname(require.resolve('sql.js')), file)
            });
        } catch (error) {
            throw toJarvisError(error, 'DB_INIT');
        }

        if (existsSync(this.dbFile)) {
            try {
                this.db = new SQL.Database(readFileSync(this.dbFile));
            } catch (error) {
                throw toJarvisError(error, 'DB_INIT');
            }
        } else {
            this.db = new SQL.Database();
        }

        this.migrate();
        this.persistNow();
    }

    private migrate(): void {
        this.requireDb().run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT,
        message_count INTEGER NOT NULL DEFAULT 0, tool_calls INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL,
        content TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL, name TEXT NOT NULL, args TEXT,
        ok INTEGER NOT NULL, summary TEXT, duration_ms INTEGER NOT NULL, at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS federation_rounds (
        round INTEGER PRIMARY KEY, algorithm TEXT NOT NULL, accuracy REAL NOT NULL,
        loss REAL NOT NULL, avg_latency_ms REAL NOT NULL, model_size_bytes INTEGER NOT NULL,
        participants INTEGER NOT NULL, timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS telemetry (
        id TEXT PRIMARY KEY, ts TEXT NOT NULL, kind TEXT NOT NULL, value REAL NOT NULL, meta TEXT
      );
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY, ts TEXT NOT NULL, level TEXT NOT NULL,
        source TEXT NOT NULL, message TEXT NOT NULL, meta TEXT
      );
      CREATE TABLE IF NOT EXISTS esp32_nodes (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, ip TEXT,
        firmware TEXT, last_seen TEXT, metrics TEXT
      );
      CREATE TABLE IF NOT EXISTS voice_events (
        id TEXT PRIMARY KEY, ts TEXT NOT NULL, kind TEXT NOT NULL, text TEXT, duration_ms INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id);
      CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(ts);
    `);
    }

    private requireDb(): SqlJsDatabase {
        if (!this.db) throw new Error('Database not initialized. Call init() first.');
        return this.db;
    }

    private persistNow(): void {
        writeFileSync(this.dbFile, Buffer.from(this.requireDb().export()));
    }

    private schedulePersist(): void {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.persistNow();
        }, 500);
    }

    private run(sql: string, params: unknown[] = []): void {
        this.requireDb().run(sql, params);
        this.schedulePersist();
    }

    private all<T>(sql: string, params: unknown[] = []): T[] {
        const stmt = this.requireDb().prepare(sql);
        try {
            stmt.bind(params);
            const rows: T[] = [];
            while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
            return rows;
        } finally {
            stmt.free();
        }
    }

    async createSession(session: SessionRecord): Promise<void> {
        this.run(`INSERT INTO sessions (id, started_at, ended_at, message_count, tool_calls) VALUES (?, ?, ?, ?, ?)`, [
            session.id,
            session.startedAt,
            session.endedAt,
            session.messageCount,
            session.toolCalls
        ]);
    }

    async endSession(sessionId: string): Promise<void> {
        this.run(`UPDATE sessions SET ended_at = ? WHERE id = ?`, [nowIso(), sessionId]);
    }

    async saveInteraction(sessionId: string, message: AgentMessage): Promise<void> {
        this.run(
            `INSERT INTO interactions (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
            [newId('msg'), sessionId, message.role, message.content ?? '', nowIso()]
        );
        this.run(`UPDATE sessions SET message_count = message_count + 1 WHERE id = ?`, [sessionId]);
    }

    async recordToolCall(call: ToolCallRecord): Promise<void> {
        this.run(
            `INSERT INTO tool_calls (id, session_id, name, args, ok, summary, duration_ms, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                call.id,
                call.sessionId ?? '',
                call.name,
                JSON.stringify(call.args ?? {}),
                call.ok ? 1 : 0,
                call.summary,
                call.durationMs,
                call.at
            ]
        );
        if (call.sessionId) {
            this.run(`UPDATE sessions SET tool_calls = tool_calls + 1 WHERE id = ?`, [call.sessionId]);
        }
    }

    async getRecentToolCalls(limit = 50): Promise<ToolCallRecord[]> {
        return this.all<ToolCallRecord>(
            `SELECT id AS id, session_id AS sessionId, name AS name, args AS args,
              ok AS ok, summary AS summary, duration_ms AS durationMs, at AS at
       FROM tool_calls ORDER BY at DESC LIMIT ?`,
            [Math.max(1, Math.min(500, limit))]
        );
    }

    async getRecentInteractions(limit = 100): Promise<InteractionRecord[]> {
        return this.all<InteractionRecord>(
            `SELECT id AS id, session_id AS sessionId, role AS role, content AS content,
              created_at AS createdAt
       FROM interactions ORDER BY created_at ASC LIMIT ?`,
            [Math.max(1, Math.min(500, limit))]
        );
    }

    async clearInteractions(): Promise<void> {
        this.run(`DELETE FROM interactions`);
        this.run(`DELETE FROM sessions`);
    }

    async recordFederationRound(round: FederationRound): Promise<void> {
        this.run(
            `INSERT OR REPLACE INTO federation_rounds
        (round, algorithm, accuracy, loss, avg_latency_ms, model_size_bytes, participants, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                round.round,
                round.algorithm,
                round.accuracy,
                round.loss,
                round.avgLatencyMs,
                round.modelSizeBytes,
                round.participants,
                round.timestamp
            ]
        );
    }

    async getRounds(): Promise<FederationRound[]> {
        return this.all<FederationRound>(
            `SELECT round AS round, algorithm AS algorithm, accuracy AS accuracy, loss AS loss,
              avg_latency_ms AS avgLatencyMs, model_size_bytes AS modelSizeBytes,
              participants AS participants, timestamp AS timestamp
       FROM federation_rounds ORDER BY round ASC`
        );
    }

    async recordTelemetry(record: TelemetryRecord): Promise<void> {
        this.run(`INSERT INTO telemetry (id, ts, kind, value, meta) VALUES (?, ?, ?, ?, ?)`, [
            newId('tel'),
            record.ts,
            record.kind,
            record.value,
            record.meta
        ]);
    }

    async recordLog(entry: LogEntry): Promise<void> {
        this.run(`INSERT INTO logs (id, ts, level, source, message, meta) VALUES (?, ?, ?, ?, ?, ?)`, [
            newId('log'),
            entry.ts,
            entry.level,
            entry.source,
            entry.message,
            JSON.stringify(entry.meta ?? null)
        ]);
    }

    async recordVoiceEvent(kind: string, text: string | null, durationMs: number): Promise<void> {
        this.run(`INSERT INTO voice_events (id, ts, kind, text, duration_ms) VALUES (?, ?, ?, ?, ?)`, [
            newId('voice'),
            nowIso(),
            kind,
            text,
            durationMs
        ]);
    }

    async getStats(): Promise<DatabaseStats> {
        const count = (table: string): number => {
            const rows = this.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
            return Number(rows[0]?.n ?? 0);
        };
        return {
            interactions: count('interactions'),
            toolCalls: count('tool_calls'),
            federationRounds: count('federation_rounds'),
            telemetry: count('telemetry'),
            voiceEvents: count('voice_events'),
            nodes: count('esp32_nodes')
        };
    }

    async exportResearch(): Promise<unknown> {
        const rounds = await this.getRounds();
        const interactions = this.all<InteractionRecord>(
            `SELECT id AS id, session_id AS sessionId, role AS role, content AS content,
              created_at AS createdAt FROM interactions ORDER BY created_at`
        );
        const toolCalls = this.all<unknown>(
            `SELECT id, session_id AS sessionId, name, args, ok, summary,
              duration_ms AS durationMs, at FROM tool_calls`
        );
        const telemetry = this.all<TelemetryRecord>(
            `SELECT ts AS ts, kind AS kind, value AS value, meta AS meta FROM telemetry ORDER BY ts`
        );
        return { exportedAt: nowIso(), rounds, interactions, toolCalls, telemetry };
    }

    dispose(): void {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        if (this.db) {
            try {
                this.persistNow();
            } catch {
                /* best effort */
            }
            this.db.close();
            this.db = null;
        }
    }
}
