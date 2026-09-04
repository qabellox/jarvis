'use client';

import { useState } from 'react';

export interface CommandBarProps {
    listening: boolean;
    wakeArmed: boolean;
    micSupported: boolean;
    transcript: string;
    onSend: (text: string) => void;
    onMicToggle: () => void;
    onWakeToggle: () => void;
}

/**
 * CommandBar — clean input for JARVIS.
 *
 * Typing is never touched by voice: while the mic is off, the bar shows ONLY
 * what you type and Enter sends exactly that. Voice only appears while the
 * mic is actively listening.
 */
export function CommandBar({
    listening,
    wakeArmed,
    micSupported,
    transcript,
    onSend,
    onMicToggle,
    onWakeToggle
}: CommandBarProps) {
    const [draft, setDraft] = useState('');

    // Voice shows only while listening; otherwise it's your typed text.
    const shown = listening ? transcript : draft;

    const submit = (): void => {
        const text = shown.trim();
        if (!text) return;
        setDraft('');
        onSend(text);
    };

    return (
        <div className="w-[min(92vw,640px)]">
            <div className="flex items-center gap-2 rounded-full border border-[var(--hud-card-border)] bg-[var(--hud-card-bg)] px-4 py-2 shadow-[var(--hud-glow)] backdrop-blur-[20px]">
                <input
                    value={shown}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    placeholder={listening ? 'Listening… speak now' : 'Ask JARVIS…'}
                    aria-label="Command"
                    className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-[#e0f2fe] placeholder-ink-faint outline-none"
                    style={{ caretColor: 'var(--hud-cyan)' }}
                />

                <button
                    onClick={onMicToggle}
                    disabled={!micSupported}
                    title={micSupported ? (listening ? 'Stop' : 'Talk') : 'Voice not supported'}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all ${listening
                            ? 'border-[rgba(255,183,0,0.55)] bg-[rgba(255,183,0,0.14)] text-[var(--hud-amber)] shadow-[0_0_18px_rgba(255,183,0,0.4)]'
                            : 'border-[rgba(0,243,255,0.35)] bg-[rgba(0,243,255,0.08)] text-[var(--hud-cyan)] hover:border-[rgba(0,243,255,0.7)]'
                        } ${!micSupported ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                    <MicIcon listening={listening} />
                </button>

                <button
                    onClick={onWakeToggle}
                    title="Wake word: say 'Jarvis' to trigger"
                    className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 font-mono text-[10px] uppercase tracking-wider transition-all ${wakeArmed
                            ? 'border-[rgba(0,243,255,0.45)] bg-[rgba(0,243,255,0.1)] text-[var(--hud-cyan)]'
                            : 'border-white/15 bg-white/5 text-ink-faint'
                        }`}
                >
                    <span className={`h-1.5 w-1.5 rounded-full ${wakeArmed ? 'animate-pulse bg-[var(--hud-cyan)]' : 'bg-ink-faint'}`} />
                    Wake
                </button>

                <button
                    onClick={submit}
                    className="shrink-0 rounded-full bg-[linear-gradient(135deg,#00f3ff,#0066ff)] px-5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#030712] shadow-[0_0_18px_rgba(0,243,255,0.35)] transition-transform hover:scale-[1.03]"
                >
                    Send
                </button>
            </div>

            {/* status line */}
            <div className="mt-2 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                {listening ? (
                    <span className="text-[var(--hud-amber)]">● Listening… speak now</span>
                ) : wakeArmed && transcript ? (
                    <span className="text-[var(--hud-cyan)]">Heard: {transcript}</span>
                ) : wakeArmed ? (
                    <span>say &quot;Jarvis&quot; to wake — or press the mic</span>
                ) : (
                    <span>press the mic to talk</span>
                )}
            </div>
        </div>
    );
}

function MicIcon({ listening }: { listening: boolean }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 ${listening ? 'animate-pulse' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
        </svg>
    );
}
