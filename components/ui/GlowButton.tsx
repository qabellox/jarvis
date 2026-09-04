'use client';

import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'ghost';
    children?: ReactNode;
}

/** Neon button. `primary` glows orange, `ghost` is a muted glass button. */
export function GlowButton({ variant = 'ghost', className, children, ...rest }: GlowButtonProps) {
    return (
        <button
            className={clsx(variant === 'primary' ? 'btn-primary' : 'btn-ghost', className)}
            {...rest}
        >
            {children}
        </button>
    );
}
