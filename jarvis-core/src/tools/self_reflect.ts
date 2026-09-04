import type { ToolDefinition, ReflectionSuggestion } from '../shared/types';
import { newId } from '../utils/id';
import { nowIso } from '../utils/time';
import type { JarvisTool } from '../agent/ToolRegistry';
import type { ToolDeps } from './deps';

const definition: ToolDefinition = {
    name: 'self_reflect',
    description:
        'Review recent interactions and system metrics, then produce concrete self-improvement suggestions (tool reliability, latency, federation tuning). Records them to memory.',
    parameters: {}
};

export function selfReflectTool(deps: ToolDeps): JarvisTool {
    return {
        definition,
        async execute() {
            const [stats, rounds] = await Promise.all([deps.repository.getStats(), deps.repository.getRounds()]);
            const suggestions: ReflectionSuggestion[] = [];

            if (stats.toolCalls > 0) {
                suggestions.push({
                    id: newId('ref'),
                    title: 'Instrument tool latency',
                    detail: `${stats.toolCalls} tool calls recorded. Add per-tool p95 latency telemetry to catch slow ESP32 command timeouts.`,
                    metric: `tool_calls=${stats.toolCalls}`,
                    at: nowIso()
                });
            }
            if (rounds.length >= 3) {
                const accuracies = rounds.map((r) => r.accuracy);
                const last = accuracies[accuracies.length - 1];
                const first = accuracies[0];
                if (last > first) {
                    suggestions.push({
                        id: newId('ref'),
                        title: 'Convergence is healthy',
                        detail: `Federated accuracy improved ${first}% -> ${last}% over ${rounds.length} rounds. Consider raising target rounds for finer convergence.`,
                        metric: `delta=${(last - first).toFixed(2)}%`,
                        at: nowIso()
                    });
                } else {
                    suggestions.push({
                        id: newId('ref'),
                        title: 'Convergence stalled',
                        detail: `Accuracy did not improve (${last}%). Review learning rate and client data distribution for non-IID drift.`,
                        metric: `latest=${last}%`,
                        at: nowIso()
                    });
                }
            }
            if (stats.interactions === 0) {
                suggestions.push({
                    id: newId('ref'),
                    title: 'Seed the knowledge base',
                    detail: 'No interactions recorded yet. Run a few agent sessions so memory recall has signal to work from.',
                    metric: 'interactions=0',
                    at: nowIso()
                });
            }

            for (const suggestion of suggestions) {
                deps.memory.add('suggestion', `${suggestion.title}: ${suggestion.detail}`, ['reflection']);
            }

            return {
                summary: `Reflection complete: ${suggestions.length} suggestion(s) recorded`,
                data: suggestions
            };
        }
    };
}
