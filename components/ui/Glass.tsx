'use client';

import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export interface GlassProps extends HTMLAttributes<HTMLDivElement> {
    accent?: 'none' | 'orange' | 'blue';
    children?: ReactNode;
}

/** Frosted glass panel with optional neon accent border. */
export function Glass({ accent = 'none', className, children, ...rest }: GlassProps) {
    return (
        <div
            className={clsx(
                'glass-panel',
                accent === 'orange' && 'glass-panel-accent-purple',
                accent === 'blue' && 'glass-panel-accent-cyan',
                className
            )}
            {...rest}
        >
            {children}
        </div>
    );
}
