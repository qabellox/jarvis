/**
 * Typed error taxonomy for JARVIS. Every subsystem throws one of these so the
 * IPC layer can map them to structured payloads instead of leaking stack traces
 * to the renderer.
 */
export class JarvisError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'JarvisError';
    }
}

export class ConfigError extends JarvisError {
    constructor(message: string, details?: unknown) {
        super(message, 'CONFIG_ERROR', details);
        this.name = 'ConfigError';
    }
}

export class AgentError extends JarvisError {
    constructor(message: string, details?: unknown) {
        super(message, 'AGENT_ERROR', details);
        this.name = 'AgentError';
    }
}

export class Esp32Error extends JarvisError {
    constructor(message: string, details?: unknown) {
        super(message, 'ESP32_ERROR', details);
        this.name = 'Esp32Error';
    }
}

export class DatabaseError extends JarvisError {
    constructor(message: string, details?: unknown) {
        super(message, 'DATABASE_ERROR', details);
        this.name = 'DatabaseError';
    }
}

export class VoiceError extends JarvisError {
    constructor(message: string, details?: unknown) {
        super(message, 'VOICE_ERROR', details);
        this.name = 'VoiceError';
    }
}

/** Convert any thrown value into a JarvisError with a stable shape. */
export function toJarvisError(error: unknown, fallbackCode = 'INTERNAL_ERROR'): JarvisError {
    if (error instanceof JarvisError) return error;
    if (error instanceof Error) return new JarvisError(error.message, fallbackCode, { stack: error.stack });
    return new JarvisError(String(error), fallbackCode);
}

/** Stable payload shape sent over IPC for every rejection. */
export interface ErrorPayload {
    ok: false;
    code: string;
    message: string;
}
