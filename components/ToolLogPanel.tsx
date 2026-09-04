'use client';

import type { ToolCallRecord } from '@shared/types';
import { SectionTitle } from './ui/SectionTitle';

export interface ToolLogPanelProps {
    calls: ToolCallRecord[];
}

/** Tool Log — every action the agent has taken against the real world. */
export function ToolLogPanel({ calls }: ToolLogPanelProps) {
    return (
        <div className="flex min-h-0 flex-col">
            <SectionTitle
                title="Tool Log"
                subtitle={`${calls.length} action(s) routed through the agent`}
                accent="orange"
            />

            <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {calls.map((call) => (
                    <div key={call.id} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-ink">
                                <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${call.ok ? 'bg-emerald-400' : 'bg-rose-400'
                                        }`}
                                    style={{
                                        boxShadow: call.ok
                                            ? '0 0 6px #34d399'
                                            : '0 0 6px #fb7185'
                                    }}
                                />
                                <span className="truncate">{call.name}</span>
                            </span>
                            <span className="shrink-0 text-[10px] text-ink-faint">{call.durationMs}ms</span>
                        </div>
                        {call.summary && (
                            <p className="mt-1 text-[11px] leading-snug text-ink-muted">{call.summary}</p>
                        )}
                        <div className="mt-1 text-[10px] text-ink-faint">{formatTime(call.at)}</div>
                    </div>
                ))}
                {calls.length === 0 && (
                    <p className="py-6 text-center text-xs text-ink-faint">
                        No tool calls recorded yet. Ask JARVIS to do something and watch the log fill up.
                    </p>
                )}
            </div>
        </div>
    );
}

function formatTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
