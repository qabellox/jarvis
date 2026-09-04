'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Glass } from './ui/Glass';
import type { AgentTurn, ToolActivity } from '@/lib/use-jarvis';

export interface AgentConsoleProps {
    turns: AgentTurn[];
}

export function AgentConsole({ turns }: AgentConsoleProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [turns]);

    if (turns.length === 0) {
        return (
            <div className="flex items-center justify-center py-16 text-center">
                <div>
                    <div className="font-display text-sm uppercase tracking-[0.4em] text-ink-faint">
                        JARVIS Standing By
                    </div>
                    <p className="mt-2 max-w-sm text-sm text-ink-muted">
                        Speak or type a directive and JARVIS will respond.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex max-h-full flex-col gap-3 overflow-y-auto pr-1">
            {turns.map((turn) => (
                <TurnCard key={turn.sessionId} turn={turn} />
            ))}
            <div ref={bottomRef} />
        </div>
    );
}

function TurnCard({ turn }: { turn: AgentTurn }) {
    const thinking = turn.status === 'thinking';
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-2"
        >
            {/* user prompt */}
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm border border-white/10 bg-white/[0.04] px-4 py-2.5">
                <div className="mb-0.5 text-[10px] uppercase tracking-[0.3em] text-ink-faint">You</div>
                <p className="text-sm text-ink">{turn.prompt}</p>
            </div>

            {/* assistant */}
            <Glass accent="blue" className="max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                    <span className="neon-blue-text font-display text-[10px] font-semibold uppercase tracking-[0.3em]">
                        JARVIS
                    </span>
                    {thinking && <ThinkingDots />}
                </div>

                {turn.toolActivity.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        {turn.toolActivity.map((tool) => (
                            <ToolChip key={tool.id} tool={tool} />
                        ))}
                    </div>
                )}

                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink/90">
                    {turn.tokens}
                    {thinking && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-neon-blue align-text-bottom" />}
                </p>

                {turn.status === 'error' && (
                    <p className="mt-2 text-xs text-rose-300">Error: {turn.error}</p>
                )}
            </Glass>
        </motion.div>
    );
}

function ToolChip({ tool }: { tool: ToolActivity }) {
    const done = tool.status === 'done';
    const failed = tool.status === 'error';
    const color = failed ? '#fb7185' : done ? '#34d399' : '#00f0ff';
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]"
            style={{ borderColor: `${color}55`, color, background: `${color}11` }}
            title={tool.summary}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${done || failed ? '' : 'animate-pulse'}`}
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            />
            {tool.name}
            {done && <span className="text-ink-faint">/ {tool.summary}</span>}
        </span>
    );
}

function ThinkingDots() {
    return (
        <span className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    className="h-1 w-1 rounded-full bg-neon-cyan"
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                />
            ))}
        </span>
    );
}
