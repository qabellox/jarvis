'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NeuralSwarm, type SwarmMode } from '@/components/NeuralSwarm';
import { AgentConsole } from '@/components/AgentConsole';
import { VoicePoweredOrb } from './VoicePoweredOrb';
import { CommandBar } from './CommandBar';
import { useJarvis } from '@/lib/use-jarvis';
import { useVoice } from '@/lib/use-voice';

/**
 * JarvisHUD — clean, focused interface.
 *  - The vibrational orb is the single focus, centered.
 *  - One clean command bar (type or speak; spoken words appear live).
 *  - The conversation appears only when you actually talk to JARVIS.
 * No fake metrics, no logs, no clutter.
 */
export function JarvisHUD() {
    const jarvis = useJarvis();
    const spokenRef = useRef<string | null>(null);

    const { listening, wakeArmed, supported: micSupported, transcript, toggle: toggleMic, setWakeArmed } = useVoice(
        (finalText) => {
            if (finalText) void jarvis.sendPrompt(finalText);
        }
    );

    const activeTurn = jarvis.activeTurn;
    const isActive = activeTurn?.status === 'thinking' || activeTurn?.status === 'working';

    // Vocalize the finished response once per turn. Restored turns (loaded
    // from history on refresh) are skipped — only turns created live in this
    // session get spoken, so a page refresh never replays old replies.
    useEffect(() => {
        const turn = activeTurn;
        if (
            turn &&
            !turn.restored &&
            turn.status === 'done' &&
            turn.tokens.trim() &&
            spokenRef.current !== turn.sessionId
        ) {
            spokenRef.current = turn.sessionId;
            void jarvis.speak(turn.tokens.trim());
        }
    }, [activeTurn, jarvis]);

    const swarmMode: SwarmMode = listening
        ? 'speaking'
        : activeTurn?.status === 'thinking'
            ? 'thinking'
            : activeTurn?.status === 'working'
                ? 'working'
                : 'idle';

    const send = (text: string): void => {
        const trimmed = text.trim();
        if (!trimmed) return;
        void jarvis.sendPrompt(trimmed);
        if (listening) toggleMic();
    };

    return (
        <main className="relative flex h-screen w-screen flex-col items-center overflow-hidden">
            {/* ambient atoms */}
            <NeuralSwarm mode={swarmMode} />

            {/* minimal top bar — wordmark + connection only */}
            <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(0,243,255,0.4)] bg-[rgba(0,243,255,0.1)] shadow-[0_0_16px_rgba(0,243,255,0.35)]">
                        <span className="font-display text-sm font-bold text-[var(--hud-cyan)]">J</span>
                    </div>
                    <span className="title-display text-base text-white">JARVIS</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                    <button
                        type="button"
                        onClick={() => {
                            window.speechSynthesis?.cancel();
                            void jarvis.clearConversation();
                        }}
                        title="Start a new conversation"
                        className="flex h-7 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 text-[10px] uppercase tracking-[0.2em] text-ink-faint transition-all hover:border-[rgba(0,243,255,0.45)] hover:text-[var(--hud-cyan)]"
                    >
                        <span aria-hidden>＋</span> New Chat
                    </button>
                    <span
                        className={`h-1.5 w-1.5 rounded-full ${jarvis.connected ? 'bg-emerald-400' : 'bg-rose-400'}`}
                        style={{ boxShadow: jarvis.connected ? '0 0 6px #34d399' : '0 0 6px #fb7185' }}
                    />
                    {jarvis.connected ? 'Core Online' : 'Core Offline'}
                </div>
            </header>

            {/* center stage — the orb is the focus */}
            <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-6 pb-10">
                <div className="relative flex shrink-0 items-center justify-center">
                    <div
                        className="pointer-events-none absolute rounded-full"
                        style={{
                            inset: -140,
                            background:
                                'radial-gradient(circle, rgba(3,7,18,0) 40%, rgba(0,102,255,0.1) 62%, rgba(3,7,18,0.95) 100%)'
                        }}
                    />
                    <div
                        className="orb-ring pointer-events-none absolute rounded-full border border-[rgba(0,243,255,0.16)]"
                        style={{ inset: -56 }}
                    />
                    <div
                        className="orb-ring-rev pointer-events-none absolute rounded-full border border-dashed border-[rgba(0,102,255,0.2)]"
                        style={{ inset: -22 }}
                    />
                    <div
                        className="orb-ring pointer-events-none absolute rounded-full border border-[rgba(0,243,255,0.1)]"
                        style={{ inset: 12 }}
                    />
                    <div className="relative h-[440px] w-[440px] rounded-full">
                        <VoicePoweredOrb
                            enableVoiceControl={listening}
                            className="h-full w-full overflow-hidden rounded-full"
                        />
                    </div>
                </div>

                <CommandBar
                    listening={listening}
                    wakeArmed={wakeArmed}
                    micSupported={micSupported}
                    transcript={transcript}
                    onSend={send}
                    onMicToggle={toggleMic}
                    onWakeToggle={() => setWakeArmed(!wakeArmed)}
                />

                {/* conversation appears only when there is one */}
                <AnimatePresence>
                    {jarvis.turns.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 12 }}
                            transition={{ duration: 0.35 }}
                            className="max-h-[34vh] w-[min(92vw,640px)] overflow-y-auto rounded-2xl border border-[var(--hud-card-border)] bg-[var(--hud-card-bg)] p-4 shadow-[var(--hud-glow)] backdrop-blur-[20px]"
                        >
                            <AgentConsole turns={jarvis.turns} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
