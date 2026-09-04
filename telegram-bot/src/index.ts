import { config as loadDotEnv } from 'dotenv';
import { CoreClient } from './coreClient';
import { JarvisBot } from './bot';

loadDotEnv();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('[jarvis-telegram] TELEGRAM_BOT_TOKEN is required. See .env.example');
    process.exit(1);
}

const coreUrl = process.env.JARVIS_CORE_WS_URL || 'ws://127.0.0.1:8767';
const version = process.env.JARVIS_VERSION || '1.1.0';
const allowedChatIds = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const log = (message: string): void => console.log(`[${new Date().toISOString()}] ${message}`);

const client = new CoreClient(coreUrl, version);
client.onStatusChange((status) => log(`Core ${status}`));
client.connect();

const bot = new JarvisBot(token, client, allowedChatIds, log);
bot.launch();

log(`JARVIS Telegram client v${version} -> Core at ${coreUrl}`);

const shutdown = (): void => {
    bot.stop();
    client.dispose();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
