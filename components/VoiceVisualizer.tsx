'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';

export interface VoiceVisualizerProps {
    active: boolean;
    level?: number;
    color?: string;
    barCount?: number;
}

/** Neon waveform that animates while the microphone is live. */
export function VoiceVisualizer({
    active,
    level = 0.5,
    color = '#00f0ff',
    barCount = 28
}: VoiceVisualizerProps) {
    const bars = useMemo(
        () =>
            Array.from({ length: barCount }, (_, i) => ({
                delay: (i % 7) * 0.05,
                seed: ((i * 37) % 13) / 13,
                base: 0.22 + ((i * 11) % 9) / 24
            })),
        [barCount]
    );

    return (
        <div className="flex h-10 items-center justify-center gap-[3px]" aria-hidden="true">
            {bars.map((bar, i) => (
                <motion.span
                    key={i}
                    className="h-full w-[3px] origin-center rounded-full"
                    style={{
                        background: color,
                        boxShadow: `0 0 8px ${color}`,
                        opacity: active ? 0.95 : 0.3
                    }}
                    animate={{
                        scaleY: active ? 0.25 + level * 1.15 + bar.seed * 0.75 : 0.22
                    }}
                    transition={{
                        repeat: Infinity,
                        repeatType: 'mirror',
                        duration: 0.7 + bar.seed,
                        delay: bar.delay,
                        ease: 'easeInOut'
                    }}
                />
            ))}
        </div>
    );
}
