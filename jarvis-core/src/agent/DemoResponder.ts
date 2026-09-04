import type { AgentEvent } from '../shared/types';
import { newId } from '../utils/id';
import { nowIso } from '../utils/time';
import type { LoggerLike } from '../logger';
import type { MemoryStore } from '../memory/MemoryStore';
import type { ToolRegistry, ToolContext } from './ToolRegistry';

/**
 * Demo responder — keeps the whole system live even without a DeepSeek key.
 * Performs REAL tool calls against the ESP32 gateway, federation core, memory
 * and research database, so the distributed pipeline is exercised end to end.
 */
export class DemoResponder {
    constructor(
        private readonly tools: ToolRegistry,
        private readonly logger: LoggerLike,
        private readonly memory: MemoryStore
    ) { }

    async respond(sessionId: string, prompt: string, emit: (event: AgentEvent) => void): Promise<string> {
        const ctx: ToolContext = { sessionId, emit };
        const lower = prompt.toLowerCase();

        for (const token of this.openers(lower)) {
            emit({ type: 'token', sessionId, data: token, at: nowIso() });
            await sleep(16);
        }

        const call =
            /train|learn|federat|round/i.test(lower)
                ? { name: 'initiate_training', args: { rounds: 5 } }
                : /deploy|model/i.test(lower)
                    ? { name: 'control_esp32', args: { target_node: 'all', command: 'deploy_model', model: 'tiny-mnist-v3' } }
                    : /python|script|run/i.test(lower)
                        ? { name: 'execute_python', args: { script_path: 'sample.py' } }
                        : { name: 'query_federated_learning_status', args: {} };

        let summary = '';
        const callId = newId('tc');
        emit({ type: 'tool_call', sessionId, data: { id: callId, name: call.name, args: call.args }, at: nowIso() });
        try {
            const result = await this.tools.execute(call.name, call.args, ctx);
            summary = result.summary;
            emit({ type: 'tool_result', sessionId, data: { id: callId, name: call.name, ok: true, summary }, at: nowIso() });
        } catch (error) {
            summary = `Tool failed: ${String(error)}`;
            emit({ type: 'tool_result', sessionId, data: { id: callId, name: call.name, ok: false, summary }, at: nowIso() });
        }

        this.memory.add('fact', `Demo turn about "${prompt.slice(0, 60)}" used ${call.name}`, ['demo']);

        const reply = this.composeReply(lower, summary);
        for (const word of reply.split(' ')) {
            emit({ type: 'token', sessionId, data: word + ' ', at: nowIso() });
            await sleep(20);
        }
        return reply;
    }

    private openers(prompt: string): string[] {
        const options = ['Understood. ', 'Processing. ', 'At your service. ', 'Engaging the neural swarm. '];
        return [options[prompt.length % options.length], 'Let me consult the fleet. '];
    }

    private composeReply(prompt: string, summary: string): string {
        const lower = prompt.toLowerCase();
        if (/train|learn|federat/i.test(lower)) {
            return `Training is underway across the fleet. ${summary}. I will report convergence as each round commits to the research database.`;
        }
        if (/deploy|model/i.test(lower)) {
            return `Deployment complete. ${summary}. The updated model is now resident on every reachable node.`;
        }
        if (/python|script|run/i.test(lower)) {
            return `Script executed. ${summary}. Output has been logged to the research database.`;
        }
        return `${summary}. The swarm is stable and awaiting your next directive.`;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
