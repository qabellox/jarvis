'use client';

import { useEffect, useRef, useState } from 'react';

export interface VoiceApi {
    /** Mic is capturing a command (mic button pressed). Sends on final. */
    listening: boolean;
    /** Wake-word mode: say "Jarvis" to trigger hands-free. */
    wakeArmed: boolean;
    level: number;
    supported: boolean;
    /** Live recognized text (interim + final). */
    transcript: string;
    toggle: () => void;
    setWakeArmed: (armed: boolean) => void;
    stop: () => void;
}

interface SRResultItem {
    transcript: string;
    isFinal: boolean;
}
interface SREventLike {
    resultIndex: number;
    results: ArrayLike<{ [index: number]: SRResultItem } & { length: number }>;
}
interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((e: SREventLike) => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
}

const WAKE_WORD = 'jarvis';

/**
 * useVoice — robust speech engine.
 *
 * Two independent modes share ONE recognition instance so the browser's mic
 * permission is only requested once:
 *
 *  - Mic button (push-to-talk): `continuous = true` — you press the mic, speak
 *    for as long as you need, then press again (or tap "stop") and it sends
 *    everything it heard. It ALSO auto-sends on a final result so a short
 *    utterance doesn't require a second tap.
 *  - Wake word: while armed, recognition keeps running; any phrase that
 *    contains "jarvis" is sent hands-free.
 *
 * The transcript is NEVER cleared before the heard text is dispatched, so a
 * "press mic -> speak -> release" flow cannot drop your words.
 */
export function useVoice(onCommand: (text: string) => void): VoiceApi {
    const [listening, setListening] = useState(false);
    const [wakeArmed, setWakeArmed] = useState(true);
    const [level, setLevel] = useState(0);
    const [supported, setSupported] = useState(false);
    const [transcript, setTranscript] = useState('');

    const onCommandRef = useRef(onCommand);
    onCommandRef.current = onCommand;
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const listeningRef = useRef(false);
    const wakeRef = useRef(true);
    const wantRunningRef = useRef(true);
    const lastHeardRef = useRef('');
    const finalBufferRef = useRef('');
    const restartTimerRef = useRef<number | null>(null);
    const disposedRef = useRef(false);
    listeningRef.current = listening;
    wakeRef.current = wakeArmed;

    /** Dispatch what we heard (if anything) and reset capture buffers. */
    const dispatchHeard = (): void => {
        const heard = (finalBufferRef.current + ' ' + lastHeardRef.current).trim();
        finalBufferRef.current = '';
        lastHeardRef.current = '';
        setTranscript('');
        setLevel(0);
        if (heard) onCommandRef.current(heard);
    };

    useEffect(() => {
        const w = window as unknown as {
            SpeechRecognition?: new () => SpeechRecognitionLike;
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        };
        const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!Ctor) return;
        setSupported(true);

        const recognition = new Ctor();
        // continuous = true: keeps capturing while the mic is held (push-to-talk),
        // and keeps listening in wake mode. No more "stop after one word" drops.
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        const clearRestart = (): void => {
            if (restartTimerRef.current) {
                window.clearTimeout(restartTimerRef.current);
                restartTimerRef.current = null;
            }
        };

        const startEngine = (): void => {
            try {
                recognition.start();
            } catch {
                /* already running — fine */
            }
        };

        const scheduleRestart = (): void => {
            clearRestart();
            restartTimerRef.current = window.setTimeout(() => {
                restartTimerRef.current = null;
                if (!disposedRef.current && wantRunningRef.current) {
                    try {
                        recognition.start();
                    } catch {
                        /* noop */
                    }
                }
            }, 350);
        };

        recognition.onresult = (e) => {
            let final = '';
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i += 1) {
                const result = e.results[i];
                if (result[0].isFinal) final += result[0].transcript;
                else interim += result[0].transcript;
            }
            if (final) finalBufferRef.current += final + ' ';
            if (interim) lastHeardRef.current = interim.trim();
            const active = (finalBufferRef.current + ' ' + lastHeardRef.current).trim();
            if (active) setLevel(Math.min(1, 0.3 + active.length * 0.02));
            setTranscript(active);

            const phrase = final.trim();
            if (!phrase) return;

            const triggeredByWake = wakeRef.current && phrase.toLowerCase().includes(WAKE_WORD);

            if (listeningRef.current) {
                // Push-to-talk: a final result arrived — send it now, then stop
                // the mic session (recognition may keep running for wake mode).
                listeningRef.current = false;
                setListening(false);
                finalBufferRef.current = '';
                lastHeardRef.current = '';
                setTranscript('');
                setLevel(0);
                onCommandRef.current(phrase);
                wantRunningRef.current = wakeRef.current;
                return;
            }

            if (triggeredByWake) {
                // Wake word: hands-free command. Keep listening.
                finalBufferRef.current = '';
                lastHeardRef.current = '';
                setTranscript('');
                setLevel(0);
                onCommandRef.current(phrase.replace(new RegExp(WAKE_WORD, 'gi'), '').trim() || phrase);
                return;
            }

            // Heard speech that wasn't a command (wake not armed, mic not on) —
            // remember it as interim so it isn't lost if the user starts the mic.
        };

        recognition.onend = () => {
            setLevel(0);
            if (!disposedRef.current && !listeningRef.current && wakeRef.current) {
                // Wake mode: keep the channel alive.
                scheduleRestart();
            }
        };

        recognition.onerror = () => {
            setLevel(0);
            // If the mic session was active, still dispatch whatever we caught
            // so a hiccup never deletes the user's words.
            if (listeningRef.current) {
                listeningRef.current = false;
                setListening(false);
                dispatchHeard();
            }
        };

        recognitionRef.current = recognition;

        const arm = (): void => {
            if (wakeRef.current) {
                wantRunningRef.current = true;
                startEngine();
            }
        };
        arm();
        window.addEventListener('pointerdown', arm, { once: true });

        return () => {
            disposedRef.current = true;
            clearRestart();
            window.removeEventListener('pointerdown', arm);
            try {
                recognition.abort();
            } catch {
                /* noop */
            }
            recognitionRef.current = null;
        };
    }, []);

    // React to wakeArmed changes.
    useEffect(() => {
        const r = recognitionRef.current;
        if (!r) return;
        if (wakeArmed) {
            wantRunningRef.current = true;
            try {
                r.start();
            } catch {
                /* noop */
            }
        } else if (!listeningRef.current) {
            wantRunningRef.current = false;
            try {
                r.stop();
            } catch {
                /* noop */
            }
        }
    }, [wakeArmed]);

    const toggle = (): void => {
        const r = recognitionRef.current;
        if (!r) return;
        if (listening) {
            // Stop push-to-talk: send what was heard.
            listeningRef.current = false;
            setListening(false);
            wantRunningRef.current = wakeRef.current;
            dispatchHeard();
            try {
                r.stop();
            } catch {
                /* noop */
            }
        } else {
            // Start push-to-talk. Continuous mode keeps the mic open until the
            // user stops again, so nothing gets cut off.
            listeningRef.current = true;
            setListening(true);
            wantRunningRef.current = true;
            try {
                r.start();
            } catch {
                /* already running — fine, we're now capturing */
            }
        }
    };

    const stop = (): void => {
        listeningRef.current = false;
        setListening(false);
        wantRunningRef.current = wakeRef.current;
        dispatchHeard();
        try {
            recognitionRef.current?.stop();
        } catch {
            /* noop */
        }
    };

    return {
        listening,
        wakeArmed,
        level,
        supported,
        transcript,
        toggle,
        setWakeArmed,
        stop
    };
}
