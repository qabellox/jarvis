/**
 * Generates the JARVIS application icon:
 *  - build/icon.png  (512x512, used by electron-builder as source)
 *  - build/icon.ico  (multi-size PNG-compressed ICO for Windows)
 * Requires `sharp` (already a dependency of the Next.js build).
 * Run: node scripts/make-icon.mjs
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'build');
mkdirSync(outDir, { recursive: true });

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#0d1526"/>
      <stop offset="55%" stop-color="#080d1a"/>
      <stop offset="100%" stop-color="#05070f"/>
    </radialGradient>
    <linearGradient id="orb" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff8a3d"/>
      <stop offset="55%" stop-color="#f0601a"/>
      <stop offset="100%" stop-color="#38b6ff"/>
    </linearGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g opacity="0.55">
    <circle cx="96" cy="96" r="3" fill="#7fd4ff"/>
    <circle cx="420" cy="80" r="3" fill="#ffb06b"/>
    <circle cx="444" cy="330" r="3" fill="#7fd4ff"/>
    <circle cx="70" cy="360" r="3" fill="#ffb06b"/>
    <circle cx="256" cy="56" r="3" fill="#7fd4ff"/>
    <circle cx="130" cy="430" r="3" fill="#ffb06b"/>
  </g>
  <circle cx="256" cy="256" r="152" fill="none" stroke="url(#orb)" stroke-width="4" filter="url(#glow)"/>
  <circle cx="256" cy="256" r="118" fill="none" stroke="url(#orb)" stroke-width="2" opacity="0.7" stroke-dasharray="3 10"/>
  <circle cx="256" cy="256" r="84" fill="url(#orb)" opacity="0.16" filter="url(#glow)"/>
  <circle cx="256" cy="256" r="84" fill="none" stroke="#ffb06b" stroke-width="1.5" opacity="0.5"/>
  <text x="256" y="312" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="200" font-weight="900" fill="#ffffff" filter="url(#glow)">J</text>
</svg>`;

/** Pack PNG buffers into a Windows .ico (PNG-compressed entries, Vista+). */
function packIco(images) {
    const count = images.length;
    const entrySize = 16;
    const headerSize = 6;
    let offset = headerSize + entrySize * count;
    const entries = [];
    const body = [];
    for (const { size, data } of images) {
        const w = size >= 256 ? 0 : size;
        const len = data.length;
        entries.push(
            Buffer.from([
                w,
                w,
                0, 0, // color count + reserved
                1, 0, // planes
                32, 0, // bit count
                len & 0xff, (len >> 8) & 0xff, (len >> 16) & 0xff, (len >> 24) & 0xff,
                offset & 0xff, (offset >> 8) & 0xff, (offset >> 16) & 0xff, (offset >> 24) & 0xff
            ])
        );
        body.push(data);
        offset += len;
    }
    const header = Buffer.alloc(headerSize);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type = icon
    header.writeUInt16LE(count, 4);
    return Buffer.concat([header, ...entries, ...body]);
}

const png512 = await sharp(Buffer.from(SVG)).resize(512, 512).png().toBuffer();
await sharp(png512).png().toFile(join(outDir, 'icon.png'));

const sizes = [256, 128, 64, 48, 32, 24, 16];
const images = [];
for (const size of sizes) {
    images.push({ size, data: await sharp(png512).resize(size, size).png().toBuffer() });
}
writeFileSync(join(outDir, 'icon.ico'), packIco(images));

console.log('JARVIS icon written to:');
console.log('  ' + join(outDir, 'icon.png'));
console.log('  ' + join(outDir, 'icon.ico') + ' (' + sizes.length + ' sizes)');
