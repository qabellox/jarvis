import type { ToolDefinition } from '../shared/types';
import type { JarvisTool } from '../agent/ToolRegistry';
import type { ToolDeps } from './deps';

const definition: ToolDefinition = {
    name: 'get_system_status',
    description: 'Retrieve JARVIS Core status: uptime, platform, connected node count, CPU/memory, connected clients.',
    parameters: {}
};

export function systemStatusTool(deps: ToolDeps): JarvisTool {
    return {
        definition,
        async execute() {
            const status = deps.systemStatus();
            return {
                summary: `Uptime ${status.uptimeSeconds}s | ${status.nodeCount} nodes | ${status.federationActive ? 'training active' : 'idle'} | clients ${JSON.stringify(status.connectedClients)}`,
                data: status
            };
        }
    };
}
