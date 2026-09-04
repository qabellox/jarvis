// Minimal static file server for the Next.js static export (dist/renderer).
// Used to expose the built JARVIS UI publicly via a Cloudflare quick tunnel.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const ROOT = resolve(
    new URL('../dist/renderer/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
);
const PORT = Number(process.env.PORT || 4173);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.map': 'application/json'
};

function safe(root, urlPath) {
    const full = resolve(root, '.' + urlPath);
    const rootLower = root.toLowerCase();
    const fullLower = full.toLowerCase();
    if (fullLower !== rootLower && !fullLower.startsWith(rootLower + sep)) return null;
    return full;
}

createServer(async (req, res) => {
    try {
        let urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
        if (urlPath === '/') urlPath = '/index.html';
        const filePath = safe(ROOT, urlPath);
        if (!filePath) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        let body;
        try {
            body = await readFile(filePath);
        } catch {
            // Static-export fallback: serve index.html for unknown paths.
            body = await readFile(resolve(ROOT, 'index.html'));
        }
        res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
        res.end(body);
    } catch (error) {
        res.writeHead(500);
        res.end(String(error));
    }
}).listen(PORT, () => {
    console.log(`static server on http://localhost:${PORT} serving ${ROOT}`);
});
