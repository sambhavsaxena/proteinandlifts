// Renders the favicon, header mark, PWA and Apple touch icons and the social
// card from the Trainory logo (scripts/brand/trainory.svg, copied from
// trainory-app's assets/brand: a black arm on a lime tile). The mark is lime in
// both themes, like the mobile app's. Run with `node scripts/build-icons.mjs`.
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const PUBLIC = new URL('../public/', import.meta.url);
const LOGO = await readFile(new URL('brand/trainory.svg', import.meta.url));

// Dark-scheme tokens from src/styles/global.css, like the app's splash screen.
const INK = '#f5f5f5';
const MUTE = '#a9ada6';
const CANVAS = '#111315';
const HAIRLINE = '#2f3337';
const ACCENT = '#c6ff00';

const render = (size) => sharp(LOGO, { density: (72 * size) / 600 }).resize(size, size).png().toBuffer();

/** The lime tile with rounded corners (~22% radius, like the app icon). */
async function tile(size) {
  const r = Math.round(size * 0.22);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" /></svg>`);
  return sharp(await render(size)).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

/** 1200×630 social card: mark and wordmark, headline, and a protein ring. */
async function og() {
  const ring = 2 * Math.PI * 110;
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" font-family="Inter, Helvetica, Arial, sans-serif">
  <rect width="1200" height="630" fill="${CANVAS}" />
  <text x="172" y="129" font-size="34" font-weight="600" letter-spacing="-0.6" fill="${ACCENT}">trainory</text>
  <text x="80" y="330" font-size="76" font-weight="700" letter-spacing="-2" fill="${INK}">Protein tracker and</text>
  <text x="80" y="420" font-size="76" font-weight="700" letter-spacing="-2" fill="${INK}">workout planner</text>
  <text x="80" y="508" font-size="30" fill="${MUTE}">Log protein in one tap. Plan workouts by day. See progress.</text>
  <circle cx="1010" cy="315" r="110" fill="none" stroke="${HAIRLINE}" stroke-width="22" />
  <circle cx="1010" cy="315" r="110" fill="none" stroke="${ACCENT}" stroke-width="22" stroke-linecap="round"
    stroke-dasharray="${ring}" stroke-dashoffset="${ring * 0.3}" transform="rotate(-90 1010 315)" />
  <text x="1010" y="333" text-anchor="middle" font-size="52" font-weight="700" fill="${INK}">84 g</text>
</svg>`;
  return sharp(Buffer.from(card))
    .composite([{ input: await tile(72), left: 80, top: 80 }])
    .png()
    .toBuffer();
}

// Maskable and Apple icons are full-bleed squares because the platform applies its own mask.
const OUTPUTS = [
  { file: 'favicon.png', build: () => tile(48) },
  { file: 'icons/mark-64.png', build: () => tile(64) },
  { file: 'icons/icon-192.png', build: () => tile(192) },
  { file: 'icons/icon-512.png', build: () => tile(512) },
  { file: 'icons/icon-maskable-512.png', build: () => render(512) },
  { file: 'icons/apple-touch-icon.png', build: () => render(180) },
  { file: 'og.png', build: og },
];

await mkdir(new URL('icons/', PUBLIC), { recursive: true });
for (const { file, build } of OUTPUTS) {
  await sharp(await build()).toFile(new URL(file, PUBLIC).pathname);
  console.log(`public/${file}`);
}
