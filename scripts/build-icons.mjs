// Renders the PNG app icons in public/icons/ from the favicon's dumbbell mark.
// The favicon flips colours with prefers-color-scheme; PNGs cannot, so these
// use the light-theme pair. Run with `node scripts/build-icons.mjs`.
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = new URL('../public/icons/', import.meta.url);

// rx 7 matches the favicon tile. Maskable and Apple icons are full-bleed
// squares because the platform applies its own mask.
function svg(rx) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${rx}" fill="#171717" />
  <path d="M8 12v8M11 9.5v13M21 9.5v13M24 12v8M11 16h10" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" fill="none" />
</svg>`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, rx: 7 },
  { file: 'icon-512.png', size: 512, rx: 7 },
  { file: 'icon-maskable-512.png', size: 512, rx: 0 },
  { file: 'apple-touch-icon.png', size: 180, rx: 0 },
];

await mkdir(OUT, { recursive: true });
for (const { file, size, rx } of ICONS) {
  await sharp(Buffer.from(svg(rx)), { density: (72 * size) / 32 })
    .resize(size, size)
    .png()
    .toFile(new URL(file, OUT).pathname);
  console.log(`public/icons/${file}`);
}
