import type { AgentEvent, ToolDefinition } from '../shared/types';
import { AgentError } from '../utils/errors';

export interface ToolContext {
    sessionId: string;
    emit: (event: AgentEvent) => void;
}

export interface ToolResult {
    summary: string;
    data?: unknown;
}

export interface JarvisTool {
    definition: ToolDefinition;
    execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * ToolRegistry — the only way the "Brain" can touch the "Body" (ESP32 fleet,
 * PC, Telegram, research store). Tools are discovered from the tools/ folder
 * and registered here at boot.
 */
export class ToolRegistry {
    private readonly tools = new Map<string, JarvisTool>();

    register(tool: JarvisTool): void {
        this.tools.set(tool.definition.name, tool);
    }

    registerAll(tools: JarvisTool[]): void {
        for (const tool of tools) this.register(tool);
    }

    definitions(): ToolDefinition[] {
        return [...this.tools.values()].map((t) => t.definition);
    }

    names(): string[] {
        return [...this.tools.keys()];
    }

    get(name: string): JarvisTool | undefined {
        return this.tools.get(name);
    }

    async execute(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
        const tool = this.tools.get(name);
        if (!tool) throw new AgentError(`Unknown tool: ${name}`);
        const args = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Record<string, unknown>;
        return tool.execute(args, ctx);
    }
}
