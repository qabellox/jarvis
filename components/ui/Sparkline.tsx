'use client';

import { useId } from 'react';

export interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
}

/** Lightweight SVG sparkline for convergence / latency trends. */
export function Sparkline({
    data,
    width = 140,
    height = 36,
    color = '#00f0ff'
}: SparklineProps) {
    const gradientId = useId();
    if (data.length < 2) {
        return <svg width={width} height={height} aria-hidden />;
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pad = 3;
    const stepX = (width - pad * 2) / (data.length - 1);
    const points = data
        .map((v, i) => {
            const x = pad + i * stepX;
            const y = pad + (1 - (v - min) / span) * (height - pad * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`${pad},${height - pad} ${points} ${width - pad},${height - pad}`} fill={`url(#${gradientId})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        </svg>
    );
}
