'use client';

import { EventsWidget } from '../widgets/EventsWidget';
import { HudGlassCard, HudCardHeader } from './HudGlassCard';

/** ScheduleWidget — Port Said weather + upcoming events. */
export function ScheduleWidget() {
    return (
        <HudGlassCard className="shrink-0 p-3">
            <HudCardHeader title="Weather / Schedule" right={<span className="font-mono text-[9px] text-[var(--hud-cyan)]">Port Said</span>} />
            <EventsWidget />
        </HudGlassCard>
    );
}
