import type { ToolDefinition } from '../shared/types';
import { AgentError } from '../utils/errors';
import type { JarvisTool } from '../agent/ToolRegistry';
import type { ToolDeps } from './deps';

const definition: ToolDefinition = {
    name: 'control_esp32',
    description:
        'Send a command to a specific ESP32 node in the fleet, or "all" to broadcast. Commands: ping, deploy_model, execute_action, start_training, stop_training.',
    parameters: {
        target_node: { type: 'string', description: 'ESP32 node id, or "all"', required: true },
        command: {
            type: 'string',
            description: 'Command to execute',
            enum: ['ping', 'deploy_model', 'execute_action', 'start_training', 'stop_training'],
            required: true
        },
        model: { type: 'string', description: 'Model identifier to deploy (deploy_model only)' },
        action: { type: 'string', description: 'Action to execute (execute_action only)' }
    }
};

export function controlEsp32Tool(deps: ToolDeps): JarvisTool {
    return {
        definition,
        async execute(args) {
            const targetNode = String(args.target_node ?? '');
            const command = String(args.command ?? '');
            if (!targetNode) throw new AgentError('control_esp32 requires target_node');
            if (!command) throw new AgentError('control_esp32 requires command');

            const result = await deps.gateway.sendCommand(targetNode, {
                type: command as never,
                ...(args.model ? { model: String(args.model) } : {}),
                ...(args.action ? { action: String(args.action) } : {})
            });
            return { summary: `${command} -> ${targetNode}: ${result.message}`, data: result };
        }
    };
}
