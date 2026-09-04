'use client';

import type { LogEntry } from '@shared/types';
import { StatusPanel } from '../StatusPanel';
import { HudGlassCard, HudCardHeader } from './HudGlassCard';

export interface TerminalLogsProps {
    logs: LogEntry[];
}

/** TerminalLogs — monospaced real-time system feedback. */
export function TerminalLogs({ logs }: TerminalLogsProps) {
    return (
        <HudGlassCard className="flex min-h-0 flex-[1.25] flex-col overflow-hidden p-3">
            <HudCardHeader title="Terminal" right={<span className="font-mono text-[9px] text-emerald-400">● LIVE</span>} />
            <div className="min-h-0 flex-1">
                <StatusPanel logs={logs} />
            </div>
        </HudGlassCard>
    );
}
