'use client';

import type { SystemStatus } from '@shared/types';
import { Badge } from './ui/Badge';
import type { SwarmMode } from './NeuralSwarm';

const MODE_LABEL: Record<SwarmMode, { label: string; tone: 'blue' | 'purple' | 'cyan' | 'green' | 'muted' }> = {
    idle: { label: 'JARVIS // Online', tone: 'blue' },
    thinking: { label: 'JARVIS // Thinking', tone: 'purple' },
    working: { label: 'JARVIS // Working', tone: 'cyan' },
    speaking: { label: 'JARVIS // Listening', tone: 'green' }
};

function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export interface TopBarProps {
    system: SystemStatus | null;
    mode: SwarmMode;
    connected?: boolean;
}

export function TopBar({ system, mode, connected = true }: TopBarProps) {
    const meta = MODE_LABEL[mode];
    return (
        <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 shadow-glow-cyan">
                    <span className="font-display text-sm font-bold text-neon-cyan">J</span>
                </div>
                <div className="leading-tight">
                    <div className="title-display text-lg text-white">
                        JARVIS
                        <span className="ml-2 hidden text-[10px] text-ink-faint sm:inline">v{system?.version ?? '1.0.0'}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.34em] text-neon-blue/80">Personal AI Assistant</div>
                </div>
            </div>

            <div className="hidden items-center gap-3 md:flex">
                <Badge tone={connected ? 'green' : 'red'} pulse={connected}>
                    {connected ? 'Core Online' : 'Core Offline'}
                </Badge>
                <Badge tone={meta.tone} pulse={mode !== 'idle'}>
                    {meta.label}
                </Badge>
            </div>

            <div className="flex items-center gap-5 font-display text-[11px] uppercase tracking-[0.2em] text-ink-muted">
                <div className="hidden text-right sm:block">
                    <div className="text-ink-faint">Uptime</div>
                    <div className="text-neon-blue">{system ? formatUptime(system.uptimeSeconds) : '--:--:--'}</div>
                </div>
                <div className="hidden text-right lg:block">
                    <div className="text-ink-faint">Core Link</div>
                    <div className="text-ink">{system ? `:${system.wsPort}` : ':8767'}</div>
                </div>
            </div>
        </header>
    );
}
