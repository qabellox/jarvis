import type { JarvisTool } from '../agent/ToolRegistry';
import { systemStatusTool } from './system_status';
import { queryResearchTool } from './query_research';
import { executePythonTool } from './execute_python';
import { sendTelegramTool } from './send_telegram_message';
import { selfReflectTool } from './self_reflect';
import { fileTools } from './file_ops';
import type { ToolDeps } from './deps';

/**
 * Dynamic tool loader. Add a new file under tools/ and register it here; the
 * agent, every client and the UI automatically see the new capability.
 */
export function loadTools(deps: ToolDeps): JarvisTool[] {
    return [
        systemStatusTool(deps),
        queryResearchTool(deps),
        executePythonTool(deps),
        sendTelegramTool(deps),
        selfReflectTool(deps),
        ...fileTools(deps)
    ];
}

export type { ToolDeps } from './deps';
