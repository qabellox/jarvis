/**
 * Minimal ambient typings for `sql.js` (SQLite -> WebAssembly).
 */
declare module 'sql.js' {
    export type BindParams = unknown[] | Record<string, unknown> | null;

    export interface QueryExecResult {
        columns: string[];
        values: unknown[][];
    }

    export interface Statement {
        bind(params?: BindParams): boolean;
        step(): boolean;
        get(): unknown[] | null;
        getAsObject(): Record<string, unknown> | null;
        free(): void;
    }

    export interface SqlJsDatabase {
        run(sql: string, params?: BindParams): void;
        exec(sql: string): QueryExecResult[];
        prepare(sql: string): Statement;
        export(): Uint8Array;
        close(): void;
    }

    export interface SqlJsConfig {
        locateFile?: (file: string) => string;
    }

    export interface SqlJsNamespace {
        Database: new (data?: Uint8Array) => SqlJsDatabase;
    }

    export type SqlJsStatic = (config?: SqlJsConfig) => Promise<SqlJsNamespace>;

    const initSqlJs: SqlJsStatic;
    export default initSqlJs;
}
