import { must, supabase } from './supabase';

/** One entry of public/exercise-catalog.json (built by scripts/build-exercise-catalog.mjs). */
export type CatalogEntry = {
  id: string;
  name: string;
  muscle: string | null;
  equipment: string | null;
  category: string | null;
  level: string | null;
  instructions: string[];
  /** Number of photos, served at /exercises/<id>/<n>.jpg */
  images: number;
};

export const catalogImage = (id: string, n: number) => `/exercises/${id}/${n}.jpg`;

export const mediaCaption = (position: number) => (position === 0 ? 'Start position' : 'End position');

let cached: Promise<CatalogEntry[]> | null = null;

/** The full catalog. Fetched once per page, and only when something asks for it. */
export function loadCatalog(): Promise<CatalogEntry[]> {
  cached ??= fetch('/exercise-catalog.json').then((r) => {
    if (!r.ok) throw new Error('Could not load the exercise catalog.');
    return r.json();
  });
  return cached;
}

/** Copies a catalog exercise, with its photos and steps, into the user's library. */
export async function addCatalogExercise(entry: CatalogEntry): Promise<string> {
  const created = must(
    await supabase
      .from('exercises')
      .insert({ name: entry.name, muscle_group: entry.muscle, equipment: entry.equipment, instructions: entry.instructions.join('\n'), catalog_id: entry.id })
      .select('id')
      .single(),
  );
  if (entry.images) {
    must(
      await supabase.from('exercise_media').insert(
        Array.from({ length: entry.images }, (_, position) => ({
          exercise_id: created.id,
          kind: 'step',
          url: catalogImage(entry.id, position),
          caption: mediaCaption(position),
          position,
        })),
      ),
    );
  }
  return created.id;
}
