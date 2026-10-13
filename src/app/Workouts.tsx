import { useEffect, useState } from 'preact/hooks';
import { WEEKDAYS_LONG } from '../lib/dates';
import { deleteMedia, mediaUrls, uploadMedia } from '../lib/media';
import { must, supabase } from '../lib/supabase';
import type { Exercise, ExerciseMedia, MediaKind, ScheduleRow, Workout, WorkoutExercise } from '../lib/types';
import { CatalogPicker } from './Catalog';
import { Gate, type Ctx } from './Gate';
import { Card, ConfirmButton, Empty, ErrorNote, Field, IconButton, Loading, NumberInput, Page, param, Segmented } from './ui';

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

const BackLink = () => (
  <a href="/app/workouts/" class="btn btn-sm btn-quiet -ml-2.5 self-start">‹ Workouts</a>
);

/** Shared error plumbing for the three views. */
function useRun() {
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => {
    setError(null);
    fn().catch((e) => setError(e.message));
  };
  return [error, run] as const;
}

// ---------------------------------------------------------------- overview

type OverviewData = { workouts: Workout[]; exercises: Exercise[]; schedule: ScheduleRow[]; thumbs: Record<string, string> };

function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, run] = useRun();

  useEffect(() => {
    run(async () => {
      const [workouts, exercises, schedule] = (await Promise.all([
        supabase.from('workouts').select('*,workout_exercises(*)').order('position').then(must),
        supabase.from('exercises').select('*,exercise_media(*)').order('name').then(must),
        supabase.from('schedule').select('weekday,workout_id').then(must),
      ])) as [Workout[], Exercise[], ScheduleRow[]];
      const covers = exercises.flatMap((e) => [...(e.exercise_media ?? [])].sort(byPosition).slice(0, 1));
      const urls = await mediaUrls(covers);
      const thumbs = Object.fromEntries(covers.map((m) => [m.exercise_id, urls[m.id]]));
      setData({ workouts, exercises, schedule, thumbs });
    });
  }, []);

  if (!data) return <Page title="Workouts">{error ? <ErrorNote error={error} /> : <Loading />}</Page>;
  const { workouts, exercises, schedule, thumbs } = data;
  const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));

  const assign = (weekday: number, workoutId: string) =>
    run(async () => {
      if (workoutId) must(await supabase.from('schedule').upsert({ weekday, workout_id: workoutId }, { onConflict: 'user_id,weekday' }));
      else must(await supabase.from('schedule').delete().eq('weekday', weekday));
      const rest = schedule.filter((s) => s.weekday !== weekday);
      setData({ ...data, schedule: workoutId ? [...rest, { weekday, workout_id: workoutId }] : rest });
    });

  const create = (table: 'workouts' | 'exercises', key: 'workout' | 'exercise', row: object) =>
    run(async () => {
      const created = must(await supabase.from(table).insert(row).select('id').single());
      location.assign(`?${key}=${created.id}`);
    });

  return (
    <Page title="Workouts">
      <ErrorNote error={error} />
      <Card title="Your week">
        <div class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {WEEKDAYS_LONG.map((day, weekday) => (
            <label key={day} class="flex items-center gap-3">
              <span class="w-24 shrink-0 text-sm text-ink">{day}</span>
              <select class="input" value={schedule.find((s) => s.weekday === weekday)?.workout_id ?? ''} onChange={(e) => assign(weekday, e.currentTarget.value)}>
                <option value="">Rest</option>
                {workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Workouts" action={<button type="button" class="btn btn-sm" onClick={() => create('workouts', 'workout', { name: 'New workout', position: workouts.length })}>New workout</button>}>
        {workouts.length === 0 && <Empty>No workouts yet. Create one, then link it to a day above.</Empty>}
        <ul class="divide-y divide-hairline">
          {workouts.map((w) => (
            <li key={w.id}>
              <a href={`?workout=${w.id}`} class="flex items-center gap-3 py-3 no-underline">
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-ink">{w.name}</p>
                  <p class="truncate text-sm text-mute">
                    {[...(w.workout_exercises ?? [])].sort(byPosition).map((x) => exerciseName.get(x.exercise_id)).join(' · ') || 'No exercises yet'}
                  </p>
                </div>
                <span class="text-mute" aria-hidden="true">›</span>
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Exercise library"
        action={
          <div class="flex gap-2">
            <a class="btn btn-sm" href="?catalog=1">Browse catalog</a>
            <button type="button" class="btn btn-sm" onClick={() => create('exercises', 'exercise', { name: 'New exercise' })}>New exercise</button>
          </div>
        }
      >
        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {exercises.map((e) => (
            <li key={e.id}>
              <a href={`?exercise=${e.id}`} class="group block no-underline">
                <div class="aspect-[3/2] overflow-hidden rounded-lg border border-hairline bg-canvas">
                  {thumbs[e.id] && <img src={thumbs[e.id]} alt="" loading="lazy" class="h-full w-full object-cover transition-opacity group-hover:opacity-85" />}
                </div>
                <p class="mt-1.5 truncate text-sm font-medium text-ink">{e.name}</p>
                <p class="truncate text-xs text-mute">{[e.muscle_group, e.equipment].filter(Boolean).join(' · ')}</p>
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  );
}

// ---------------------------------------------------------- workout editor

function WorkoutEditor({ id }: { id: string }) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [items, setItems] = useState<WorkoutExercise[]>([]);
  const [exercises, setExercises] = useState<Pick<Exercise, 'id' | 'name'>[]>([]);
  const [adding, setAdding] = useState('');
  const [error, run] = useRun();

  useEffect(() => {
    run(async () => {
      const [w, ex] = await Promise.all([
        supabase.from('workouts').select('*,workout_exercises(*)').eq('id', id).single().then(must),
        supabase.from('exercises').select('id,name').order('name').then(must),
      ]);
      setWorkout(w as Workout);
      setItems([...(w as Workout).workout_exercises!].sort(byPosition));
      setExercises(ex as Exercise[]);
    });
  }, []);

  if (!workout) return <Page title="Workout"><BackLink />{error ? <ErrorNote error={error} /> : <Loading />}</Page>;
  const nameOf = (exerciseId: string) => exercises.find((e) => e.id === exerciseId)?.name ?? 'Exercise';

  const patchWorkout = (patch: Partial<Workout>) =>
    run(async () => {
      must(await supabase.from('workouts').update(patch).eq('id', id));
      setWorkout({ ...workout, ...patch });
    });

  const patchItem = (itemId: string, patch: Partial<WorkoutExercise>) =>
    run(async () => {
      must(await supabase.from('workout_exercises').update(patch).eq('id', itemId));
      setItems(items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
    });

  const move = (index: number, by: -1 | 1) =>
    run(async () => {
      const next = [...items];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      const renumbered = next.map((item, position) => ({ ...item, position }));
      await Promise.all(
        renumbered.filter((item, i) => item.position !== next[i].position).map((item) => supabase.from('workout_exercises').update({ position: item.position }).eq('id', item.id).then(must)),
      );
      setItems(renumbered);
    });

  const add = () =>
    run(async () => {
      const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
      const created = must(await supabase.from('workout_exercises').insert({ workout_id: id, exercise_id: adding, position }).select().single());
      setItems([...items, created as WorkoutExercise]);
      setAdding('');
    });

  const remove = (itemId: string) =>
    run(async () => {
      must(await supabase.from('workout_exercises').delete().eq('id', itemId));
      setItems(items.filter((i) => i.id !== itemId));
    });

  const destroy = () =>
    run(async () => {
      must(await supabase.from('workouts').delete().eq('id', id));
      location.assign('/app/workouts/');
    });

  return (
    <Page title={workout.name} eyebrow="Workout">
      <BackLink />
      <ErrorNote error={error} />
      <Card>
        <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field label="Name">
            <input class="input" value={workout.name} onChange={(e) => e.currentTarget.value.trim() && patchWorkout({ name: e.currentTarget.value.trim() })} />
          </Field>
          <Field label="Rest between sets (seconds)">
            <NumberInput label="Rest between sets in seconds" value={workout.rest_seconds} step={5} onCommit={(n) => patchWorkout({ rest_seconds: Math.round(n) })} />
          </Field>
          <Field label="Notes" class="sm:col-span-2">
            <textarea class="input" rows={2} value={workout.notes ?? ''} onChange={(e) => patchWorkout({ notes: e.currentTarget.value.trim() || null })} />
          </Field>
        </div>
      </Card>

      <Card title="Exercises">
        {items.length === 0 && <Empty>Add the first exercise below.</Empty>}
        <ul class="divide-y divide-hairline">
          {items.map((item, index) => (
            <li key={item.id} class="py-3">
              <div class="flex items-center gap-1">
                <a href={`?exercise=${item.exercise_id}`} class="min-w-0 flex-1 truncate font-medium text-ink">{nameOf(item.exercise_id)}</a>
                <IconButton label="Move up" onClick={() => move(index, -1)} disabled={index === 0}>↑</IconButton>
                <IconButton label="Move down" onClick={() => move(index, 1)} disabled={index === items.length - 1}>↓</IconButton>
                <IconButton label={`Remove ${nameOf(item.exercise_id)}`} onClick={() => remove(item.id)}>×</IconButton>
              </div>
              <div class="mt-2 flex flex-wrap items-end gap-3">
                <label>
                  <span class="label">Sets</span>
                  <NumberInput label="Sets" class="w-16" min={1} step={1} value={item.target_sets} onCommit={(n) => patchItem(item.id, { target_sets: Math.round(n) })} />
                </label>
                <div>
                  <span class="label">Reps</span>
                  <div class="flex items-center gap-1.5">
                    <NumberInput label="Minimum reps" class="w-16" min={1} step={1} value={item.rep_min} onCommit={(n) => patchItem(item.id, { rep_min: Math.round(n) })} />
                    <span class="text-mute">–</span>
                    <NumberInput label="Maximum reps" class="w-16" min={1} step={1} value={item.rep_max} onCommit={(n) => patchItem(item.id, { rep_max: Math.round(n) })} />
                  </div>
                </div>
                <label class="min-w-40 flex-1">
                  <span class="label">Alternate</span>
                  <select class="input" value={item.alt_exercise_id ?? ''} onChange={(e) => patchItem(item.id, { alt_exercise_id: e.currentTarget.value || null })}>
                    <option value="">None</option>
                    {exercises.filter((e) => e.id !== item.exercise_id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
        <div class="mt-3 flex gap-2 border-t border-hairline pt-4">
          <select class="input" aria-label="Exercise to add" value={adding} onChange={(e) => setAdding(e.currentTarget.value)}>
            <option value="">Add an exercise…</option>
            {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button type="button" class="btn" disabled={!adding} onClick={add}>Add</button>
        </div>
        <a class="mt-3 inline-block text-sm text-link" href={`?catalog=1&workout=${id}`}>Or pick from the full exercise catalog</a>
      </Card>

      <ConfirmButton class="self-start" label="Delete workout" onConfirm={destroy} />
    </Page>
  );
}

// --------------------------------------------------------- exercise editor

const KINDS: { value: MediaKind; label: string }[] = [
  { value: 'step', label: 'Step photo' },
  { value: 'machine', label: 'Machine photo' },
];

function ExerciseEditor({ id, userId }: { id: string; userId: string }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [media, setMedia] = useState<ExerciseMedia[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<MediaKind>('step');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, run] = useRun();

  const showMedia = async (list: ExerciseMedia[]) => {
    const sorted = [...list].sort(byPosition);
    setUrls(await mediaUrls(sorted));
    setMedia(sorted);
  };

  useEffect(() => {
    run(async () => {
      const e = must(await supabase.from('exercises').select('*,exercise_media(*)').eq('id', id).single()) as Exercise;
      setExercise(e);
      await showMedia(e.exercise_media ?? []);
    });
  }, []);

  if (!exercise) return <Page title="Exercise"><BackLink />{error ? <ErrorNote error={error} /> : <Loading />}</Page>;
  const nextPosition = () => (media.length ? Math.max(...media.map((m) => m.position)) + 1 : 0);

  const patch = (change: Partial<Exercise>) =>
    run(async () => {
      must(await supabase.from('exercises').update(change).eq('id', id));
      setExercise({ ...exercise, ...change });
    });

  const patchMedia = (m: ExerciseMedia, change: Partial<ExerciseMedia>) =>
    run(async () => {
      must(await supabase.from('exercise_media').update(change).eq('id', m.id));
      setMedia(media.map((x) => (x.id === m.id ? { ...x, ...change } : x)));
    });

  const upload = (files: FileList | null) =>
    run(async () => {
      if (!files?.length) return;
      setBusy(true);
      try {
        const added: ExerciseMedia[] = [];
        for (const file of Array.from(files)) added.push(await uploadMedia(userId, id, kind, file, nextPosition() + added.length));
        await showMedia([...media, ...added]);
      } finally {
        setBusy(false);
      }
    });

  const addLink = (e: Event) => {
    e.preventDefault();
    run(async () => {
      const created = must(await supabase.from('exercise_media').insert({ exercise_id: id, kind, url: link.trim(), position: nextPosition() }).select().single());
      setLink('');
      await showMedia([...media, created as ExerciseMedia]);
    });
  };

  const removeMedia = (m: ExerciseMedia) =>
    run(async () => {
      await deleteMedia(m);
      setMedia(media.filter((x) => x.id !== m.id));
    });

  const destroy = () =>
    run(async () => {
      for (const m of media) await deleteMedia(m);
      must(await supabase.from('exercises').delete().eq('id', id));
      location.assign('/app/workouts/');
    });

  const text = (key: 'name' | 'muscle_group' | 'equipment', required = false) => ({
    class: 'input',
    value: exercise[key] ?? '',
    onChange: (e: Event) => {
      const value = (e.currentTarget as HTMLInputElement).value.trim();
      if (value || !required) patch({ [key]: value || null });
    },
  });

  return (
    <Page title={exercise.name} eyebrow="Exercise">
      <BackLink />
      <ErrorNote error={error} />
      <Card>
        <div class="grid gap-4 sm:grid-cols-2">
          <Field label="Name" class="sm:col-span-2"><input {...text('name', true)} /></Field>
          <Field label="Muscle group"><input {...text('muscle_group')} /></Field>
          <Field label="Machine or equipment"><input {...text('equipment')} /></Field>
          <Field label="Steps" hint="One step per line." class="sm:col-span-2">
            <textarea class="input" rows={6} value={exercise.instructions ?? ''} onChange={(e) => patch({ instructions: e.currentTarget.value.trim() || null })} />
          </Field>
        </div>
      </Card>

      <Card title="Photos">
        {media.length === 0 && <Empty>No photos yet. Add step-by-step shots, or a picture of the machine so you can find it on the gym floor.</Empty>}
        <ul class="grid gap-4 sm:grid-cols-2">
          {media.map((m) => (
            <li key={m.id} class="flex flex-col gap-2">
              <div class="aspect-[3/2] overflow-hidden rounded-lg border border-hairline bg-canvas">
                {urls[m.id] && <img src={urls[m.id]} alt={m.caption ?? `${exercise.name} photo`} loading="lazy" class="h-full w-full object-cover" />}
              </div>
              <input class="input" aria-label="Caption" placeholder="Caption" value={m.caption ?? ''} onChange={(e) => patchMedia(m, { caption: e.currentTarget.value.trim() || null })} />
              <div class="flex items-center justify-between gap-2">
                <select class="input w-44" aria-label="Photo type" value={m.kind} onChange={(e) => patchMedia(m, { kind: e.currentTarget.value as MediaKind })}>
                  {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <ConfirmButton label="Remove" confirm="Confirm" onConfirm={() => removeMedia(m)} />
              </div>
            </li>
          ))}
        </ul>
        <div class="mt-4 flex flex-col gap-3 border-t border-hairline pt-4">
          <Segmented<MediaKind> label="Type of photo to add" options={KINDS} value={kind} onChange={setKind} />
          <label class="btn self-start">
            {busy ? 'Uploading…' : 'Upload photos'}
            <input type="file" accept="image/*" multiple class="sr-only" disabled={busy} onChange={(e) => { upload(e.currentTarget.files); e.currentTarget.value = ''; }} />
          </label>
          <form onSubmit={addLink} class="flex gap-2">
            <input class="input" type="url" required aria-label="Image link" placeholder="…or paste an image link" value={link} onInput={(e) => setLink(e.currentTarget.value)} />
            <button type="submit" class="btn" disabled={!link.trim()}>Add</button>
          </form>
        </div>
      </Card>

      <ConfirmButton class="self-start" label="Delete exercise" onConfirm={destroy} />
    </Page>
  );
}

function WorkoutsScreen({ userId }: Ctx) {
  const workoutId = param('workout');
  const exerciseId = param('exercise');
  if (param('catalog')) return <CatalogPicker workoutId={workoutId} />;
  if (workoutId) return <WorkoutEditor id={workoutId} />;
  if (exerciseId) return <ExerciseEditor id={exerciseId} userId={userId} />;
  return <Overview />;
}

export default function Workouts() {
  return <Gate>{(ctx) => <WorkoutsScreen {...ctx} />}</Gate>;
}
