'use client';

import { useCallback, useEffect, useState } from 'react';
import { Events, type ConversationMessage } from '@shared/ipc';
import type {
    AgentEvent,
    CommandResult,
    Esp32Command,
    Esp32Node,
    FederationStatus,
    LogEntry,
    MemoryEntry,
    MemoryStats,
    SystemStatus,
    ToolCallRecord
} from '@shared/types';
import { getBridge } from './bridge';

export interface ToolActivity {
    id: string;
    name: string;
    status: 'running' | 'done' | 'error';
    summary?: string;
    args?: unknown;
}

export interface AgentTurn {
    sessionId: string;
    prompt: string;
    tokens: string;
    toolActivity: ToolActivity[];
    status: 'thinking' | 'working' | 'done' | 'error';
    error?: string;
    /** True when this turn was reconstructed from persisted history (restored on
     *  refresh), so the UI must NOT re-speak it or treat it as brand-new. */
    restored?: boolean;
}

export interface JarvisApi {
    nodes: Esp32Node[];
    federation: FederationStatus | null;
    logs: LogEntry[];
    system: SystemStatus | null;
    turns: AgentTurn[];
    activeTurn: AgentTurn | null;
    connected: boolean;
    memoryEntries: MemoryEntry[];
    memoryStats: MemoryStats | null;
    toolLog: ToolCallRecord[];
    searchMemory: (query: string) => Promise<void>;
    sendPrompt: (prompt: string) => Promise<void>;
    sendCommand: (nodeId: string, command: Esp32Command) => Promise<CommandResult>;
    speak: (text: string) => Promise<void>;
    refresh: () => Promise<void>;
    clearConversation: () => Promise<void>;
}

function upsertNode(list: Esp32Node[], node: Esp32Node): Esp32Node[] {
    const idx = list.findIndex((n) => n.id === node.id);
    if (idx === -1) return [...list, node];
    const next = [...list];
    next[idx] = node;
    return next;
}

/**
 * Reconstruct chat turns from persisted interaction history. Messages are
 * chronological across sessions; we group by session and pair each user
 * prompt with its assistant reply so refresh restores the full conversation.
 */
function conversationToTurns(messages: ConversationMessage[]): AgentTurn[] {
    const turns: AgentTurn[] = [];
    const order: string[] = [];
    const bySession = new Map<string, ConversationMessage[]>();
    for (const m of messages) {
        if (!bySession.has(m.sessionId)) {
            bySession.set(m.sessionId, []);
            order.push(m.sessionId);
        }
        bySession.get(m.sessionId)!.push(m);
    }
    for (const sid of order) {
        const msgs = bySession.get(sid)!;
        let prompt: string | null = null;
        for (const m of msgs) {
            if (m.role === 'user') prompt = m.content;
            else if (m.role === 'assistant' && prompt !== null) {
                turns.push({
                    sessionId: sid,
                    prompt,
                    tokens: m.content,
                    toolActivity: [],
                    status: 'done',
                    restored: true
                });
                prompt = null;
            }
        }
    }
    return turns;
}

/**
 * The single client-side state hub for JARVIS. Wraps the bridge, subscribes to
 * the real-time event channels, and exposes a small, typed API to the UI.
 */
export function useJarvis(): JarvisApi {
    const [connected, setConnected] = useState(true);
    const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
    const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
    const [toolLog, setToolLog] = useState<ToolCallRecord[]>([]);
    const [nodes, setNodes] = useState<Esp32Node[]>([]);
    const [federation, setFederation] = useState<FederationStatus | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [system, setSystem] = useState<SystemStatus | null>(null);
    const [turns, setTurns] = useState<AgentTurn[]>([]);

    const handleAgentEvent = useCallback((ev: AgentEvent) => {
        setTurns((prev) => {
            const idx = prev.findIndex((t) => t.sessionId === ev.sessionId);
            if (idx === -1) return prev;
            const next = [...prev];
            const turn = { ...next[idx] };
            const data = ev.data as Record<string, unknown> | undefined;

            switch (ev.type) {
                case 'status':
                    if (data?.toString() === 'idle') turn.status = 'done';
                    break;
                case 'token':
                    turn.tokens += String(ev.data ?? '');
                    break;
                case 'tool_call':
                    turn.toolActivity = [
                        ...turn.toolActivity,
                        {
                            id: String(data?.id ?? Math.random()),
                            name: String(data?.name ?? 'tool'),
                            status: 'running',
                            args: data?.args
                        }
                    ];
                    turn.status = 'working';
                    break;
                case 'tool_result':
                    turn.toolActivity = turn.toolActivity.map((t) =>
                        t.id === String(data?.id ?? '')
                            ? { ...t, status: data?.ok ? 'done' : 'error', summary: String(data?.summary ?? '') }
                            : t
                    );
                    break;
                case 'error':
                    turn.status = 'error';
                    turn.error = String(data?.message ?? 'Agent error');
                    break;
                case 'done':
                    if (turn.status !== 'error') turn.status = 'done';
                    break;
            }
            next[idx] = turn;
            return next;
        });
    }, []);

    useEffect(() => {
        const b = getBridge();
        let mounted = true;

        const loadInitial = async (): Promise<void> => {
            const [nodeList, fed, logList, sys, mem, memStats, toolLogList, conv] = await Promise.all([
                b.esp32.listNodes(),
                b.federation.getStatus(),
                b.system.getLogs(80),
                b.system.getStatus(),
                b.memory.list(undefined, 100).catch(() => []),
                b.memory.stats().catch(() => null),
                b.system.getToolLog(50).catch(() => []),
                b.conversation.list(100).catch(() => [] as ConversationMessage[])
            ]);
            if (!mounted) return;
            setNodes(nodeList);
            setFederation(fed);
            setLogs(logList);
            setSystem(sys);
            setMemoryEntries(mem);
            setMemoryStats(memStats);
            setToolLog(toolLogList);
            setTurns(conversationToTurns(conv));
        };
        void loadInitial();

        const unsubs = [
            b.on(Events.NodeUpdate, (p) => {
                if (!mounted) return;
                const { node } = p as { node: Esp32Node };
                setNodes((prev) => upsertNode(prev, node));
            }),
            b.on(Events.FederationUpdate, (p) => {
                if (!mounted) return;
                setFederation((p as { status: FederationStatus }).status);
            }),
            b.on(Events.Log, (p) => {
                if (!mounted) return;
                setLogs((prev) => [...prev.slice(-199), p as LogEntry]);
            }),
            b.on(Events.AgentEvent, (p) => {
                if (!mounted) return;
                handleAgentEvent(p as AgentEvent);
            }),
            b.on(Events.Connection, (p) => {
                if (!mounted) return;
                setConnected((p as { connected: boolean }).connected);
            })
        ];

        const sysTimer = window.setInterval(() => {
            if (!mounted) return;
            void b.system.getStatus().then(setSystem);
        }, 5000);

        return () => {
            mounted = false;
            unsubs.forEach((u) => u());
            window.clearInterval(sysTimer);
        };
    }, [handleAgentEvent]);

    const sendPrompt = useCallback(async (prompt: string) => {
        const b = getBridge();
        const sessionId = await b.agent.run(prompt);
        setTurns((prev) => [
            ...prev,
            { sessionId, prompt, tokens: '', toolActivity: [], status: 'thinking' }
        ]);
    }, []);

    const sendCommand = useCallback(
        (nodeId: string, command: Esp32Command) => getBridge().esp32.sendCommand(nodeId, command),
        []
    );

    const speak = useCallback(async (text: string) => {
        try {
            const result = await getBridge().voice.speak(text);
            if (result && 'dataUrl' in result && result.dataUrl) {
                const audio = new Audio(result.dataUrl);
                await audio.play();
                return;
            }
        } catch {
            /* fall through to Web Speech */
        }
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.02;
            utterance.pitch = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }, []);

    const refresh = useCallback(async () => {
        const b = getBridge();
        const [nodeList, fed, sys] = await Promise.all([
            b.esp32.listNodes(),
            b.federation.getStatus(),
            b.system.getStatus()
        ]);
        setNodes(nodeList);
        setFederation(fed);
        setSystem(sys);
    }, []);

    const clearConversation = useCallback(async () => {
        try {
            await getBridge().conversation.clear();
        } catch {
            /* best effort — the local state still clears */
        }
        setTurns([]);
        setToolLog([]);
    }, []);

    const searchMemory = useCallback(async (query: string) => {
        if (!query.trim()) return;
        const results = await getBridge().memory.search(query, 10);
        setMemoryEntries((prev) => {
            const found = results.map((r) => r.entry);
            const merged = [...found, ...prev];
            const seen = new Set<string>();
            return merged.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).slice(0, 100);
        });
    }, []);

    const activeTurn = turns.length > 0 ? turns[turns.length - 1] : null;

    return {
        nodes,
        federation,
        logs,
        system,
        turns,
        activeTurn,
        connected,
        memoryEntries,
        memoryStats,
        toolLog,
        searchMemory,
        sendPrompt,
        sendCommand,
        speak,
        refresh,
        clearConversation
    };
}
