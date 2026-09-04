import type { LoggerLike } from '../logger';

export interface SpeakResult {
    /** Base64 data URL of synthesized speech, or null if synthesis failed. */
    dataUrl: string | null;
    voice: string;
    durationMs: number;
}

/**
 * VoiceService — JARVIS's vocal cord.
 *
 * Uses Microsoft Edge online voices (msedge-tts) to synthesize natural speech
 * in the main process. The renderer plays the returned audio; if synthesis
 * fails it transparently falls back to the browser's Web Speech API.
 */
export class VoiceService {
    constructor(
        private readonly voiceName: string,
        private readonly logger: LoggerLike
    ) { }

    async speak(text: string): Promise<SpeakResult> {
        const started = Date.now();
        try {
            const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
            const tts = new MsEdgeTTS();
            await tts.setMetadata(this.voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            const audioStream = tts.toStream(text);
            const chunks: Uint8Array[] = [];
            for await (const chunk of audioStream) chunks.push(Buffer.from(chunk as Uint8Array));
            const audio = Buffer.concat(chunks);
            if (audio.byteLength === 0) {
                this.logger.warn('voice', 'Edge TTS returned empty audio');
                return { dataUrl: null, voice: this.voiceName, durationMs: duration(started) };
            }
            const dataUrl = toDataUrl(audio, 'audio/mp3');
            this.logger.info('voice', `Synthesized speech (${Math.round(audio.byteLength / 1024)} KB)`);
            return { dataUrl, voice: this.voiceName, durationMs: duration(started) };
        } catch (error) {
            this.logger.warn('voice', `TTS failed, falling back: ${String(error)}`);
            void error;
            return { dataUrl: null, voice: this.voiceName, durationMs: duration(started) };
        }
    }
}

function duration(started: number): number {
    return Date.now() - started;
}

function toDataUrl(bytes: Uint8Array, mime: string): string {
    const base64 = Buffer.from(bytes).toString('base64');
    return `data:${mime};base64,${base64}`;
}
