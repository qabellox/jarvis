import { Telegraf } from 'telegraf';
import { Channels, Methods } from './protocol';
import type { CoreClient } from './coreClient';

interface AgentEventLike {
    type: 'token' | 'status' | 'tool_call' | 'tool_result' | 'done' | 'error';
    sessionId: string;
    data?: { name?: string; ok?: boolean; summary?: string; message?: string } | string;
}

interface RouteLike {
    kind?: string;
    chatId?: string;
    text?: string;
}

/**
 * JarvisBot — the Telegram face of JARVIS.
 *
 * Sits between Telegram and the Core: user messages become agent.run requests,
 * the Core's streamed replies are relayed back as Telegram messages, and the
 * Core's proactive reports (monitor, self-improvement, send_telegram_message
 * tool) are delivered to the operator's chat.
 */
export class JarvisBot {
    private readonly bot: Telegraf;
    private readonly pendingReplies = new Map<string, { chatId: number; tokens: string }>();

    constructor(
        token: string,
        private readonly client: CoreClient,
        private readonly allowedChatIds: string[],
        private readonly log: (message: string) => void
    ) {
        this.bot = new Telegraf(token);
        this.wireCoreEvents();
        this.wireBotCommands();
    }

    launch(): void {
        void this.bot.launch().catch((error) => this.log(`Telegram launch failed: ${String(error)}`));
        this.log('JARVIS Telegram bot polling');
    }

    stop(): void {
        this.bot.stop();
    }

    private allowed(chatId: number): boolean {
        return this.allowedChatIds.length === 0 || this.allowedChatIds.includes(String(chatId));
    }

    private primaryChatId(): number | null {
        const first = this.allowedChatIds[0];
        return first ? Number(first) : null;
    }

    // ------------------------------------------------------------------ core
    private wireCoreEvents(): void {
        this.client.onEvent(Channels.AgentEvent, (raw) => {
            const event = raw as AgentEventLike;
            const pending = this.pendingReplies.get(event.sessionId);
            if (!pending) return;
            const data = event.data as { name?: string; ok?: boolean; summary?: string; message?: string };

            switch (event.type) {
                case 'token':
                    if (typeof event.data === 'string') pending.tokens += event.data;
                    break;
                case 'tool_call':
                    void this.safeSend(pending.chatId, `\u{1F527} ${data?.name ?? 'tool'} running...`);
                    break;
                case 'tool_result': {
                    const status = data?.ok === false ? 'failed' : 'done';
                    if (data?.summary) void this.safeSend(pending.chatId, `\u2705 ${data.summary} (${status})`);
                    break;
                }
                case 'done': {
                    this.pendingReplies.delete(event.sessionId);
                    const text = pending.tokens.trim();
                    if (text) void this.safeSend(pending.chatId, text);
                    break;
                }
                case 'error':
                    this.pendingReplies.delete(event.sessionId);
                    void this.safeSend(pending.chatId, `\u26A0\uFE0F ${data?.message ?? 'Agent error'}`);
                    break;
                default:
                    break;
            }
        });

        // Core -> telegram routed messages (proactive reports, tool sends).
        this.client.onEvent('__route__', (raw) => {
            const route = raw as RouteLike;
            if (route.kind === 'message') {
                const chatId = route.chatId === 'default' ? this.primaryChatId() : Number(route.chatId ?? '');
                if (chatId && route.text) void this.safeSend(chatId, route.text);
            } else if (route.kind === 'report') {
                const chatId = this.primaryChatId();
                if (chatId && route.text) void this.safeSend(chatId, route.text);
            }
        });
    }

    // ---------------------------------------------------------------- bot
    private wireBotCommands(): void {
        this.bot.start((ctx) => {
            if (!this.allowed(ctx.chat.id)) return ctx.reply('Access denied.');
            return ctx.reply(
                'JARVIS online. Command the ESP32 fleet, federated learning, and your PC from your phone.\n\n' +
                'Just send a message, or use /status, /nodes, /memory, /help.'
            );
        });

        this.bot.command('status', async (ctx) => {
            if (!this.allowed(ctx.chat.id)) return;
            try {
                const status = await this.client.request<Record<string, unknown>>(Methods.SystemStatus);
                const lines = [
                    `\u{1F4CA} JARVIS Core status`,
                    `Uptime: ${String(status.uptimeSeconds)}s`,
                    `Nodes: ${String(status.nodeCount)} | Sessions: ${String(status.activeSessions)}`,
                    `Federation: ${status.federationActive ? 'active' : 'idle'}`,
                    `Clients: ${JSON.stringify(status.connectedClients ?? {})}`
                ];
                return ctx.reply(lines.join('\n'));
            } catch (error) {
                return ctx.reply(`\u26A0\uFE0F Core unreachable: ${(error as Error).message}`);
            }
        });

        this.bot.command('nodes', async (ctx) => {
            if (!this.allowed(ctx.chat.id)) return;
            try {
                const nodes = await this.client.request<Array<{ name: string; status: string; metrics?: { accuracy: number; latencyMs: number } | null }>>(Methods.NodeList);
                if (nodes.length === 0) return ctx.reply('No ESP32 nodes connected.');
                const lines = nodes.map(
                    (n) => `\u2022 ${n.name} [${n.status}] ${n.metrics ? `${n.metrics.accuracy.toFixed(1)}% / ${n.metrics.latencyMs.toFixed(1)}ms` : 'no metrics'}`
                );
                return ctx.reply(lines.join('\n'));
            } catch (error) {
                return ctx.reply(`\u26A0\uFE0F ${(error as Error).message}`);
            }
        });

        this.bot.command('memory', async (ctx) => {
            if (!this.allowed(ctx.chat.id)) return;
            try {
                const stats = await this.client.request<Record<string, number>>(Methods.MemoryStats);
                return ctx.reply(
                    `\u{1F9E0} Memory: ${stats.total ?? 0} entries (${stats.facts ?? 0} facts, ${stats.suggestions ?? 0} suggestions)`
                );
            } catch (error) {
                return ctx.reply(`\u26A0\uFE0F ${(error as Error).message}`);
            }
        });

        this.bot.help((ctx) => {
            if (!this.allowed(ctx.chat.id)) return ctx.reply('Access denied.');
            return ctx.reply(
                'Commands: /status, /nodes, /memory, /help\n\n' +
                'Or just talk to JARVIS — it can control ESP32 nodes, run federated training, execute Python, recall memory and notify you.'
            );
        });

        this.bot.on('text', async (ctx) => {
            if (!this.allowed(ctx.chat.id)) return;
            const prompt = (ctx.message as { text: string }).text;
            try {
                const { sessionId } = await this.client.request<{ sessionId: string }>(Methods.AgentRun, { prompt });
                this.pendingReplies.set(sessionId, { chatId: ctx.chat.id, tokens: '' });
                this.log(`agent.run -> ${sessionId} from chat ${ctx.chat.id}`);
            } catch (error) {
                await ctx.reply(`\u26A0\uFE0F Core unreachable: ${(error as Error).message}`);
            }
        });
    }

    private async safeSend(chatId: number, text: string): Promise<void> {
        try {
            await this.bot.telegram.sendMessage(chatId, text);
        } catch (error) {
            this.log(`send failed to ${chatId}: ${String(error)}`);
        }
    }
}
