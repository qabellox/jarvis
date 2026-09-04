'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { MemoryEntry, MemoryStats } from '@shared/types';
import { SectionTitle } from './ui/SectionTitle';

export interface MemoryPanelProps {
    entries: MemoryEntry[];
    stats: MemoryStats | null;
    onSearch: (query: string) => void;
}

const KIND_STYLE: Record<MemoryEntry['kind'], string> = {
    fact: 'text-neon-cyan border-neon-cyan/30',
    preference: 'text-emerald-300 border-emerald-400/30',
    interaction: 'text-neon-blue border-neon-blue/30',
    suggestion: 'text-warn border-warn/30'
};

/** Memory Explorer — what JARVIS remembers, searchable semantically. */
export function MemoryPanel({ entries, stats, onSearch }: MemoryPanelProps) {
    const [query, setQuery] = useState('');

    return (
        <div className="flex min-h-0 flex-col">
            <SectionTitle
                title="Memory Explorer"
                subtitle={`${stats?.total ?? 0} memories recalled across sessions`}
            />

            <div className="mt-3 flex gap-2">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onSearch(query);
                    }}
                    placeholder="Search memories..."
                    className="input-jarvis !py-2 text-sm"
                    aria-label="Search memory"
                />
                <button onClick={() => onSearch(query)} className="btn-ghost shrink-0">
                    Recall
                </button>
            </div>

            {stats && (
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-ink-muted">
                    <span>{stats.facts} facts</span>·<span>{stats.interactions} chats</span>·
                    <span>{stats.preferences} prefs</span>·<span>{stats.suggestions} ideas</span>
                </div>
            )}

            <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {entries.length >= 2 && <MemoryConstellation entries={entries} />}
                {entries.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <span
                                className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${KIND_STYLE[entry.kind]}`}
                            >
                                {entry.kind}
                            </span>
                            <span className="text-[10px] text-ink-faint">{formatTime(entry.createdAt)}</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-snug text-ink/85">{entry.content}</p>
                        {entry.tags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                {entry.tags.map((tag) => (
                                    <span key={tag} className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-ink-faint">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {entries.length === 0 && (
                    <p className="py-6 text-center text-xs text-ink-faint">
                        No memories yet. JARVIS stores facts, preferences and conversation summaries here.
                    </p>
                )}
            </div>
        </div>
    );
}

function formatTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Sci-fi "knowledge constellation": memories as a pulsing network graph. */
function MemoryConstellation({ entries }: { entries: MemoryEntry[] }) {
    const nodes = entries.slice(0, 8);
    const W = 280;
    const H = 118;
    const cx = W / 2;
    const cy = H / 2;
    const R = 44;
    const pos = nodes.map((_, i) => {
        const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
    const edges = nodes.map((_, i) => [i, (i + 1) % nodes.length] as const);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="relative mb-2 rounded-xl border border-neon-cyan/10 bg-black/10"
        >
            <div className="absolute left-2 top-1.5 text-[9px] uppercase tracking-[0.3em] text-ink-faint">
                Knowledge Graph
            </div>
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="block" aria-hidden>
                {edges.map(([a, b], i) => (
                    <motion.line
                        key={`e${i}`}
                        x1={pos[a].x}
                        y1={pos[a].y}
                        x2={pos[b].x}
                        y2={pos[b].y}
                        stroke="rgba(0,240,255,0.3)"
                        strokeWidth="1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.2, 0.8, 0.2] }}
                        transition={{ repeat: Infinity, duration: 3, delay: i * 0.25 }}
                    />
                ))}
                {nodes.map((n, i) => (
                    <g key={n.id} transform={`translate(${pos[i].x},${pos[i].y})`}>
                        <motion.circle
                            r="9"
                            fill={i % 3 === 0 ? 'rgba(168,85,247,0.12)' : 'rgba(0,240,255,0.12)'}
                            stroke={i % 3 === 0 ? 'rgba(168,85,247,0.5)' : 'rgba(0,240,255,0.5)'}
                            animate={{ r: [9, 13, 9], opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 2.6, delay: i * 0.18 }}
                        />
                        <circle r="2.5" fill={i % 3 === 0 ? '#a855f7' : '#00f0ff'} />
                    </g>
                ))}
            </svg>
        </motion.div>
    );
}
