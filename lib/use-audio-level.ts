'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useAudioLevel — real-time microphone loudness (0..1) while `active`.
 *
 * Used to make the central JARVIS orb vibrate with sound, NCS-visualizer
 * style. Gated by the `active` flag so the mic is only tapped while listening;
 * falls back to 0 silently if the mic is unavailable.
 */
export function useAudioLevel(active: boolean): number {
    const [level, setLevel] = useState(0);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        if (!active) {
            setLevel(0);
            return;
        }

        let ctx: AudioContext | null = null;
        let analyser: AnalyserNode | null = null;
        let stream: MediaStream | null = null;
        let data: Uint8Array<ArrayBuffer> | null = null;
        let disposed = false;

        const tick = (): void => {
            if (disposed) return;
            if (analyser && data) {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i += 1) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                // Scale so normal speech lands around 0.3-0.8; loud sound peaks at 1.
                setLevel(Math.min(1, rms * 3.2));
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        (async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (disposed) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                const Ctor =
                    window.AudioContext ??
                    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!Ctor) return;
                ctx = new Ctor();
                analyser = ctx.createAnalyser();
                analyser.fftSize = 1024;
                ctx.createMediaStreamSource(stream).connect(analyser);
                data = new Uint8Array(analyser.fftSize);
                rafRef.current = requestAnimationFrame(tick);
            } catch {
                /* mic unavailable — CSS breathing keeps the orb alive */
            }
        })();

        return () => {
            disposed = true;
            cancelAnimationFrame(rafRef.current);
            stream?.getTracks().forEach((t) => t.stop());
            ctx?.close().catch(() => undefined);
            setLevel(0);
        };
    }, [active]);

    return level;
}
