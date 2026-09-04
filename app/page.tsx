import { JarvisHUD } from '@/components/hud/JarvisHUD';

/**
 * JARVIS — root page. The entire HUD lives in the modular JarvisHUD
 * component (components/hud/); this file stays as a thin entry point.
 */
export default function Home() {
    return <JarvisHUD />;
}
