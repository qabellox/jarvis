import type { ToolDefinition } from '../shared/types';
import type { JarvisTool } from '../agent/ToolRegistry';
import type { ToolDeps } from './deps';

const definition: ToolDefinition = {
    name: 'query_federated_learning_status',
    description:
        'Retrieve the latest federated learning status: active round, algorithm, accuracy, loss, participants, and rounds history.',
    parameters: {}
};

export function queryFederationTool(deps: ToolDeps): JarvisTool {
    return {
        definition,
        async execute() {
            const status = deps.federation.getStatus();
            return {
                summary: `Round ${status.round}${status.active ? ` of ${status.targetRound}` : ''} | ${status.algorithm} | accuracy ${status.accuracy}% | loss ${status.loss} | ${status.participants} participants`,
                data: status
            };
        }
    };
}
