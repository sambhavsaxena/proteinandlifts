// Rebuilds the exercise catalog from a local clone of
// https://github.com/yuhonas/free-exercise-db (public domain).
//
//   node scripts/build-exercise-catalog.mjs <path-to-clone>
//
// Writes:
//   public/exercise-catalog.json     every exercise, for the in-app picker
//   public/exercises/<id>/<n>.jpg    its photos, downscaled
//   src/data/starter-exercises.json  the subset the starter plans are built from

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = process.argv[2];
if (!source || !existsSync(join(source, 'dist/exercises.json'))) {
  console.error('usage: node scripts/build-exercise-catalog.mjs <path-to-free-exercise-db-clone>');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imageDir = join(root, 'public/exercises');
const MAX_WIDTH = 640;
const QUALITY = 72;

const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : null);
const all = JSON.parse(readFileSync(join(source, 'dist/exercises.json'), 'utf8'));

rmSync(imageDir, { recursive: true, force: true });

const catalog = [];
let bytes = 0;
for (const e of all) {
  let images = 0;
  for (const path of e.images) {
    const from = join(source, 'exercises', path);
    if (!existsSync(from)) continue;
    const to = join(imageDir, e.id, `${images}.jpg`);
    mkdirSync(dirname(to), { recursive: true });
    const info = await sharp(from).resize({ width: MAX_WIDTH, withoutEnlargement: true }).jpeg({ quality: QUALITY, mozjpeg: true }).toFile(to);
    bytes += info.size;
    images += 1;
  }
  catalog.push({
    id: e.id,
    name: e.name,
    muscle: capitalise(e.primaryMuscles[0] ?? null),
    equipment: capitalise(e.equipment),
    category: capitalise(e.category),
    level: capitalise(e.level),
    instructions: e.instructions,
    images,
  });
}
catalog.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(root, 'public/exercise-catalog.json'), JSON.stringify(catalog));

const keys = JSON.parse(readFileSync(join(root, 'src/data/starter-exercise-keys.json'), 'utf8'));
const starter = {};
for (const [key, { id, name }] of Object.entries(keys)) {
  const e = catalog.find((x) => x.id === id);
  if (!e) throw new Error(`starter exercise "${key}" points at unknown catalog id "${id}"`);
  starter[key] = {
    catalog_id: e.id,
    name,
    muscle_group: e.muscle,
    equipment: e.equipment,
    instructions: e.instructions.join('\n'),
    images: Array.from({ length: e.images }, (_, i) => `/exercises/${e.id}/${i}.jpg`),
  };
}
writeFileSync(join(root, 'src/data/starter-exercises.json'), JSON.stringify(starter, null, 2) + '\n');

console.log(`${catalog.length} exercises, ${catalog.reduce((n, e) => n + e.images, 0)} images (${(bytes / 1e6).toFixed(1)} MB), ${Object.keys(starter).length} starter exercises`);
