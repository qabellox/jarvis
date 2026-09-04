'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export interface SectionTitleProps {
    title: string;
    subtitle?: string;
    accent?: 'orange' | 'blue';
    className?: string;
    children?: ReactNode;
}

/** Small neon section header: glowing dot + display title + optional action. */
export function SectionTitle({ title, subtitle, accent = 'blue', className, children }: SectionTitleProps) {
    const dot = accent === 'orange' ? 'bg-neon-blue shadow-[0_0_10px_2px_rgba(0,102,255,0.6)]' : 'bg-neon-cyan shadow-[0_0_10px_2px_rgba(0,240,255,0.6)]';
    return (
        <div className={clsx('flex items-center justify-between', className)}>
            <div className="flex items-center gap-2.5">
                <span className={clsx('h-1.5 w-1.5 rounded-full', dot)} />
                <div>
                    <h2 className="title-display text-xs text-ink">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-[11px] leading-tight text-ink-faint">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}
