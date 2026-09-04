import { config as loadDotEnv } from 'dotenv';

/**
 * JARVIS Electron client configuration.
 *
 * The desktop client is intentionally thin: the only settings it needs are
 * where the Core lives and the voice preference. Everything else (DeepSeek,
 * ESP32, federation, memory, research DB) is owned by the Core.
 */
export interface ClientConfig {
    coreWsUrl: string;
    voice: { ttsVoice: string };
    reconnectDelayMs: number;
    /** True when the operator runs their own Core (JARVIS_EXTERNAL_CORE=1). */
    externalCore: boolean;
}

function envStr(key: string, fallback = ''): string {
    const value = process.env[key];
    return value === undefined || value === '' ? fallback : value;
}

function envInt(key: string, fallback: number): number {
    const raw = Number(process.env[key]);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export class ClientConfigService {
    load(): ClientConfig {
        loadDotEnv();
        const host = envStr('JARVIS_HOST', '127.0.0.1');
        const port = envInt('JARVIS_CORE_WS_PORT', 8767);
        return {
            coreWsUrl: envStr('JARVIS_CORE_WS_URL', `ws://${host}:${port}`),
            voice: { ttsVoice: envStr('JARVIS_TTS_VOICE', 'en-US-ChristopherNeural') },
            reconnectDelayMs: envInt('JARVIS_RECONNECT_MS', 3000),
            externalCore: envStr('JARVIS_EXTERNAL_CORE', '0') === '1'
        };
    }
}
