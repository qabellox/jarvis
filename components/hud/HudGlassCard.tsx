'use client';

import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * HudGlassCard — reusable glassmorphism container using the HUD design tokens.
 */
export function HudGlassCard({
    className,
    children,
    ...rest
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
    return (
        <div
            className={clsx(
                'rounded-2xl border border-[var(--hud-card-border)]',
                'bg-[var(--hud-card-bg)]',
                'backdrop-blur-[20px]',
                'shadow-[var(--hud-glow)]',
                className
            )}
            {...rest}
        >
            {children}
        </div>
    );
}

/** Small neon section header used across HUD cards. */
export function HudCardHeader({ title, right }: { title: string; right?: ReactNode }) {
    return (
        <div className="mb-2.5 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-[var(--hud-cyan)]">{title}</span>
            {right}
        </div>
    );
}
