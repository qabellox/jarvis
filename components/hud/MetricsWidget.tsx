'use client';

import type { SystemStatus } from '@shared/types';
import { CpuRing } from '../widgets/CpuRing';
import { HudGlassCard, HudCardHeader } from './HudGlassCard';

export interface MetricsWidgetProps {
    system: SystemStatus | null;
}

/** MetricsWidget — real machine metrics (CPU + memory). */
export function MetricsWidget({ system }: MetricsWidgetProps) {
    const memPct = system ? Math.round((system.memoryMb.free / system.memoryMb.total) * 100) : 0;

    return (
        <HudGlassCard className="shrink-0 p-3">
            <HudCardHeader title="System Metrics" />
            <div className="flex items-center justify-around gap-2">
                <CpuRing label="CPU" value={system?.cpuUsage ?? 0} />
                <CpuRing label="Mem Free" value={memPct} />
                <CpuRing label="Sessions" value={system?.activeSessions ?? 0} max={50} />
            </div>
        </HudGlassCard>
    );
}
