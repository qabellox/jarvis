import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { ClientConfigService } from './services/config';
import { Logger } from './services/logger';
import { VoiceService } from './services/voice/VoiceService';
import { CoreClient, type CoreConnectionStatus } from './core/CoreClient';
import { CoreLauncher } from './core/coreLauncher';
import { Channels } from '../shared/protocol';
import { Events } from '../shared/ipc';
import { registerIpc } from './ipc/register';
import { createMainWindow } from './window';
import { toJarvisError } from './utils/errors';

let mainWindow: BrowserWindow | null = null;
let coreClient: CoreClient | null = null;
let coreLauncher: CoreLauncher | null = null;
let logger: Logger | null = null;

/**
 * Forward Core event channels to the renderer over webContents.send.
 * The Core is the source of truth; the desktop UI is a live mirror.
 */
function forwardEvents(win: BrowserWindow): void {
    if (!coreClient) return;
    const send = (channel: string, payload: unknown): void => {
        if (!win.isDestroyed()) win.webContents.send(channel, payload);
    };

    coreClient.onEvent(Channels.AgentEvent, (p) => send(Events.AgentEvent, p));
    coreClient.onEvent(Channels.NodeUpdate, (p) => send(Events.NodeUpdate, p));
    coreClient.onEvent(Channels.FederationUpdate, (p) => send(Events.FederationUpdate, p));
    coreClient.onEvent(Channels.Log, (p) => send(Events.Log, p));
    coreClient.onEvent(Channels.Alert, (p) => send(Events.Alert, p));
    coreClient.onStatusChange((status: CoreConnectionStatus) =>
        send(Events.Connection, { connected: status === 'connected' })
    );
}

async function bootstrap(): Promise<void> {
    const config = new ClientConfigService().load();
    logger = new Logger('info');
    const voice = new VoiceService(config.voice.ttsVoice, logger);

    // One-click experience: spawn the Core in the background, then connect.
    coreLauncher = new CoreLauncher(logger, config.externalCore);
    coreLauncher.start();

    coreClient = new CoreClient(config.coreWsUrl, app.getVersion(), logger, config.reconnectDelayMs);
    coreClient.connect();

    registerIpc(coreClient, voice, logger);
    mainWindow = createMainWindow();
    forwardEvents(mainWindow);

    logger.info(
        'client',
        `JARVIS desktop client v${app.getVersion()} online, targeting Core at ${config.coreWsUrl} (${config.externalCore ? 'external' : 'auto-spawned'})`
    );
}

app.whenReady().then(async () => {
    try {
        await bootstrap();
    } catch (error) {
        const err = toJarvisError(error);
        console.error(`[jarvis-client] bootstrap failed: ${err.message}`);
        app.quit();
        return;
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow();
            if (mainWindow) forwardEvents(mainWindow);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    coreClient?.dispose();
    coreLauncher?.stop();
});
