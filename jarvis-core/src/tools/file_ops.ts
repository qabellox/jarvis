import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import type { ToolDefinition } from '../shared/types';
import { ToolError } from '../utils/errors';
import type { JarvisTool } from '../agent/ToolRegistry';
import type { ToolDeps } from './deps';

/**
 * Real file & folder control. All operations are sandboxed inside the Core
 * workspace directory (JARVIS_WORKSPACE) so the agent can manage files but not
 * touch the rest of the machine.
 */

const listDefinition: ToolDefinition = {
    name: 'list_files',
    description: 'List files and folders inside the JARVIS workspace. Use to see what is on the machine.',
    parameters: {
        path: { type: 'string', description: 'Sub-path inside the workspace (empty = workspace root)' }
    }
};

const readDefinition: ToolDefinition = {
    name: 'read_file',
    description: 'Read the text content of a file inside the JARVIS workspace.',
    parameters: {
        path: { type: 'string', description: 'Path to the file (relative to the workspace)', required: true }
    }
};

const writeDefinition: ToolDefinition = {
    name: 'write_file',
    description: 'Create or overwrite a text file inside the JARVIS workspace (creates folders as needed).',
    parameters: {
        path: { type: 'string', description: 'Path to the file (relative to the workspace)', required: true },
        content: { type: 'string', description: 'Full text content to write', required: true }
    }
};

function safePath(workspace: string, raw: string): string {
    const target = resolve(workspace, raw || '.');
    const base = resolve(workspace);
    if (target !== base && !target.startsWith(base + '\\') && !target.startsWith(base + '/')) {
        throw new ToolError(`Path escapes the workspace: ${raw}`);
    }
    return target;
}

export function fileTools(deps: ToolDeps): JarvisTool[] {
    return [
        {
            definition: listDefinition,
            async execute(args) {
                const dir = safePath(deps.workspace, String(args.path ?? ''));
                if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
                    throw new ToolError(`Not a directory: ${args.path ?? '.'}`);
                }
                const entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({
                    name: e.name,
                    type: e.isDirectory() ? 'folder' : 'file',
                    size: e.isDirectory() ? null : statSync(join(dir, e.name)).size
                }));
                return { summary: `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} in ${relative(deps.workspace, dir) || 'workspace root'}`, data: entries };
            }
        },
        {
            definition: readDefinition,
            async execute(args) {
                const file = safePath(deps.workspace, String(args.path ?? ''));
                const st = statSync(file, { throwIfNoEntry: false });
                if (!st || !st.isFile()) throw new ToolError(`File not found: ${args.path}`);
                if (st.size > 200_000) throw new ToolError('File too large to read (max 200 KB)');
                return { summary: `Read ${args.path} (${st.size} bytes)`, data: { path: args.path, content: readFileSync(file, 'utf8') } };
            }
        },
        {
            definition: writeDefinition,
            async execute(args) {
                const file = safePath(deps.workspace, String(args.path ?? ''));
                mkdirSync(join(file, '..'), { recursive: true });
                writeFileSync(file, String(args.content ?? ''), 'utf8');
                return { summary: `Wrote ${args.path}`, data: { path: args.path, bytes: String(args.content ?? '').length } };
            }
        }
    ];
}
