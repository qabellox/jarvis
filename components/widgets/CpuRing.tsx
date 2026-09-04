'use client';

export interface CpuRingProps {
    label: string;
    value: number;
    max?: number;
}

/** Minimal glowing progress ring for real-time metrics (CPU / accuracy). */
export function CpuRing({ label, value, max = 100 }: CpuRingProps) {
    const pct = Math.max(0, Math.min(1, value / max));
    const R = 34;
    const C = 2 * Math.PI * R;

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative">
                <svg width={84} height={84} viewBox="0 0 84 84" aria-hidden>
                    <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(0,240,255,0.12)" strokeWidth="5" />
                    <circle
                        cx="42"
                        cy="42"
                        r={R}
                        fill="none"
                        stroke="#00f0ff"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={C}
                        strokeDashoffset={C * (1 - pct)}
                        transform="rotate(-90 42 42)"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(0,240,255,0.7))', transition: 'stroke-dashoffset 0.7s ease' }}
                    />
                </svg>
                <div
                    className="absolute inset-0 flex items-center justify-center font-mono text-xl text-[#e0f2fe]"
                    style={{ textShadow: '0 0 10px rgba(0,240,255,0.5)' }}
                >
                    {Math.round(pct * 100)}
                    <span className="ml-0.5 text-xs text-neon-cyan">%</span>
                </div>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-faint">{label}</div>
        </div>
    );
}
