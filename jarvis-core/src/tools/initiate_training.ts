import type { ToolDefinition } from '../shared/types';
import type { JarvisTool } from '../agent/ToolRegistry';
import type { ToolDeps } from './deps';

const definition: ToolDefinition = {
    name: 'initiate_training',
    description:
        'Start a new federated training process across the connected ESP32 network using the chosen algorithm (default FedAvg). Also signals the fleet to begin on-device training.',
    parameters: {
        algorithm: {
            type: 'string',
            description: 'Federated learning algorithm',
            enum: ['FedAvg', 'FedProx', 'FedSGD']
        },
        rounds: { type: 'number', description: 'Number of federated rounds (default 5)' }
    }
};

export function initiateTrainingTool(deps: ToolDeps): JarvisTool {
    return {
        definition,
        async execute(args) {
            const algorithm = String(args.algorithm ?? deps.federation.getStatus().algorithm ?? 'FedAvg');
            const rounds = Math.max(1, Math.min(50, Number(args.rounds) || 5));
            deps.federation.startTraining(rounds);
            await deps.gateway
                .sendCommand('all', { type: 'start_training', algorithm, rounds })
                .catch((error) => deps.logger.warn('agent-tools', 'Fleet training signal failed', { error: String(error) }));
            return {
                summary: `Federated training initiated: ${algorithm}, ${rounds} rounds across the fleet`,
                data: { algorithm, rounds }
            };
        }
    };
}
