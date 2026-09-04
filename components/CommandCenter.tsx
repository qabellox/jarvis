'use client';

import { useState } from 'react';
import { GlowButton } from './ui/GlowButton';
import { VoiceVisualizer } from './VoiceVisualizer';

export interface CommandCenterProps {
    busy: boolean;
    listening: boolean;
    micSupported: boolean;
    onSend: (prompt: string) => void;
    onMicToggle: () => void;
}

const SUGGESTIONS = [
    'What is your current status?',
    'List the files in your workspace',
    'What do you remember about me?',
    'What can you do?'
];

export function CommandCenter({
    busy,
    listening,
    micSupported,
    onSend,
    onMicToggle
}: CommandCenterProps) {
    const [prompt, setPrompt] = useState('');

    const submit = (): void => {
        const text = prompt.trim();
        if (!text || busy) return;
        setPrompt('');
        onSend(text);
    };

    return (
        <div className="flex w-full max-w-3xl flex-col gap-4">
            <div className="glass-panel-accent-purple relative overflow-hidden rounded-2xl border p-2 backdrop-blur-xl">
                <div className="scanline" />
                <div className="flex items-center gap-2">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                submit();
                            }
                        }}
                        rows={2}
                        placeholder="Speak or type a directive for JARVIS"
                        className="input-jarvis resize-none border-0 bg-transparent shadow-none focus:border-0 focus:shadow-none"
                        aria-label="JARVIS command input"
                    />
                </div>
                <div className="flex items-center justify-between gap-3 p-2">
                    <div className="flex-1">
                        {listening ? (
                            <VoiceVisualizer active color="#00f0ff" />
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {SUGGESTIONS.slice(0, busy ? 2 : 4).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => !busy && onSend(s)}
                                        disabled={busy}
                                        className="rounded-full border border-white/25 bg-white/[0.08] px-3.5 py-1.5 text-[11px] font-medium text-ink transition-colors hover:border-neon-cyan/60 hover:text-white disabled:opacity-40"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            {listening && (
                                <span className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-xl border border-neon-cyan/50" />
                            )}
                            <GlowButton
                                variant="ghost"
                                onClick={onMicToggle}
                                disabled={!micSupported || busy}
                                title={micSupported ? 'Voice command' : 'Voice not supported'}
                                className={`h-12 w-12 rounded-xl p-0 ${listening ? 'border-neon-cyan/50 shadow-glow-cyan' : ''}`}
                            >
                                <MicIcon listening={listening} />
                            </GlowButton>
                        </div>
                        <GlowButton variant="primary" onClick={submit} disabled={busy} className="h-12 px-6">
                            {busy ? (
                                <Spinner />
                            ) : (
                                <>
                                    <span className="hidden sm:inline">Activate JARVIS</span>
                                    <span className="sm:hidden">Activate</span>
                                </>
                            )}
                        </GlowButton>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MicIcon({ listening }: { listening: boolean }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 ${listening ? 'animate-pulse text-neon-cyan' : 'text-ink-muted'}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
        >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
        </svg>
    );
}

function Spinner() {
    return <span className="spinner-ring" aria-hidden="true" />;
}
