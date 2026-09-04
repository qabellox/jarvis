'use client';

/** Upcoming events / weather — demo data for the HUD widget. */
const EVENTS = [
    { icon: 'M12 4v4m0 0V4m0 0H8m4 0h4M6 8h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm3 3h.01M9 14h.01M9 17h.01M15 11h.01M15 14h.01M15 17h.01', time: '14:00', title: 'Federation review' },
    { icon: 'M12 3a9 9 0 1 0 9 9M12 3a9 9 0 0 1 9 9M12 3v9l6 3', time: '16:30', title: 'Model deploy window' },
    { icon: 'M9 3v18M15 3v18M3 9h18M3 15h18', time: '19:00', title: 'Nightly self-reflection' }
];

/** Simple icon-based weather + calendar feed. */
export function EventsWidget() {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-neon-cyan/20 bg-black/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-neon-cyan" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M7 16a4 4 0 0 1-.9-7.9 5 5 0 0 1 9.6-1.4A3.5 3.5 0 0 1 17 16H7Z" strokeLinejoin="round" />
                    </svg>
                    <div>
                        <div className="font-mono text-lg text-[#e0f2fe]" style={{ textShadow: '0 0 10px rgba(0,240,255,0.4)' }}>
                            21°C
                        </div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink-faint">Port Said · Clear</div>
                    </div>
                </div>
                <span className="font-mono text-[10px] text-neon-cyan">72%</span>
            </div>

            <div className="flex flex-col gap-1.5">
                {EVENTS.map((ev, i) => (
                    <div
                        key={ev.title}
                        className="flex items-center gap-2.5 rounded-lg border border-neon-cyan/10 bg-black/10 px-2.5 py-1.5"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-neon-cyan" fill="none" stroke="currentColor" strokeWidth="1.6">
                            <path d={ev.icon} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#e0f2fe]">{ev.title}</span>
                        <span className="shrink-0 font-mono text-[10px] text-ink-faint">{ev.time}</span>
                        {i === 0 && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-warn" style={{ boxShadow: '0 0 6px #ffaa00' }} />}
                    </div>
                ))}
            </div>
        </div>
    );
}
