'use client';

import type { LogEntry } from '@shared/types';

export interface StatusPanelProps {
    logs: LogEntry[];
}

const levelColor: Record<LogEntry['level'], string> = {
    debug: 'text-ink-faint',
    info: 'text-neon-cyan',
    warn: 'text-warn',
    error: 'text-rose-300'
};

export function StatusPanel({ logs }: StatusPanelProps) {
    return (
        <div className="flex min-h-0 flex-col font-mono">
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-ink-faint">
                <span className="text-neon-cyan">root@jarvis</span>
                <span className="text-ink-muted">:~$</span>
                <span className="animate-pulse text-neon-cyan">▊</span>
            </div>
            <div className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
                {logs.map((log, i) => {
                    const last = i === logs.length - 1;
                    return (
                        <div
                            key={`${log.ts}-${i}`}
                            className={`flex items-start gap-2 rounded-lg px-1.5 py-0.5 text-[11px] leading-snug hover:bg-white/[0.03] ${last ? 'term-caret' : ''}`}
                        >
                            <span className="mt-0.5 shrink-0 text-neon-cyan/60">›</span>
                            <span className="mt-0.5 shrink-0 text-ink-faint">{formatTime(log.ts)}</span>
                            <span className={`mt-0.5 shrink-0 ${levelColor[log.level]}`}>
                                [{log.level.toUpperCase().slice(0, 4)}]
                            </span>
                            <span className="min-w-0">
                                <span className="text-ink-faint">{log.source}:</span>{' '}
                                <span className="text-ink/80">{log.message}</span>
                            </span>
                        </div>
                    );
                })}
                {logs.length === 0 && (
                    <p className="px-2 text-xs text-ink-faint">No log entries yet.</p>
                )}
            </div>
        </div>
    );
}

function formatTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--:--:--';
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
