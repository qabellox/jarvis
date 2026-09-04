import type { ToolDefinition } from '../shared/types';
import { ToolError } from '../utils/errors';
import type { JarvisTool } from '../agent/ToolRegistry';
import type { ToolDeps } from './deps';

const definition: ToolDefinition = {
    name: 'send_telegram_message',
    description:
        'Send a message to a Telegram chat (user or group) through the connected Telegram client. Use for alerts and proactive reports. Fails if no Telegram client is connected.',
    parameters: {
        chat_id: { type: 'string', description: 'Telegram chat id, or "default" for the primary chat', required: true },
        text: { type: 'string', description: 'Message text', required: true }
    }
};

export function sendTelegramTool(deps: ToolDeps): JarvisTool {
    return {
        definition,
        async execute(args) {
            const chatId = String(args.chat_id ?? 'default');
            const text = String(args.text ?? '');
            if (!text) throw new ToolError('send_telegram_message requires text');

            const delivered = deps.clients.sendTo('telegram', {
                kind: 'message',
                chatId,
                text,
                at: new Date().toISOString()
            });
            if (!delivered) {
                throw new ToolError('No Telegram client is connected to the Core');
            }
            return {
                summary: `Telegram message queued for chat ${chatId}`,
                data: { chatId, text }
            };
        }
    };
}
