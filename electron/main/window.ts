import { BrowserWindow, shell } from 'electron';
import { join } from 'node:path';

const isDev = process.argv.includes('--dev');

/**
 * Create and own the single application window. The renderer is either the
 * Next.js dev server (--dev) or the statically exported build.
 */
export function createMainWindow(): BrowserWindow {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1080,
        minHeight: 680,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#05070f',
        title: 'JARVIS - Edge AI Orchestrator',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    win.once('ready-to-show', () => win.show());

    // Security hardening: block new windows and external navigation.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://')) void shell.openExternal(url);
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event) => {
        event.preventDefault();
    });

    if (isDev) {
        void win.loadURL('http://localhost:3000');
    } else {
        void win.loadFile(join(__dirname, '../../renderer/index.html'));
    }

    return win;
}

export function isDevMode(): boolean {
    return isDev;
}
