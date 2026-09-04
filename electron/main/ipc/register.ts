import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc';
import { Methods } from '../../shared/protocol';
import type { Esp32Command } from '../../shared/types';
import { toJarvisError, type ErrorPayload } from '../utils/errors';
import type { CoreClient } from '../core/CoreClient';
import type { LoggerLike } from '../services/logger';
import type { VoiceService } from '../services/voice/VoiceService';

type Handler = (...args: unknown[]) => Promise<unknown> | unknown;

/**
 * Secure IPC registration.
 *
 * The renderer's channels are now proxied to the JARVIS Core via CoreClient —
 * the desktop app holds no intelligence of its own. Handlers wrap every call
 * so rejections become structured {ok, code, message} payloads.
 */
export function registerIpc(client: CoreClient, voice: VoiceService, logger: LoggerLike): void {
    const safe = (handler: Handler) => async (_event: IpcMainInvokeEvent, ...args: unknown[]) => {
        try {
            const data = await handler(...args);
            return { ok: true, data };
        } catch (error) {
            const err = toJarvisError(error);
            logger.warn('ipc', `Handler error: ${err.message}`, { code: err.code });
            const payload: ErrorPayload = { ok: false, code: err.code, message: err.message };
            return payload;
        }
    };

    // ------------------------------------------------------------------ agent
    ipcMain.handle(
        IPC.Agent.Run,
        safe(async (prompt) => client.request<{ sessionId: string }>(Methods.AgentRun, { prompt }))
    );
    ipcMain.handle(
        IPC.Agent.Cancel,
        safe(async (sessionId) => client.request(Methods.AgentCancel, { sessionId }))
    );

    // ------------------------------------------------------------------ voice
    ipcMain.handle(IPC.Voice.Speak, safe(async (text) => voice.speak(String(text ?? ''))));
    ipcMain.handle(IPC.Voice.Stop, safe(async () => ({ stopped: true })));

    // ------------------------------------------------------------------ esp32
    ipcMain.handle(IPC.Esp32.ListNodes, safe(async () => client.request(Methods.NodeList)));
    ipcMain.handle(
        IPC.Esp32.SendCommand,
        safe(async (nodeId, command) =>
            client.request(Methods.NodeCommand, { nodeId: String(nodeId), command: command as Esp32Command })
        )
    );

    // ------------------------------------------------------------ federation
    ipcMain.handle(IPC.Federation.GetStatus, safe(async () => client.request(Methods.FederationStatus)));

    // --------------------------------------------------------------- memory
    ipcMain.handle(
        IPC.Memory.Get,
        safe(async (kind, limit) =>
            client.request(Methods.MemoryGet, { kind: kind ?? undefined, limit: Number(limit) || 100 })
        )
    );
    ipcMain.handle(
        IPC.Memory.Search,
        safe(async (query, limit) =>
            client.request(Methods.MemorySearch, { query: String(query ?? ''), limit: Number(limit) || 5 })
        )
    );
    ipcMain.handle(IPC.Memory.Stats, safe(async () => client.request(Methods.MemoryStats)));

    // --------------------------------------------------------- conversation
    ipcMain.handle(
        IPC.Conversation.List,
        safe(async (limit) => client.request(Methods.ConversationList, { limit: Number(limit) || 100 }))
    );
    ipcMain.handle(IPC.Conversation.Clear, safe(async () => client.request(Methods.ConversationClear)));

    // --------------------------------------------------------------- system
    ipcMain.handle(IPC.System.GetStatus, safe(async () => client.request(Methods.SystemStatus)));
    ipcMain.handle(
        IPC.System.GetLogs,
        safe(async (limit) => client.request(Methods.Logs, { limit: Number(limit) || 200 }))
    );
    ipcMain.handle(
        IPC.System.ToolLog,
        safe(async (limit) => client.request(Methods.ToolLog, { limit: Number(limit) || 50 }))
    );
}
