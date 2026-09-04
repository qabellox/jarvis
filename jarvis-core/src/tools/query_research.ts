import type { ToolDefinition } from '../shared/types';
import { AgentError } from '../utils/errors';
import type { JarvisTool } from '../agent/ToolRegistry';
import type { ToolDeps } from './deps';

const definition: ToolDefinition = {
    name: 'query_research_database',
    description:
        'Query the local research database. Options: "recent_rounds" for federated rounds history, "stats" for aggregate counters, "export" for the full research export.',
    parameters: {
        query: {
            type: 'string',
            description: 'What to query',
            enum: ['recent_rounds', 'stats', 'export'],
            required: true
        }
    }
};

export function queryResearchTool(deps: ToolDeps): JarvisTool {
    return {
        definition,
        async execute(args) {
            const query = String(args.query ?? '');
            switch (query) {
                case 'recent_rounds':
                    return {
                        summary: `Research DB: ${(await deps.repository.getRounds()).length} rounds recorded`,
                        data: await deps.repository.getRounds()
                    };
                case 'stats':
                    return { summary: 'Research DB stats retrieved', data: await deps.repository.getStats() };
                case 'export':
                    return { summary: 'Full research export prepared', data: await deps.repository.exportResearch() };
                default:
                    throw new AgentError(`Unknown research query: ${query}`);
            }
        }
    };
}
