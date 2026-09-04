import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
    theme: {
        extend: {
            colors: {
                void: '#050510',
                abyss: '#07071a',
                panel: '#0a0a20',
                warn: '#ffb700',
                neon: {
                    cyan: '#00f0ff',
                    blue: '#0066ff',
                    sky: '#7ff5ff',
                    // legacy keys kept so old class names render on-spec colors
                    purple: '#0066ff',
                    violet: '#00f0ff',
                    orange: '#00f0ff',
                    amber: '#ffaa00'
                },
                ink: {
                    DEFAULT: '#e0f2fe',
                    muted: '#b9c6e2',
                    faint: '#94a4c6'
                }
            },
            fontFamily: {
                display: ['Orbitron', 'Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
            },
            boxShadow: {
                'glow-cyan': '0 0 24px 2px rgba(0, 240, 255, 0.35), 0 0 64px 4px rgba(0, 240, 255, 0.12)',
                'glow-blue': '0 0 24px 2px rgba(0, 102, 255, 0.35), 0 0 64px 4px rgba(0, 102, 255, 0.12)',
                'glow-purple': '0 0 24px 2px rgba(168, 85, 247, 0.4), 0 0 64px 4px rgba(168, 85, 247, 0.14)',
                // legacy alias -> cyan glow
                'glow-orange': '0 0 24px 2px rgba(0, 240, 255, 0.35), 0 0 64px 4px rgba(0, 240, 255, 0.12)',
                'neon': '0 0 18px 1px rgba(0, 240, 255, 0.4)',
                'glass': 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 24px 48px -12px rgba(0, 0, 0, 0.7)'
            },
            backdropBlur: {
                xs: '2px'
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'flicker': 'flicker 4s linear infinite',
                'scan': 'scan 8s linear infinite',
                'wave': 'wave 1.4s ease-in-out infinite',
                'pulse-ring': 'pulse-ring 2.4s ease-out infinite',
                'spin-slow': 'spin 3s linear infinite',
                'shimmer': 'shimmer 1.6s infinite',
                'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite'
            },
            keyframes: {
                flicker: {
                    '0%, 100%': { opacity: '1' },
                    '45%': { opacity: '0.94' },
                    '48%': { opacity: '1' },
                    '52%': { opacity: '0.9' },
                    '55%': { opacity: '1' }
                },
                scan: {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(100%)' }
                },
                wave: {
                    '0%, 100%': { transform: 'scaleY(0.3)' },
                    '50%': { transform: 'scaleY(1)' }
                },
                'pulse-ring': {
                    '0%': { transform: 'scale(0.85)', opacity: '0.8' },
                    '100%': { transform: 'scale(1.7)', opacity: '0' }
                },
                shimmer: {
                    '100%': { transform: 'translateX(100%)' }
                },
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 10px rgba(0,240,255,0.45)' },
                    '50%': { boxShadow: '0 0 30px rgba(0,240,255,0.8)' }
                }
            }
        }
    },
    plugins: []
};

export default config;
