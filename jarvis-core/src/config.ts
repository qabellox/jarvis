import { config as loadDotEnv } from 'dotenv';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigError } from './utils/errors';

export interface CoreConfig {
    server: { host: string; wsPort: number; esp32Port: number; httpPort: number };
    deepseek: { apiKey: string; model: string; baseUrl: string };
    dataDir: string;
    fl: { algorithm: string; maxToolIterations: number };
    demo: { fleet: boolean; autoTrain: boolean };
    python: { allowedDir: string; timeoutMs: number };
    workspace: string;
    accessToken: string;
    autonomy: {
        proactiveCron: string;
        reflectionCron: string;
        nodeTimeoutMs: number;
    };
    telegram: { botToken: string; allowedChatIds: string[] };
    version: string;
}

function envStr(key: string, fallback = ''): string {
    const value = process.env[key];
    return value === undefined || value === '' ? fallback : value;
}

function envInt(key: string, fallback: number): number {
    const raw = Number(process.env[key]);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return fallback;
    return raw === '1' || raw.toLowerCase() === 'true';
}

export class ConfigService {
    private cfg!: CoreConfig;

    constructor(private readonly dataDirOverride?: string) { }

    load(): CoreConfig {
        // Load this Core's own .env so it works no matter which process/cwd
        // spawned it (dev, the desktop app's auto-launcher, or packaged).
        // __dirname = <core>/dist (or <core>/src via tsx) → one level up = <core>.
        loadDotEnv({ path: join(__dirname, '..', '.env') });

        // Resolve paths relative to this module so the Core works from any cwd
        // (dev via tsx, packaged, or launched by absolute path).
        const root = join(__dirname, '..', '..');
        const base = this.dataDirOverride || envStr('JARVIS_DATA_DIR') || join(root, 'data');
        const dataDir = join(base, 'jarvis');
        const pythonAllowedDir = join(root, 'jarvis-core', 'scripts');
        const workspace = join(root, 'workspace');
        mkdirSync(workspace, { recursive: true });

        this.cfg = {
            server: {
                host: envStr('JARVIS_HOST', '0.0.0.0'),
                wsPort: envInt('JARVIS_CORE_WS_PORT', 8767),
                esp32Port: envInt('JARVIS_WS_PORT', 8765),
                httpPort: envInt('JARVIS_HTTP_PORT', 8080)
            },
            deepseek: {
                apiKey: envStr('DEEPSEEK_API_KEY'),
                model: envStr('DEEPSEEK_MODEL', 'deepseek-chat'),
                baseUrl: envStr('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
            },
            dataDir,
            fl: {
                algorithm: envStr('JARVIS_FL_ALGORITHM', 'FedAvg'),
                maxToolIterations: envInt('JARVIS_MAX_TOOL_ITERATIONS', 6)
            },
            demo: {
                fleet: envBool('JARVIS_DEMO_FLEET', false),
                autoTrain: envBool('JARVIS_DEMO_AUTO_TRAIN', false)
            },
            python: {
                allowedDir: pythonAllowedDir,
                timeoutMs: envInt('JARVIS_PYTHON_TIMEOUT_MS', 30000)
            },
            workspace,
            accessToken: envStr('JARVIS_ACCESS_TOKEN'),
            autonomy: {
                proactiveCron: envStr('JARVIS_PROACTIVE_CRON', '0 * * * *'),
                reflectionCron: envStr('JARVIS_REFLECTION_CRON', '0 3 * * *'),
                nodeTimeoutMs: envInt('JARVIS_NODE_TIMEOUT_MS', 30000)
            },
            telegram: {
                botToken: envStr('TELEGRAM_BOT_TOKEN'),
                allowedChatIds: envStr('TELEGRAM_ALLOWED_CHAT_IDS', '')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
            },
            version: '1.1.0'
        };

        return this.cfg;
    }

    get(): CoreConfig {
        if (!this.cfg) throw new ConfigError('ConfigService.load() must be called first.');
        return this.cfg;
    }

    hasDeepSeekKey(): boolean {
        return this.cfg.deepseek.apiKey.length > 0;
    }
}
