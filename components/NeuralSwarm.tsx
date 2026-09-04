'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type SwarmMode = 'idle' | 'thinking' | 'working' | 'speaking';

/** How strongly the swarm reacts per agent state (harmonizes with the orb). */
const ENERGY: Record<SwarmMode, number> = {
    idle: 0.3,
    thinking: 1.0,
    working: 0.72,
    speaking: 0.9
};

/**
 * NeuralSwarm — round "dissipating atoms".
 *
 * A soft cloud of glowing cyan/blue atoms (round, not squares) that:
 *  - shimmer and fade in/out individually (dissipating)
 *  - are gently attracted toward the center orb (an attracting glimmer)
 *  - swirl harder and pull inward while JARVIS thinks / works / speaks
 * Rendered with a custom shader for round, additive, glowing points.
 */
export function NeuralSwarm({ mode = 'idle' }: { mode?: SwarmMode }) {
    const mountRef = useRef<HTMLDivElement>(null);
    const modeRef = useRef<SwarmMode>(mode);
    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount || typeof window === 'undefined') return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
        camera.position.z = 7;

        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);

        const COUNT = 3200;
        const positions = new Float32Array(COUNT * 3);
        const colors = new Float32Array(COUNT * 3);
        const scales = new Float32Array(COUNT);
        const phases = new Float32Array(COUNT);
        const home = new Float32Array(COUNT * 3);

        const radius = 3.2;
        const palette = [new THREE.Color('#7ff5ff'), new THREE.Color('#00f3ff'), new THREE.Color('#0066ff')];
        for (let i = 0; i < COUNT; i += 1) {
            const r = radius * Math.cbrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            home[i * 3] = x;
            home[i * 3 + 1] = y;
            home[i * 3 + 2] = z;
            const base = palette[i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : 2];
            const b = 0.72 + Math.random() * 0.28;
            colors[i * 3] = base.r * b;
            colors[i * 3 + 1] = base.g * b;
            colors[i * 3 + 2] = base.b * b;
            scales[i] = 0.6 + Math.random() * 0.9;
            phases[i] = Math.random();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
        geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

        const uniforms = {
            uTime: { value: 0 },
            uSize: { value: 0.11 },
            uEnergy: { value: ENERGY.idle },
            uOpacity: { value: 0.85 }
        };

        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                attribute vec3 color;
                attribute float aScale;
                attribute float aPhase;
                uniform float uTime;
                uniform float uSize;
                uniform float uEnergy;
                varying vec3 vColor;
                varying float vAlpha;
                void main() {
                    vColor = color;
                    // dissipating shimmer — each atom fades in and out on its own clock
                    float tw = 0.5 + 0.5 * sin(uTime * (0.9 + aPhase * 1.4) + aPhase * 6.2831);
                    vAlpha = 0.28 + tw * (0.45 + uEnergy * 0.42);
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = uSize * aScale * (300.0 / -mv.z);
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: `
                precision highp float;
                varying vec3 vColor;
                varying float vAlpha;
                uniform float uOpacity;
                void main() {
                    vec2 c = gl_PointCoord - vec2(0.5);
                    float r = length(c) * 2.0;
                    float a = smoothstep(1.0, 0.0, r);
                    a = pow(a, 1.5);
                    if (a < 0.02) discard;
                    gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        const pointer = new THREE.Vector2(0, 0);
        const onPointerMove = (e: PointerEvent): void => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        };
        window.addEventListener('pointermove', onPointerMove);

        const resize = (): void => {
            const w = mount.clientWidth || window.innerWidth;
            const h = mount.clientHeight || window.innerHeight;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        resize();
        window.addEventListener('resize', resize);
        const observer = new ResizeObserver(resize);
        observer.observe(mount);

        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        let time = 0;
        let raf = 0;
        let last = performance.now();

        const swirlTarget = (): { x: number; y: number } => {
            const halfH = Math.tan((70 * Math.PI) / 180 / 2) * camera.position.z;
            const halfW = halfH * camera.aspect;
            return { x: pointer.x * halfW, y: pointer.y * halfH };
        };

        const animate = (now: number): void => {
            raf = requestAnimationFrame(animate);
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            time += dt;

            const m = modeRef.current;
            const energy = ENERGY[m];
            uniforms.uTime.value = time;
            uniforms.uEnergy.value = energy;

            // gentle attraction toward the orb (origin) — stronger while active
            const pull = 0.005 + energy * 0.014;
            const swirl = swirlTarget();
            const attract = m === 'thinking' ? 0.9 : m === 'working' ? 0.6 : m === 'speaking' ? 0.35 : 0;
            const churn = 0.3 + energy;

            const arr = posAttr.array as Float32Array;
            for (let i = 0; i < COUNT; i += 1) {
                const i3 = i * 3;
                const ph = phases[i] * 6.2831;
                let x = arr[i3];
                let y = arr[i3 + 1];
                let z = arr[i3 + 2];
                const hx = home[i3];
                const hy = home[i3 + 1];
                const hz = home[i3 + 2];

                // spring back toward home
                x += (hx - x) * 0.05 * dt;
                y += (hy - y) * 0.05 * dt;
                z += (hz - z) * 0.05 * dt;
                // attracting glimmer — atoms drift toward the orb and shimmer
                x += (0 - x) * pull * dt;
                y += (0 - y) * pull * dt;
                z += (0 - z) * pull * dt;
                // orbital shimmer
                x += Math.sin(time * 1.4 + ph) * 0.012 * dt * 60 * churn;
                y += Math.cos(time * 1.1 + ph * 1.3) * 0.012 * dt * 60 * churn;
                z += Math.sin(time * 1.8 + ph * 0.7) * 0.008 * dt * 60 * churn;
                // pointer attraction (gathering thoughts)
                if (attract > 0) {
                    x += (swirl.x - x) * attract * dt;
                    y += (swirl.y - y) * attract * dt;
                    z += (0 - z) * attract * dt * 0.3;
                }

                arr[i3] = x;
                arr[i3 + 1] = y;
                arr[i3 + 2] = z;
            }
            posAttr.needsUpdate = true;

            points.rotation.y += dt * 0.02;
            renderer.render(scene, camera);
        };
        animate(performance.now());

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('resize', resize);
            observer.disconnect();
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        };
    }, []);

    return <div ref={mountRef} className="absolute inset-0 z-0" aria-hidden="true" />;
}
