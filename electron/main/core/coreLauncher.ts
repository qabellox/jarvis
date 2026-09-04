import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { LoggerLike } from '../services/logger';

/**
 * CoreLauncher — makes the desktop app a true one-click application.
 *
 * On startup the Electron main process spawns the JARVIS Core as a child
 * process (running Electron itself in `ELECTRON_RUN_AS_NODE` mode, so no
 * separate Node installation is required), and shuts it down on quit. If the
 * operator prefers to run their own Core (e.g. on a server), set
 * `JARVIS_EXTERNAL_CORE=1` and the app simply connects instead.
 */
export class CoreLauncher {
    private child: ChildProcess | null = null;

    constructor(
        private readonly logger: LoggerLike,
        private readonly external: boolean
    ) { }

    isExternal(): boolean {
        return this.external;
    }

    start(): void {
        if (this.external) {
            this.logger.info('core-launcher', 'External Core mode: not spawning a Core');
            return;
        }
        const entry = this.resolveEntry();
        if (!entry) {
            this.logger.warn('core-launcher', 'Core entry not found; expecting an external Core to be running');
            return;
        }

        this.logger.info('core-launcher', `Spawning JARVIS Core: ${entry}`);
        try {
            this.child = spawn(process.execPath, [entry], {
                env: {
                    ...process.env,
                    ELECTRON_RUN_AS_NODE: '1',
                    JARVIS_DATA_DIR: join(app.getPath('userData'), 'jarvis')
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true
            });
            this.child.stdout?.on('data', (d: Buffer) => this.logger.debug('core-launcher', String(d).trim()));
            this.child.stderr?.on('data', (d: Buffer) => this.logger.warn('core-launcher', String(d).trim()));
            this.child.on('exit', (code) => {
                this.logger.warn('core-launcher', `Core process exited (code ${code})`);
                this.child = null;
            });
            this.child.on('error', (error) => {
                this.logger.warn('core-launcher', `Failed to spawn Core: ${error.message}`);
                this.child = null;
            });
        } catch (error) {
            this.logger.warn('core-launcher', `Failed to launch Core: ${String(error)}`);
            this.child = null;
        }
    }

    stop(): void {
        if (this.child && !this.child.killed) {
            this.logger.info('core-launcher', 'Stopping JARVIS Core');
            this.child.kill();
            this.child = null;
        }
    }

    /** Locate the compiled Core entry in dev or packaged builds. */
    private resolveEntry(): string | null {
        const candidates = app.isPackaged
            ? [join(process.resourcesPath, 'jarvis-core', 'dist', 'index.js')]
            : [join(app.getAppPath(), 'jarvis-core', 'dist', 'index.js')];
        for (const candidate of candidates) {
            if (existsSync(candidate)) return candidate;
        }
        return null;
    }
}
