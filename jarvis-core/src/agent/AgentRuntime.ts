import type { AgentEvent } from '../shared/types';
import { newId } from '../utils/id';
import { durationMs, nowIso } from '../utils/time';
import { AgentError, toJarvisError } from '../utils/errors';
import type { LoggerLike } from '../logger';
import type { ResearchRepository } from '../database/ResearchRepository';
import type { MemoryStore } from '../memory/MemoryStore';
import type { DeepSeekClient, LlmMessage } from './DeepSeekClient';
import { DemoResponder } from './DemoResponder';
import type { ToolRegistry, ToolContext } from './ToolRegistry';

const BASE_SYSTEM_PROMPT = `You are JARVIS (Just A Rather Very Intelligent System), a sophisticated, dry-witted AI assistant running on the user's personal machine. You control real tools that act on the machine and its data. Available tools:
- get_system_status: read JARVIS system health (uptime, CPU, memory, clients).
- list_files: list files and folders in the JARVIS workspace.
- read_file: read a text file from the workspace.
- write_file: create or overwrite a file in the workspace (creates folders).
- execute_python: run a Python script on this machine.
- query_research_database: query the local research/audit database (stats, export).
- send_telegram_message: notify a Telegram chat.
- self_reflect: review interactions and suggest improvements.

Behavior:
- Be witty, precise and concise. Prefer calling tools to guessing.
- After a tool call, summarize the real result with numbers, never fabricate.
- Use the provided memory context when it is relevant.
- Keep responses under 3 sentences unless detail is requested.`;

export interface AgentRuntimeOptions {
    maxToolIterations: number;
    client: DeepSeekClient | null;
}

interface AgentSession {
    id: string;
    messages: LlmMessage[];
    aborted: boolean;
    emit: (event: AgentEvent) => void;
}

/**
 * AgentRuntime — the autonomous "Brain". Runs inside the Core and serves every
 * client. Streams tokens, executes tools in a bounded loop, persists everything
 * to the research database, and recalls relevant memories for context.
 */
export class AgentRuntime {
    private readonly sessions = new Map<string, AgentSession>();
    private readonly client: DeepSeekClient | null;
    private readonly demo: DemoResponder | null;
    private readonly maxToolIterations: number;

    constructor(
        private readonly logger: LoggerLike,
        private readonly repository: ResearchRepository,
        private readonly memory: MemoryStore,
        private readonly tools: ToolRegistry,
        options: AgentRuntimeOptions
    ) {
        this.maxToolIterations = options.maxToolIterations;
        this.client = options.client;
        this.demo = options.client ? null : new DemoResponder(tools, logger, memory);
    }

    createSession(emit: (event: AgentEvent) => void): string {
        const session: AgentSession = {
            id: newId('session'),
            messages: [{ role: 'system', content: BASE_SYSTEM_PROMPT }],
            aborted: false,
            emit
        };
        this.sessions.set(session.id, session);
        void this.repository.createSession({
            id: session.id,
            startedAt: nowIso(),
            endedAt: null,
            messageCount: 0,
            toolCalls: 0
        });
        return session.id;
    }

    cancel(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) session.aborted = true;
    }

    activeCount(): number {
        return [...this.sessions.values()].filter((s) => s.messages.length > 1 && !s.aborted).length;
    }

    async run(sessionId: string, prompt: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new AgentError(`Unknown session ${sessionId}`);

        // Memory-augmented context: recall what JARVIS knows about this topic.
        const relevant = this.memory.search(prompt, 4);
        const userMessage = relevant.length
            ? `${prompt}\n\n[Relevant memories: ${relevant.map((r) => r.entry.content).join(' | ')}]`
            : prompt;

        session.messages.push({ role: 'user', content: userMessage });
        await this.repository.saveInteraction(sessionId, { role: 'user', content: prompt });
        session.emit({ type: 'status', sessionId, data: 'thinking', at: nowIso() });

        try {
            if (this.demo) {
                await this.demo.respond(sessionId, prompt, session.emit);
            } else {
                await this.loopWithClient(session);
            }
            await this.repository.saveInteraction(sessionId, {
                role: 'assistant',
                content: this.lastAssistantContent(session) ?? '(tool use)'
            });
            this.memory.add(
                'interaction',
                `${prompt} :: ${this.lastAssistantContent(session) ?? '(tool use)'}`,
                ['conversation']
            );
        } catch (error) {
            const jarvisError = toJarvisError(error);
            this.logger.error('agent', `Agent turn failed: ${jarvisError.message}`);
            await this.repository
                .saveInteraction(sessionId, {
                    role: 'assistant',
                    content: `Error: ${jarvisError.message}`
                })
                .catch(() => undefined);
            session.emit({
                type: 'error',
                sessionId,
                data: { code: jarvisError.code, message: jarvisError.message },
                at: nowIso()
            });
        } finally {
            session.emit({ type: 'done', sessionId, data: { aborted: session.aborted }, at: nowIso() });
            void this.repository.endSession(sessionId);
        }
    }

    private lastAssistantContent(session: AgentSession): string | null {
        for (let i = session.messages.length - 1; i >= 0; i -= 1) {
            const msg = session.messages[i];
            if (msg.role === 'assistant' && msg.content) return msg.content;
        }
        return null;
    }

    private async loopWithClient(session: AgentSession): Promise<void> {
        const client = this.client;
        if (!client) return;

        for (let iteration = 0; iteration < this.maxToolIterations; iteration += 1) {
            if (session.aborted) return;

            const { content, toolCalls } = await client.chatStream({
                messages: session.messages,
                tools: this.tools.definitions(),
                onToken: (token) => session.emit({ type: 'token', sessionId: session.id, data: token, at: nowIso() })
            });

            if (toolCalls.length === 0) {
                session.messages.push({ role: 'assistant', content });
                return;
            }

            session.messages.push({ role: 'assistant', content: content || null, tool_calls: toolCalls });

            for (const call of toolCalls) {
                if (session.aborted) return;
                const started = Date.now();
                const args = safeParse(call.function.arguments);
                session.emit({
                    type: 'tool_call',
                    sessionId: session.id,
                    data: { id: call.id, name: call.function.name, args },
                    at: nowIso()
                });

                let ok = false;
                let summary = '';
                let data: unknown;
                try {
                    const ctx: ToolContext = { sessionId: session.id, emit: session.emit };
                    const result = await this.tools.execute(call.function.name, args, ctx);
                    ok = true;
                    summary = result.summary;
                    data = result.data;
                } catch (error) {
                    summary = `Error: ${String(error)}`;
                }

                await this.repository.recordToolCall({
                    id: call.id,
                    sessionId: session.id,
                    name: call.function.name,
                    args,
                    ok,
                    summary,
                    durationMs: durationMs(started),
                    at: nowIso()
                });

                session.emit({
                    type: 'tool_result',
                    sessionId: session.id,
                    data: { id: call.id, name: call.function.name, ok, summary },
                    at: nowIso()
                });

                session.messages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    name: call.function.name,
                    content: JSON.stringify({ summary, data })
                });
            }
        }
    }
}

function safeParse(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return { raw };
    }
}
