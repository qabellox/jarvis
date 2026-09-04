'use client';

import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'orange' | 'blue' | 'purple' | 'cyan' | 'green' | 'red' | 'muted';

const toneClasses: Record<BadgeTone, string> = {
    orange: 'text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10 shadow-[0_0_12px_-2px_rgba(0,240,255,0.5)]',
    blue: 'text-neon-blue border-neon-blue/40 bg-neon-blue/10 shadow-[0_0_12px_-2px_rgba(0,102,255,0.5)]',
    purple: 'text-neon-blue border-neon-blue/40 bg-neon-blue/10 shadow-[0_0_12px_-2px_rgba(0,102,255,0.5)]',
    cyan: 'text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10 shadow-[0_0_12px_-2px_rgba(0,240,255,0.5)]',
    green: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10 shadow-[0_0_12px_-2px_rgba(52,211,153,0.5)]',
    red: 'text-rose-300 border-rose-400/40 bg-rose-400/10 shadow-[0_0_12px_-2px_rgba(251,113,133,0.5)]',
    muted: 'text-ink-muted border-white/10 bg-white/5'
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone;
    children?: ReactNode;
    pulse?: boolean;
}

export function Badge({ tone = 'muted', pulse = false, className, children, ...rest }: BadgeProps) {
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.14em]',
                toneClasses[tone],
                pulse && 'animate-pulse-slow',
                className
            )}
            {...rest}
        >
            {pulse && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            {children}
        </span>
    );
}
