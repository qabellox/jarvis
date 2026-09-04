import type { ToolDefinition } from '../shared/types';
import { AgentError, toJarvisError } from '../utils/errors';
import type { LoggerLike } from '../logger';

/** OpenAI-compatible chat message (DeepSeek wire format). */
export interface LlmMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    name?: string;
    tool_call_id?: string;
    tool_calls?: LlmToolCall[];
}

export interface LlmToolCall {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
}

export interface LlmToolCallDelta {
    index: number;
    id?: string;
    name?: string;
    argumentsDelta?: string;
}

export function toOpenAiTools(tools: ToolDefinition[]): unknown[] {
    return tools.map((tool) => {
        const entries = Object.entries(tool.parameters);
        return {
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: {
                    type: 'object',
                    properties: Object.fromEntries(
                        entries.map(([key, schema]) => [
                            key,
                            {
                                type: schema.type,
                                ...(schema.description ? { description: schema.description } : {}),
                                ...(schema.enum ? { enum: schema.enum } : {})
                            }
                        ])
                    ),
                    required: entries.filter(([, schema]) => schema.required).map(([key]) => key)
                }
            }
        };
    });
}

export interface ChatStreamOptions {
    messages: LlmMessage[];
    tools?: ToolDefinition[];
    signal?: AbortSignal;
    onToken?: (token: string) => void;
    onToolCallDelta?: (delta: LlmToolCallDelta) => void;
}

export interface ChatStreamResult {
    content: string;
    toolCalls: LlmToolCall[];
    finishReason: string;
}

/** DeepSeek API client — pure fetch + SSE parsing, no SDK. */
export class DeepSeekClient {
    constructor(
        private readonly apiKey: string,
        private readonly model: string,
        private readonly baseUrl: string,
        private readonly logger: LoggerLike
    ) { }

    async chatStream(options: ChatStreamOptions): Promise<ChatStreamResult> {
        const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
        const body = {
            model: this.model,
            messages: options.messages,
            stream: true,
            tools: options.tools && options.tools.length > 0 ? toOpenAiTools(options.tools) : undefined
        };

        let response: Response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
                body: JSON.stringify(body),
                signal: options.signal
            });
        } catch (error) {
            throw toJarvisError(error, 'DEEPSEEK_NETWORK');
        }

        if (!response.ok || !response.body) {
            const detail = await response.text().catch(() => '');
            throw new AgentError(`DeepSeek API error ${response.status}: ${detail.slice(0, 300)}`);
        }

        return this.parseSse(response.body, options);
    }

    private async parseSse(body: ReadableStream<Uint8Array>, options: ChatStreamOptions): Promise<ChatStreamResult> {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        const toolCalls = new Map<number, LlmToolCall>();
        let buffer = '';
        let content = '';
        let finishReason = '';

        const flushLine = (line: string): boolean => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) return false;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') return true;
            try {
                const json = JSON.parse(payload);
                const choice = json.choices?.[0];
                if (choice?.finish_reason) finishReason = choice.finish_reason;
                const delta = choice?.delta;
                if (!delta) return false;
                if (typeof delta.content === 'string') {
                    content += delta.content;
                    options.onToken?.(delta.content);
                }
                if (Array.isArray(delta.tool_calls)) {
                    for (const call of delta.tool_calls) {
                        const index = call.index ?? 0;
                        const existing = toolCalls.get(index) ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
                        if (call.id) existing.id = call.id;
                        if (call.function?.name) existing.function.name += call.function.name;
                        if (call.function?.arguments) existing.function.arguments += call.function.arguments;
                        toolCalls.set(index, existing);
                        options.onToolCallDelta?.({
                            index,
                            id: call.id,
                            name: call.function?.name,
                            argumentsDelta: call.function?.arguments
                        });
                    }
                }
            } catch (error) {
                this.logger.debug('deepseek', 'SSE parse skip', { error: String(error) });
            }
            return false;
        };

        let done = false;
        while (!done) {
            const { done: streamDone, value } = await reader.read();
            if (streamDone) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (flushLine(line)) {
                    done = true;
                    break;
                }
            }
        }

        return {
            content,
            toolCalls: [...toolCalls.values()].filter((c) => c.function.name),
            finishReason
        };
    }
}
