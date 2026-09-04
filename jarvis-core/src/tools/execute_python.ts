import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { ToolDefinition, PythonExecResult } from '../shared/types';
import { ToolError } from '../utils/errors';
import { durationMs } from '../utils/time';
import type { JarvisTool } from '../agent/ToolRegistry';
import type { ToolDeps } from './deps';

const definition: ToolDefinition = {
    name: 'execute_python',
    description:
        'Execute a Python script located inside the Core scripts directory on this machine and return its output. Use for real-world automation (data pipelines, file processing, hardware glue).',
    parameters: {
        script_path: {
            type: 'string',
            description: 'Path (relative to the scripts dir, or absolute inside it) of the .py script to run',
            required: true
        },
        args: { type: 'array', description: 'Optional CLI arguments passed to the script' }
    }
};

function isInside(parent: string, child: string): boolean {
    const rel = resolve(child);
    const base = resolve(parent);
    return rel === base || rel.startsWith(base + '\\') || rel.startsWith(base + '/');
}

export function executePythonTool(deps: ToolDeps): JarvisTool {
    return {
        definition,
        async execute(args) {
            const raw = String(args.script_path ?? '');
            if (!raw) throw new ToolError('execute_python requires script_path');
            const scriptPath = resolve(deps.python.allowedDir, raw);
            if (!isInside(deps.python.allowedDir, scriptPath)) {
                throw new ToolError(`Script path is outside the allowed scripts directory: ${scriptPath}`);
            }
            const scriptArgs = Array.isArray(args.args) ? args.args.map(String) : [];
            const started = Date.now();

            const result = await runPython(scriptPath, scriptArgs, deps);
            deps.memory.add('fact', `Ran python script ${raw} -> ${result.ok ? 'success' : 'failure'}`, ['python', 'automation']);
            return {
                summary: `${result.ok ? 'OK' : 'FAILED'} (exit ${result.exitCode}) in ${result.durationMs}ms`,
                data: result
            };
        }
    };
}

function runPython(scriptPath: string, scriptArgs: string[], deps: ToolDeps): Promise<PythonExecResult> {
    return new Promise<PythonExecResult>((resolvePromise, reject) => {
        const started = Date.now();
        const child = spawn('python', [scriptPath, ...scriptArgs], {
            cwd: deps.python.allowedDir,
            windowsHide: true
        });
        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill();
            resolvePromise({
                ok: false,
                scriptPath,
                stdout,
                stderr: `${stderr}\n[timed out after ${deps.python.timeoutMs}ms]`,
                exitCode: null,
                durationMs: durationMs(started)
            });
        }, deps.python.timeoutMs);

        child.stdout.on('data', (d: Buffer) => {
            stdout += d.toString();
            if (stdout.length > 200_000) child.stdout.destroy();
        });
        child.stderr.on('data', (d: Buffer) => {
            stderr += d.toString();
            if (stderr.length > 200_000) child.stderr.destroy();
        });
        child.on('error', (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(new ToolError(`Failed to launch python: ${error.message}`));
        });
        child.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolvePromise({
                ok: code === 0,
                scriptPath,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: code,
                durationMs: durationMs(started)
            });
        });
    });
}
