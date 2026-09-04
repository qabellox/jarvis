import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, Events, type EventChannel, type JarvisBridge } from '../shared/ipc';

/**
 * Preload bridge.
 *
 * The renderer only ever sees this typed surface. contextIsolation keeps the
 * renderer's world separate; here we translate IPC into promises and typed
 * event subscriptions. No raw ipcRenderer leaks into the page.
 */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    const result = await ipcRenderer.invoke(channel, ...args);
    if (result && result.ok === false) {
        throw new Error(`${result.code}: ${result.message}`);
    }
    return result?.data as T;
}

const bridge: JarvisBridge = {
    platform: process.platform,
    agent: {
        run: (prompt) => invoke<{ sessionId: string; at: string }>(IPC.Agent.Run, prompt).then((r) => r.sessionId),
        cancel: (sessionId) => invoke<void>(IPC.Agent.Cancel, sessionId)
    },
    voice: {
        speak: (text) => invoke(IPC.Voice.Speak, text),
        stop: () => invoke(IPC.Voice.Stop)
    },
    esp32: {
        listNodes: () => invoke(IPC.Esp32.ListNodes),
        sendCommand: (nodeId, command) => invoke(IPC.Esp32.SendCommand, nodeId, command)
    },
    federation: {
        getStatus: () => invoke(IPC.Federation.GetStatus)
    },
    memory: {
        list: (kind, limit) => invoke(IPC.Memory.Get, kind, limit),
        search: (query, limit) => invoke(IPC.Memory.Search, query, limit),
        stats: () => invoke(IPC.Memory.Stats)
    },
    conversation: {
        list: (limit) => invoke(IPC.Conversation.List, limit),
        clear: () => invoke<void>(IPC.Conversation.Clear)
    },
    system: {
        getStatus: () => invoke(IPC.System.GetStatus),
        getLogs: (limit) => invoke(IPC.System.GetLogs, limit),
        getToolLog: (limit) => invoke(IPC.System.ToolLog, limit)
    },
    on: (channel: EventChannel, callback: (payload: unknown) => void) => {
        const listener = (_event: IpcRendererEvent, payload: unknown): void => callback(payload);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    }
};

contextBridge.exposeInMainWorld('jarvis', bridge);

export type { JarvisBridge };
