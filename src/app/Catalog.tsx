import { useEffect, useMemo, useState } from 'preact/hooks';
import { addCatalogExercise, catalogImage, loadCatalog, mediaCaption, type CatalogEntry } from '../lib/catalog';
import { must, supabase } from '../lib/supabase';
import { Card, Empty, ErrorNote, Loading, Page, ZoomImage } from './ui';

const PAGE_SIZE = 30;

type Target = { id: string; name: string };

type Data = {
  catalog: CatalogEntry[];
  /** Catalog id → the user's copy of that exercise. */
  owned: Map<string, string>;
  /** The workout being added to, if the picker was opened from one. */
  workout: Target | null;
  inWorkout: Set<string>;
  nextPosition: number;
};

async function load(workoutId: string | null): Promise<Data> {
  const [catalog, mine, workout] = await Promise.all([
    loadCatalog(),
    supabase.from('exercises').select('id,catalog_id').not('catalog_id', 'is', null).then(must),
    workoutId ? supabase.from('workouts').select('id,name,workout_exercises(exercise_id,alt_exercise_id,position)').eq('id', workoutId).single().then(must) : null,
  ]);
  const items: { exercise_id: string; alt_exercise_id: string | null; position: number }[] = workout?.workout_exercises ?? [];
  return {
    catalog,
    owned: new Map(mine.map((e: { id: string; catalog_id: string }) => [e.catalog_id, e.id])),
    workout: workout && { id: workout.id, name: workout.name },
    inWorkout: new Set(items.map((i) => i.exercise_id)),
    nextPosition: items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0,
  };
}

const distinct = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))].sort();

/** Browse the full exercise catalog and copy entries into the library, or straight into a workout. */
export function CatalogPicker({ workoutId }: { workoutId: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    load(workoutId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const muscles = useMemo(() => distinct(data?.catalog.map((e) => e.muscle) ?? []), [data?.catalog]);
  const equipments = useMemo(() => distinct(data?.catalog.map((e) => e.equipment) ?? []), [data?.catalog]);
  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (data?.catalog ?? []).filter(
      (e) => (!muscle || e.muscle === muscle) && (!equipment || e.equipment === equipment) && words.every((w) => e.name.toLowerCase().includes(w)),
    );
  }, [data?.catalog, query, muscle, equipment]);

  const back = workoutId ? `?workout=${workoutId}` : '/app/workouts/';
  const backLink = <a href={back} class="btn btn-sm btn-quiet -ml-2.5 self-start">‹ {data?.workout ? data.workout.name : 'Workouts'}</a>;

  if (!data) return <Page title="Exercise catalog">{backLink}{error ? <ErrorNote error={error} /> : <Loading />}</Page>;
  const { workout } = data;

  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setShown(PAGE_SIZE);
  };

  const add = async (entry: CatalogEntry) => {
    setBusy(entry.id);
    setError(null);
    try {
      const exerciseId = data.owned.get(entry.id) ?? (await addCatalogExercise(entry));
      const next: Data = { ...data, owned: new Map(data.owned).set(entry.id, exerciseId) };
      if (workout && !data.inWorkout.has(exerciseId)) {
        must(await supabase.from('workout_exercises').insert({ workout_id: workout.id, exercise_id: exerciseId, position: data.nextPosition }));
        next.inWorkout = new Set(data.inWorkout).add(exerciseId);
        next.nextPosition = data.nextPosition + 1;
      }
      setData(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page title="Exercise catalog" eyebrow={workout ? `Adding to ${workout.name}` : 'Add to your library'}>
      {backLink}
      <ErrorNote error={error} />

      <Card>
        <div class="grid gap-2 sm:grid-cols-[1fr_11rem_11rem]">
          <input class="input" type="search" aria-label="Search exercises" placeholder="Search, e.g. incline press" value={query} onInput={(e) => filter(setQuery)(e.currentTarget.value)} />
          <select class="input" aria-label="Muscle" value={muscle} onChange={(e) => filter(setMuscle)(e.currentTarget.value)}>
            <option value="">All muscles</option>
            {muscles.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select class="input" aria-label="Equipment" value={equipment} onChange={(e) => filter(setEquipment)(e.currentTarget.value)}>
            <option value="">All equipment</option>
            {equipments.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <p class="num mt-3 text-xs text-mute" role="status">{matches.length} of {data.catalog.length} exercises</p>

        {matches.length === 0 && <Empty>Nothing matches. Try fewer words or clear a filter.</Empty>}
        <ul class="mt-1 divide-y divide-hairline">
          {matches.slice(0, shown).map((entry) => {
            const exerciseId = data.owned.get(entry.id);
            const done = workout ? !!exerciseId && data.inWorkout.has(exerciseId) : !!exerciseId;
            const expanded = open === entry.id;
            return (
              <li key={entry.id}>
                <div class="flex items-center gap-3 py-2.5">
                  <button type="button" class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : entry.id)}>
                    <span class="aspect-[3/2] w-16 shrink-0 overflow-hidden rounded-md border border-hairline bg-canvas">
                      {entry.images > 0 && <img src={catalogImage(entry.id, 0)} alt="" loading="lazy" class="h-full w-full object-cover" />}
                    </span>
                    <span class="min-w-0">
                      <span class="line-clamp-2 text-sm leading-5 font-medium text-ink">{entry.name}</span>
                      <span class="block truncate text-xs text-mute">{[entry.muscle, entry.equipment, entry.level].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                  <button type="button" class={done ? 'btn btn-sm min-w-16 shrink-0 text-good' : 'btn btn-sm btn-primary min-w-16 shrink-0'} disabled={done || busy !== null} onClick={() => add(entry)}>
                    {busy === entry.id ? 'Adding…' : done ? (workout ? 'In workout' : 'Added') : 'Add'}
                  </button>
                </div>
                {expanded && (
                  <div class="pb-4">
                    {entry.images > 0 && (
                      <div class="grid grid-cols-2 gap-2" data-zoom-group>
                        {Array.from({ length: entry.images }, (_, n) => (
                          <ZoomImage key={n} src={catalogImage(entry.id, n)} alt={`${entry.name}: ${mediaCaption(n).toLowerCase()}`} class="aspect-[3/2] w-full rounded-lg border border-hairline object-cover" />
                        ))}
                      </div>
                    )}
                    {entry.instructions.length > 0 && (
                      <ol class="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6">
                        {entry.instructions.map((step, i) => <li key={i}>{step}</li>)}
                      </ol>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {matches.length > shown && (
          <button type="button" class="btn mt-3 w-full" onClick={() => setShown(shown + PAGE_SIZE)}>Show more</button>
        )}
      </Card>
    </Page>
  );
}
