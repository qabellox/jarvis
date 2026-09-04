/** @type {import('next').NextConfig} */
const nextConfig = {
    // Static export: the Electron main process serves these files directly.
    output: 'export',
    distDir: 'dist/renderer',
    images: {
        unoptimized: true
    },
    // JARVIS talks to the Electron main process via the preload bridge,
    // never via Next's server, so we keep the renderer fully client-side.
    reactStrictMode: true
};

export default nextConfig;
