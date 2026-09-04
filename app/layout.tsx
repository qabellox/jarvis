import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'JARVIS - Edge AI Orchestrator',
    description:
        'JARVIS (Just A Rather Very Intelligent System). A cinematic command center orchestrating a fleet of ESP32 edge devices through federated learning.'
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
