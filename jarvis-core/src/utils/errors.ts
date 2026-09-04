/** Typed error taxonomy for JARVIS Core. */
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

export class ToolError extends JarvisError {
    constructor(message: string, details?: unknown) {
        super(message, 'TOOL_ERROR', details);
        this.name = 'ToolError';
    }
}

export class ProtocolError extends JarvisError {
    constructor(message: string, details?: unknown) {
        super(message, 'PROTOCOL_ERROR', details);
        this.name = 'ProtocolError';
    }
}

/** Convert any thrown value into a JarvisError. */
export function toJarvisError(error: unknown, fallbackCode = 'INTERNAL_ERROR'): JarvisError {
    if (error instanceof JarvisError) return error;
    if (error instanceof Error) return new JarvisError(error.message, fallbackCode, { stack: error.stack });
    return new JarvisError(String(error), fallbackCode);
}
